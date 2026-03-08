import { useState, useEffect, useRef, useCallback } from 'react';
import { generateQuestions, generateChoices } from '../utils/questions';
import { calculateScore, WRONG_PENALTY, FALL_DURATION } from '../utils/scoring';
import { playCorrect, playWrong, playExplosion, playSelect, playStageStart, playStageClear, playGameComplete, startBGM, stopBGM } from '../utils/sound';
import { PLANET_SPRITES, EARTH_SPRITE } from '../data/characters';
import { getMissileStyle } from '../data/missileStyles';
import PixelCharacter from './PixelCharacter';
import SchoolCardCharacter from './SchoolCardCharacter';

const SCHOOL_CARD_ID = 13;
const GOLDEN_WORM_ID = 24;

export default function GamePlay({
  mode,
  player,
  onStageClear,
}) {
  // Custom mode: { type: 'custom', dans: [2, 5, 9] }
  const isCustomMode = typeof mode === 'object' && mode?.type === 'custom';
  const customDans = isCustomMode ? mode.dans : null;
  const questionMode = isCustomMode ? 'sequential' : mode;
  const [customDanIndex, setCustomDanIndex] = useState(0);

  const [currentDan, setCurrentDan] = useState(isCustomMode ? customDans[0] : 2);
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
  const [totalWrongCount, setTotalWrongCount] = useState(0); // track total wrong across all dans
  const [perfectClear, setPerfectClear] = useState(null); // { bonus } when 2-9단 perfect

  const animRef = useRef(null);
  const containerRef = useRef(null);

  const currentQuestion = questions[questionIndex];

  // Start a new dan
  const startDan = useCallback((dan, retryList = null) => {
    const qs = retryList || generateQuestions(dan, questionMode);
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
  }, [questionMode]);

  // Initialize
  useEffect(() => {
    startBGM('game');
    startDan(isCustomMode ? customDans[0] : 2);
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

  const isGoldenWorm = player.equippedCharacter === GOLDEN_WORM_ID;

  const handleTimeout = () => {
    cancelAnimationFrame(animRef.current);
    setGamePhase('feedback');
    playWrong();
    setShake(true);
    setTimeout(() => setShake(false), 400);

    const penalty = isGoldenWorm ? 0 : WRONG_PENALTY;
    if (penalty) {
      setStageScore((s) => s + penalty);
      setTotalSessionScore((s) => s + penalty);
    }
    setTotalWrongCount((c) => c + 1);
    setFeedback({ type: 'wrong', score: penalty, text: isGoldenWorm ? '시간 초과! (보호)' : '시간 초과!' });
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

      const penalty = isGoldenWorm ? 0 : WRONG_PENALTY;
      if (penalty) {
        setStageScore((s) => s + penalty);
        setTotalSessionScore((s) => s + penalty);
      }
      setTotalWrongCount((c) => c + 1);
      setFeedback({ type: 'wrong', score: penalty, text: isGoldenWorm ? '보호!' : `${penalty}` });
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

  // Perfect clear popup (2-9단 all correct)
  if (perfectClear) {
    return (
      <PerfectClearScreen
        bonus={perfectClear.bonus}
        totalSessionScore={totalSessionScore}
        playerScore={player.score}
        onContinue={() => {
          setPerfectClear(null);
          setCurrentDan(10);
          startBGM('game');
          startDan(10);
        }}
        onQuit={() => onStageClear(totalSessionScore, false)}
      />
    );
  }

  if (gamePhase === 'stageClear') {
    // Determine if this is the last dan
    const isLastDan = isCustomMode
      ? customDanIndex >= customDans.length - 1
      : currentDan >= 20;

    return (
      <StageClearScreen
        dan={currentDan}
        stageScore={stageScore}
        totalSessionScore={totalSessionScore}
        playerScore={player.score}
        onNext={() => {
          if (isLastDan) {
            onStageClear(totalSessionScore, true);
          } else if (isCustomMode) {
            const nextIdx = customDanIndex + 1;
            const nextDan = customDans[nextIdx];
            setCustomDanIndex(nextIdx);
            setCurrentDan(nextDan);
            startBGM('game');
            startDan(nextDan);
          } else {
            const nextDan = currentDan + 1;
            // Check perfect clear at end of 9단
            if (currentDan === 9 && totalWrongCount === 0) {
              const bonus = 10000;
              setTotalSessionScore((s) => s + bonus);
              setPerfectClear({ bonus });
              return;
            }
            setCurrentDan(nextDan);
            startBGM('game');
            startDan(nextDan);
          }
        }}
        onQuit={() => onStageClear(totalSessionScore, false)}
        isLastDan={isLastDan}
        nextDanLabel={isCustomMode && !isLastDan ? `${customDans[customDanIndex + 1]}단` : null}
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
        <span>{currentDan}단 {isRetryRound ? '(재도전)' : isCustomMode ? `(${customDanIndex + 1}/${customDans.length})` : ''}</span>
        <span>
          {questionIndex + 1} / {questions.length}
        </span>
        <span className="hud-score">
          {(player.score + totalSessionScore).toLocaleString()} P
        </span>
      </div>

      {/* Quit button - fixed top-left */}
      <button
        onClick={() => {
          cancelAnimationFrame(animRef.current);
          stopBGM();
          setQuitResult({ totalScore: totalSessionScore });
        }}
        style={{
          position: 'fixed',
          top: 10,
          left: 10,
          zIndex: 1000,
          background: 'rgba(20, 20, 50, 0.8)',
          border: '2px solid #ff4444',
          color: '#ff4444',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 9,
          padding: '6px 12px',
          cursor: 'pointer',
          borderRadius: 4,
        }}
      >
        종료
      </button>

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
        {missile && <MissileProjectile characterId={player.equippedCharacter} />}

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
          <div style={{
            transition: 'transform 0.15s ease-out',
            transform: charFrame === 'attack' ? 'scale(1.3) translateY(-8px)' : 'scale(1)',
          }}>
            {player.equippedCharacter === SCHOOL_CARD_ID ? (
              <SchoolCardCharacter
                schoolName={player.schoolName || '학교'}
                frame={charFrame}
                pixelSize={4}
                mode="card"
              />
            ) : (
              <PixelCharacter
                characterId={player.equippedCharacter}
                frame={charFrame}
                pixelSize={4}
              />
            )}
          </div>
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

      {/* Quit popup overlay */}
      {quitResult && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            background: '#141450',
            border: '3px solid #6666aa',
            padding: '28px 32px',
            textAlign: 'center',
            maxWidth: 340,
            width: '90%',
          }}>
            <div style={{
              fontSize: 18,
              color: 'var(--gold)',
              marginBottom: 20,
              textShadow: '2px 2px 0 #b8860b',
            }}>
              게임 종료
            </div>
            <div style={{ fontSize: 13, marginBottom: 10, lineHeight: 2.2 }}>
              진행: {currentDan}단
            </div>
            <div style={{ fontSize: 13, marginBottom: 10, lineHeight: 2.2 }}>
              획득 점수: <span style={{ color: quitResult.totalScore >= 0 ? 'var(--gold)' : 'var(--red)' }}>
                {quitResult.totalScore >= 0 ? '+' : ''}{quitResult.totalScore}
              </span>
            </div>
            <div style={{ fontSize: 14, color: 'var(--gold)', marginBottom: 24, lineHeight: 2.2 }}>
              보유 점수: {(player.score + quitResult.totalScore).toLocaleString()} P
            </div>
            <button className="pixel-btn gold" onClick={() => onStageClear(quitResult.totalScore, false)}>
              확인
            </button>
          </div>
        </div>
      )}
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
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={480}
        height={240}
        style={{ imageRendering: 'pixelated' }}
      />
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -30%)',
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 28,
        color: 'rgba(255, 255, 255, 0.3)',
        pointerEvents: 'none',
        userSelect: 'none',
        letterSpacing: 4,
      }}>
        지구
      </div>
    </div>
  );
}

// Stage Clear sub-screen
function StageClearScreen({ dan, stageScore, totalSessionScore, playerScore, onNext, onQuit, isLastDan, nextDanLabel }) {
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
              다음 단으로 ({nextDanLabel || `${dan + 1}단`})
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

// Perfect Clear Screen - 2~9단 올클리어 축하
function PerfectClearScreen({ bonus, totalSessionScore, playerScore, onContinue, onQuit }) {
  useEffect(() => {
    playGameComplete();
  }, []);

  return (
    <div className="game-container perfect-clear-bg" style={{ justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      {/* Sparkle particles */}
      {Array.from({ length: 30 }, (_, i) => (
        <div
          key={i}
          className="perfect-sparkle"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${1 + Math.random() * 2}s`,
            width: `${4 + Math.random() * 8}px`,
            height: `${4 + Math.random() * 8}px`,
            background: ['#ffd700', '#ffffff', '#ff6600', '#ffee88', '#ff4444'][Math.floor(Math.random() * 5)],
          }}
        />
      ))}

      <div className="perfect-title">
        PERFECT!
      </div>
      <div style={{
        fontSize: 13,
        color: '#ffee88',
        marginBottom: 8,
        textShadow: '2px 2px 0 #b8860b',
        animation: 'perfectPulse 1s ease-in-out infinite',
      }}>
        2단~9단 올클리어!
      </div>
      <div style={{
        fontSize: 10,
        color: '#aaa',
        marginBottom: 24,
      }}>
        한 문제도 틀리지 않았어요!
      </div>

      <div style={{
        background: 'rgba(20, 20, 80, 0.9)',
        border: '4px solid #ffd700',
        padding: 28,
        textAlign: 'center',
        marginBottom: 30,
        width: '100%',
        lineHeight: 2.4,
        boxShadow: '0 0 30px rgba(255, 215, 0, 0.4), inset 0 0 20px rgba(255, 215, 0, 0.1)',
      }}>
        <div style={{ fontSize: 16, marginBottom: 10 }}>
          보너스: <span style={{ color: '#ffd700', fontSize: 20 }}>
            +{bonus.toLocaleString()}P
          </span>
        </div>
        <div style={{ fontSize: 14, marginBottom: 10 }}>
          총 획득: <span style={{ color: 'var(--gold)' }}>
            +{totalSessionScore.toLocaleString()}
          </span>
        </div>
        <div style={{ fontSize: 16, color: 'var(--gold)' }}>
          보유 점수: {(playerScore + totalSessionScore).toLocaleString()} P
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button className="pixel-btn gold" onClick={onContinue}>
          계속하기 (10단)
        </button>
        <button className="pixel-btn red" onClick={onQuit}>
          그만하기
        </button>
      </div>
    </div>
  );
}

// Missile projectile with character-specific style
function MissileProjectile({ characterId }) {
  const ms = getMissileStyle(characterId);
  const isPremium = ms.premium;

  return (
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
      {/* 꼬리 파티클들 */}
      {Array.from({ length: ms.trail }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            bottom: -(i + 1) * (isPremium ? 8 : 6),
            left: '50%',
            transform: `translateX(${(Math.random() - 0.5) * (isPremium ? 16 : 8)}px)`,
            width: Math.max(2, ms.size - i * 3),
            height: Math.max(2, ms.size - i * 3),
            background: i < ms.trail / 2 ? ms.mid : ms.tail,
            opacity: 1 - (i / ms.trail) * 0.8,
            imageRendering: 'pixelated',
          }}
        />
      ))}
      {/* 메인 미사일 헤드 */}
      <div style={{
        width: ms.size,
        height: ms.size * (isPremium ? 1.8 : 1.5),
        background: `linear-gradient(to top, ${ms.tail}, ${ms.mid}, ${ms.head})`,
        boxShadow: isPremium
          ? `0 0 ${ms.size}px ${ms.mid}, 0 0 ${ms.size * 2}px ${ms.tail}`
          : `0 0 ${ms.size / 2}px ${ms.mid}`,
        imageRendering: 'pixelated',
      }} />
      {/* 프리미엄: 양쪽 스파크 */}
      {isPremium && (
        <>
          <div style={{
            position: 'absolute',
            top: 2,
            left: -6,
            width: 4,
            height: 4,
            background: ms.head,
            opacity: 0.8,
          }} />
          <div style={{
            position: 'absolute',
            top: 2,
            right: -6,
            width: 4,
            height: 4,
            background: ms.head,
            opacity: 0.8,
          }} />
          <div style={{
            position: 'absolute',
            top: -4,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 6,
            height: 6,
            background: '#ffffff',
            opacity: 0.9,
          }} />
        </>
      )}
    </div>
  );
}
