import { useState, useEffect, useRef, useCallback } from 'react';
import { generateQuestions, generateChoices } from '../utils/questions';
import { calculateScore, WRONG_PENALTY } from '../utils/scoring';
import { playCorrect, playWrong, playExplosion, playStageStart, playStageClear, playGameComplete, startBGM, stopBGM } from '../utils/sound';
import { PLANET_SPRITES, EARTH_SPRITE } from '../data/characters';
import { broadcastGame, leaveRoom } from '../utils/realtime';
import PixelCharacter from './PixelCharacter';

const COOP_FALL_DURATION = 15; // 15 seconds for 4 questions
const QUESTIONS_PER_PLANET = 4;
const SCORE_MULTIPLIER = 2;

export default function CoopGame({ coopData, player, nickname, onEnd }) {
  const { isHost, roomChannel, lobbyChannel, players: initialPlayers } = coopData;

  const [currentDan, setCurrentDan] = useState(2);
  const [allQuestions, setAllQuestions] = useState([]); // 9 questions for this dan
  const [questionIndex, setQuestionIndex] = useState(0); // which planet group (0-based, each group = 4 questions)
  const [subIndex, setSubIndex] = useState(0); // which sub-question in current planet (0-3)
  const [choices, setChoices] = useState([]);
  const [selectedChoice, setSelectedChoice] = useState(-1);
  const [planetY, setPlanetY] = useState(0);
  const [planetStartTime, setPlanetStartTime] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [gamePhase, setGamePhase] = useState('ready'); // ready, playing, feedback, stageClear, gameOver
  const [shake, setShake] = useState(false);
  const [flashColor, setFlashColor] = useState(null);
  const [currentPlanet, setCurrentPlanet] = useState(0);
  const [particles, setParticles] = useState([]);

  // Contribution tracking: { nickname: { correctCount, score } }
  const [contributions, setContributions] = useState(() => {
    const c = {};
    initialPlayers.forEach((p) => {
      c[p.nickname] = { correctCount: 0, score: 0, equippedCharacter: p.equippedCharacter };
    });
    return c;
  });
  const [totalSessionScore, setTotalSessionScore] = useState(0);
  const [connectedPlayers, setConnectedPlayers] = useState(initialPlayers);

  const animRef = useRef(null);
  const subStartTimeRef = useRef(null); // when current sub-question started

  // Current planet's questions (group of 4)
  const planetQuestions = allQuestions.slice(questionIndex * QUESTIONS_PER_PLANET, (questionIndex + 1) * QUESTIONS_PER_PLANET);
  const currentQuestion = planetQuestions[subIndex];

  // Generate choices when question changes
  useEffect(() => {
    if (currentQuestion) {
      setChoices(generateChoices(currentQuestion.a, currentQuestion.answer));
      subStartTimeRef.current = Date.now();
    }
  }, [currentQuestion]);

  // Start a dan
  const startDan = useCallback((dan) => {
    // Generate questions - need multiples of 4. Generate for multiple planets.
    // For a dan: 9 questions normally. For coop, generate 8 (2 planets x 4) or 12 (3 planets x 4)
    const qs = [];
    for (let i = 1; i <= 8; i++) { // 2 planets worth
      qs.push({ a: dan, b: i, answer: dan * i });
    }
    // Shuffle
    for (let i = qs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [qs[i], qs[j]] = [qs[j], qs[i]];
    }

    setAllQuestions(qs);
    setQuestionIndex(0);
    setSubIndex(0);
    setGamePhase('ready');
    setCurrentPlanet(Math.floor(Math.random() * PLANET_SPRITES.length));
    playStageStart();

    setTimeout(() => {
      setGamePhase('playing');
      setPlanetStartTime(Date.now());
      setPlanetY(0);
    }, 500);

    // Broadcast to other players
    if (isHost) {
      setTimeout(() => {
        broadcastGame(roomChannel, {
          type: 'dan-start',
          dan,
          questions: qs,
          planetIndex: Math.floor(Math.random() * PLANET_SPRITES.length),
        });
      }, 100);
    }
  }, [isHost, roomChannel]);

  // Initialize
  useEffect(() => {
    startBGM('game');
    if (isHost) {
      startDan(2);
    }
    return () => { stopBGM(); cancelAnimationFrame(animRef.current); };
  }, []);

  // Planet fall animation
  useEffect(() => {
    if (gamePhase !== 'playing' || !planetStartTime) return;

    const animate = () => {
      const elapsed = (Date.now() - planetStartTime) / 1000;
      const progress = Math.min(elapsed / COOP_FALL_DURATION, 1);
      setPlanetY(progress);

      if (progress >= 1) {
        // Planet crashed - penalty for remaining questions
        const remaining = QUESTIONS_PER_PLANET - subIndex;
        handlePlanetCrash(remaining);
        return;
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [gamePhase, planetStartTime, subIndex]);

  // Listen for broadcasts (non-host)
  useEffect(() => {
    if (!roomChannel) return;

    const handler = ({ payload }) => {
      if (!payload) return;

      switch (payload.type) {
        case 'dan-start':
          if (!isHost) {
            setCurrentDan(payload.dan);
            setAllQuestions(payload.questions);
            setQuestionIndex(0);
            setSubIndex(0);
            setCurrentPlanet(payload.planetIndex);
            setGamePhase('ready');
            playStageStart();
            setTimeout(() => {
              setGamePhase('playing');
              setPlanetStartTime(Date.now());
              setPlanetY(0);
            }, 500);
          }
          break;

        case 'answer-result':
          handleAnswerResult(payload);
          break;

        case 'planet-crash':
          handleCrashResult(payload);
          break;

        case 'next-planet':
          setQuestionIndex(payload.questionIndex);
          setSubIndex(0);
          setCurrentPlanet(Math.floor(Math.random() * PLANET_SPRITES.length));
          setPlanetStartTime(Date.now());
          setPlanetY(0);
          setGamePhase('playing');
          setFeedback(null);
          break;

        case 'stage-clear':
          setGamePhase('stageClear');
          playStageClear();
          break;

        case 'game-over':
          setGamePhase('gameOver');
          playGameComplete();
          break;

        case 'next-dan':
          if (!isHost) {
            setCurrentDan(payload.dan);
          }
          break;
      }
    };

    roomChannel.on('broadcast', { event: 'game' }, handler);
    return () => {
      roomChannel.off('broadcast', { event: 'game' }, handler);
    };
  }, [roomChannel, isHost]);

  // Keyboard controls
  useEffect(() => {
    if (gamePhase !== 'playing' || !currentQuestion) return;

    const handleKey = (e) => {
      if (e.key >= '1' && e.key <= '4') {
        const idx = parseInt(e.key) - 1;
        if (choices[idx] !== undefined) handleAnswer(choices[idx]);
      }
      if (e.key === 'Escape') {
        handleQuit();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gamePhase, choices, currentQuestion]);

  const handleAnswer = (answer) => {
    if (gamePhase !== 'playing' || !currentQuestion) return;
    setSelectedChoice(answer);

    // Send answer to host (or process locally if host)
    if (isHost) {
      processAnswer(nickname, answer);
    } else {
      broadcastGame(roomChannel, {
        type: 'answer-attempt',
        nickname,
        answer,
        subIndex,
      });
    }
  };

  // Host processes answers
  useEffect(() => {
    if (!isHost || !roomChannel) return;

    const handler = ({ payload }) => {
      if (payload?.type === 'answer-attempt') {
        processAnswer(payload.nickname, payload.answer);
      }
    };

    roomChannel.on('broadcast', { event: 'game' }, handler);
    return () => roomChannel.off('broadcast', { event: 'game' }, handler);
  }, [isHost, roomChannel, currentQuestion, subIndex, allQuestions, questionIndex]);

  const processAnswer = (answerNickname, answer) => {
    if (!currentQuestion) return;

    const correct = answer === currentQuestion.answer;
    const elapsed = subStartTimeRef.current ? (Date.now() - subStartTimeRef.current) / 1000 : 10;

    let score = 0;
    if (correct) {
      score = calculateScore(elapsed) * SCORE_MULTIPLIER;
    } else {
      score = WRONG_PENALTY * SCORE_MULTIPLIER; // -200
    }

    // Broadcast result
    broadcastGame(roomChannel, {
      type: 'answer-result',
      nickname: answerNickname,
      correct,
      score,
      answer,
      subIndex,
    });

    // Process locally too
    handleAnswerResult({ nickname: answerNickname, correct, score, subIndex });
  };

  const handleAnswerResult = (payload) => {
    const { nickname: answerNick, correct, score } = payload;

    if (correct) {
      playCorrect();
      setFlashColor('rgba(0, 255, 0, 0.15)');
      setFeedback({ type: 'correct', text: `${answerNick} +${score}`, score });

      // Update contributions
      setContributions((prev) => ({
        ...prev,
        [answerNick]: {
          ...prev[answerNick],
          correctCount: (prev[answerNick]?.correctCount || 0) + 1,
          score: (prev[answerNick]?.score || 0) + score,
        },
      }));
      setTotalSessionScore((s) => s + score);

      // Explosion particles
      setParticles(Array.from({ length: 8 }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 300,
        color: ['#ff0', '#f80', '#0f0', '#0ff'][Math.floor(Math.random() * 4)],
        delay: Math.random() * 0.3,
      })));

      // Move to next sub-question or next planet
      setTimeout(() => {
        setFeedback(null);
        setFlashColor(null);
        setParticles([]);
        setSelectedChoice(-1);

        const nextSub = subIndex + 1;
        if (nextSub >= QUESTIONS_PER_PLANET) {
          // Planet cleared!
          playExplosion();
          const nextQIndex = questionIndex + 1;
          if (nextQIndex * QUESTIONS_PER_PLANET >= allQuestions.length) {
            // Dan complete
            if (isHost) {
              handleDanComplete();
            }
          } else {
            // Next planet
            if (isHost) {
              broadcastGame(roomChannel, {
                type: 'next-planet',
                questionIndex: nextQIndex,
              });
            }
            setQuestionIndex(nextQIndex);
            setSubIndex(0);
            setCurrentPlanet(Math.floor(Math.random() * PLANET_SPRITES.length));
            setPlanetStartTime(Date.now());
            setPlanetY(0);
          }
        } else {
          setSubIndex(nextSub);
        }
      }, 800);
    } else {
      playWrong();
      setShake(true);
      setFlashColor('rgba(255, 0, 0, 0.15)');
      setFeedback({ type: 'wrong', text: `${answerNick} ${score}`, score });

      setContributions((prev) => ({
        ...prev,
        [answerNick]: {
          ...prev[answerNick],
          score: (prev[answerNick]?.score || 0) + score,
        },
      }));
      setTotalSessionScore((s) => s + score);

      setTimeout(() => {
        setShake(false);
        setFlashColor(null);
        setFeedback(null);
        setSelectedChoice(-1);
      }, 600);
    }
  };

  const handlePlanetCrash = (remaining) => {
    const penalty = remaining * Math.abs(WRONG_PENALTY) * SCORE_MULTIPLIER; // -200 per remaining
    setTotalSessionScore((s) => s - penalty);
    setShake(true);
    setFlashColor('rgba(255, 0, 0, 0.3)');
    setFeedback({ type: 'wrong', text: `미해결 ${remaining}개! -${penalty}P`, score: -penalty });

    if (isHost) {
      broadcastGame(roomChannel, {
        type: 'planet-crash',
        remaining,
        penalty,
      });
    }

    setTimeout(() => {
      setShake(false);
      setFlashColor(null);
      setFeedback(null);

      const nextQIndex = questionIndex + 1;
      if (nextQIndex * QUESTIONS_PER_PLANET >= allQuestions.length) {
        if (isHost) handleDanComplete();
      } else {
        if (isHost) {
          broadcastGame(roomChannel, {
            type: 'next-planet',
            questionIndex: nextQIndex,
          });
        }
        setQuestionIndex(nextQIndex);
        setSubIndex(0);
        setCurrentPlanet(Math.floor(Math.random() * PLANET_SPRITES.length));
        setPlanetStartTime(Date.now());
        setPlanetY(0);
        setGamePhase('playing');
      }
    }, 1500);
  };

  const handleCrashResult = (payload) => {
    const { remaining, penalty } = payload;
    setTotalSessionScore((s) => s - penalty);
    setShake(true);
    setFlashColor('rgba(255, 0, 0, 0.3)');
    setFeedback({ type: 'wrong', text: `미해결 ${remaining}개! -${penalty}P`, score: -penalty });
    setTimeout(() => {
      setShake(false);
      setFlashColor(null);
      setFeedback(null);
    }, 1500);
  };

  const handleDanComplete = () => {
    const nextDan = currentDan + 1;
    if (nextDan > 9) {
      // Game over
      broadcastGame(roomChannel, { type: 'game-over' });
      setGamePhase('gameOver');
      playGameComplete();
    } else {
      broadcastGame(roomChannel, { type: 'stage-clear' });
      setGamePhase('stageClear');
      playStageClear();

      // After showing stage clear, start next dan
      setTimeout(() => {
        setCurrentDan(nextDan);
        broadcastGame(roomChannel, { type: 'next-dan', dan: nextDan });
        startDan(nextDan);
      }, 3000);
    }
  };

  const handleQuit = () => {
    cancelAnimationFrame(animRef.current);
    stopBGM();
    leaveRoom(roomChannel, lobbyChannel);
    onEnd(totalSessionScore);
  };

  // Sorted contributions for display
  const sortedContributions = Object.entries(contributions)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.correctCount - a.correctCount || b.score - a.score);

  const planetSprite = PLANET_SPRITES[currentPlanet];

  // --- Stage Clear Screen ---
  if (gamePhase === 'stageClear') {
    return (
      <div className="game-container" style={{ justifyContent: 'center' }}>
        <div style={{ fontSize: 24, color: '#ffd700', marginBottom: 20, textShadow: '2px 2px 0 #b8860b' }}>
          {currentDan}단 클리어!
        </div>
        <ContributionBoard contributions={sortedContributions} nickname={nickname} />
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 16 }}>
          다음 단 준비 중...
        </div>
      </div>
    );
  }

  // --- Game Over Screen ---
  if (gamePhase === 'gameOver') {
    return (
      <div className="game-container" style={{ justifyContent: 'center' }}>
        <div style={{ fontSize: 24, color: '#ffd700', marginBottom: 8, textShadow: '2px 2px 0 #b8860b' }}>
          게임 완료!
        </div>
        <div style={{ fontSize: 14, color: '#fff', marginBottom: 20 }}>
          총 점수: <span style={{ color: '#ffd700' }}>{totalSessionScore.toLocaleString()}P</span>
        </div>
        <ContributionBoard contributions={sortedContributions} nickname={nickname} />
        <button
          className="pixel-btn gold"
          onClick={handleQuit}
          style={{ marginTop: 24 }}
        >
          나가기
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="game-container" style={{ justifyContent: 'center' }}>
        <div style={{ fontSize: 12, color: '#aaa' }}>준비 중...</div>
      </div>
    );
  }

  // --- Playing ---
  return (
    <div className={`game-container ${shake ? 'shake' : ''}`} style={{ justifyContent: 'flex-start', paddingTop: 10 }}>
      {flashColor && <div className="flash-overlay" style={{ background: flashColor }} />}

      {/* HUD */}
      <div className="hud">
        <span>{currentDan}단</span>
        <span style={{ fontSize: 10, color: '#aaa' }}>
          {subIndex + 1}/{QUESTIONS_PER_PLANET}
        </span>
        <span className="hud-score">
          {(player.score + totalSessionScore).toLocaleString()} P
        </span>
      </div>

      {/* Quit button */}
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

      {/* Game area */}
      <div style={{
        flex: 1, width: '100%', position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        overflow: 'hidden', minHeight: 300,
      }}>
        {/* Big planet falling */}
        <div style={{
          position: 'absolute',
          top: `${planetY * 55}%`,
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          opacity: feedback?.type === 'correct' && subIndex === QUESTIONS_PER_PLANET - 1 ? 0 : 1,
        }}>
          <div style={{
            width: 120, height: 120,
            margin: '0 auto 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            {/* Trail */}
            {planetY > 0.05 && gamePhase === 'playing' && (
              [0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{
                  position: 'absolute', top: -(14 + i * 16),
                  left: '50%', transform: 'translateX(-50%)',
                  width: Math.max(6, 14 - i * 2), height: Math.max(6, 14 - i * 2),
                  borderRadius: '50%', background: planetSprite?.colors[1] || '#888',
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

        {/* Explosion particles */}
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

        {/* Players on earth */}
        <div style={{
          position: 'absolute', bottom: -120, left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            {Object.entries(contributions).map(([name, data]) => (
              <div key={name} style={{ textAlign: 'center' }}>
                <PixelCharacter characterId={data.equippedCharacter || 0} pixelSize={3} />
                <div style={{ fontSize: 6, color: name === nickname ? '#ffd700' : '#aaa', marginTop: 2 }}>
                  {name}
                </div>
              </div>
            ))}
          </div>
          <EarthCanvas />
        </div>

        {/* Contribution board (right side) */}
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
            key={idx}
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

// Contribution leaderboard component
function ContributionBoard({ contributions, nickname }) {
  return (
    <div style={{
      background: '#141450', border: '3px solid #333366',
      padding: 16, width: '100%', maxWidth: 320,
    }}>
      <div style={{ fontSize: 11, color: '#ffd700', marginBottom: 10, textAlign: 'center' }}>기여도</div>
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
          <span style={{ color: '#aaa', marginRight: 10 }}>{c.correctCount}문제</span>
          <span style={{ color: '#ffd700' }}>{c.score.toLocaleString()}P</span>
        </div>
      ))}
    </div>
  );
}

// Bigger planet canvas (120px)
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

// Earth canvas (reused from GamePlay)
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
