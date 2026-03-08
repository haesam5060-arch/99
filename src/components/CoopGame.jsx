import { useState, useEffect, useRef, useCallback } from 'react';
import { generateChoices } from '../utils/questions';
import { calculateScore, WRONG_PENALTY } from '../utils/scoring';
import { playCorrect, playWrong, playExplosion, playStageStart, playStageClear, playGameComplete, startBGM, stopBGM } from '../utils/sound';
import { PLANET_SPRITES, EARTH_SPRITE, getRandomSkill, CHARACTER_PALETTES } from '../data/characters';
import { broadcastGame, leaveRoom } from '../utils/realtime';
import PixelCharacter from './PixelCharacter';

const COOP_FALL_DURATION = 15;
const QUESTIONS_PER_PLANET = 4;
const SCORE_MULTIPLIER = 2;

export default function CoopGame({ coopData, player, nickname, onEnd }) {
  const { isHost, roomChannel, lobbyChannel, players: initialPlayers } = coopData;

  const [currentDan, setCurrentDan] = useState(2);
  const [allQuestions, setAllQuestions] = useState([]); // each: { a, b, answer, choices }
  const [questionIndex, setQuestionIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState(-1);
  const [planetY, setPlanetY] = useState(0);
  const [planetStartTime, setPlanetStartTime] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [gamePhase, setGamePhase] = useState('ready');
  const [shake, setShake] = useState(false);
  const [flashColor, setFlashColor] = useState(null);
  const [currentPlanet, setCurrentPlanet] = useState(0);
  const [particles, setParticles] = useState([]);
  const [contributions, setContributions] = useState(() => {
    const c = {};
    (initialPlayers || []).forEach((p) => {
      c[p.nickname] = { correctCount: 0, score: 0, equippedCharacter: p.equippedCharacter };
    });
    return c;
  });
  const [totalSessionScore, setTotalSessionScore] = useState(0);
  const [error, setError] = useState(null);
  const [skillName, setSkillName] = useState(null);

  const animRef = useRef(null);
  const subStartTimeRef = useRef(null);
  // Refs for latest state in callbacks
  const stateRef = useRef({
    subIndex: 0, questionIndex: 0, allQuestions: [], currentDan: 2,
    gamePhase: 'ready', totalSessionScore: 0,
  });

  // Sync refs
  useEffect(() => {
    stateRef.current = {
      subIndex, questionIndex, allQuestions, currentDan,
      gamePhase, totalSessionScore,
    };
  });

  // Derived state
  const planetQuestions = allQuestions.slice(
    questionIndex * QUESTIONS_PER_PLANET,
    (questionIndex + 1) * QUESTIONS_PER_PLANET
  );
  const currentQuestion = planetQuestions[subIndex];
  const choices = currentQuestion?.choices || [];

  // Set sub-question start time when question changes
  useEffect(() => {
    if (currentQuestion) {
      subStartTimeRef.current = Date.now();
    }
  }, [currentQuestion]);

  // Generate questions with choices included
  const makeQuestions = useCallback((dan) => {
    const qs = [];
    for (let i = 1; i <= 8; i++) {
      const answer = dan * i;
      const ch = generateChoices(dan, answer);
      // Safety: ensure correct answer is included
      if (!ch.includes(answer)) {
        ch[0] = answer;
        for (let j = ch.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [ch[j], ch[k]] = [ch[k], ch[j]];
        }
      }
      qs.push({ a: dan, b: i, answer, choices: ch });
    }
    // Shuffle question order
    for (let i = qs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [qs[i], qs[j]] = [qs[j], qs[i]];
    }
    return qs;
  }, []);

  // Start a dan (host only generates and broadcasts)
  const startDan = useCallback((dan) => {
    try {
      const qs = makeQuestions(dan);
      const planetIdx = Math.floor(Math.random() * PLANET_SPRITES.length);

      setAllQuestions(qs);
      setQuestionIndex(0);
      setSubIndex(0);
      setGamePhase('ready');
      setCurrentPlanet(planetIdx);
      setFeedback(null);
      setSelectedChoice(-1);
      playStageStart();

      // Update refs immediately
      stateRef.current.allQuestions = qs;
      stateRef.current.questionIndex = 0;
      stateRef.current.subIndex = 0;
      stateRef.current.gamePhase = 'ready';

      setTimeout(() => {
        setGamePhase('playing');
        stateRef.current.gamePhase = 'playing';
        setPlanetStartTime(Date.now());
        setPlanetY(0);
      }, 500);

      // Broadcast to other players
      if (isHost && roomChannel) {
        setTimeout(() => {
          try {
            broadcastGame(roomChannel, {
              type: 'dan-start',
              dan,
              questions: qs,
              planetIndex: planetIdx,
            });
          } catch (e) {
            console.error('broadcast dan-start error:', e);
          }
        }, 200);
      }
    } catch (e) {
      console.error('startDan error:', e);
      setError(`startDan 오류: ${e.message}`);
    }
  }, [isHost, roomChannel, makeQuestions]);

  // Initialize
  useEffect(() => {
    try {
      startBGM('game');
      if (isHost) {
        startDan(2);
      }
    } catch (e) {
      console.error('init error:', e);
      setError(`초기화 오류: ${e.message}`);
    }
    return () => {
      stopBGM();
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Planet fall animation
  useEffect(() => {
    if (gamePhase !== 'playing' || !planetStartTime) return;

    const animate = () => {
      const elapsed = (Date.now() - planetStartTime) / 1000;
      const progress = Math.min(elapsed / COOP_FALL_DURATION, 1);
      setPlanetY(progress);

      if (progress >= 1) {
        const remaining = QUESTIONS_PER_PLANET - stateRef.current.subIndex;
        handlePlanetCrash(remaining);
        return;
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [gamePhase, planetStartTime]);

  // === BROADCAST LISTENER ===
  useEffect(() => {
    if (!roomChannel) return;
    let active = true;

    const handler = ({ payload }) => {
      if (!active || !payload) return;
      try {
        switch (payload.type) {
          case 'dan-start':
            if (!isHost) {
              setCurrentDan(payload.dan);
              setAllQuestions(payload.questions);
              setQuestionIndex(0);
              setSubIndex(0);
              setCurrentPlanet(payload.planetIndex);
              setGamePhase('ready');
              setFeedback(null);
              setSelectedChoice(-1);
              stateRef.current.allQuestions = payload.questions;
              stateRef.current.questionIndex = 0;
              stateRef.current.subIndex = 0;
              stateRef.current.currentDan = payload.dan;
              stateRef.current.gamePhase = 'ready';
              playStageStart();
              setTimeout(() => {
                if (!active) return;
                setGamePhase('playing');
                stateRef.current.gamePhase = 'playing';
                setPlanetStartTime(Date.now());
                setPlanetY(0);
              }, 500);
            }
            break;

          case 'answer-attempt':
            // Host only: process other players' answers
            if (isHost) {
              const s = stateRef.current;
              const pqs = s.allQuestions.slice(
                s.questionIndex * QUESTIONS_PER_PLANET,
                (s.questionIndex + 1) * QUESTIONS_PER_PLANET
              );
              const q = pqs[s.subIndex];
              if (!q || s.gamePhase !== 'playing') return;

              const correct = payload.answer === q.answer;
              const elapsed = subStartTimeRef.current ? (Date.now() - subStartTimeRef.current) / 1000 : 10;
              const score = correct
                ? calculateScore(elapsed) * SCORE_MULTIPLIER
                : WRONG_PENALTY * SCORE_MULTIPLIER;

              broadcastGame(roomChannel, {
                type: 'answer-result',
                nickname: payload.nickname,
                correct,
                score,
              });

              // Process locally for host
              if (active) applyAnswerResult(payload.nickname, correct, score);
            }
            break;

          case 'answer-result':
            // Non-host only (host already processed locally)
            if (!isHost && active) {
              applyAnswerResult(payload.nickname, payload.correct, payload.score);
            }
            break;

          case 'planet-crash':
            if (!isHost && active) {
              setTotalSessionScore((s) => s - payload.penalty);
              setShake(true);
              setFlashColor('rgba(255, 0, 0, 0.3)');
              setFeedback({ type: 'wrong', text: `미해결 ${payload.remaining}개! -${payload.penalty}P`, score: -payload.penalty });
              setTimeout(() => {
                if (!active) return;
                setShake(false);
                setFlashColor(null);
                setFeedback(null);
              }, 1500);
            }
            break;

          case 'next-planet':
            if (!isHost && active) {
              setQuestionIndex(payload.questionIndex);
              setSubIndex(0);
              setCurrentPlanet(Math.floor(Math.random() * PLANET_SPRITES.length));
              setPlanetStartTime(Date.now());
              setPlanetY(0);
              setGamePhase('playing');
              setFeedback(null);
              setSelectedChoice(-1);
              stateRef.current.questionIndex = payload.questionIndex;
              stateRef.current.subIndex = 0;
              stateRef.current.gamePhase = 'playing';
            }
            break;

          case 'stage-clear':
            if (!isHost && active) {
              setGamePhase('stageClear');
              stateRef.current.gamePhase = 'stageClear';
              playStageClear();
            }
            break;

          case 'game-over':
            if (!isHost && active) {
              setGamePhase('gameOver');
              stateRef.current.gamePhase = 'gameOver';
              playGameComplete();
            }
            break;

          case 'next-dan':
            if (!isHost && active) {
              setCurrentDan(payload.dan);
              stateRef.current.currentDan = payload.dan;
            }
            break;
        }
      } catch (e) {
        console.error('broadcast handler error:', e);
      }
    };

    roomChannel.on('broadcast', { event: 'game' }, handler);
    return () => { active = false; };
  }, [roomChannel, isHost]);

  // Apply answer result (shared logic for host + non-host)
  // Score is shared equally by ALL players, contributions only track solve count
  const applyAnswerResult = (answerNick, correct, score) => {
    if (correct) {
      playCorrect();
      setFlashColor('rgba(0, 255, 0, 0.15)');
      setFeedback({ type: 'correct', text: `${answerNick} +${score}`, score, answerNick });

      // 기술명 표시 (정답자의 캐릭터 기반)
      setContributions((prev) => {
        const charId = prev[answerNick]?.equippedCharacter || 0;
        const palette = CHARACTER_PALETTES[charId];
        const skillColor = palette?.colors?.[1] || '#ffd700';
        setSkillName({ text: getRandomSkill(charId), color: skillColor });
        return prev;
      });

      // Track who solved it (contribution count only)
      setContributions((prev) => ({
        ...prev,
        [answerNick]: {
          ...prev[answerNick],
          correctCount: (prev[answerNick]?.correctCount || 0) + 1,
        },
      }));
      // Everyone gets the same score
      setTotalSessionScore((s) => s + score);

      setParticles(Array.from({ length: 8 }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 300,
        color: ['#ff0', '#f80', '#0f0', '#0ff'][Math.floor(Math.random() * 4)],
        delay: Math.random() * 0.3,
      })));

      setTimeout(() => {
        setFeedback(null);
        setFlashColor(null);
        setParticles([]);
        setSelectedChoice(-1);
        setSkillName(null);
        advanceQuestion();
      }, 800);
    } else {
      playWrong();
      setShake(true);
      setFlashColor('rgba(255, 0, 0, 0.15)');
      setFeedback({ type: 'wrong', text: `${answerNick} ${score}`, score });

      // Penalty is also shared by all
      setTotalSessionScore((s) => s + score);

      setTimeout(() => {
        setShake(false);
        setFlashColor(null);
        setFeedback(null);
        setSelectedChoice(-1);
      }, 600);
    }
  };

  // Advance to next sub-question or next planet
  const advanceQuestion = () => {
    const s = stateRef.current;
    const nextSub = s.subIndex + 1;

    if (nextSub >= QUESTIONS_PER_PLANET) {
      playExplosion();
      const nextQIndex = s.questionIndex + 1;
      if (nextQIndex * QUESTIONS_PER_PLANET >= s.allQuestions.length) {
        // Dan complete
        if (isHost) handleDanComplete();
      } else {
        // Next planet
        if (isHost) {
          broadcastGame(roomChannel, { type: 'next-planet', questionIndex: nextQIndex });
        }
        setQuestionIndex(nextQIndex);
        setSubIndex(0);
        setCurrentPlanet(Math.floor(Math.random() * PLANET_SPRITES.length));
        setPlanetStartTime(Date.now());
        setPlanetY(0);
        setFeedback(null);
        setSelectedChoice(-1);
        stateRef.current.questionIndex = nextQIndex;
        stateRef.current.subIndex = 0;
      }
    } else {
      setSubIndex(nextSub);
      stateRef.current.subIndex = nextSub;
    }
  };

  const handlePlanetCrash = (remaining) => {
    const penalty = remaining * Math.abs(WRONG_PENALTY) * SCORE_MULTIPLIER;
    setTotalSessionScore((s) => s - penalty);
    setShake(true);
    setFlashColor('rgba(255, 0, 0, 0.3)');
    setFeedback({ type: 'wrong', text: `미해결 ${remaining}개! -${penalty}P`, score: -penalty });

    if (isHost) {
      broadcastGame(roomChannel, { type: 'planet-crash', remaining, penalty });
    }

    setTimeout(() => {
      setShake(false);
      setFlashColor(null);
      setFeedback(null);

      const s = stateRef.current;
      const nextQIndex = s.questionIndex + 1;
      if (nextQIndex * QUESTIONS_PER_PLANET >= s.allQuestions.length) {
        if (isHost) handleDanComplete();
      } else {
        if (isHost) {
          broadcastGame(roomChannel, { type: 'next-planet', questionIndex: nextQIndex });
        }
        setQuestionIndex(nextQIndex);
        setSubIndex(0);
        setCurrentPlanet(Math.floor(Math.random() * PLANET_SPRITES.length));
        setPlanetStartTime(Date.now());
        setPlanetY(0);
        setGamePhase('playing');
        stateRef.current.questionIndex = nextQIndex;
        stateRef.current.subIndex = 0;
        stateRef.current.gamePhase = 'playing';
      }
    }, 1500);
  };

  const handleDanComplete = () => {
    const nextDan = stateRef.current.currentDan + 1;
    if (nextDan > 9) {
      broadcastGame(roomChannel, { type: 'game-over' });
      setGamePhase('gameOver');
      stateRef.current.gamePhase = 'gameOver';
      playGameComplete();
    } else {
      broadcastGame(roomChannel, { type: 'stage-clear' });
      setGamePhase('stageClear');
      stateRef.current.gamePhase = 'stageClear';
      playStageClear();

      setTimeout(() => {
        setCurrentDan(nextDan);
        stateRef.current.currentDan = nextDan;
        broadcastGame(roomChannel, { type: 'next-dan', dan: nextDan });
        startDan(nextDan);
      }, 3000);
    }
  };

  const handleAnswer = (answer) => {
    if (stateRef.current.gamePhase !== 'playing') return;
    const s = stateRef.current;
    const pqs = s.allQuestions.slice(
      s.questionIndex * QUESTIONS_PER_PLANET,
      (s.questionIndex + 1) * QUESTIONS_PER_PLANET
    );
    const q = pqs[s.subIndex];
    if (!q) return;

    setSelectedChoice(answer);

    if (isHost) {
      // Process locally
      const correct = answer === q.answer;
      const elapsed = subStartTimeRef.current ? (Date.now() - subStartTimeRef.current) / 1000 : 10;
      const score = correct
        ? calculateScore(elapsed) * SCORE_MULTIPLIER
        : WRONG_PENALTY * SCORE_MULTIPLIER;

      broadcastGame(roomChannel, {
        type: 'answer-result',
        nickname,
        correct,
        score,
      });

      applyAnswerResult(nickname, correct, score);
    } else {
      broadcastGame(roomChannel, {
        type: 'answer-attempt',
        nickname,
        answer,
      });
    }
  };

  const handleQuit = () => {
    cancelAnimationFrame(animRef.current);
    stopBGM();
    leaveRoom(roomChannel, lobbyChannel);
    onEnd(stateRef.current.totalSessionScore);
  };

  // Keyboard controls
  useEffect(() => {
    if (gamePhase !== 'playing' || !currentQuestion) return;

    const handleKey = (e) => {
      if (e.key >= '1' && e.key <= '4') {
        const idx = parseInt(e.key) - 1;
        if (choices[idx] !== undefined) handleAnswer(choices[idx]);
      }
      if (e.key === 'Escape') handleQuit();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gamePhase, choices, currentQuestion]);

  // Sorted contributions
  const sortedContributions = Object.entries(contributions)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.correctCount - a.correctCount);

  const planetSprite = PLANET_SPRITES[currentPlanet];

  // === ERROR SCREEN ===
  if (error) {
    return (
      <div className="game-container" style={{ justifyContent: 'center' }}>
        <div style={{ fontSize: 12, color: '#ff4444', marginBottom: 20 }}>오류 발생</div>
        <div style={{ fontSize: 9, color: '#aaa', marginBottom: 20, textAlign: 'center' }}>{error}</div>
        <button className="pixel-btn red" onClick={handleQuit}>나가기</button>
      </div>
    );
  }

  // === STAGE CLEAR ===
  if (gamePhase === 'stageClear') {
    return (
      <div className="game-container" style={{ justifyContent: 'center' }}>
        <div style={{ fontSize: 24, color: '#ffd700', marginBottom: 20, textShadow: '2px 2px 0 #b8860b' }}>
          {currentDan}단 클리어!
        </div>
        <ContributionBoard contributions={sortedContributions} nickname={nickname} totalScore={totalSessionScore} />
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 16 }}>다음 단 준비 중...</div>
      </div>
    );
  }

  // === GAME OVER ===
  if (gamePhase === 'gameOver') {
    return (
      <div className="game-container" style={{ justifyContent: 'center' }}>
        <div style={{ fontSize: 24, color: '#ffd700', marginBottom: 8, textShadow: '2px 2px 0 #b8860b' }}>
          게임 완료!
        </div>
        <div style={{ fontSize: 14, color: '#fff', marginBottom: 20 }}>
          총 점수: <span style={{ color: '#ffd700' }}>{totalSessionScore.toLocaleString()}P</span>
        </div>
        <ContributionBoard contributions={sortedContributions} nickname={nickname} totalScore={totalSessionScore} />
        <button className="pixel-btn gold" onClick={handleQuit} style={{ marginTop: 24 }}>나가기</button>
      </div>
    );
  }

  // === LOADING ===
  if (!currentQuestion) {
    return (
      <div className="game-container" style={{ justifyContent: 'center' }}>
        <div style={{ fontSize: 12, color: '#aaa' }}>
          {isHost ? '게임 준비 중...' : '호스트 대기 중...'}
        </div>
        <button className="pixel-btn red" onClick={handleQuit} style={{ marginTop: 20 }}>나가기</button>
      </div>
    );
  }

  // === PLAYING ===
  return (
    <div className={`game-container ${shake ? 'shake' : ''}`} style={{ justifyContent: 'flex-start', paddingTop: 10 }}>
      {flashColor && <div className="flash-overlay" style={{ background: flashColor }} />}

      <div className="hud">
        <span>{currentDan}단</span>
        <span style={{ fontSize: 10, color: '#aaa' }}>{subIndex + 1}/{QUESTIONS_PER_PLANET}</span>
        <span className="hud-score">{(player.score + totalSessionScore).toLocaleString()} P</span>
      </div>

      <button
        onClick={handleQuit}
        style={{
          position: 'fixed', top: 10, left: 10, zIndex: 1000,
          background: 'rgba(20, 20, 50, 0.8)',
          border: '2px solid #ff4444', color: '#ff4444',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 9, padding: '6px 12px', cursor: 'pointer', borderRadius: 4,
        }}
      >종료</button>

      <div style={{ width: '100%', height: 6, background: '#1a1a4e', marginBottom: 10, border: '1px solid #333366' }}>
        <div style={{
          width: `${(1 - planetY) * 100}%`, height: '100%',
          background: planetY > 0.7 ? 'var(--red)' : planetY > 0.4 ? '#ffa500' : 'var(--green)',
          transition: 'width 0.1s linear',
        }} />
      </div>

      <div style={{
        flex: 1, width: '100%', position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        overflow: 'hidden', minHeight: 300,
      }}>
        <div style={{
          position: 'absolute', top: `${planetY * 55}%`, left: '50%',
          transform: 'translateX(-50%)', textAlign: 'center',
          opacity: feedback?.type === 'correct' && subIndex === QUESTIONS_PER_PLANET - 1 ? 0 : 1,
        }}>
          <div style={{
            width: 120, height: 120, margin: '0 auto 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            {planetY > 0.05 && gamePhase === 'playing' && (
              [0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{
                  position: 'absolute', top: -(14 + i * 16),
                  left: '50%', transform: 'translateX(-50%)',
                  width: Math.max(6, 14 - i * 2), height: Math.max(6, 14 - i * 2),
                  borderRadius: '50%', background: planetSprite?.colors?.[1] || '#888',
                  opacity: 0.5 - i * 0.08, filter: `blur(${i}px)`,
                }} />
              ))
            )}
            <PlanetCanvasBig sprite={planetSprite} size={120} />
          </div>
          <div style={{
            fontSize: 18, fontFamily: "'Press Start 2P', monospace",
            color: '#fff', textShadow: '2px 2px 0 #000', whiteSpace: 'nowrap',
          }}>
            {currentQuestion.a} x {currentQuestion.b} = ?
          </div>
          <div style={{ fontSize: 9, color: '#aaa', marginTop: 4 }}>
            남은 문제: {QUESTIONS_PER_PLANET - subIndex}
          </div>
        </div>

        {particles.map((p) => (
          <div key={p.id} style={{
            position: 'absolute', top: `${planetY * 55}%`,
            left: `calc(50% + ${p.x - 150}px)`,
            width: 8, height: 8, background: p.color,
            animation: `scorePopup 0.8s ease-out ${p.delay}s forwards`, opacity: 0.8,
          }} />
        ))}

        {feedback && (
          <div style={{
            position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
            fontSize: feedback.type === 'correct' ? 20 : 16,
            color: feedback.type === 'correct' ? '#00ff00' : '#ff4444',
            fontFamily: "'Press Start 2P', monospace",
            textShadow: '2px 2px 0 #000', zIndex: 10,
            animation: 'scorePopup 1s ease-out forwards',
          }}>
            {feedback.text}
          </div>
        )}

        {/* Skill name popup */}
        {skillName && (
          <div
            key={Date.now()}
            className="skill-name-popup"
            style={{
              top: '55%',
              left: '50%',
              color: skillName.color,
              textShadow: `2px 2px 0 #000, -1px -1px 0 #000, 0 0 10px ${skillName.color}`,
            }}
          >
            {skillName.text}
          </div>
        )}

        <div style={{
          position: 'absolute', bottom: -120, left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            {Object.entries(contributions).map(([name, data]) => {
              const isAttacking = feedback?.type === 'correct' && feedback?.answerNick === name;
              return (
                <div key={name} style={{ textAlign: 'center' }}>
                  <div style={{
                    transition: 'transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.3)',
                    transform: isAttacking ? 'scale(2) translateY(-12px)' : 'scale(1)',
                    transformOrigin: 'center bottom',
                    zIndex: isAttacking ? 100 : 1,
                    position: 'relative',
                  }}>
                    <PixelCharacter
                      characterId={data.equippedCharacter || 0}
                      frame={isAttacking ? 'attack' : 'idle'}
                      pixelSize={3}
                    />
                  </div>
                  <div style={{ fontSize: 6, color: name === nickname ? '#ffd700' : '#aaa', marginTop: 2 }}>
                    {name}
                  </div>
                </div>
              );
            })}
          </div>
          <EarthCanvas />
        </div>

        <div style={{
          position: 'absolute', top: 8, right: 8,
          fontFamily: "'Press Start 2P', monospace", zIndex: 1,
        }}>
          <div style={{ fontSize: 7, color: '#ffd700', marginBottom: 4 }}>기여도</div>
          {sortedContributions.map((c, i) => (
            <div key={c.name} style={{
              fontSize: 8, padding: '2px 0',
              color: c.name === nickname ? 'rgba(255, 215, 0, 0.7)' : 'rgba(255, 255, 255, 0.3)',
              display: 'flex', gap: 6,
            }}>
              <span style={{ width: 14 }}>{i + 1}</span>
              <span style={{ width: 50, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
              <span>{c.correctCount}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="choices-grid">
        {choices.map((choice, idx) => (
          <button
            key={`${questionIndex}-${subIndex}-${idx}`}
            className={`choice-btn ${selectedChoice === choice ? (choice === currentQuestion?.answer ? 'correct' : 'wrong') : ''}`}
            onClick={() => handleAnswer(choice)}
            disabled={gamePhase !== 'playing'}
          >
            <span className="choice-number">{idx + 1}</span>
            <span className="choice-value">{choice}</span>
          </button>
        ))}
      </div>

      <div style={{
        fontSize: 9, color: '#555', textAlign: 'center', padding: '8px 0',
        fontFamily: "'Press Start 2P', monospace",
      }}>
        1~4 숫자키 | ESC 종료
      </div>
    </div>
  );
}

function ContributionBoard({ contributions, nickname, totalScore }) {
  return (
    <div style={{
      background: '#141450', border: '3px solid #333366',
      padding: 16, width: '100%', maxWidth: 320,
    }}>
      <div style={{ fontSize: 11, color: '#ffd700', marginBottom: 10, textAlign: 'center' }}>기여도</div>
      {totalScore !== undefined && (
        <div style={{ fontSize: 10, color: '#aaa', marginBottom: 10, textAlign: 'center' }}>
          전원 획득: <span style={{ color: '#ffd700' }}>{totalScore.toLocaleString()}P</span>
        </div>
      )}
      {contributions.map((c, i) => (
        <div key={c.name} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 8px', fontSize: 11,
          color: c.name === nickname ? '#ffd700' : '#fff',
          background: c.name === nickname ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
        }}>
          <span style={{
            color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#888',
            width: 24,
          }}>{i + 1}위</span>
          <span style={{ flex: 1 }}>{c.name}</span>
          <span style={{ color: '#aaa' }}>{c.correctCount}문제</span>
        </div>
      ))}
    </div>
  );
}

function PlanetCanvasBig({ sprite, size }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!sprite || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pixelSize = size / 8;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    sprite.sprite.forEach((row, ry) => {
      row.forEach((cell, rx) => {
        if (cell !== 0 && sprite.colors[cell]) {
          ctx.fillStyle = sprite.colors[cell];
          ctx.fillRect(rx * pixelSize, ry * pixelSize, pixelSize, pixelSize);
        }
      });
    });
  }, [sprite, size]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ imageRendering: 'pixelated' }} />;
}

function EarthCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pixelSize = 20;
    canvas.width = 24 * pixelSize;
    canvas.height = 12 * pixelSize;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    EARTH_SPRITE.sprite.forEach((row, ry) => {
      row.forEach((cell, rx) => {
        if (cell !== 0 && EARTH_SPRITE.colors[cell]) {
          ctx.fillStyle = EARTH_SPRITE.colors[cell];
          ctx.fillRect(rx * pixelSize, ry * pixelSize, pixelSize, pixelSize);
        }
      });
    });
  }, []);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas ref={canvasRef} width={480} height={240} style={{ imageRendering: 'pixelated' }} />
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        fontFamily: "'Press Start 2P', monospace", fontSize: 52,
        color: 'rgba(255, 255, 255, 0.4)', pointerEvents: 'none', userSelect: 'none',
        letterSpacing: 14, textShadow: '0 0 12px rgba(100, 200, 255, 0.3)',
      }}>
        지구
      </div>
    </div>
  );
}
