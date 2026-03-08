import { useState, useEffect, useRef } from 'react';
import { calculateScore, WRONG_PENALTY } from '../utils/scoring';
import { playCorrect, playWrong, playExplosion, playStageStart, playStageClear, playGameComplete, startBGM, stopBGM } from '../utils/sound';
import { PLANET_SPRITES, EARTH_SPRITE, getRandomSkill, CHARACTER_PALETTES } from '../data/characters';
import { broadcastGame, leaveRoom } from '../utils/realtime';
import PixelCharacter from './PixelCharacter';

const COOP_FALL_DURATION = 15;
const QUESTIONS_PER_PLANET = 4;
const SCORE_MULTIPLIER = 2;

// Deterministic choice generation - same input = same output, no randomness
function makeChoicesForQuestion(dan, b, answer) {
  const wrong = [];
  for (let i = 1; i <= 9; i++) {
    if (i !== b) wrong.push(dan * i);
  }
  // Sort wrong answers by distance from correct answer
  wrong.sort((a, bb) => Math.abs(a - answer) - Math.abs(bb - answer));
  // Take 3 closest wrong answers
  const picks = wrong.slice(0, 3);
  // Combine with correct answer, sort numerically (deterministic order)
  const all = [answer, ...picks].sort((a, bb) => a - bb);
  return all;
}

// Generate all 9 questions for a dan (deterministic order: 1-9 shuffled by seed)
function makeQuestionsForDan(dan, seed) {
  const indices = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  // Seeded shuffle
  let s = seed;
  for (let i = indices.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.map((b) => ({
    a: dan,
    b,
    answer: dan * b,
    choices: makeChoicesForQuestion(dan, b, dan * b),
  }));
}

export default function CoopGame({ coopData, player, nickname, onEnd }) {
  const { isHost, roomChannel, lobbyChannel, players: initialPlayers } = coopData;

  const [currentDan, setCurrentDan] = useState(2);
  const [questions, setQuestions] = useState([]); // 9 questions for current dan
  const [qIndex, setQIndex] = useState(0); // current question index (0-8)
  const [solvedInPlanet, setSolvedInPlanet] = useState(0); // how many solved in current planet group
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
      c[p.nickname] = { correctCount: 0, equippedCharacter: p.equippedCharacter };
    });
    return c;
  });
  const [totalSessionScore, setTotalSessionScore] = useState(0);
  const [error, setError] = useState(null);
  const [skillName, setSkillName] = useState(null);

  const animRef = useRef(null);
  const subStartTimeRef = useRef(null);
  const stateRef = useRef({
    qIndex: 0, questions: [], currentDan: 2,
    gamePhase: 'ready', totalSessionScore: 0, solvedInPlanet: 0,
  });

  // Sync refs after every render
  useEffect(() => {
    stateRef.current = {
      qIndex, questions, currentDan,
      gamePhase, totalSessionScore, solvedInPlanet,
    };
  });

  const currentQuestion = questions[qIndex];
  const choices = currentQuestion?.choices || [];

  // Reset sub-question timer when question changes
  useEffect(() => {
    if (currentQuestion) {
      subStartTimeRef.current = Date.now();
    }
  }, [qIndex, currentDan]);

  // Start a dan
  const startNewDan = (dan, seed) => {
    const qs = makeQuestionsForDan(dan, seed);
    setQuestions(qs);
    setQIndex(0);
    setSolvedInPlanet(0);
    setGamePhase('ready');
    setCurrentPlanet(Math.floor(Math.random() * PLANET_SPRITES.length));
    setFeedback(null);
    setSelectedChoice(-1);
    playStageStart();

    stateRef.current.questions = qs;
    stateRef.current.qIndex = 0;
    stateRef.current.solvedInPlanet = 0;
    stateRef.current.gamePhase = 'ready';

    setTimeout(() => {
      setGamePhase('playing');
      stateRef.current.gamePhase = 'playing';
      setPlanetStartTime(Date.now());
      setPlanetY(0);
    }, 500);
  };

  // Initialize
  useEffect(() => {
    try {
      startBGM('game');
      if (isHost) {
        const seed = Date.now();
        startNewDan(2, seed);
        // Broadcast seed so all clients generate same questions
        setTimeout(() => {
          if (roomChannel) {
            broadcastGame(roomChannel, { type: 'dan-start', dan: 2, seed });
          }
        }, 200);
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
        handlePlanetCrash();
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
              stateRef.current.currentDan = payload.dan;
              startNewDan(payload.dan, payload.seed);
            }
            break;

          case 'answer-attempt':
            if (isHost) {
              const s = stateRef.current;
              const q = s.questions[s.qIndex];
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
                newQIndex: correct ? s.qIndex + 1 : s.qIndex,
                newSolvedInPlanet: correct ? s.solvedInPlanet + 1 : s.solvedInPlanet,
              });

              if (active) applyAnswerResult(payload.nickname, correct, score);
            }
            break;

          case 'answer-result':
            if (!isHost && active) {
              applyAnswerResult(payload.nickname, payload.correct, payload.score);
            }
            break;

          case 'planet-crash':
            if (!isHost && active) {
              setTotalSessionScore((s) => s - payload.penalty);
              setShake(true);
              setFlashColor('rgba(255, 0, 0, 0.3)');
              setFeedback({ type: 'wrong', text: `충돌! -${payload.penalty}P`, score: -payload.penalty });
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
              setSolvedInPlanet(0);
              stateRef.current.solvedInPlanet = 0;
              setCurrentPlanet(Math.floor(Math.random() * PLANET_SPRITES.length));
              setPlanetStartTime(Date.now());
              setPlanetY(0);
              setGamePhase('playing');
              stateRef.current.gamePhase = 'playing';
              setFeedback(null);
              setSelectedChoice(-1);
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
        }
      } catch (e) {
        console.error('broadcast handler error:', e);
      }
    };

    roomChannel.on('broadcast', { event: 'game' }, handler);
    return () => { active = false; };
  }, [roomChannel, isHost]);

  // Apply answer result
  const applyAnswerResult = (answerNick, correct, score) => {
    if (correct) {
      playCorrect();
      setFlashColor('rgba(0, 255, 0, 0.15)');
      setFeedback({ type: 'correct', text: `${answerNick} +${score}`, score, answerNick });

      // Skill name
      setContributions((prev) => {
        const charId = prev[answerNick]?.equippedCharacter || 0;
        try {
          const palette = CHARACTER_PALETTES?.[charId];
          const skillColor = palette?.colors?.[1] || '#ffd700';
          setSkillName({ text: getRandomSkill(charId), color: skillColor });
        } catch (e) { /* ignore */ }
        return prev;
      });

      // +1 기여도
      setContributions((prev) => ({
        ...prev,
        [answerNick]: {
          ...prev[answerNick],
          correctCount: (prev[answerNick]?.correctCount || 0) + 1,
        },
      }));
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
        advanceAfterCorrect();
      }, 800);
    } else {
      playWrong();
      setShake(true);
      setFlashColor('rgba(255, 0, 0, 0.15)');
      setFeedback({ type: 'wrong', text: `${answerNick} ${score}`, score });

      // -1 기여도
      setContributions((prev) => ({
        ...prev,
        [answerNick]: {
          ...prev[answerNick],
          correctCount: (prev[answerNick]?.correctCount || 0) - 1,
        },
      }));
      setTotalSessionScore((s) => s + score);

      // Wrong answer: question stays the same (don't advance)
      setTimeout(() => {
        setShake(false);
        setFlashColor(null);
        setFeedback(null);
        setSelectedChoice(-1);
      }, 600);
    }
  };

  // Advance after correct answer
  const advanceAfterCorrect = () => {
    const s = stateRef.current;
    const newSolved = s.solvedInPlanet + 1;

    if (newSolved >= QUESTIONS_PER_PLANET) {
      // Planet cleared!
      playExplosion();

      const nextQIndex = s.qIndex + 1;
      if (nextQIndex >= s.questions.length) {
        // Dan complete! All 9 questions solved
        if (isHost) handleDanComplete();
      } else {
        // Next planet, continue with next question
        if (isHost) {
          broadcastGame(roomChannel, { type: 'next-planet' });
        }
        setQIndex(nextQIndex);
        stateRef.current.qIndex = nextQIndex;
        setSolvedInPlanet(0);
        stateRef.current.solvedInPlanet = 0;
        setCurrentPlanet(Math.floor(Math.random() * PLANET_SPRITES.length));
        setPlanetStartTime(Date.now());
        setPlanetY(0);
        setFeedback(null);
        setSelectedChoice(-1);
      }
    } else {
      // Next question in same planet
      const nextQIndex = s.qIndex + 1;
      if (nextQIndex >= s.questions.length) {
        // Dan complete even if planet not full
        if (isHost) handleDanComplete();
      } else {
        setQIndex(nextQIndex);
        stateRef.current.qIndex = nextQIndex;
        setSolvedInPlanet(newSolved);
        stateRef.current.solvedInPlanet = newSolved;
      }
    }
  };

  const handlePlanetCrash = () => {
    // Planet crashed: penalty for remaining unsolved questions in this planet group
    const remaining = QUESTIONS_PER_PLANET - stateRef.current.solvedInPlanet;
    const penalty = remaining * Math.abs(WRONG_PENALTY) * SCORE_MULTIPLIER;
    setTotalSessionScore((s) => s - penalty);
    setShake(true);
    setFlashColor('rgba(255, 0, 0, 0.3)');
    setFeedback({ type: 'wrong', text: `충돌! -${penalty}P`, score: -penalty });

    if (isHost) {
      broadcastGame(roomChannel, { type: 'planet-crash', remaining, penalty });
    }

    setTimeout(() => {
      setShake(false);
      setFlashColor(null);
      setFeedback(null);

      // Reset planet but keep current question (unsolved questions stay)
      setSolvedInPlanet(0);
      stateRef.current.solvedInPlanet = 0;

      const s = stateRef.current;
      if (s.qIndex >= s.questions.length) {
        if (isHost) handleDanComplete();
      } else {
        if (isHost) {
          broadcastGame(roomChannel, { type: 'next-planet' });
        }
        setCurrentPlanet(Math.floor(Math.random() * PLANET_SPRITES.length));
        setPlanetStartTime(Date.now());
        setPlanetY(0);
        setGamePhase('playing');
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
        const seed = Date.now();
        startNewDan(nextDan, seed);
        broadcastGame(roomChannel, { type: 'dan-start', dan: nextDan, seed });
      }, 3000);
    }
  };

  const handleAnswer = (answer) => {
    if (stateRef.current.gamePhase !== 'playing') return;
    const q = stateRef.current.questions[stateRef.current.qIndex];
    if (!q) return;

    setSelectedChoice(answer);

    if (isHost) {
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

  // Keyboard
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

  const sortedContributions = Object.entries(contributions)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.correctCount - a.correctCount);

  const planetSprite = PLANET_SPRITES[currentPlanet];

  // Progress: how many questions solved in this dan
  const totalInDan = questions.length;
  const solvedInDan = qIndex;

  // === ERROR ===
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
        <span style={{ fontSize: 10, color: '#aaa' }}>{solvedInDan}/{totalInDan}</span>
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

      {/* Timer bar */}
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
        {/* Planet + question */}
        <div style={{
          position: 'absolute', top: `${planetY * 55}%`, left: '50%',
          transform: 'translateX(-50%)', textAlign: 'center',
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
            행성 {solvedInPlanet + 1}/{QUESTIONS_PER_PLANET}
          </div>
        </div>

        {/* Particles */}
        {particles.map((p) => (
          <div key={p.id} style={{
            position: 'absolute', top: `${planetY * 55}%`,
            left: `calc(50% + ${p.x - 150}px)`,
            width: 8, height: 8, background: p.color,
            animation: `scorePopup 0.8s ease-out ${p.delay}s forwards`, opacity: 0.8,
          }} />
        ))}

        {/* Feedback */}
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
              top: '55%', left: '50%',
              color: skillName.color,
              textShadow: `2px 2px 0 #000, -1px -1px 0 #000, 0 0 10px ${skillName.color}`,
            }}
          >
            {skillName.text}
          </div>
        )}

        {/* Players on earth */}
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

        {/* Contribution board */}
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

      {/* Choices */}
      <div className="choices-grid">
        {choices.map((choice, idx) => (
          <button
            key={`${currentDan}-${qIndex}-${idx}`}
            className={`choice-btn ${
              feedback && choice === currentQuestion?.answer ? 'correct' : ''
            } ${
              feedback && feedback.type === 'wrong' && selectedChoice === choice ? 'wrong' : ''
            }`}
            onClick={() => handleAnswer(choice)}
            disabled={gamePhase !== 'playing'}
          >
            {choice}
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
