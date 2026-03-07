import { useState, useEffect, useRef, useCallback } from 'react';
import { generateQuestions, generateChoices } from '../utils/questions';
import { calculateScore, WRONG_PENALTY, FALL_DURATION } from '../utils/scoring';
import { playCorrect, playWrong, playExplosion, playSelect, playStageStart, playStageClear, playGameComplete, startBGM, stopBGM } from '../utils/sound';
import { PLANET_SPRITES, EARTH_SPRITE } from '../data/characters';
import PixelCharacter from './PixelCharacter';

export default function GamePlay({
  mode,
  player,
  onStageClear,
}) {
  const [currentDan, setCurrentDan] = useState(2);
  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [choices, setChoices] = useState([]);
  const [selectedChoice, setSelectedChoice] = useState(-1);
  const [stageScore, setStageScore] = useState(0);
  const [totalSessionScore, setTotalSessionScore] = useState(0);
  const [planetY, setPlanetY] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'correct'|'wrong', score, text }
  const [wrongQuestions, setWrongQuestions] = useState([]);
  const [isRetryRound, setIsRetryRound] = useState(false);
  const [gamePhase, setGamePhase] = useState('ready'); // ready, playing, feedback, stageClear
  const [shake, setShake] = useState(false);
  const [flashColor, setFlashColor] = useState(null);
  const [charFrame, setCharFrame] = useState('idle');
  const [currentPlanet, setCurrentPlanet] = useState(0);
  const [particles, setParticles] = useState([]);
  const [missile, setMissile] = useState(null); // { progress: 0~1 }
  const [quitResult, setQuitResult] = useState(null); // { totalScore }

  const animRef = useRef(null);
  const containerRef = useRef(null);

  const currentQuestion = questions[questionIndex];

  // Start a new dan
  const startDan = useCallback((dan, retryList = null) => {
    const qs = retryList || generateQuestions(dan, mode);
    setQuestions(qs);
    setQuestionIndex(0);
    setStageScore(0);
    setWrongQuestions([]);
    setIsRetryRound(!!retryList);
    setGamePhase('ready');
    setCurrentPlanet(Math.floor(Math.random() * PLANET_SPRITES.length));
    playStageStart();

    setTimeout(() => {
      setGamePhase('playing');
      setStartTime(Date.now());
      setPlanetY(0);
    }, 500);
  }, [mode]);

  // Initialize
  useEffect(() => {
    startBGM('game');
    startDan(2);
    return () => { stopBGM(); cancelAnimationFrame(animRef.current); };
  }, [startDan]);

  // Planet fall animation
  useEffect(() => {
    if (gamePhase !== 'playing' || !startTime) return;

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / FALL_DURATION, 1);
      setPlanetY(progress);

      if (progress >= 1) {
        // Timeout
        handleTimeout();
        return;
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [gamePhase, startTime, questionIndex]);

  const handleTimeout = () => {
    cancelAnimationFrame(animRef.current);
    setGamePhase('feedback');
    playWrong();
    setShake(true);
    setTimeout(() => setShake(false), 400);

    const penalty = WRONG_PENALTY;
    setStageScore((s) => s + penalty);
    setTotalSessionScore((s) => s + penalty);
    setFeedback({ type: 'wrong', score: penalty, text: '시간 초과!' });
    setWrongQuestions((prev) => {
      if (prev.find((q) => q.a === currentQuestion.a && q.b === currentQuestion.b)) return prev;
      return [...prev, currentQuestion];
    });

    setTimeout(() => nextQuestion(), 1200);
  };

  const handleAnswer = (answer) => {
    if (gamePhase !== 'playing') return;
    cancelAnimationFrame(animRef.current);
    setGamePhase('feedback');

    const elapsed = (Date.now() - startTime) / 1000;

    if (answer === currentQuestion.answer) {
      // Correct
      const score = calculateScore(elapsed);
      playCorrect();
      setCharFrame('attack');

      // Launch missile first, then explode
      setMissile({ progress: 0 });
      setTimeout(() => {
        playExplosion();
        setMissile(null);
        setFlashColor('#ffffff');
        setTimeout(() => setFlashColor(null), 300);
        setParticles(generateParticles());
      }, 350);
      setTimeout(() => setCharFrame('idle'), 500);

      setStageScore((s) => s + score);
      setTotalSessionScore((s) => s + score);
      setFeedback({ type: 'correct', score, text: `+${score}` });
    } else {
      // Wrong
      playWrong();
      setShake(true);
      setTimeout(() => setShake(false), 400);

      const penalty = WRONG_PENALTY;
      setStageScore((s) => s + penalty);
      setTotalSessionScore((s) => s + penalty);
      setFeedback({ type: 'wrong', score: penalty, text: `${penalty}` });
      setWrongQuestions((prev) => {
        if (prev.find((q) => q.a === currentQuestion.a && q.b === currentQuestion.b)) return prev;
        return [...prev, currentQuestion];
      });
    }

    setTimeout(() => nextQuestion(), 1000);
  };

  const nextQuestion = () => {
    setFeedback(null);
    setParticles([]);
    const nextIdx = questionIndex + 1;

    if (nextIdx >= questions.length) {
      // All questions in this round done
      // Always use functional state to get latest wrongQuestions (avoids stale closure)
      setWrongQuestions((currentWrong) => {
        if (currentWrong.length > 0) {
          startDan(currentDan, [...currentWrong]);
        } else {
          setGamePhase('stageClear');
        }
        return currentWrong;
      });
      return;
    }

    setQuestionIndex(nextIdx);
    setCurrentPlanet(Math.floor(Math.random() * PLANET_SPRITES.length));
    setGamePhase('playing');
    setStartTime(Date.now());
    setPlanetY(0);
    setSelectedChoice(-1);
  };

  // Generate choices when question changes
  useEffect(() => {
    if (currentQuestion) {
      setChoices(generateChoices(currentDan, currentQuestion.answer));
      setSelectedChoice(-1);
    }
  }, [currentQuestion, currentDan]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelAnimationFrame(animRef.current);
        stopBGM();
        setQuitResult({ totalScore: totalSessionScore });
        return;
      }

      if (gamePhase !== 'playing') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        playSelect();
        setSelectedChoice((prev) => {
          if (prev <= 0) return choices.length - 1;
          return prev - 1;
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        playSelect();
        setSelectedChoice((prev) => {
          if (prev >= choices.length - 1 || prev < 0) return 0;
          return prev + 1;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        playSelect();
        setSelectedChoice((prev) => {
          const next = prev - 2;
          return next < 0 ? prev : next;
        });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        playSelect();
        setSelectedChoice((prev) => {
          const next = prev + 2;
          return next >= choices.length ? prev : next;
        });
      } else if ((e.key === 'Enter' || e.key === ' ') && selectedChoice >= 0) {
        e.preventDefault();
        handleAnswer(choices[selectedChoice]);
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (idx < choices.length) {
          handleAnswer(choices[idx]);
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gamePhase, choices, selectedChoice, totalSessionScore]);

  // Handle stage clear
  useEffect(() => {
    if (gamePhase === 'stageClear') {
      stopBGM();
    }
  }, [gamePhase]);

  const generateParticles = () => {
    const colors = ['#ff6b6b', '#ffd700', '#ff69b4', '#00ff00', '#6bb5ff', '#ff9900'];
    return Array.from({ length: 16 }, (_, i) => ({
      id: i,
      x: 50 + Math.random() * 200,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.3,
    }));
  };

  if (quitResult) {
    return (
      <div className="game-container" style={{ justifyContent: 'center' }}>
        <div style={{
          fontSize: 22,
          color: 'var(--gold)',
          textAlign: 'center',
          marginBottom: 24,
          textShadow: '2px 2px 0 #b8860b',
        }}>
          게임 종료
        </div>

        <div style={{
          background: '#141450',
          border: '3px solid #333366',
          padding: 28,
          textAlign: 'center',
          marginBottom: 30,
          width: '100%',
          lineHeight: 2.4,
        }}>
          <div style={{ fontSize: 14, marginBottom: 10 }}>
            진행: {currentDan}단
          </div>
          <div style={{ fontSize: 14, marginBottom: 10 }}>
            획득 점수: <span style={{ color: quitResult.totalScore >= 0 ? 'var(--gold)' : 'var(--red)' }}>
              {quitResult.totalScore >= 0 ? '+' : ''}{quitResult.totalScore}
            </span>
          </div>
          <div style={{ fontSize: 16, color: 'var(--gold)' }}>
            보유 점수: {(player.score + quitResult.totalScore).toLocaleString()} P
          </div>
        </div>

        <button className="pixel-btn gold" onClick={() => onStageClear(quitResult.totalScore, false)}>
          메인으로
        </button>
      </div>
    );
  }

  if (gamePhase === 'stageClear') {
    return (
      <StageClearScreen
        dan={currentDan}
        stageScore={stageScore}
        totalSessionScore={totalSessionScore}
        playerScore={player.score}
        onNext={() => {
          if (currentDan >= 20) {
            onStageClear(totalSessionScore, true);
          } else {
            setCurrentDan(currentDan + 1);
            startBGM('game');
            startDan(currentDan + 1);
          }
        }}
        onQuit={() => onStageClear(totalSessionScore, false)}
        isLastDan={currentDan >= 20}
      />
    );
  }

  if (!currentQuestion) return null;

  const planetSprite = PLANET_SPRITES[currentPlanet];

  return (
    <div
      ref={containerRef}
      className={`game-container ${shake ? 'shake' : ''}`}
      style={{ justifyContent: 'flex-start', paddingTop: 10 }}
    >
      {flashColor && (
        <div className="flash-overlay" style={{ background: flashColor }} />
      )}

      {/* HUD */}
      <div className="hud">
        <span>{currentDan}단 {isRetryRound ? '(재도전)' : ''}</span>
        <span>
          {questionIndex + 1} / {questions.length}
        </span>
        <span className="hud-score">
          {(player.score + totalSessionScore).toLocaleString()} P
        </span>
        <button
          onClick={() => {
            cancelAnimationFrame(animRef.current);
            stopBGM();
            setQuitResult({ totalScore: totalSessionScore });
          }}
          style={{
            background: 'none',
            border: '2px solid #ff4444',
            color: '#ff4444',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 9,
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          종료
        </button>
      </div>

      {/* Timer bar */}
      <div style={{
        width: '100%',
        height: 6,
        background: '#1a1a4e',
        marginBottom: 10,
        border: '1px solid #333366',
      }}>
        <div style={{
          width: `${(1 - planetY) * 100}%`,
          height: '100%',
          background: planetY > 0.7 ? 'var(--red)' : planetY > 0.4 ? '#ffa500' : 'var(--green)',
          transition: 'width 0.1s linear',
        }} />
      </div>

      {/* Game area */}
      <div style={{
        flex: 1,
        width: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'hidden',
        minHeight: 300,
      }}>
        {/* Planet falling */}
        <div style={{
          position: 'absolute',
          top: `${planetY * 60}%`,
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          transition: gamePhase === 'feedback' ? 'none' : undefined,
          opacity: feedback?.type === 'correct' ? 0 : 1,
        }}>
          {/* Planet sprite visual */}
          <div style={{
            width: 60,
            height: 60,
            margin: '0 auto 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}>
            <PlanetCanvas sprite={planetSprite} size={60} />
          </div>
          <div style={{
            fontSize: 16,
            fontFamily: "'Press Start 2P', monospace",
            color: '#fff',
            textShadow: '2px 2px 0 #000',
            whiteSpace: 'nowrap',
          }}>
            {currentQuestion.a} x {currentQuestion.b} = ?
          </div>
        </div>

        {/* Missile projectile */}
        {missile && (
          <div
            style={{
              position: 'absolute',
              bottom: '10%',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 50,
              animation: 'missileShoot 0.35s ease-in forwards',
            }}
          >
            <div style={{
              width: 8,
              height: 16,
              background: 'linear-gradient(to top, #ff4400, #ffcc00, #ffffff)',
              borderRadius: '50% 50% 20% 20%',
              boxShadow: '0 0 12px #ff6600, 0 0 24px #ff4400',
            }} />
          </div>
        )}

        {/* Explosion particles */}
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              top: `${planetY * 60}%`,
              left: `calc(50% + ${p.x - 150}px)`,
              width: 6,
              height: 6,
              background: p.color,
              animation: `scorePopup 0.8s ease-out ${p.delay}s forwards`,
              opacity: 0.8,
            }}
          />
        ))}

        {/* Score popup */}
        {feedback && (
          <div
            className={`score-popup ${feedback.type === 'correct' ? 'positive' : 'negative'}`}
            style={{
              top: '40%',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            {feedback.text}
          </div>
        )}

        {/* Earth + Character at bottom */}
        <div style={{
          position: 'absolute',
          bottom: -120,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <PixelCharacter
            characterId={player.equippedCharacter}
            frame={charFrame}
            pixelSize={4}
          />
          <EarthCanvas />
        </div>
      </div>

      {/* Choices */}
      <div className="choices-grid">
        {choices.map((choice, idx) => (
          <button
            key={`${questionIndex}-${idx}`}
            className={`choice-btn ${
              selectedChoice === idx ? 'focused' : ''
            } ${
              feedback && choice === currentQuestion.answer ? 'correct' : ''
            } ${
              feedback && feedback.type === 'wrong' && selectedChoice === idx ? 'wrong' : ''
            }`}
            onClick={() => handleAnswer(choice)}
            disabled={gamePhase !== 'playing'}
          >
            <span style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>
              {idx + 1}
            </span>
            {choice}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 10, color: '#555', textAlign: 'center', padding: '6px 0' }}>
        1~4 숫자키 | 방향키+Enter/Space | ESC 종료
      </div>
    </div>
  );
}

// Planet Canvas sub-component
function PlanetCanvas({ sprite, size }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sprite) return;
    const ctx = canvas.getContext('2d');
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    const pixelSize = Math.floor(size / 8);
    sprite.sprite.forEach((row, ry) => {
      row.forEach((cell, rx) => {
        if (cell !== 0 && sprite.colors[cell]) {
          ctx.fillStyle = sprite.colors[cell];
          ctx.fillRect(rx * pixelSize, ry * pixelSize, pixelSize, pixelSize);
        }
      });
    });
  }, [sprite, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

// Earth Canvas sub-component - large arc at bottom of screen
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
    <canvas
      ref={canvasRef}
      width={480}
      height={240}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

// Stage Clear sub-screen
function StageClearScreen({ dan, stageScore, totalSessionScore, playerScore, onNext, onQuit, isLastDan }) {
  useEffect(() => {
    if (isLastDan) {
      playGameComplete();
    } else {
      playStageClear();
    }
  }, []);

  return (
    <div className="game-container" style={{ justifyContent: 'center' }}>
      <div style={{
        fontSize: 22,
        color: 'var(--gold)',
        textAlign: 'center',
        marginBottom: 24,
        textShadow: '2px 2px 0 #b8860b',
      }}>
        {isLastDan ? '전체 클리어!' : `${dan}단 클리어!`}
      </div>

      <div style={{
        background: '#141450',
        border: '3px solid #333366',
        padding: 28,
        textAlign: 'center',
        marginBottom: 30,
        width: '100%',
        lineHeight: 2.4,
      }}>
        <div style={{ fontSize: 14, marginBottom: 10 }}>
          이번 단 획득: <span style={{ color: stageScore >= 0 ? 'var(--gold)' : 'var(--red)' }}>
            {stageScore >= 0 ? '+' : ''}{stageScore}
          </span>
        </div>
        <div style={{ fontSize: 14, marginBottom: 10 }}>
          이번 게임 총 획득: <span style={{ color: 'var(--gold)' }}>
            {totalSessionScore >= 0 ? '+' : ''}{totalSessionScore}
          </span>
        </div>
        <div style={{ fontSize: 16, color: 'var(--gold)' }}>
          보유 점수: {(playerScore + totalSessionScore).toLocaleString()} P
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {isLastDan ? (
          <button className="pixel-btn gold" onClick={onQuit}>
            메인으로
          </button>
        ) : (
          <>
            <button className="pixel-btn gold" onClick={onNext}>
              다음 단으로 ({dan + 1}단)
            </button>
            <button className="pixel-btn red" onClick={onQuit}>
              그만하기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
