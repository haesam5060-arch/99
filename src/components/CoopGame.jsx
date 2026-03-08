import { useState, useEffect, useRef, useCallback } from 'react';
import { calculateScore, WRONG_PENALTY } from '../utils/scoring';
import { playCorrect, playWrong, playStageStart, playStageClear, playGameComplete, startBGM, stopBGM } from '../utils/sound';
import { leaveRoom } from '../utils/realtime';
import PixelCharacter from './PixelCharacter';

const QUESTION_TIME = 10; // 문제당 제한시간(초)
const SCORE_MULTIPLIER = 2;

// 시드 기반 결정적 문제 생성
function makeChoicesForQuestion(dan, b, answer) {
  const wrong = [];
  for (let i = 1; i <= 9; i++) {
    if (i !== b) wrong.push(dan * i);
  }
  wrong.sort((a, bb) => Math.abs(a - answer) - Math.abs(bb - answer));
  const picks = wrong.slice(0, 3);
  return [answer, ...picks].sort((a, bb) => a - bb);
}

function makeAllQuestions(seed) {
  const allQs = [];
  for (let dan = 2; dan <= 9; dan++) {
    const indices = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    let s = seed + dan * 1000;
    for (let i = indices.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    indices.forEach(b => {
      allQs.push({ dan, b, answer: dan * b, choices: makeChoicesForQuestion(dan, b, dan * b) });
    });
  }
  return allQs; // 72문제 (8단 x 9문제)
}

export default function CoopGame({ coopData, player, nickname, onEnd }) {
  const { isHost, roomChannel, lobbyChannel, players: initialPlayers } = coopData;

  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [gamePhase, setGamePhase] = useState('countdown'); // countdown, playing, danClear, finished
  const [countdown, setCountdown] = useState(3);
  const [feedback, setFeedback] = useState(null);
  const [selectedChoice, setSelectedChoice] = useState(-1);
  const [shake, setShake] = useState(false);
  const [flashColor, setFlashColor] = useState(null);
  const [timer, setTimer] = useState(QUESTION_TIME);
  const [danClearDan, setDanClearDan] = useState(0);

  // 실시간 랭킹
  const [rankings, setRankings] = useState(() =>
    (initialPlayers || []).map(p => ({
      nickname: p.nickname,
      characterId: p.equippedCharacter || 0,
      score: 0,
      currentDan: 2,
      qInDan: 0,
      finished: false,
    }))
  );
  const [rankChanges, setRankChanges] = useState({});
  const prevRankMapRef = useRef({});
  const finishedByOtherRef = useRef(false);

  const timerRef = useRef(null);
  const qStartTimeRef = useRef(null);
  const stateRef = useRef({ qIndex: 0, myScore: 0, gamePhase: 'countdown', questions: [] });
  const seedRef = useRef(0);

  // Refs 동기화
  useEffect(() => {
    stateRef.current = { qIndex, myScore, gamePhase, questions };
  });

  const currentQuestion = questions[qIndex];
  const currentDan = currentQuestion?.dan || 2;
  const qInDan = currentQuestion ? (qIndex % 9) : 0;

  // 초기화: 시드 받기 (Presence에서)
  useEffect(() => {
    if (!roomChannel) return;
    let active = true;

    // 호스트가 시드를 presence에 포함
    if (isHost) {
      const seed = Date.now();
      seedRef.current = seed;
      setQuestions(makeAllQuestions(seed));
      roomChannel.track({
        nickname,
        equippedCharacter: player.equippedCharacter || 0,
        score: 0, currentDan: 2, qInDan: 0, finished: false,
        seed, // 호스트만 시드 포함
      });
    }

    // Presence sync로 랭킹 + 시드 수신
    const handleSync = () => {
      if (!active) return;
      const state = roomChannel.presenceState();
      const players = [];
      let hostSeed = null;
      Object.values(state).forEach(presences => {
        presences.forEach(p => {
          if (p.nickname) {
            players.push({
              nickname: p.nickname,
              characterId: p.equippedCharacter || 0,
              score: p.score || 0,
              currentDan: p.currentDan || 2,
              qInDan: p.qInDan || 0,
              finished: !!p.finished,
            });
            if (p.seed) hostSeed = p.seed;
          }
        });
      });

      // 비호스트: 시드 받아서 문제 생성
      if (!isHost && hostSeed && seedRef.current === 0) {
        seedRef.current = hostSeed;
        setQuestions(makeAllQuestions(hostSeed));
      }

      // 누군가 완료했으면 전체 게임 종료
      const someoneFinished = players.some(p => p.finished);
      if (someoneFinished && !finishedByOtherRef.current) {
        const s = stateRef.current;
        if (s.gamePhase === 'playing' || s.gamePhase === 'danClear') {
          finishedByOtherRef.current = true;
          clearInterval(timerRef.current);
          // 내 최종 점수도 broadcast
          broadcastMyState(s.myScore, s.qIndex, true);
          setGamePhase('finished');
          stopBGM();
          playGameComplete();
        }
      }

      // 랭킹 업데이트 + 순위 변동 감지
      const sorted = [...players].sort((a, b) => b.score - a.score || (a.finished ? 1 : 0) - (b.finished ? 1 : 0));
      const newRankMap = {};
      sorted.forEach((p, i) => { newRankMap[p.nickname] = i; });

      const changes = {};
      const prev = prevRankMapRef.current;
      sorted.forEach((p, i) => {
        if (prev[p.nickname] !== undefined && prev[p.nickname] !== i) {
          changes[p.nickname] = prev[p.nickname] > i ? 'up' : 'down';
        }
      });
      if (Object.keys(changes).length > 0) {
        setRankChanges(changes);
        setTimeout(() => setRankChanges({}), 1500);
      }
      prevRankMapRef.current = newRankMap;
      setRankings(sorted);
    };

    roomChannel.on('presence', { event: 'sync' }, handleSync);

    return () => { active = false; };
  }, [roomChannel, isHost, nickname]);

  // 카운트다운
  useEffect(() => {
    if (gamePhase !== 'countdown') return;
    if (countdown <= 0) {
      setGamePhase('playing');
      qStartTimeRef.current = Date.now();
      startBGM('game');
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [gamePhase, countdown]);

  // 문제 타이머
  useEffect(() => {
    if (gamePhase !== 'playing' || !currentQuestion) return;
    setTimer(QUESTION_TIME);
    qStartTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - qStartTimeRef.current) / 1000;
      const remaining = Math.max(0, QUESTION_TIME - elapsed);
      setTimer(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        handleTimeout();
      }
    }, 50);

    return () => clearInterval(timerRef.current);
  }, [qIndex, gamePhase]);

  // 타임아웃
  const handleTimeout = useCallback(() => {
    const s = stateRef.current;
    if (s.gamePhase !== 'playing') return;
    const penalty = WRONG_PENALTY * SCORE_MULTIPLIER;
    playWrong();
    setShake(true);
    setFlashColor('rgba(255, 0, 0, 0.15)');
    setFeedback({ type: 'wrong', text: `시간초과! ${penalty}P` });
    setMyScore(prev => {
      const ns = prev + penalty;
      broadcastMyState(ns, s.qIndex + 1);
      return ns;
    });

    setTimeout(() => {
      setShake(false);
      setFlashColor(null);
      setFeedback(null);
      setSelectedChoice(-1);
      advanceQuestion();
    }, 800);
  }, []);

  // 정답 처리 (캐릭터 특수능력 무효 - 스킬 이펙트 없음, 황금 지렁이 감점 면역 없음)
  const handleAnswer = useCallback((answer) => {
    const s = stateRef.current;
    if (s.gamePhase !== 'playing') return;
    const q = s.questions[s.qIndex];
    if (!q) return;

    clearInterval(timerRef.current);
    setSelectedChoice(answer);

    const correct = answer === q.answer;
    const elapsed = qStartTimeRef.current ? (Date.now() - qStartTimeRef.current) / 1000 : QUESTION_TIME;
    const score = correct
      ? calculateScore(elapsed) * SCORE_MULTIPLIER
      : WRONG_PENALTY * SCORE_MULTIPLIER;

    if (correct) {
      playCorrect();
      setFlashColor('rgba(0, 255, 0, 0.12)');
      setFeedback({ type: 'correct', text: `+${score}P` });
    } else {
      playWrong();
      setShake(true);
      setFlashColor('rgba(255, 0, 0, 0.15)');
      setFeedback({ type: 'wrong', text: `${score}P` });
    }

    setMyScore(prev => {
      const ns = prev + score;
      broadcastMyState(ns, s.qIndex + 1);
      return ns;
    });

    setTimeout(() => {
      setShake(false);
      setFlashColor(null);
      setFeedback(null);
      setSelectedChoice(-1);
      advanceQuestion();
    }, correct ? 600 : 800);
  }, []);

  // 다음 문제로
  const advanceQuestion = useCallback(() => {
    const s = stateRef.current;
    const nextIdx = s.qIndex + 1;
    const currentQ = s.questions[s.qIndex];
    const nextQ = s.questions[nextIdx];

    // 단 변경 체크
    if (currentQ && nextQ && currentQ.dan !== nextQ.dan) {
      playStageClear();
      setDanClearDan(currentQ.dan);
      setGamePhase('danClear');
      setTimeout(() => {
        setQIndex(nextIdx);
        setGamePhase('playing');
        playStageStart();
      }, 1500);
      return;
    }

    // 모든 문제 완료 (내가 9단까지 다 풀었을 때 → 전체 종료 트리거)
    if (nextIdx >= s.questions.length) {
      setGamePhase('finished');
      stopBGM();
      playGameComplete();
      broadcastMyState(s.myScore, nextIdx, true);
      return;
    }

    setQIndex(nextIdx);
  }, []);

  // Presence로 내 상태 브로드캐스트
  const broadcastMyState = useCallback((score, nextQIdx, finished = false) => {
    if (!roomChannel) return;
    const q = stateRef.current.questions[nextQIdx] || stateRef.current.questions[nextQIdx - 1];
    roomChannel.track({
      nickname,
      equippedCharacter: player.equippedCharacter || 0,
      score,
      currentDan: q?.dan || 9,
      qInDan: nextQIdx % 9,
      finished,
      seed: isHost ? seedRef.current : undefined,
    });
  }, [roomChannel, nickname, isHost]);

  // 나가기
  const handleQuit = () => {
    clearInterval(timerRef.current);
    stopBGM();
    leaveRoom(roomChannel, lobbyChannel);
    onEnd(stateRef.current.myScore);
  };

  // 키보드
  useEffect(() => {
    if (gamePhase !== 'playing' || !currentQuestion) return;
    const handleKey = (e) => {
      const choices = currentQuestion.choices;
      if (e.key >= '1' && e.key <= '4') {
        const idx = parseInt(e.key) - 1;
        if (choices[idx] !== undefined) handleAnswer(choices[idx]);
      }
      if (e.key === 'Escape') handleQuit();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gamePhase, currentQuestion]);

  const myRank = rankings.findIndex(r => r.nickname === nickname) + 1;

  // === 카운트다운 ===
  if (gamePhase === 'countdown') {
    return (
      <div className="game-container" style={{ justifyContent: 'center' }}>
        <div style={{ fontSize: 14, color: '#ffd700', marginBottom: 20, fontFamily: "'Press Start 2P', monospace" }}>
          함께 구구단
        </div>
        <div style={{ fontSize: 64, color: countdown === 0 ? '#00ff00' : '#fff', fontFamily: "'Press Start 2P', monospace", textShadow: '3px 3px 0 #000' }}>
          {countdown === 0 ? 'GO!' : countdown}
        </div>
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 20 }}>
          2단~9단 · 각자 풀기 · 점수 경쟁!
        </div>
        <RankingBoard rankings={rankings} nickname={nickname} rankChanges={{}} compact />
      </div>
    );
  }

  // === 단 클리어 ===
  if (gamePhase === 'danClear') {
    return (
      <div className="game-container" style={{ justifyContent: 'center' }}>
        <div style={{
          fontSize: 28, color: '#ffd700', fontFamily: "'Press Start 2P', monospace",
          textShadow: '2px 2px 0 #b8860b', animation: 'scorePopup 1.5s ease-out',
        }}>
          {danClearDan}단 완료!
        </div>
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 10 }}>
          다음: {danClearDan + 1}단
        </div>
        <RankingBoard rankings={rankings} nickname={nickname} rankChanges={rankChanges} />
      </div>
    );
  }

  // === 게임 완료 - 시상식 ===
  if (gamePhase === 'finished') {
    return (
      <div className="game-container" style={{ justifyContent: 'center', paddingTop: 16 }}>
        <div style={{
          fontSize: 22, color: '#ffd700', marginBottom: 4, fontFamily: "'Press Start 2P', monospace",
          textShadow: '2px 2px 0 #b8860b',
        }}>
          게임 완료!
        </div>
        <div style={{ fontSize: 12, color: '#fff', marginBottom: 16 }}>
          내 점수: <span style={{ color: '#ffd700' }}>{myScore.toLocaleString()}P</span>
          {' '}<span style={{ fontSize: 10, color: myRank === 1 ? '#ffd700' : '#aaa' }}>({myRank}위)</span>
        </div>

        {/* 시상대 */}
        <Podium rankings={rankings} nickname={nickname} />

        <button className="pixel-btn gold" onClick={handleQuit} style={{ marginTop: 16 }}>나가기</button>
      </div>
    );
  }

  // === 로딩 ===
  if (!currentQuestion) {
    return (
      <div className="game-container" style={{ justifyContent: 'center' }}>
        <div style={{ fontSize: 12, color: '#aaa' }}>문제 준비 중...</div>
        <button className="pixel-btn red" onClick={handleQuit} style={{ marginTop: 20 }}>나가기</button>
      </div>
    );
  }

  // === 플레이 중 ===
  const timerPct = timer / QUESTION_TIME;
  const timerColor = timerPct > 0.6 ? '#00cc66' : timerPct > 0.3 ? '#ffa500' : '#ff3333';

  return (
    <div className={`game-container ${shake ? 'shake' : ''}`} style={{ justifyContent: 'flex-start', paddingTop: 8 }}>
      {flashColor && <div className="flash-overlay" style={{ background: flashColor }} />}

      {/* 상단 HUD */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', padding: '0 8px', marginBottom: 4,
        fontFamily: "'Press Start 2P', monospace",
      }}>
        <span style={{ fontSize: 12, color: '#ffd700' }}>{currentDan}단</span>
        <span style={{ fontSize: 9, color: '#aaa' }}>{qInDan + 1}/9</span>
        <span style={{ fontSize: 11, color: '#fff' }}>{myScore.toLocaleString()}P</span>
      </div>

      {/* 타이머 바 */}
      <div style={{ width: '100%', height: 8, background: '#1a1a4e', marginBottom: 6, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          width: `${timerPct * 100}%`, height: '100%', background: timerColor,
          transition: 'width 0.05s linear, background 0.3s',
          borderRadius: 4,
        }} />
      </div>

      {/* 종료 버튼 */}
      <button onClick={handleQuit} style={{
        position: 'fixed', top: 10, left: 10, zIndex: 1000,
        background: 'rgba(20,20,50,0.8)', border: '2px solid #ff4444', color: '#ff4444',
        fontFamily: "'Press Start 2P', monospace", fontSize: 9, padding: '6px 12px',
        cursor: 'pointer', borderRadius: 4,
      }}>종료</button>

      {/* 메인 영역 */}
      <div style={{ flex: 1, width: '100%', display: 'flex', position: 'relative' }}>
        {/* 왼쪽: 문제 + 선택지 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {/* 문제 */}
          <div style={{
            fontSize: 28, fontFamily: "'Press Start 2P', monospace",
            color: '#fff', textShadow: '2px 2px 0 #000', marginBottom: 24,
          }}>
            {currentQuestion.dan} × {currentQuestion.b} = ?
          </div>

          {/* 진행도 점 */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: i < qInDan ? '#00cc66' : i === qInDan ? '#ffd700' : '#333',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>

          {/* 선택지 */}
          <div className="choices-grid" style={{ maxWidth: 280 }}>
            {currentQuestion.choices.map((choice, idx) => (
              <button
                key={`${qIndex}-${idx}`}
                className={`choice-btn ${
                  feedback && choice === currentQuestion.answer ? 'correct' : ''
                } ${
                  feedback && feedback.type === 'wrong' && selectedChoice === choice ? 'wrong' : ''
                }`}
                onClick={() => handleAnswer(choice)}
                disabled={gamePhase !== 'playing' || feedback !== null}
              >
                {choice}
              </button>
            ))}
          </div>

          {/* 피드백 */}
          {feedback && (
            <div style={{
              fontSize: feedback.type === 'correct' ? 22 : 18,
              color: feedback.type === 'correct' ? '#00ff00' : '#ff4444',
              fontFamily: "'Press Start 2P', monospace",
              textShadow: '2px 2px 0 #000', marginTop: 12,
              animation: 'scorePopup 0.8s ease-out',
            }}>
              {feedback.text}
            </div>
          )}
        </div>

        {/* 오른쪽: 실시간 랭킹 */}
        <div style={{
          width: 120, padding: '8px 6px', borderLeft: '1px solid #333366',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ fontSize: 8, color: '#ffd700', marginBottom: 8, textAlign: 'center', fontFamily: "'Press Start 2P', monospace" }}>
            LIVE 순위
          </div>
          {rankings.map((r, i) => {
            const isMe = r.nickname === nickname;
            const change = rankChanges[r.nickname];
            return (
              <div key={r.nickname} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 2px', marginBottom: 2,
                background: isMe ? 'rgba(255,215,0,0.15)' : change === 'up' ? 'rgba(0,255,0,0.1)' : change === 'down' ? 'rgba(255,0,0,0.1)' : 'transparent',
                borderRadius: 4,
                transition: 'background 0.3s, transform 0.3s',
                transform: change === 'up' ? 'scale(1.05)' : 'scale(1)',
                border: isMe ? '1px solid rgba(255,215,0,0.4)' : '1px solid transparent',
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 'bold', width: 16, textAlign: 'center',
                  color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#666',
                  fontFamily: "'Press Start 2P', monospace",
                }}>
                  {i === 0 ? '👑' : i + 1}
                </span>
                <PixelCharacter characterId={r.characterId} pixelSize={1.5} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    fontSize: 6, color: isMe ? '#ffd700' : '#ccc',
                    fontFamily: "'Press Start 2P', monospace",
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{r.nickname}</div>
                  <div style={{ fontSize: 7, color: '#aaa', fontFamily: "'Press Start 2P', monospace" }}>
                    {r.score.toLocaleString()}
                  </div>
                </div>
                {change && (
                  <span style={{
                    fontSize: 10, fontWeight: 'bold',
                    color: change === 'up' ? '#00ff00' : '#ff4444',
                    animation: 'scorePopup 1s ease-out',
                  }}>
                    {change === 'up' ? '▲' : '▼'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{
        fontSize: 8, color: '#444', textAlign: 'center', padding: '4px 0',
        fontFamily: "'Press Start 2P', monospace",
      }}>
        1~4 숫자키 | ESC 종료
      </div>
    </div>
  );
}

// 시상대 컴포넌트 (1위, 2위, 3위 + 나머지 리스트)
function Podium({ rankings, nickname }) {
  const top3 = rankings.slice(0, 3);
  const rest = rankings.slice(3);

  // 시상대 순서: 2위(왼쪽) - 1위(가운데) - 3위(오른쪽)
  const podiumOrder = [];
  if (top3[1]) podiumOrder.push({ ...top3[1], rank: 2 });
  if (top3[0]) podiumOrder.push({ ...top3[0], rank: 1 });
  if (top3[2]) podiumOrder.push({ ...top3[2], rank: 3 });

  const podiumHeights = { 1: 80, 2: 56, 3: 40 };
  const podiumColors = { 1: '#ffd700', 2: '#c0c0c0', 3: '#cd7f32' };
  const medalEmojis = { 1: '👑', 2: '🥈', 3: '🥉' };

  return (
    <div style={{ width: '100%', maxWidth: 340 }}>
      {/* 시상대 */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
        gap: 6, marginBottom: 16, minHeight: 160,
      }}>
        {podiumOrder.map((p) => {
          const isMe = p.nickname === nickname;
          const height = podiumHeights[p.rank];
          return (
            <div key={p.nickname} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              width: p.rank === 1 ? 110 : 90,
              animation: 'slideUp 0.8s ease-out',
            }}>
              {/* 메달 */}
              <div style={{ fontSize: 20, marginBottom: 4 }}>{medalEmojis[p.rank]}</div>
              {/* 캐릭터 */}
              <div style={{
                marginBottom: 6,
                filter: isMe ? 'drop-shadow(0 0 8px rgba(255,215,0,0.6))' : 'none',
              }}>
                <PixelCharacter characterId={p.characterId} pixelSize={p.rank === 1 ? 4 : 3} />
              </div>
              {/* 닉네임 */}
              <div style={{
                fontSize: 8, color: isMe ? '#ffd700' : '#fff',
                fontFamily: "'Press Start 2P', monospace",
                marginBottom: 2, textAlign: 'center',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}>
                {p.nickname}{isMe ? '(나)' : ''}
              </div>
              {/* 점수 */}
              <div style={{
                fontSize: 9, color: podiumColors[p.rank],
                fontFamily: "'Press Start 2P', monospace",
                marginBottom: 4,
              }}>
                {p.score.toLocaleString()}P
              </div>
              {/* 시상대 블록 */}
              <div style={{
                width: '100%', height,
                background: `linear-gradient(180deg, ${podiumColors[p.rank]}33 0%, ${podiumColors[p.rank]}11 100%)`,
                border: `2px solid ${podiumColors[p.rank]}`,
                borderRadius: '6px 6px 0 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{
                  fontSize: 24, fontFamily: "'Press Start 2P', monospace",
                  color: podiumColors[p.rank], textShadow: '2px 2px 0 #000',
                }}>
                  {p.rank}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4위 이하 리스트 */}
      {rest.length > 0 && (
        <div style={{
          background: '#0d0d3d', border: '2px solid #333366', borderRadius: 8,
          padding: 10, marginBottom: 8,
        }}>
          {rest.map((r, i) => {
            const isMe = r.nickname === nickname;
            const rank = i + 4;
            return (
              <div key={r.nickname} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 8px', marginBottom: 2, borderRadius: 4,
                background: isMe ? 'rgba(255,215,0,0.1)' : 'transparent',
                border: isMe ? '1px solid rgba(255,215,0,0.2)' : '1px solid transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 11, width: 24, textAlign: 'center', color: '#666',
                    fontFamily: "'Press Start 2P', monospace",
                  }}>{rank}</span>
                  <PixelCharacter characterId={r.characterId} pixelSize={2} />
                  <span style={{
                    fontSize: 9, color: isMe ? '#ffd700' : '#ccc',
                    fontFamily: "'Press Start 2P', monospace",
                  }}>{r.nickname}</span>
                </div>
                <span style={{
                  fontSize: 9, color: '#aaa',
                  fontFamily: "'Press Start 2P', monospace",
                }}>
                  {r.score.toLocaleString()}P
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 랭킹 보드 (카운트다운, 단클리어 화면용)
function RankingBoard({ rankings, nickname, rankChanges, compact }) {
  return (
    <div style={{
      background: '#0d0d3d', border: '3px solid #333366', borderRadius: 8,
      padding: compact ? 10 : 16, width: '100%', maxWidth: 320, marginTop: 12,
    }}>
      <div style={{ fontSize: 10, color: '#ffd700', marginBottom: 8, textAlign: 'center', fontFamily: "'Press Start 2P', monospace" }}>
        순위
      </div>
      {rankings.map((r, i) => {
        const isMe = r.nickname === nickname;
        const change = rankChanges[r.nickname];
        return (
          <div key={r.nickname} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 10px', marginBottom: 4, borderRadius: 6,
            background: isMe ? 'rgba(255,215,0,0.12)' : change === 'up' ? 'rgba(0,255,0,0.08)' : 'transparent',
            border: isMe ? '1px solid rgba(255,215,0,0.3)' : '1px solid transparent',
            transition: 'all 0.3s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 14, width: 28, textAlign: 'center',
                color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#666',
                fontFamily: "'Press Start 2P', monospace",
              }}>
                {i === 0 ? '👑' : `${i + 1}`}
              </span>
              <PixelCharacter characterId={r.characterId} pixelSize={2} />
              <span style={{
                fontSize: 10, color: isMe ? '#ffd700' : '#fff',
                fontFamily: "'Press Start 2P', monospace",
              }}>{r.nickname}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 7, color: r.finished ? '#00cc66' : '#aaa' }}>
                {r.finished ? '완료!' : `${r.currentDan}단`}
              </div>
              {change && (
                <span style={{
                  fontSize: 12, color: change === 'up' ? '#00ff00' : '#ff4444',
                  animation: 'scorePopup 1s ease-out',
                }}>
                  {change === 'up' ? '▲' : '▼'}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
