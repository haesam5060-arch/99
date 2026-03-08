import { useState, useEffect, useRef, useCallback } from 'react';
import { CHARACTER_SPRITES, CHARACTER_PALETTES, getRandomSkill } from '../data/characters';
import { renderSprite } from '../utils/pixelRenderer';
import { playClick } from '../utils/sound';
import { FURNITURE_DEFS } from './Shop';
import { isOnline, saveRoomData, getRoomData, hostVisitRoom, joinVisitRoom, broadcastVisitPosition, leaveVisitRoom, updateOnlineScore, saveYardFlowers, getYardFlowers } from '../utils/supabase';
import { updatePlayerScore } from '../utils/storage';

const SCALE = 2;

const ACTION_DURATION = { idle: [4000, 8000], walk: [6000, 12000], sleep: [8000, 14000], sit: [6000, 10000], eat: [6000, 10000], eat_at: [8000, 12000], play: [6000, 10000], watch: [8000, 12000], music: [6000, 10000], ball: [4000, 8000], goout: [10000, 10000] };

// 일반 대사 (닉네임 무관)
const SPEECH_BUBBLES_GENERIC = [
  '오늘도 화이팅!', '심심해~', '놀아줘!',
  '배고파...', '잠온다 zzZ', '같이 공부할까?', '나 천재인듯?',
  '여기 좋다~', '간식 먹고싶다', '숙제 다했어?',
  '최고의 하루!', '으쌰으쌰!', '힘내자!', '뭐하고 놀까?',
  '하품~ 아아앙~', '오늘 기분 좋다!', '나 배아파...',
  '노래 부르자~', '산책 가고싶다~', '친구들 보고싶다',
  '오늘 뭐하지?', '비 오나?', '해 떴다!',
  '나 졸려...', '점프 점프!', '달리기 하자!',
  '간식 시간이다~', '초콜릿 먹고싶다~', '아이스크림!',
  '숨바꼭질 하자!', '가위바위보!', '하나 둘 셋!',
];

// 주인 이름 포함 대사 (nickname 동적 삽입)
const OWNER_SPEECH_TEMPLATES = [
  (n) => `${n}아 놀아줘~`,
  (n) => `${n} 최고!`,
  (n) => `${n}아 같이 공부하자!`,
  (n) => `${n}아 간식 줘~`,
  (n) => `${n} 오늘도 파이팅!`,
  (n) => `${n}아 사랑해~`,
  (n) => `${n}이 제일 좋아!`,
  (n) => `${n}아 나 심심해~`,
  (n) => `${n}아 안녕!`,
  (n) => `${n} 보고싶었어!`,
  (n) => `${n}아 같이 놀자!`,
  (n) => `${n}아 배고파~`,
  (n) => `${n}아 숙제 했어?`,
  (n) => `${n}아 나 칭찬해줘!`,
  (n) => `${n} 대단해!`,
];

// 구구단 퀴즈 생성
function generateQuiz() {
  const a = 2 + Math.floor(Math.random() * 8); // 2~9
  const b = 1 + Math.floor(Math.random() * 9); // 1~9
  const answer = a * b;
  const quizTypes = [
    `${a}x${b}=? 정답은 ${answer}!`,
    `${a} 곱하기 ${b}은? ${answer}!`,
    `문제! ${a}x${b}은~?`,
    `${a}x${b}=${answer} 맞지?`,
    `퀴즈! ${a}x${b}=?`,
    `${a}단! ${a}x${b}=${answer}!`,
    `${answer}=${a}x${b} 알지?`,
    `나 알아! ${a}x${b}=${answer}!`,
  ];
  return quizTypes[Math.floor(Math.random() * quizTypes.length)];
}

// 구구단 관련 대사
const GUGUDAN_SPEECH = [
  '구구단 연습하자~', '구구단은 재밌어!',
  '2x3=6 쉽지!', '9x9=81 어렵다!',
  '구구단 마스터가 될거야!', '곱셈은 내가 최고!',
  '7단이 젤 어려워~', '외우면 천재!',
];

// 종합 말풍선 생성 함수
function getRandomSpeech(nickname) {
  const roll = Math.random();
  if (roll < 0.25) {
    // 25% 주인 이름 대사
    const tmpl = OWNER_SPEECH_TEMPLATES[Math.floor(Math.random() * OWNER_SPEECH_TEMPLATES.length)];
    return tmpl(nickname);
  } else if (roll < 0.45) {
    // 20% 구구단 퀴즈/대사
    return Math.random() < 0.6
      ? generateQuiz()
      : GUGUDAN_SPEECH[Math.floor(Math.random() * GUGUDAN_SPEECH.length)];
  } else {
    // 55% 일반 대사
    return SPEECH_BUBBLES_GENERIC[Math.floor(Math.random() * SPEECH_BUBBLES_GENERIC.length)];
  }
}

// 상호작용별 대사
const INTERACTION_SPEECH = {
  eat: ['배고프다~', '간식 꺼내먹어야지~', '뭐 먹을까~', '냉장고 열어보자!', '맛있는 거 있을까?', '우유 마시고싶다~'],
  eat_at: ['냠냠 맛있다!', '꿀맛이다~', '잘 먹겠습니다!', '배부르다~', '맛있는 간식!', '한 입만 더~', '이거 진짜 맛있어!', '배 터지겠다~'],
  play: ['부릉부릉~', '출발이다!', '장난감 트럭 최고!', '배달 왔어요~', '삐뽀삐뽀!', '경찰차다!', '소방차 출동!', '짐 싣는 중~'],
  watch: ['만화 보자~', 'TV 볼 시간이다!', '재밌는 거 하고있다~', '꺄~ 재밌어!', '이 프로 좋아!', '다음 편은 언제?', '주인공 멋져!', '한 편만 더~'],
  music: ['도레미파솔~', '라시도~!', '피아노 연습!', '멜로디~', '나 천재 피아니스트!', '딩동댕~', '작곡 중이야!', '콩쿠르 나갈거야!'],
  ball: ['슛! 골인~!', '패스 패스!', '드리블~', '여기로 차!', '골~~~~!', '나 메시다!', '헤딩슛!', '월드컵 우승!'],
  goout_leave: ['학교 갔다올게~!', '산책 다녀올게~!', '놀이터 다녀올게!', '친구 만나고 올게~!', '마트 다녀올게!', '잠깐 나갔다올게~!'],
  goout_return: ['다녀왔어~!', '집이 최고야!', '아~ 피곤해!', '재밌었다~!', '돌아왔어!', '집이다 집!'],
};

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// ── 가구 캔버스 ──
export function FurnitureCanvas({ furnitureId, scale = 2, isOpen = false }) {
  const canvasRef = useRef(null);
  const f = FURNITURE_DEFS[furnitureId];

  useEffect(() => {
    if (!canvasRef.current || !f) return;
    const ctx = canvasRef.current.getContext('2d');
    const spriteData = (isOpen && f.spriteOpen) ? f.spriteOpen : f.sprite;
    const colorData = (isOpen && f.colorsOpen) ? f.colorsOpen : f.colors;
    const w = f.w * scale;
    const h = f.h * scale;
    canvasRef.current.width = w;
    canvasRef.current.height = h;
    ctx.clearRect(0, 0, w, h);
    spriteData.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val && colorData[val]) {
          ctx.fillStyle = colorData[val];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });
  }, [furnitureId, scale, isOpen]);

  if (!f) return null;
  const w = f.w * scale;
  const h = f.h * scale;
  return <canvas ref={canvasRef} width={w} height={h} style={{ width: w, height: h, imageRendering: 'pixelated', pointerEvents: 'none' }} />;
}

// ── 캐릭터 렌더러 (실제 px 좌표) ──
function RoomCharacter({ characterId, x, y, flip, sleeping, scale = 2 }) {
  const canvasRef = useRef(null);
  const palette = CHARACTER_PALETTES[characterId];
  const sprite = CHARACTER_SPRITES[characterId]?.idle;
  const spriteSize = palette?.spriteSize || 16;
  const ps = spriteSize === 32 ? Math.max(1, Math.floor(scale / 2)) : scale;
  const canvasSize = spriteSize * ps;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sprite || !palette?.colors) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    renderSprite(ctx, sprite, palette.colors, 0, 0, ps);
  }, [characterId, sprite, palette, canvasSize, ps]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize}
      height={canvasSize}
      style={{
        position: 'absolute',
        left: x - canvasSize / 2,
        top: y - canvasSize,
        width: canvasSize,
        height: canvasSize,
        imageRendering: 'pixelated',
        transform: `scaleX(${flip ? -1 : 1})${sleeping ? ' rotate(90deg) translateY(8px)' : ''}`,
        zIndex: Math.floor(y),
      }}
    />
  );
}

// ── 메인 ──
export default function MyRoom({ player, nickname, onBack }) {
  const [layout, setLayout] = useState(() => {
    try {
      const saved = localStorage.getItem(`room_layout_${nickname}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [ownedFurniture, setOwnedFurniture] = useState(() => {
    try {
      const saved = localStorage.getItem(`room_furniture_${nickname}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [editMode, setEditMode] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [charStates, setCharStates] = useState([]);
  const [roomSize, setRoomSize] = useState({ w: 600, h: 400 });
  const [doorOpen, setDoorOpen] = useState(false);
  const [ballPositions, setBallPositions] = useState({}); // { layoutIdx: { x, y } } 가상좌표
  const [goalCelebration, setGoalCelebration] = useState(null); // { x, y, particles }
  const goalCooldownRef = useRef(false);
  const ballPhysicsRef = useRef({}); // { layoutIdx: { x, y, vx, vy } } 가상좌표
  const charStatesRef = useRef([]); // 축구공 물리용 최신 캐릭터 상태 참조
  const roomRef = useRef(null);
  const animFrameRef = useRef(null);
  const keysRef = useRef({}); // 키보드 입력 상태
  const joystickRef = useRef({ active: false, dx: 0, dy: 0 }); // 모바일 조이스틱

  const ownedCharacters = player.characters || [0];
  const equippedId = Number(player.equippedCharacter ?? ownedCharacters[0]);
  const [ridingTruckIdx, setRidingTruckIdx] = useState(null);
  const tailRef = useRef([]);
  const [flowers, setFlowers] = useState([]); // [{ id, x, y, createdAt }]
  const flowerIdRef = useRef(0);

  // ── 앞마당 시스템 ──
  const [yardMode, setYardMode] = useState(null); // null | 'own' | 'visiting'
  const [yardOwner, setYardOwner] = useState(''); // 앞마당 주인 닉네임
  const [yardFlowers, setYardFlowers] = useState([]); // [{ gridX, gridY, type }]
  const [yardCharPos, setYardCharPos] = useState({ x: 150, y: 160 }); // 가상좌표 300x200
  const [doorChoice, setDoorChoice] = useState(false); // 문 선택 팝업
  const yardCharFlip = useRef(false);
  const yardModeRef = useRef(null);
  const yardFlowersRef = useRef([]);
  const yardCharPosRef = useRef({ x: 150, y: 160 });
  const yardOwnerRef = useRef('');

  // 앞마당 꽃 종류 (5가지)
  const YARD_FLOWER_TYPES = [
    { name: '해바라기', color1: '#ffcc00', color2: '#ff8800', color3: '#886600', stem: '#228822' },
    { name: '튤립', color1: '#ff4466', color2: '#cc2244', color3: '#aa1133', stem: '#228822' },
    { name: '장미', color1: '#ff2244', color2: '#cc0022', color3: '#880011', stem: '#1a7a1a' },
    { name: '데이지', color1: '#ffffff', color2: '#ffee44', color3: '#ccbb22', stem: '#2a8a2a' },
    { name: '라벤더', color1: '#aa66ff', color2: '#8844dd', color3: '#6622bb', stem: '#228822' },
  ];
  const YARD_COLS = 8;
  const YARD_ROWS = 5;

  // ── 구구단 퀴즈 (자동차 타기 / 문 이동 전) ──
  const [quiz, setQuiz] = useState(null); // { a, b, answer, choices, onCorrect }
  const [quizWrong, setQuizWrong] = useState(null); // 틀린 선택지 인덱스
  // ── 1:1 대결 퀴즈 ──
  const [duel, setDuel] = useState(null); // { opponentName, opponentId, a, b, answer, choices, timeLeft }
  const [duelWrong, setDuelWrong] = useState(null);
  const [duelResult, setDuelResult] = useState(null); // 'win' | 'lose' | null
  const duelTimerRef = useRef(null);
  const generateRoomQuiz = useCallback((onCorrect) => {
    const a = 2 + Math.floor(Math.random() * 8); // 2~9
    const b = 1 + Math.floor(Math.random() * 9); // 1~9
    const answer = a * b;
    const choiceSet = new Set([answer]);
    while (choiceSet.size < 4) {
      const fake = Math.max(1, answer + Math.floor(Math.random() * 21) - 10);
      choiceSet.add(fake);
    }
    const choices = [...choiceSet].sort(() => Math.random() - 0.5);
    setQuiz({ a, b, answer, choices, onCorrect });
  }, []);

  const handleQuizAnswer = async (selected) => {
    if (!quiz) return;
    if (selected !== quiz.answer) {
      setQuizWrong(selected);
      setTimeout(() => setQuizWrong(null), 500);
      return;
    }
    // 정답! +100점
    if (isOnline()) {
      await updateOnlineScore(nickname, 100);
    } else {
      updatePlayerScore(nickname, 100);
    }
    const callback = quiz.onCorrect;
    setQuiz(null);
    if (callback) callback();
  };

  // ── 1:1 대결 ──
  const DUEL_TIME = 10; // 제한시간 10초
  const NEAR_RANGE = 40; // 캐릭터 근접 거리

  const findNearbyCharacter = useCallback((eq) => {
    if (!eq) return null;
    // 온라인 상대방(게스트) 캐릭터만 검색 (AI 캐릭터는 대결 불가)
    for (const g of guests) {
      const dx = eq.x - g.x, dy = eq.y - g.y;
      if (Math.sqrt(dx * dx + dy * dy) < NEAR_RANGE) {
        return { name: g.nickname, charId: g.characterId };
      }
    }
    return null;
  }, [guests]);

  const startDuel = useCallback((opponentName, opponentId) => {
    const a = 2 + Math.floor(Math.random() * 8);
    const b = 1 + Math.floor(Math.random() * 9);
    const answer = a * b;
    const choiceSet = new Set([answer]);
    while (choiceSet.size < 4) {
      const fake = Math.max(1, answer + Math.floor(Math.random() * 21) - 10);
      choiceSet.add(fake);
    }
    const choices = [...choiceSet].sort(() => Math.random() - 0.5);
    setDuel({ opponentName, opponentId, a, b, answer, choices, timeLeft: DUEL_TIME });
    setDuelWrong(null);
    setDuelResult(null);
    // 타이머 시작
    if (duelTimerRef.current) clearInterval(duelTimerRef.current);
    duelTimerRef.current = setInterval(() => {
      setDuel(prev => {
        if (!prev) return null;
        const next = prev.timeLeft - 1;
        if (next <= 0) {
          clearInterval(duelTimerRef.current);
          setDuelResult('lose');
          return { ...prev, timeLeft: 0 };
        }
        return { ...prev, timeLeft: next };
      });
    }, 1000);
  }, []);

  const handleDuelAnswer = async (selected) => {
    if (!duel || duelResult) return;
    if (selected !== duel.answer) {
      setDuelWrong(selected);
      setTimeout(() => setDuelWrong(null), 400);
      return;
    }
    // 정답 = 승리!
    clearInterval(duelTimerRef.current);
    setDuelResult('win');
    if (isOnline()) {
      await updateOnlineScore(nickname, 100);
    } else {
      updatePlayerScore(nickname, 100);
    }
  };

  const closeDuel = () => {
    clearInterval(duelTimerRef.current);
    setDuel(null);
    setDuelResult(null);
    setDuelWrong(null);
  };

  // ── 방 방문 시스템 ──
  const [visitMode, setVisitMode] = useState(null); // null | 'input' | 'visiting'
  const [visitTarget, setVisitTarget] = useState(''); // 방문할 닉네임
  const [visitError, setVisitError] = useState('');
  const [guests, setGuests] = useState([]); // 내 방에 놀러온 게스트 [{nickname, characterId, x, y, flip}]
  const visitChannelRef = useRef(null);
  const hostChannelRef = useRef(null);
  const visitModeRef = useRef(null);

  // 온라인이면 Supabase에서 가구/레이아웃 로드
  useEffect(() => {
    if (!isOnline()) return;
    (async () => {
      const data = await getRoomData(nickname);
      if (data) {
        if (data.room_furniture?.length > 0) {
          setOwnedFurniture(data.room_furniture);
          localStorage.setItem(`room_furniture_${nickname}`, JSON.stringify(data.room_furniture));
        }
        if (data.room_layout?.length > 0) {
          setLayout(data.room_layout);
          localStorage.setItem(`room_layout_${nickname}`, JSON.stringify(data.room_layout));
        }
      }
    })();
  }, [nickname]);

  // 실제 DOM 크기 추적
  useEffect(() => {
    const updateSize = () => {
      if (roomRef.current) {
        const rect = roomRef.current.getBoundingClientRect();
        setRoomSize({ w: rect.width, h: rect.height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // visitModeRef를 항상 최신 상태로 동기화
  useEffect(() => { visitModeRef.current = visitMode; }, [visitMode]);

  useEffect(() => {
    // 방문 중이거나 입력 모달 중에는 내 방 데이터를 덮어쓰지 않음
    if (visitModeRef.current) return;
    localStorage.setItem(`room_layout_${nickname}`, JSON.stringify(layout));
    if (isOnline()) {
      const furniture = JSON.parse(localStorage.getItem(`room_furniture_${nickname}`) || '[]');
      saveRoomData(nickname, layout, furniture);
    }
  }, [layout, nickname]);

  // 키보드 입력 + 스페이스바 꽃 심기
  const plantFlower = useCallback((x, y, fromBroadcast = false) => {
    const id = flowerIdRef.current++;
    const colors = ['#ff6688', '#ffaa44', '#ff44aa', '#44aaff', '#ffff44', '#aa66ff'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    setFlowers(prev => [...prev, { id, x, y, color, createdAt: Date.now() }]);
    setTimeout(() => setFlowers(prev => prev.filter(f => f.id !== id)), 10000);
    // 브로드캐스트 (방문/호스트 채널)
    if (!fromBroadcast) {
      const flowerData = { type: 'flower', x, y, color };
      if (visitChannelRef.current) broadcastVisitPosition(visitChannelRef.current, 'guest-move', flowerData);
      if (hostChannelRef.current) broadcastVisitPosition(hostChannelRef.current, 'host-chars', flowerData);
    }
  }, []);

  useEffect(() => {
    const onDown = (e) => {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault();
        keysRef.current[e.key] = true;
      }
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        // 앞마당 모드에서는 별도 처리 (꽃 심기/뽑기는 버튼의 onClick과 동일)
        if (yardModeRef.current) {
          document.querySelector('[data-yard-action]')?.click();
          return;
        }
        if (duel || quiz) return; // 이미 퀴즈 중이면 무시
        const eq = charStatesRef.current.find(c => Number(c.id) === equippedId);
        if (!eq) return;
        const nearby = findNearbyCharacter(eq);
        if (nearby) {
          startDuel(nearby.name, nearby.charId);
        } else {
          plantFlower(eq.x, eq.y);
        }
      }
    };
    const onUp = (e) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [equippedId, plantFlower]);

  // ── 앞마당 ref 동기화 ──
  useEffect(() => { yardModeRef.current = yardMode; }, [yardMode]);
  useEffect(() => { yardFlowersRef.current = yardFlowers; }, [yardFlowers]);
  useEffect(() => { yardCharPosRef.current = yardCharPos; }, [yardCharPos]);
  useEffect(() => { yardOwnerRef.current = yardOwner; }, [yardOwner]);

  // ── 앞마당 캐릭터 이동 루프 ──
  useEffect(() => {
    if (!yardMode) return;
    let frameId;
    const yardTick = () => {
      const keys = keysRef.current;
      const joy = joystickRef.current;
      let dx = 0, dy = 0;
      if (keys.ArrowLeft) dx -= 1;
      if (keys.ArrowRight) dx += 1;
      if (keys.ArrowUp) dy -= 1;
      if (keys.ArrowDown) dy += 1;
      if (joy.active) { dx += joy.dx; dy += joy.dy; }
      if (dx !== 0 || dy !== 0) {
        const speed = 1.8;
        const len = Math.sqrt(dx * dx + dy * dy);
        dx = (dx / len) * speed;
        dy = (dy / len) * speed;
        if (dx < 0) yardCharFlip.current = true;
        if (dx > 0) yardCharFlip.current = false;
        setYardCharPos(prev => ({
          x: Math.max(10, Math.min(290, prev.x + dx)),
          y: Math.max(60, Math.min(190, prev.y + dy)),
        }));
      }
      frameId = requestAnimationFrame(yardTick);
    };
    frameId = requestAnimationFrame(yardTick);
    return () => cancelAnimationFrame(frameId);
  }, [yardMode]);

  // ── 호스트 채널: 내 방을 개방하여 게스트 수신 ──
  useEffect(() => {
    if (!isOnline()) return;
    const ch = hostVisitRoom(nickname, equippedId, {
      onGuestUpdate: (payload) => {
        // 꽃 수신
        if (payload.type === 'flower') { plantFlower(payload.x, payload.y, true); return; }
        if (payload.type === 'presence') {
          setGuests(prev => {
            const existing = new Set(prev.map(g => g.nickname));
            const newGuests = [...prev];
            payload.visitors.forEach(v => {
              if (!existing.has(v.nickname)) {
                newGuests.push({ nickname: v.nickname, characterId: v.characterId, x: 100, y: 200, flip: false });
              }
            });
            // 떠난 게스트 제거
            const activeNames = new Set(payload.visitors.map(v => v.nickname));
            return newGuests.filter(g => activeNames.has(g.nickname));
          });
        } else if (payload.nickname && payload.x != null) {
          setGuests(prev => prev.map(g =>
            g.nickname === payload.nickname ? { ...g, x: payload.x, y: payload.y, flip: payload.flip } : g
          ));
        }
      },
    });
    hostChannelRef.current = ch;
    return () => { leaveVisitRoom(ch); hostChannelRef.current = null; };
  }, [nickname, equippedId]);

  // ── 내 위치 브로드캐스트 (방문자: guest-move, 호스트: host-chars) ──
  useEffect(() => {
    const eq = charStates.find(c => Number(c.id) === equippedId);
    if (!eq) return;
    const posData = { nickname, characterId: equippedId, x: eq.x, y: eq.y, flip: eq.flip };
    // 방문 중이면 상대방 채널에 guest-move
    if (visitMode === 'visiting' && visitChannelRef.current) {
      broadcastVisitPosition(visitChannelRef.current, 'guest-move', posData);
    }
    // 호스트로서 내 채널에 host-chars (방문자에게 내 위치 전달)
    if (hostChannelRef.current && guests.length > 0) {
      broadcastVisitPosition(hostChannelRef.current, 'host-chars', posData);
    }
  }, [charStates, visitMode, equippedId, nickname, guests.length]);

  // 놀러가기 핸들러
  const handleVisit = async () => {
    if (!visitTarget.trim()) return;
    // 자기 닉네임 입력 시 내 방으로 복귀
    if (visitTarget.trim() === nickname) {
      playClick();
      leaveVisitRoom(visitChannelRef.current);
      visitChannelRef.current = null;
      visitModeRef.current = null;
      setVisitMode(null);
      setVisitTarget('');
      setGuests([]);
      try {
        const saved = localStorage.getItem(`room_layout_${nickname}`);
        if (saved) setLayout(JSON.parse(saved));
      } catch {}
      // 내 보유 캐릭터로 복원
      setCharStates(ownedCharacters.map((id, i) => ({
        id, x: 40 + (i * (roomSize.w - 80) / Math.max(ownedCharacters.length, 1)),
        y: floorTop + Math.random() * (floorBottom - floorTop),
        action: 'idle', targetX: null, targetY: null,
        flip: Math.random() > 0.5, actionTimer: Date.now() + randRange(1000, 3000),
        interacting: null, speech: null, speechTimer: Date.now() + randRange(6000, 16000),
      })));
      return;
    }
    setVisitError('');
    const data = await getRoomData(visitTarget.trim());
    if (!data) { setVisitError('존재하지 않는 닉네임이에요'); return; }
    // 방문 모드 ref를 먼저 설정하여 레이아웃 저장 방지
    visitModeRef.current = 'visiting';
    // 상대방 방 레이아웃 로드
    if (data.room_layout?.length > 0) setLayout(data.room_layout);
    // 상대방 보유 캐릭터로 교체 (내 장착 캐릭터만 포함)
    const hostChars = data.characters || [0];
    const roomChars = hostChars.includes(equippedId)
      ? hostChars
      : [...hostChars, equippedId];
    setCharStates(prev => {
      const myEq = prev.find(c => Number(c.id) === equippedId);
      return roomChars.map((id, i) => {
        if (Number(id) === equippedId && myEq) return myEq; // 내 캐릭터 위치 유지
        return {
          id, x: 40 + (i * (roomSize.w - 80) / Math.max(roomChars.length, 1)),
          y: floorTop + Math.random() * (floorBottom - floorTop),
          action: 'idle', targetX: null, targetY: null,
          flip: Math.random() > 0.5, actionTimer: Date.now() + randRange(1000, 3000),
          interacting: null, speech: null, speechTimer: Date.now() + randRange(6000, 16000),
        };
      });
    });
    // 방문 채널 접속
    const ch = joinVisitRoom(visitTarget.trim(), nickname, equippedId, {
      onHostUpdate: (payload) => {
        if (payload.type === 'flower') { plantFlower(payload.x, payload.y, true); return; }
        // 호스트(방 주인) 캐릭터 위치 수신 → guests에 추가/업데이트
        if (payload.nickname && payload.x != null) {
          setGuests(prev => {
            const exists = prev.find(g => g.nickname === payload.nickname);
            if (exists) {
              return prev.map(g => g.nickname === payload.nickname
                ? { ...g, x: payload.x, y: payload.y, flip: payload.flip, characterId: payload.characterId }
                : g
              );
            }
            return [...prev, { nickname: payload.nickname, characterId: payload.characterId, x: payload.x, y: payload.y, flip: payload.flip }];
          });
        }
      },
      onGuestUpdate: (payload) => {
        if (payload.type === 'flower') { plantFlower(payload.x, payload.y, true); return; }
        if (payload.type === 'presence') {
          setGuests(prev => {
            const newGuests = prev.filter(g => g._isHost); // 호스트는 유지
            payload.visitors.forEach(v => {
              if (v.nickname !== nickname) {
                const existing = prev.find(g => g.nickname === v.nickname);
                newGuests.push(existing || { nickname: v.nickname, characterId: v.characterId, x: 200, y: 200, flip: false });
              }
            });
            return newGuests;
          });
        } else if (payload.nickname && payload.nickname !== nickname && payload.x != null) {
          setGuests(prev => prev.map(g =>
            g.nickname === payload.nickname ? { ...g, x: payload.x, y: payload.y, flip: payload.flip } : g
          ));
        }
      },
    });
    visitChannelRef.current = ch;
    setVisitMode('visiting');
    playClick();
  };

  const handleLeaveVisit = () => {
    playClick();
    leaveVisitRoom(visitChannelRef.current);
    visitChannelRef.current = null;
    // ref를 먼저 null로 설정하여 layout 복원 시 저장 방지
    visitModeRef.current = null;
    setVisitMode(null);
    setVisitTarget('');
    setGuests([]);
    // 원래 내 방 레이아웃 복원
    try {
      const saved = localStorage.getItem(`room_layout_${nickname}`);
      if (saved) setLayout(JSON.parse(saved));
    } catch {}
    // 내 보유 캐릭터로 복원
    setCharStates(ownedCharacters.map((id, i) => ({
      id, x: 40 + (i * (roomSize.w - 80) / Math.max(ownedCharacters.length, 1)),
      y: floorTop + Math.random() * (floorBottom - floorTop),
      action: 'idle', targetX: null, targetY: null,
      flip: Math.random() > 0.5, actionTimer: Date.now() + randRange(1000, 3000),
      interacting: null, speech: null, speechTimer: Date.now() + randRange(6000, 16000),
    })));
  };

  // 바닥 영역 (실제 px) - 벽 30% 아래부터 92%까지
  const floorTop = roomSize.h * 0.35;
  const floorBottom = roomSize.h * 0.92;

  // 캐릭터 초기 위치 (실제 px)
  useEffect(() => {
    if (roomSize.w < 10) return;
    const states = ownedCharacters.map((id, i) => ({
      id,
      x: 40 + (i * (roomSize.w - 80) / Math.max(ownedCharacters.length, 1)),
      y: floorTop + Math.random() * (floorBottom - floorTop),
      action: 'idle',
      targetX: null,
      targetY: null,
      flip: Math.random() > 0.5,
      actionTimer: Date.now() + randRange(1000, 3000),
      interacting: null,
      speech: null,
      speechTimer: Date.now() + randRange(6000, 16000),
    }));
    setCharStates(states);
  }, [ownedCharacters.length, roomSize.w]);

  // 가구 상호작용 위치 (실제 px) - 같은 타입 가구 중 랜덤 선택
  const findInteraction = useCallback((type) => {
    const matches = [];
    for (let i = 0; i < layout.length; i++) {
      const item = layout[i];
      const f = FURNITURE_DEFS[item.id];
      if (f?.interaction === type) {
        // 축구공은 동적 위치(ballPhysicsRef) 사용
        let vx = item.x, vy = item.y;
        if (item.id === 'soccerBall' && ballPhysicsRef.current[i]) {
          vx = ballPhysicsRef.current[i].x;
          vy = ballPhysicsRef.current[i].y;
        }
        const px = (vx / 300) * roomSize.w + (f.w * SCALE) / 2;
        // 문은 하단 중앙(문 앞)으로, 나머지는 가구 중앙 높이로
        const py = (vy / 200) * roomSize.h + (f.h * SCALE) / 2;
        matches.push({ x: px, y: py });
      }
    }
    if (matches.length === 0) return null;
    return matches[Math.floor(Math.random() * matches.length)];
  }, [layout, roomSize]);

  // charStatesRef 동기화 (축구공 물리에서 최신 상태 참조용)
  useEffect(() => { charStatesRef.current = charStates; }, [charStates]);

  // 캐릭터 AI 루프
  useEffect(() => {
    if (editMode) return;

    const PLAYER_SPEED = 1.5;
    const TAIL_GAP = 28; // 꼬리 캐릭터 간격 (px)
    const TAIL_FOLLOW_SPEED = 2.5;
    const TAIL_HIT_RANGE = 30; // 충돌 감지 범위

    const tick = () => {
      setCharStates(prev => {
        // 1단계: 장착 캐릭터 이동
        const updated = prev.map(ch => {
        // 장착 캐릭터는 플레이어가 직접 조작
        if (Number(ch.id) === equippedId) {
          const keys = keysRef.current;
          const joy = joystickRef.current;
          let dx = 0, dy = 0;
          if (keys.ArrowLeft) dx -= 1;
          if (keys.ArrowRight) dx += 1;
          if (keys.ArrowUp) dy -= 1;
          if (keys.ArrowDown) dy += 1;
          if (joy.active) { dx += joy.dx; dy += joy.dy; }
          const moving = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;
          if (moving) {
            const len = Math.sqrt(dx * dx + dy * dy);
            const speed = ch.riding ? PLAYER_SPEED * 1.5 : PLAYER_SPEED;
            const nx = (dx / len) * speed;
            const ny = (dy / len) * speed;
            const newX = Math.max(10, Math.min(roomSize.w - 10, ch.x + nx));
            const newY = Math.max(roomSize.h * 0.35, Math.min(roomSize.h * 0.92, ch.y + ny));
            return { ...ch, x: newX, y: newY, flip: dx < 0 ? true : dx > 0 ? false : ch.flip, action: 'walk' };
          }
          return ch.action === 'walk' ? { ...ch, action: 'idle' } : ch;
        }
        // 꼬리물기 중인 캐릭터는 AI 스킵 (2단계에서 처리)
        if (ch.inTail) return ch;
        const now = Date.now();
        if (now < ch.actionTimer) {
          if (ch.action === 'walk' && ch.targetX != null) {
            const dx = ch.targetX - ch.x;
            const dy = (ch.targetY || ch.y) - ch.y;
            if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
              const nextAction = ch.interacting || 'idle';
              // 문 도착 시 외출 처리
              if (ch.interacting === 'goout') {
                const leaveSpeech = INTERACTION_SPEECH.goout_leave[Math.floor(Math.random() * INTERACTION_SPEECH.goout_leave.length)];
                setDoorOpen(true);
                setTimeout(() => setDoorOpen(false), 1500);
                setTimeout(() => {
                  setDoorOpen(true);
                  setTimeout(() => setDoorOpen(false), 1500);
                  setCharStates(prev => prev.map(c => {
                    if (c.id !== ch.id || !c.hidden) return c;
                    const returnSpeech = INTERACTION_SPEECH.goout_return[Math.floor(Math.random() * INTERACTION_SPEECH.goout_return.length)];
                    return { ...c, hidden: false, action: 'idle', interacting: null, speech: returnSpeech, speechTimer: Date.now() + 3000, actionTimer: Date.now() + randRange(3000, 5000) };
                  }));
                }, 5000);
                return { ...ch, x: ch.targetX, y: ch.targetY || ch.y, action: 'goout', hidden: true, interacting: 'goout', targetX: null, targetY: null, speech: leaveSpeech, speechTimer: Date.now() + 2000, actionTimer: Date.now() + 8000 };
              }
              // 가구 도착 시 상호작용 대사
              let arrivalSpeech = null;
              if (ch.interacting && INTERACTION_SPEECH[ch.interacting]) {
                arrivalSpeech = INTERACTION_SPEECH[ch.interacting][Math.floor(Math.random() * INTERACTION_SPEECH[ch.interacting].length)];
              }
              return { ...ch, x: ch.targetX, y: ch.targetY || ch.y, action: nextAction, targetX: null, targetY: null,
                ...(arrivalSpeech ? { speech: arrivalSpeech, speechTimer: Date.now() + 2500 } : {}) };
            }
            const dist = Math.sqrt(dx * dx + dy * dy);
            const speed = 0.9;
            return {
              ...ch,
              x: ch.x + (dx / dist) * speed,
              y: ch.y + (dy / dist) * speed,
              flip: dx < 0,
            };
          }
          return ch;
        }

        // 연쇄 행동: 냉장고 도착 후 식탁으로 이동
        if (ch.interacting === 'eat' && ch.action === 'eat') {
          const tablePos = findInteraction('eat_at');
          if (tablePos) {
            const eatSpeech = INTERACTION_SPEECH.eat[Math.floor(Math.random() * INTERACTION_SPEECH.eat.length)];
            return { ...ch, action: 'walk', targetX: tablePos.x, targetY: tablePos.y, flip: tablePos.x < ch.x, actionTimer: now + 4000, interacting: 'eat_at', speech: eatSpeech, speechTimer: now + 2500 };
          }
          // 식탁 없으면 그 자리에서 먹기
          const eatSpeech = INTERACTION_SPEECH.eat_at[Math.floor(Math.random() * INTERACTION_SPEECH.eat_at.length)];
          return { ...ch, action: 'idle', interacting: null, actionTimer: now + randRange(3000, 5000), speech: eatSpeech, speechTimer: now + 2500 };
        }

        const roll = Math.random();
        // 가능한 행동 목록 구성
        const actions = ['walk', 'idle'];
        if (findInteraction('sleep')) actions.push('sleep');
        if (findInteraction('sit')) actions.push('sit');
        if (findInteraction('eat')) actions.push('eat');
        if (findInteraction('play')) actions.push('play');
        if (findInteraction('watch')) actions.push('watch');
        if (findInteraction('music')) actions.push('music');
        if (findInteraction('ball')) actions.push('ball');
        if (findInteraction('goout')) actions.push('goout');

        // 가중치: walk 30%, idle 20%, 나머지 균등 분배
        let newAction;
        if (roll < 0.25) newAction = 'walk';
        else if (roll < 0.40) newAction = 'idle';
        else {
          const interactActions = actions.filter(a => a !== 'walk' && a !== 'idle');
          if (interactActions.length > 0) {
            newAction = interactActions[Math.floor(Math.random() * interactActions.length)];
          } else {
            newAction = roll < 0.6 ? 'walk' : 'idle';
          }
        }

        const duration = randRange(...(ACTION_DURATION[newAction] || [2000, 4000]));
        const fTop = roomSize.h * 0.35;
        const fBot = roomSize.h * 0.92;

        if (newAction === 'walk') {
          const tx = 30 + Math.random() * (roomSize.w - 60);
          const ty = fTop + Math.random() * (fBot - fTop);
          return { ...ch, action: 'walk', targetX: tx, targetY: ty, flip: tx < ch.x, actionTimer: now + duration, interacting: null };
        }
        if (newAction === 'sleep') {
          const pos = findInteraction('sleep');
          if (pos && Math.abs(ch.x - pos.x) > 40) {
            return { ...ch, action: 'walk', targetX: pos.x, targetY: pos.y, flip: pos.x < ch.x, actionTimer: now + 3000, interacting: 'sleep' };
          }
          return { ...ch, action: 'sleep', targetX: null, targetY: null, actionTimer: now + duration, interacting: 'sleep' };
        }
        if (newAction === 'sit') {
          const pos = findInteraction('sit');
          if (pos && Math.abs(ch.x - pos.x) > 40) {
            return { ...ch, action: 'walk', targetX: pos.x, targetY: pos.y, flip: pos.x < ch.x, actionTimer: now + 3000, interacting: 'sit' };
          }
          return { ...ch, action: 'sit', targetX: null, targetY: null, actionTimer: now + duration, interacting: 'sit' };
        }
        // 냉장고 → 식탁 연쇄
        if (newAction === 'eat') {
          const pos = findInteraction('eat');
          const hungrySpeech = '배고프다~';
          if (pos && Math.abs(ch.x - pos.x) > 40) {
            return { ...ch, action: 'walk', targetX: pos.x, targetY: pos.y, flip: pos.x < ch.x, actionTimer: now + 4000, interacting: 'eat', speech: hungrySpeech, speechTimer: now + 2500 };
          }
          return { ...ch, action: 'eat', targetX: null, targetY: null, actionTimer: now + 2000, interacting: 'eat', speech: hungrySpeech, speechTimer: now + 2500 };
        }
        // 현관문 외출
        if (newAction === 'goout') {
          const pos = findInteraction('goout');
          if (pos) {
            if (Math.abs(ch.x - pos.x) > 40) {
              return { ...ch, action: 'walk', targetX: pos.x, targetY: pos.y, flip: pos.x < ch.x, actionTimer: now + 3000, interacting: 'goout' };
            }
            const leaveSpeech = INTERACTION_SPEECH.goout_leave[Math.floor(Math.random() * INTERACTION_SPEECH.goout_leave.length)];
            setDoorOpen(true);
            setTimeout(() => setDoorOpen(false), 1500);
            // 5초 후 돌아오기
            setTimeout(() => {
              setDoorOpen(true);
              setTimeout(() => setDoorOpen(false), 1500);
              setCharStates(prev => prev.map(c => {
                if (c.id !== ch.id || !c.hidden) return c;
                const returnSpeech = INTERACTION_SPEECH.goout_return[Math.floor(Math.random() * INTERACTION_SPEECH.goout_return.length)];
                return { ...c, hidden: false, action: 'idle', interacting: null, speech: returnSpeech, speechTimer: Date.now() + 3000, actionTimer: Date.now() + randRange(3000, 5000) };
              }));
            }, 5000);
            return { ...ch, action: 'goout', hidden: true, interacting: 'goout', speech: leaveSpeech, speechTimer: now + 2000, actionTimer: now + 8000 };
          }
        }
        // play, watch, music, ball - 가구로 이동 후 상호작용
        if (['play', 'watch', 'music', 'ball'].includes(newAction)) {
          const pos = findInteraction(newAction);
          if (pos && Math.abs(ch.x - pos.x) > 40) {
            const approachSpeech = newAction === 'ball' ? '심심한데 축구나 할까?' : null;
            return { ...ch, action: 'walk', targetX: pos.x, targetY: pos.y, flip: pos.x < ch.x, actionTimer: now + 3000, interacting: newAction,
              ...(approachSpeech ? { speech: approachSpeech, speechTimer: now + 2500 } : {}) };
          }
          const actionSpeech = INTERACTION_SPEECH[newAction][Math.floor(Math.random() * INTERACTION_SPEECH[newAction].length)];
          return { ...ch, action: newAction, targetX: null, targetY: null, actionTimer: now + duration, interacting: newAction, speech: actionSpeech, speechTimer: now + 2500 };
        }
        return { ...ch, action: 'idle', targetX: null, targetY: null, actionTimer: now + duration, interacting: null };
      }).map(ch => {
        const now = Date.now();
        // 말풍선 타이머
        if (ch.speech && now > ch.speechTimer) {
          return { ...ch, speech: null, speechTimer: now + randRange(10000, 24000) };
        }
        if (!ch.speech && now > ch.speechTimer && ch.action !== 'sleep' && Number(ch.id) !== equippedId) {
          // 20% 확률로 기술명, 80% 확률로 종합 대사 (주인 이름, 구구단 퀴즈 포함)
          const msg = Math.random() < 0.2
            ? getRandomSkill(ch.id)
            : getRandomSpeech(nickname);
          return { ...ch, speech: msg, speechTimer: now + 6000 };
        }
        return ch;
      });

        // 2단계: 꼬리물기 - 트럭 탑승 중 충돌 감지 & 따라가기
        const leader = updated.find(c => Number(c.id) === equippedId);
        if (leader?.riding) {
          // 충돌 감지: 꼬리에 없는 캐릭터가 리더/꼬리 끝에 닿으면 합류
          const tail = tailRef.current;
          // 꼬리 체인의 마지막 캐릭터 (없으면 리더)
          const lastInChain = tail.length > 0
            ? updated.find(c => Number(c.id) === tail[tail.length - 1]) || leader
            : leader;
          updated.forEach(c => {
            if (Number(c.id) === equippedId) return;
            if (c.hidden) return;
            if (tail.includes(Number(c.id))) return;
            const dx = lastInChain.x - c.x;
            const dy = lastInChain.y - c.y;
            if (Math.sqrt(dx * dx + dy * dy) < TAIL_HIT_RANGE) {
              tail.push(Number(c.id));
            }
          });

          // 꼬리 캐릭터들 따라가기
          for (let i = 0; i < tail.length; i++) {
            const targetCh = i === 0 ? leader : updated.find(c => Number(c.id) === tail[i - 1]);
            const follower = updated.find(c => Number(c.id) === tail[i]);
            if (!targetCh || !follower) continue;
            const dx = targetCh.x - follower.x;
            const dy = targetCh.y - follower.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > TAIL_GAP) {
              const move = Math.min(TAIL_FOLLOW_SPEED, dist - TAIL_GAP + 0.5);
              follower.x += (dx / dist) * move;
              follower.y += (dy / dist) * move;
              follower.flip = dx < 0;
              follower.action = 'walk';
              follower.inTail = true;
            } else {
              if (follower.inTail) follower.action = 'idle';
              follower.inTail = true;
            }
          }
        }

        return updated;
      });
      // ── 축구공 물리 ──
      const BALL_FRICTION = 0.97;
      const BALL_MIN_SPEED = 0.05;
      const KICK_FORCE = 3.5;
      const BALL_RADIUS = 15; // 충돌 감지 범위 (px)

      // 축구공 초기화
      layout.forEach((item, idx) => {
        if (item.id === 'soccerBall' && !ballPhysicsRef.current[idx]) {
          ballPhysicsRef.current[idx] = { x: item.x, y: item.y, vx: 0, vy: 0 };
        }
      });

      // 공 물리 업데이트 & 캐릭터 충돌
      let ballChanged = false;
      Object.keys(ballPhysicsRef.current).forEach(idxStr => {
        const idx = Number(idxStr);
        if (!layout[idx] || layout[idx].id !== 'soccerBall') {
          delete ballPhysicsRef.current[idx];
          return;
        }
        const bp = ballPhysicsRef.current[idx];
        const f = FURNITURE_DEFS[layout[idx].id];

        // 캐릭터 충돌 감지 (px → 가상좌표 변환)
        charStatesRef.current.forEach(ch => {
          if (ch.hidden || ch.action === 'sleep') return;
          const chVx = (ch.x / roomSize.w) * 300;
          const chVy = (ch.y / roomSize.h) * 200;
          const bCenterX = bp.x + (f.w * SCALE) / 2;
          const bCenterY = bp.y + (f.h * SCALE) / 2;
          const dx = bCenterX - chVx;
          const dy = bCenterY - chVy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < BALL_RADIUS && dist > 0) {
            // 캐릭터 이동 방향으로 차기
            const nx = dx / dist;
            const ny = dy / dist;
            bp.vx = nx * KICK_FORCE + (Math.random() - 0.5) * 1.0;
            bp.vy = ny * KICK_FORCE + (Math.random() - 0.5) * 1.0;
            ballChanged = true;
          }
        });

        // 속도 적용
        if (Math.abs(bp.vx) > BALL_MIN_SPEED || Math.abs(bp.vy) > BALL_MIN_SPEED) {
          bp.x += bp.vx;
          bp.y += bp.vy;
          bp.vx *= BALL_FRICTION;
          bp.vy *= BALL_FRICTION;

          // 벽 반사
          const maxX = 300 - f.w * SCALE;
          const maxY = 200 - f.h * SCALE;
          const minY = 60; // 바닥 영역만
          if (bp.x < 0) { bp.x = 0; bp.vx = Math.abs(bp.vx) * 0.7; }
          if (bp.x > maxX) { bp.x = maxX; bp.vx = -Math.abs(bp.vx) * 0.7; }
          if (bp.y < minY) { bp.y = minY; bp.vy = Math.abs(bp.vy) * 0.7; }
          if (bp.y > maxY) { bp.y = maxY; bp.vy = -Math.abs(bp.vy) * 0.7; }

          // 멈춤 처리
          if (Math.abs(bp.vx) < BALL_MIN_SPEED) bp.vx = 0;
          if (Math.abs(bp.vy) < BALL_MIN_SPEED) bp.vy = 0;

          // 골 감지: 공이 골대 영역 안에 들어왔는지
          if (!goalCooldownRef.current) {
            const ballCX = bp.x + (f.w * SCALE) / 2;
            const ballCY = bp.y + (f.h * SCALE) / 2;
            layout.forEach((fi) => {
              if (fi.id !== 'soccerGoal') return;
              const gf = FURNITURE_DEFS.soccerGoal;
              const gLeft = fi.x;
              const gRight = fi.x + gf.w * SCALE;
              const gTop = fi.y;
              const gBottom = fi.y + gf.h * SCALE;
              if (ballCX > gLeft + 4 && ballCX < gRight - 4 && ballCY > gTop && ballCY < gBottom) {
                goalCooldownRef.current = true;
                // 골 위치 (% 기준)
                const goalScreenX = ((fi.x + gf.w * SCALE / 2) / 300) * 100;
                const goalScreenY = ((fi.y + gf.h * SCALE / 2) / 200) * 100;
                // 파티클 생성
                const particles = Array.from({ length: 30 }, (_, i) => ({
                  id: i,
                  angle: (Math.PI * 2 * i) / 30 + (Math.random() - 0.5) * 0.5,
                  speed: 2 + Math.random() * 4,
                  color: ['#ff0', '#f44', '#4f4', '#44f', '#f4f', '#ff8800', '#00ffcc'][Math.floor(Math.random() * 7)],
                  size: 3 + Math.random() * 5,
                }));
                setGoalCelebration({ x: goalScreenX, y: goalScreenY, particles });
                // 공 리셋: 골대에서 좀 떨어진 곳으로
                bp.x = 150; bp.y = 130; bp.vx = 0; bp.vy = 0;
                // 보상: 골 1회당 5점
                if (isOnline()) {
                  updateOnlineScore(nickname, 5);
                } else {
                  updatePlayerScore(nickname, 5);
                }
                // 3초 후 쿨다운 해제 & 축하 제거
                setTimeout(() => {
                  goalCooldownRef.current = false;
                  setGoalCelebration(null);
                }, 3000);
              }
            });
          }

          ballChanged = true;
        }
      });

      if (ballChanged) {
        const newPositions = {};
        Object.entries(ballPhysicsRef.current).forEach(([idx, bp]) => {
          newPositions[idx] = { x: bp.x, y: bp.y };
        });
        setBallPositions({ ...newPositions });
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [editMode, findInteraction, roomSize, layout]);

  const handleRemoveFurniture = (idx) => {
    playClick();
    setLayout(prev => prev.filter((_, i) => i !== idx));
  };

  // ── 드래그 (가상 300x200 좌표로 저장) ──
  const draggingRef = useRef(null);

  const handlePointerDown = (e, idx) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    e.target.setPointerCapture(e.pointerId);
    const rect = roomRef.current.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * 300;
    const vy = ((e.clientY - rect.top) / rect.height) * 200;
    const dragInfo = { idx, offsetX: vx - layout[idx].x, offsetY: vy - layout[idx].y, pointerId: e.pointerId };
    draggingRef.current = dragInfo;
    setDragging(dragInfo);
  };

  const handlePointerMove = (e) => {
    const drag = draggingRef.current;
    if (!drag || !roomRef.current) return;
    e.preventDefault();
    const rect = roomRef.current.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * 300 - drag.offsetX;
    const vy = ((e.clientY - rect.top) / rect.height) * 200 - drag.offsetY;
    setLayout(prev => prev.map((item, i) => {
      if (i !== drag.idx) return item;
      const f = FURNITURE_DEFS[item.id];
      return {
        ...item,
        x: Math.max(0, Math.min(300 - f.w * SCALE, vx)),
        y: Math.max(0, Math.min(200 - f.h * SCALE, vy)),
      };
    }));
  };

  const handlePointerUp = () => {
    draggingRef.current = null;
    setDragging(null);
  };

  // 장착 캐릭터와 가까운 트럭 감지
  const equippedChar = charStates.find(ch => Number(ch.id) === equippedId);
  const nearbyTruckIdx = (() => {
    if (!equippedChar || ridingTruckIdx != null) return null;
    for (let i = 0; i < layout.length; i++) {
      if (layout[i].id !== 'toyTruck') continue;
      const f = FURNITURE_DEFS[layout[i].id];
      const truckPx = (layout[i].x / 300) * roomSize.w + (f.w * SCALE) / 2;
      const truckPy = (layout[i].y / 200) * roomSize.h + (f.h * SCALE) / 2;
      const dx = equippedChar.x - truckPx;
      const dy = equippedChar.y - truckPy;
      if (Math.sqrt(dx * dx + dy * dy) < 50) return i;
    }
    return null;
  })();

  // 장착 캐릭터와 문 근처 감지 (놀러가기)
  const nearDoor = (() => {
    if (!equippedChar) return false;
    for (let i = 0; i < layout.length; i++) {
      if (layout[i].id !== 'door') continue;
      const f = FURNITURE_DEFS[layout[i].id];
      const doorPx = (layout[i].x / 300) * roomSize.w + (f.w * SCALE) / 2;
      const doorPy = (layout[i].y / 200) * roomSize.h + (f.h * SCALE) / 2;
      const dx = equippedChar.x - doorPx;
      const dy = equippedChar.y - doorPy;
      if (Math.sqrt(dx * dx + dy * dy) < 50) return true;
    }
    return false;
  })();

  const handleRide = () => {
    if (nearbyTruckIdx != null) {
      playClick();
      const truckIdx = nearbyTruckIdx;
      generateRoomQuiz(() => {
        setRidingTruckIdx(truckIdx);
        setCharStates(prev => prev.map(ch =>
          Number(ch.id) === equippedId ? { ...ch, riding: true, speech: '부릉부릉~!', speechTimer: Date.now() + 3000 } : ch
        ));
      });
    }
  };

  const handleDismount = () => {
    playClick();
    setRidingTruckIdx(null);
    tailRef.current = []; // 꼬리 해제
    setCharStates(prev => prev.map(ch => {
      if (Number(ch.id) === equippedId) return { ...ch, riding: false, speech: '도착~!', speechTimer: Date.now() + 3000 };
      if (ch.inTail) return { ...ch, inTail: false, action: 'idle', actionTimer: Date.now() + randRange(2000, 4000) };
      return ch;
    }));
  };

  return (
    <div className="game-container" style={{ justifyContent: 'flex-start', paddingTop: 10 }}>
      <style>{`
        @keyframes quizShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes zzzFloat {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-8px); }
        }
        @keyframes speechBubble {
          0% { opacity: 0; transform: translateX(-50%) scale(0.5) translateY(4px); }
          8% { opacity: 1; transform: translateX(-50%) scale(1.08) translateY(-2px); }
          16% { transform: translateX(-50%) scale(0.97) translateY(0); }
          24% { transform: translateX(-50%) scale(1) translateY(0); }
          80% { opacity: 1; transform: translateX(-50%) scale(1) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) scale(0.9) translateY(-8px); }
        }
        @keyframes goalFlash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes goalText {
          0% { opacity: 0; transform: scale(0.3); }
          15% { opacity: 1; transform: scale(1.3); }
          30% { transform: scale(1); }
          75% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(1.2) translateY(-20px); }
        }
        @keyframes goalParticle0 {
          0% { opacity: 1; transform: translate(0, 0) scale(1); }
          100% { opacity: 0; transform: translate(var(--px), var(--py)) scale(0); }
        }
        @keyframes goalParticle1 {
          0% { opacity: 1; transform: translate(0, 0) scale(1) rotate(0deg); }
          100% { opacity: 0; transform: translate(var(--px), var(--py)) scale(0) rotate(360deg); }
        }
        @keyframes goalParticle2 {
          0% { opacity: 1; transform: translate(0, 0) scale(1.2); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--px), var(--py)) scale(0); }
        }
        @keyframes goalParticle3 {
          0% { opacity: 1; transform: translate(0, 0) scale(0.8); }
          30% { opacity: 1; transform: translate(calc(var(--px) * 0.3), calc(var(--py) * 0.3)) scale(1.5); }
          100% { opacity: 0; transform: translate(var(--px), var(--py)) scale(0); }
        }
        @keyframes goalParticle4 {
          0% { opacity: 1; transform: translate(0, 0) scale(1) rotate(0deg); }
          100% { opacity: 0; transform: translate(var(--px), var(--py)) scale(0.2) rotate(-270deg); }
        }
        @keyframes goalParticle5 {
          0% { opacity: 1; transform: translate(0, 0) scale(1); }
          40% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--px), var(--py)) scale(0); }
        }
      `}</style>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10 }}>
        <button
          className="pixel-btn"
          onClick={() => { playClick(); if (visitMode === 'visiting') handleLeaveVisit(); else onBack(); }}
          style={{ fontSize: 10, minWidth: 50, padding: '6px 8px' }}
        >
          {visitMode === 'visiting' ? '돌아가기' : '뒤로'}
        </button>
        <span style={{ fontSize: 13, color: visitMode === 'visiting' ? '#88ccff' : 'var(--gold)' }}>
          {visitMode === 'visiting' ? `${visitTarget}의 방` : `${nickname}의 방`}
          {guests.length > 0 && !visitMode && (
            <span style={{ fontSize: 8, color: '#88ff88', marginLeft: 6 }}>
              방문자 {guests.length}명
            </span>
          )}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {visitMode === 'visiting' && (
            <button
              className="pixel-btn"
              onClick={() => {
                playClick();
                setYardOwner(visitTarget);
                setYardCharPos({ x: 150, y: 160 });
                if (isOnline()) {
                  getYardFlowers(visitTarget).then(f => setYardFlowers(f || []));
                }
                setYardMode('visiting');
              }}
              style={{ fontSize: 8, minWidth: 40, padding: '4px 6px', background: '#2a6e2a', border: '2px solid #44aa44', color: '#aaffaa' }}
            >
              앞마당
            </button>
          )}
          <button
            className={`pixel-btn ${editMode ? 'gold' : ''}`}
            onClick={() => { playClick(); setEditMode(!editMode); }}
            style={{ fontSize: 10, minWidth: 50, padding: '6px 8px' }}
          >
            {editMode ? '완료' : '꾸미기'}
          </button>
        </div>
      </div>

      {/* ── 앞마당 뷰 ── */}
      {yardMode && (
        <>
          <div style={{
            position: 'relative', width: '100%', maxWidth: 600,
            aspectRatio: '3 / 2', borderRadius: 8, overflow: 'hidden',
            border: '2px solid #44aa44',
          }}>
            {/* 하늘 */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '25%',
              background: 'linear-gradient(180deg, #88ccff 0%, #aaddff 60%, #cceecc 100%)',
            }} />
            {/* 구름 */}
            <div style={{
              position: 'absolute', top: '5%', left: '15%', width: 40, height: 14,
              background: '#fff', borderRadius: 10, opacity: 0.7,
              boxShadow: '12px 2px 0 #fff, -8px 3px 0 #fff, 6px -2px 0 #fff',
            }} />
            <div style={{
              position: 'absolute', top: '10%', right: '20%', width: 30, height: 10,
              background: '#fff', borderRadius: 8, opacity: 0.5,
              boxShadow: '8px 1px 0 #fff, -6px 2px 0 #fff',
            }} />
            {/* 울타리 */}
            <div style={{
              position: 'absolute', top: '22%', left: 0, right: 0, height: 14,
              display: 'flex', justifyContent: 'space-evenly', alignItems: 'flex-end',
              zIndex: 1,
            }}>
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={`fence-${i}`} style={{
                  width: 6, height: i % 2 === 0 ? 14 : 10,
                  background: i % 2 === 0 ? '#b88844' : '#aa7733',
                  borderRadius: '1px 1px 0 0',
                  boxShadow: '0 -1px 0 #dda866',
                }} />
              ))}
            </div>
            <div style={{
              position: 'absolute', top: 'calc(22% + 6px)', left: 0, right: 0, height: 3,
              background: '#996633', zIndex: 1,
            }} />
            {/* 잔디 바닥 */}
            <div style={{
              position: 'absolute', top: '25%', left: 0, right: 0, bottom: 0,
              background: 'linear-gradient(180deg, #55aa44 0%, #449933 30%, #3d8830 100%)',
            }} />
            {/* 텃밭 영역 */}
            <div style={{
              position: 'absolute', top: '30%', left: '5%', right: '5%', bottom: '8%',
              display: 'grid',
              gridTemplateColumns: `repeat(${YARD_COLS}, 1fr)`,
              gridTemplateRows: `repeat(${YARD_ROWS}, 1fr)`,
              gap: 3, padding: 4,
              background: 'rgba(80,50,20,0.3)', borderRadius: 6,
              border: '2px solid rgba(139,90,43,0.4)',
            }}>
              {Array.from({ length: YARD_COLS * YARD_ROWS }).map((_, i) => {
                const gx = i % YARD_COLS;
                const gy = Math.floor(i / YARD_COLS);
                const flower = yardFlowers.find(f => f.gridX === gx && f.gridY === gy);
                const fType = flower ? YARD_FLOWER_TYPES[flower.type % YARD_FLOWER_TYPES.length] : null;
                // 캐릭터 위치와 비교해서 하이라이트
                const cellCenterX = (5 + (gx + 0.5) * (90 / YARD_COLS)) * 3; // approx px
                const cellCenterY = (30 + (gy + 0.5) * (62 / YARD_ROWS)) * 2;
                const charScreenX = (yardCharPos.x / 300) * 600;
                const charScreenY = (yardCharPos.y / 200) * 400;
                const isNear = Math.abs(cellCenterX - charScreenX) < 30 && Math.abs(cellCenterY - charScreenY) < 25;
                return (
                  <div key={`plot-${i}`} style={{
                    background: flower
                      ? 'linear-gradient(180deg, #6b4226, #5a3520)'
                      : 'linear-gradient(180deg, #7a5533, #6b4226)',
                    borderRadius: 3,
                    border: isNear
                      ? (yardMode === 'own' && !flower ? '2px solid #ffcc00' : flower && yardMode === 'visiting' ? '2px solid #ff4444' : '1px solid #8b5a2b')
                      : '1px solid #8b5a2b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', overflow: 'visible',
                    boxShadow: isNear ? '0 0 8px rgba(255,200,0,0.4)' : 'inset 0 1px 2px rgba(0,0,0,0.3)',
                  }}>
                    {flower && fType && (
                      <svg viewBox="0 0 24 30" style={{ width: '80%', height: '90%', overflow: 'visible' }}>
                        {/* 줄기 */}
                        <line x1="12" y1="14" x2="12" y2="28" stroke={fType.stem} strokeWidth="2" />
                        <line x1="12" y1="20" x2="8" y2="18" stroke={fType.stem} strokeWidth="1.5" />
                        <ellipse cx="7" cy="17.5" rx="2.5" ry="1.5" fill="#44aa33" />
                        {/* 꽃잎 */}
                        {[0, 60, 120, 180, 240, 300].map((angle, pi) => (
                          <ellipse key={pi}
                            cx={12 + Math.cos(angle * Math.PI / 180) * 5}
                            cy={10 + Math.sin(angle * Math.PI / 180) * 5}
                            rx="3.5" ry="3"
                            fill={pi % 2 === 0 ? fType.color1 : fType.color2}
                            stroke={fType.color3} strokeWidth="0.3"
                          />
                        ))}
                        {/* 꽃 중심 */}
                        <circle cx="12" cy="10" r="3" fill={fType.color2} />
                        <circle cx="12" cy="10" r="1.5" fill={fType.color3} />
                      </svg>
                    )}
                    {!flower && (
                      <div style={{
                        width: '40%', height: '40%', borderRadius: '50%',
                        background: 'rgba(100,70,40,0.5)',
                        border: '1px dashed rgba(139,90,43,0.4)',
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
            {/* 앞마당 주인 표시 */}
            <div style={{
              position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
              fontSize: 9, color: '#fff', fontFamily: "'Press Start 2P', monospace",
              textShadow: '1px 1px 2px rgba(0,0,0,0.6)',
              background: 'rgba(0,0,0,0.3)', padding: '3px 10px', borderRadius: 6,
              zIndex: 5,
            }}>
              {yardOwner === nickname ? '내 앞마당' : `${yardOwner}의 앞마당`}
            </div>
            {/* 캐릭터 */}
            <div style={{
              position: 'absolute',
              left: `${(yardCharPos.x / 300) * 100}%`,
              top: `${(yardCharPos.y / 200) * 100}%`,
              transform: `translateX(-50%) scaleX(${yardCharFlip.current ? -1 : 1})`,
              zIndex: 10,
              pointerEvents: 'none',
            }}>
              <RoomCharacter characterId={equippedId} x={0} y={0} flip={false} sleeping={false} scale={SCALE} />
            </div>
            {/* 안내 텍스트 */}
            <div style={{
              position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
              fontSize: 7, color: '#ffe',
              fontFamily: "'Press Start 2P', monospace",
              textShadow: '1px 1px 0 #000',
              background: 'rgba(0,0,0,0.4)', padding: '2px 8px', borderRadius: 4,
              zIndex: 5, whiteSpace: 'nowrap',
            }}>
              {yardMode === 'own' ? 'SPACE: 꽃 심기' : 'SPACE: 꽃 뽑기'}
            </div>
          </div>
          {/* 앞마당 조이스틱 + 버튼 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginTop: 0 }}>
            <div
              onPointerDown={(e) => {
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                joystickRef.current = { active: true, cx, cy, dx: 0, dy: 0, id: e.pointerId };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!joystickRef.current.active) return;
                const { cx, cy } = joystickRef.current;
                const maxR = 20;
                let dx = e.clientX - cx;
                let dy = e.clientY - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }
                joystickRef.current.dx = dx / maxR;
                joystickRef.current.dy = dy / maxR;
              }}
              onPointerUp={() => { joystickRef.current = { active: false, dx: 0, dy: 0 }; }}
              onPointerCancel={() => { joystickRef.current = { active: false, dx: 0, dy: 0 }; }}
              style={{
                marginTop: 8, width: 70, height: 70, borderRadius: '50%',
                background: 'radial-gradient(circle, #2a6e2a, #1a4e1a)',
                border: '2px solid #4a8a4a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                touchAction: 'none', cursor: 'pointer', userSelect: 'none',
                position: 'relative',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'radial-gradient(circle, #6aae6a, #4a8e4a)',
                border: '1px solid #8abe8a',
              }} />
            </div>
            {/* 꽃 심기/뽑기 버튼 */}
            <button
              onClick={() => {
                if (yardMode === 'own') {
                  // 가장 가까운 빈 칸에 꽃 심기
                  let bestDist = Infinity, bestGx = -1, bestGy = -1;
                  for (let gy = 0; gy < YARD_ROWS; gy++) {
                    for (let gx = 0; gx < YARD_COLS; gx++) {
                      if (yardFlowers.find(f => f.gridX === gx && f.gridY === gy)) continue;
                      const cellX = (5 + (gx + 0.5) * (90 / YARD_COLS)) * 3;
                      const cellY = (30 + (gy + 0.5) * (62 / YARD_ROWS)) * 2;
                      const charX = (yardCharPos.x / 300) * 600;
                      const charY = (yardCharPos.y / 200) * 400;
                      const d = Math.abs(cellX - charX) + Math.abs(cellY - charY);
                      if (d < bestDist) { bestDist = d; bestGx = gx; bestGy = gy; }
                    }
                  }
                  if (bestGx >= 0 && bestDist < 80) {
                    const newType = Math.floor(Math.random() * YARD_FLOWER_TYPES.length);
                    const newFlowers = [...yardFlowers, { gridX: bestGx, gridY: bestGy, type: newType }];
                    setYardFlowers(newFlowers);
                    if (isOnline()) saveYardFlowers(nickname, newFlowers);
                    else localStorage.setItem(`yard_flowers_${nickname}`, JSON.stringify(newFlowers));
                    playClick();
                  }
                } else if (yardMode === 'visiting') {
                  // 가장 가까운 꽃 뽑기
                  let bestDist = Infinity, bestIdx = -1;
                  yardFlowers.forEach((f, fi) => {
                    const cellX = (5 + (f.gridX + 0.5) * (90 / YARD_COLS)) * 3;
                    const cellY = (30 + (f.gridY + 0.5) * (62 / YARD_ROWS)) * 2;
                    const charX = (yardCharPos.x / 300) * 600;
                    const charY = (yardCharPos.y / 200) * 400;
                    const d = Math.abs(cellX - charX) + Math.abs(cellY - charY);
                    if (d < bestDist) { bestDist = d; bestIdx = fi; }
                  });
                  if (bestIdx >= 0 && bestDist < 80) {
                    const newFlowers = yardFlowers.filter((_, i) => i !== bestIdx);
                    setYardFlowers(newFlowers);
                    if (isOnline()) saveYardFlowers(yardOwner, newFlowers);
                    playClick();
                  }
                }
              }}
              data-yard-action="true"
              style={{
                marginTop: 8, marginLeft: 12, width: 44, height: 44, borderRadius: '50%',
                background: yardMode === 'own'
                  ? 'radial-gradient(circle, #ff88aa, #cc4466)'
                  : 'radial-gradient(circle, #ff6644, #cc3322)',
                border: yardMode === 'own' ? '2px solid #ffccdd' : '2px solid #ffaa88',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, cursor: 'pointer', touchAction: 'none', userSelect: 'none',
              }}
            >
              {yardMode === 'own' ? '🌷' : '🤏'}
            </button>
            {/* 돌아가기 버튼 */}
            <button
              className="pixel-btn"
              onClick={() => {
                playClick();
                setYardMode(null);
                setYardOwner('');
                setYardFlowers([]);
              }}
              style={{ marginTop: 18, marginLeft: 12, fontSize: 8, padding: '6px 10px' }}
            >
              방으로
            </button>
          </div>
        </>
      )}

      {/* 방 */}
      {!yardMode && (<div
        ref={roomRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 600,
          aspectRatio: '3 / 2',
          background: 'linear-gradient(180deg, #2a2a5e 0%, #1e1e4a 100%)',
          borderRadius: 8,
          overflow: 'hidden',
          border: editMode ? '2px dashed var(--gold)' : '2px solid #333366',
          touchAction: 'none',
        }}
      >
        {/* 벽 */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '30%',
          background: 'linear-gradient(180deg, #3a3a6e 0%, #2a2a5e 100%)',
          borderBottom: '3px solid #5c5c8a',
        }} />
        {/* 바닥 */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%',
          background: 'repeating-conic-gradient(#4a3728 0% 25%, #5a4738 0% 50%) 0 0 / 20px 20px',
        }} />
        {/* 걸레받이 */}
        <div style={{
          position: 'absolute', top: 'calc(30% - 2px)', left: 0, right: 0,
          height: 4, background: '#7a6a5a',
        }} />

        {/* 꽃 */}
        {flowers.map(f => {
          const age = (Date.now() - f.createdAt) / 10000; // 0~1
          return (
            <div key={`flower-${f.id}`} style={{
              position: 'absolute', left: f.x, top: f.y - 6,
              transform: 'translateX(-50%)',
              fontSize: 14, zIndex: 5, pointerEvents: 'none',
              opacity: age > 0.7 ? 1 - (age - 0.7) / 0.3 : 1,
              filter: `hue-rotate(0deg)`,
            }}>
              <svg width="12" height="14" viewBox="0 0 12 14">
                <circle cx="6" cy="4" r="2.5" fill={f.color} />
                <circle cx="3.5" cy="5.5" r="2" fill={f.color} opacity="0.8" />
                <circle cx="8.5" cy="5.5" r="2" fill={f.color} opacity="0.8" />
                <circle cx="4" cy="3" r="2" fill={f.color} opacity="0.7" />
                <circle cx="8" cy="3" r="2" fill={f.color} opacity="0.7" />
                <circle cx="6" cy="4.5" r="1.5" fill="#ffee55" />
                <rect x="5.5" y="6" width="1" height="6" fill="#44aa44" rx="0.5" />
                <ellipse cx="4" cy="10" rx="2" ry="1" fill="#33882288" />
                <ellipse cx="8" cy="11" rx="1.5" ry="0.8" fill="#33882288" />
              </svg>
            </div>
          );
        })}

        {/* 가구 (가상 300x200 → %로 변환) */}
        {layout.map((item, idx) => {
          const f = FURNITURE_DEFS[item.id];
          if (!f) return null;
          // 탑승 중인 트럭은 숨김 (캐릭터 위치에서 렌더링)
          if (idx === ridingTruckIdx) return null;
          // 축구공은 동적 위치 사용
          const dynamicPos = (!editMode && item.id === 'soccerBall' && ballPositions[idx]) ? ballPositions[idx] : null;
          const renderX = dynamicPos ? dynamicPos.x : item.x;
          const renderY = dynamicPos ? dynamicPos.y : item.y;
          return (
            <div
              key={`f-${idx}`}
              onPointerDown={(e) => handlePointerDown(e, idx)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{
                position: 'absolute',
                left: `${(renderX / 300) * 100}%`,
                top: `${(renderY / 200) * 100}%`,
                cursor: editMode ? 'grab' : 'default',
                zIndex: f.wallMount ? 1 : Math.floor((renderY / 200) * roomSize.h),
                filter: editMode ? 'brightness(1.2) drop-shadow(0 0 4px var(--gold))' : 'none',
                transition: (dragging?.idx === idx || dynamicPos) ? 'none' : 'left 0.1s, top 0.1s',
                touchAction: 'none',
              }}
            >
              <FurnitureCanvas furnitureId={item.id} scale={SCALE} isOpen={item.id === 'door' && doorOpen} />
              {editMode && (
                <>
                  <div style={{
                    position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 7, color: 'var(--gold)', whiteSpace: 'nowrap',
                    fontFamily: "'Press Start 2P', monospace", textShadow: '1px 1px 0 #000',
                  }}>
                    {f.name}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveFurniture(idx); }}
                    style={{
                      position: 'absolute', top: -8, right: -8,
                      width: 16, height: 16, borderRadius: '50%',
                      background: '#ff4444', border: '1px solid #fff',
                      color: '#fff', fontSize: 8, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'Press Start 2P', monospace",
                      padding: 0, lineHeight: 1,
                    }}
                  >
                    x
                  </button>
                </>
              )}
            </div>
          );
        })}

        {/* 캐릭터 (실제 px 좌표) */}
        {!editMode && charStates.filter(ch => !ch.hidden).map((ch, idx) => (
          <div key={`char-${idx}`}>
            <RoomCharacter
              characterId={ch.id}
              x={ch.x}
              y={ch.y}
              flip={ch.flip}
              sleeping={ch.action === 'sleep'}
              scale={SCALE}
            />
            {/* 탑승 중이면 트럭을 캐릭터 아래에 렌더링 */}
            {Number(ch.id) === equippedId && ridingTruckIdx != null && (
              <div style={{
                position: 'absolute',
                left: ch.x - 22,
                top: ch.y - 8,
                zIndex: Math.floor(ch.y) - 1,
                transform: `scaleX(${ch.flip ? -1 : 1})`,
                pointerEvents: 'none',
              }}>
                <FurnitureCanvas furnitureId="toyTruck" scale={SCALE} />
              </div>
            )}
            {/* 장착 캐릭터 표시 화살표 + 타기/내리기 버튼 */}
            {Number(ch.id) === equippedId && (
              <>
                <div style={{
                  position: 'absolute', left: ch.x, top: ch.y - 42,
                  transform: 'translateX(-50%)',
                  fontSize: visitMode === 'visiting' ? 7 : 10,
                  color: '#ffcc00',
                  fontFamily: visitMode === 'visiting' ? "'Press Start 2P', monospace" : 'inherit',
                  animation: 'zzzFloat 1.5s ease-in-out infinite',
                  zIndex: 9998, pointerEvents: 'none',
                  textShadow: '0 0 4px rgba(255,200,0,0.8)',
                  whiteSpace: 'nowrap',
                }}>{visitMode === 'visiting' ? nickname : '▼'}</div>
                {/* 타기 버튼 */}
                {nearbyTruckIdx != null && ridingTruckIdx == null && (
                  <button onClick={handleRide} style={{
                    position: 'absolute', left: ch.x, top: ch.y - 58,
                    transform: 'translateX(-50%)',
                    zIndex: 9999,
                    background: 'linear-gradient(135deg, #ff6644, #cc3322)',
                    color: '#fff', border: '2px solid #fff',
                    borderRadius: 6, padding: '3px 8px',
                    fontSize: 8, fontFamily: "'Press Start 2P', monospace",
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                    animation: 'zzzFloat 1s ease-in-out infinite',
                  }}>
                    타기
                  </button>
                )}
                {/* 내리기 버튼 */}
                {ridingTruckIdx != null && (
                  <button onClick={handleDismount} style={{
                    position: 'absolute', left: ch.x, top: ch.y - 58,
                    transform: 'translateX(-50%)',
                    zIndex: 9999,
                    background: 'linear-gradient(135deg, #4488cc, #336699)',
                    color: '#fff', border: '2px solid #fff',
                    borderRadius: 6, padding: '3px 8px',
                    fontSize: 8, fontFamily: "'Press Start 2P', monospace",
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                  }}>
                    내리기
                  </button>
                )}
                {/* 문 근처: 외출 선택 */}
                {nearDoor && ridingTruckIdx == null && !doorChoice && (
                  <button onClick={() => {
                    playClick();
                    generateRoomQuiz(() => {
                      setDoorChoice(true);
                    });
                  }} style={{
                    position: 'absolute', left: ch.x, top: ch.y - 58,
                    transform: 'translateX(-50%)',
                    zIndex: 9999,
                    background: 'linear-gradient(135deg, #44cc88, #228866)',
                    color: '#fff', border: '2px solid #fff',
                    borderRadius: 6, padding: '3px 8px',
                    fontSize: 7, fontFamily: "'Press Start 2P', monospace",
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                    animation: 'zzzFloat 1s ease-in-out infinite',
                  }}>
                    외출하기!
                  </button>
                )}
              </>
            )}
            {ch.speech && (() => {
              const isSkill = ch.speech.endsWith('!');
              const charName = CHARACTER_PALETTES[ch.id]?.name || '';
              return (
                <div style={{
                  position: 'absolute',
                  left: ch.x,
                  top: ch.y - 60,
                  transform: 'translateX(-50%)',

                  background: isSkill
                    ? 'linear-gradient(135deg, #ffe066, #ffcc00)'
                    : 'linear-gradient(135deg, #ffffff, #e8e8ff)',
                  color: isSkill ? '#8b4513' : '#333',
                  fontSize: 7,
                  fontFamily: "'Press Start 2P', monospace",
                  padding: '5px 10px 4px',
                  borderRadius: 8,
                  whiteSpace: 'nowrap',
                  zIndex: 9999,
                  pointerEvents: 'none',
                  animation: 'speechBubble 3s ease-in-out forwards',
                  boxShadow: isSkill
                    ? '0 2px 8px rgba(255,200,0,0.5), inset 0 1px 0 rgba(255,255,255,0.5)'
                    : '0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.8)',
                  border: isSkill ? '1.5px solid #e6a800' : '1px solid #ccccee',
                  textAlign: 'center',
                  lineHeight: 1.6,
                }}>
                  <div style={{ fontSize: 5, color: isSkill ? '#996600' : '#888', marginBottom: 1 }}>
                    {charName}
                  </div>
                  {ch.speech}
                  <div style={{
                    position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
                    width: 0, height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: isSkill ? '6px solid #ffcc00' : '6px solid #e8e8ff',
                  }} />
                </div>
              );
            })()}
            {ch.action === 'sleep' && (
              <div style={{
                position: 'absolute',
                left: ch.x + 10,
                top: ch.y - 50,
                transition: 'left 0.5s linear, top 0.3s linear',
                fontSize: 10, color: '#aaccff',
                fontFamily: "'Press Start 2P', monospace",
                animation: 'zzzFloat 2s ease-in-out infinite',
                zIndex: 9999, pointerEvents: 'none',
              }}>
                z Z z
              </div>
            )}
          </div>
        ))}

        {/* 게스트 캐릭터 (방문자) */}
        {!editMode && guests.map((g) => (
          <div key={`guest-${g.nickname}`}>
            <RoomCharacter
              characterId={g.characterId}
              x={g.x} y={g.y}
              flip={g.flip}
              sleeping={false}
              scale={SCALE}
            />
            <div style={{
              position: 'absolute', left: g.x, top: g.y - 40,
              transform: 'translateX(-50%)',
              fontSize: 6, color: '#88ccff',
              fontFamily: "'Press Start 2P', monospace",
              textShadow: '1px 1px 0 #000',
              zIndex: 9998, pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}>
              {g.nickname}
            </div>
          </div>
        ))}

        {/* 외출 중 캐릭터 말풍선 (문 위에 표시) */}
        {!editMode && charStates.filter(ch => ch.hidden && ch.speech).map((ch) => {
          const charName = CHARACTER_PALETTES[ch.id]?.name || '';
          return (
            <div key={`goout-speech-${ch.id}`} style={{
              position: 'absolute',
              left: ch.x,
              top: ch.y - 70,
              transform: 'translateX(-50%)',
              background: 'linear-gradient(135deg, #ffe8cc, #ffd4a8)',
              color: '#8b4513',
              fontSize: 7,
              fontFamily: "'Press Start 2P', monospace",
              padding: '5px 10px 4px',
              borderRadius: 8,
              whiteSpace: 'nowrap',
              zIndex: 9999,
              pointerEvents: 'none',
              animation: 'speechBubble 3s ease-in-out forwards',
              boxShadow: '0 2px 8px rgba(200,100,0,0.3)',
              border: '1.5px solid #e6a800',
              textAlign: 'center',
              lineHeight: 1.6,
            }}>
              <div style={{ fontSize: 5, color: '#996600', marginBottom: 1 }}>{charName}</div>
              {ch.speech}
              <div style={{
                position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid #ffd4a8',
              }} />
            </div>
          );
        })}

        {/* 골 세리머니 */}
        {goalCelebration && (
          <>
            {/* 화면 플래시 */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(circle at center, rgba(255,255,0,0.3), transparent 70%)',
              zIndex: 10000, pointerEvents: 'none',
              animation: 'goalFlash 0.5s ease-out',
            }} />
            {/* GOAL!! 텍스트 */}
            <div style={{
              position: 'absolute',
              left: '50%', top: '35%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10002, pointerEvents: 'none',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: 32,
                fontFamily: "'Press Start 2P', monospace",
                color: '#fff',
                textShadow: '0 0 10px #ff0, 0 0 20px #f80, 0 0 40px #f44, 2px 2px 0 #c00, -2px -2px 0 #c00',
                animation: 'goalText 2.5s ease-out forwards',
                letterSpacing: 4,
              }}>
                GOAL!!
              </div>
              <div style={{
                fontSize: 8,
                fontFamily: "'Press Start 2P', monospace",
                color: '#ffcc00',
                marginTop: 6,
                textShadow: '1px 1px 0 #000',
                animation: 'goalText 2.5s ease-out forwards',
              }}>
                +5 점!
              </div>
            </div>
            {/* 폭죽 파티클 */}
            {goalCelebration.particles.map((p) => (
              <div key={`particle-${p.id}`} style={{
                position: 'absolute',
                left: `${goalCelebration.x}%`,
                top: `${goalCelebration.y}%`,
                width: p.size,
                height: p.size,
                borderRadius: p.id % 3 === 0 ? '50%' : p.id % 3 === 1 ? '2px' : '0',
                background: p.color,
                zIndex: 10001,
                pointerEvents: 'none',
                boxShadow: `0 0 ${p.size}px ${p.color}`,
                animation: `goalParticle${p.id % 6} ${1 + Math.random() * 1.5}s ease-out forwards`,
                '--px': `${Math.cos(p.angle) * p.speed * 30}px`,
                '--py': `${Math.sin(p.angle) * p.speed * 30}px`,
              }} />
            ))}
          </>
        )}

        {/* 가구 없을 때 */}
        {layout.length === 0 && !editMode && (
          <div style={{
            position: 'absolute', top: '55%', left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 10, color: '#666', textAlign: 'center',
            fontFamily: "'Press Start 2P', monospace",
          }}>
            상점에서<br/>가구를 구매하세요!
          </div>
        )}
      </div>)}

      {/* 모바일 조이스틱 + 꽃 버튼 */}
      {!editMode && !yardMode && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginTop: 0 }}>
        <div
          onPointerDown={(e) => {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            joystickRef.current = { active: true, cx, cy, dx: 0, dy: 0, id: e.pointerId };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!joystickRef.current.active) return;
            const { cx, cy } = joystickRef.current;
            const maxR = 20;
            let dx = e.clientX - cx;
            let dy = e.clientY - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }
            joystickRef.current.dx = dx / maxR;
            joystickRef.current.dy = dy / maxR;
          }}
          onPointerUp={() => { joystickRef.current = { active: false, dx: 0, dy: 0 }; }}
          onPointerCancel={() => { joystickRef.current = { active: false, dx: 0, dy: 0 }; }}
          style={{
            marginTop: 8, width: 70, height: 70, borderRadius: '50%',
            background: 'radial-gradient(circle, #2a2a6e, #1a1a4e)',
            border: '2px solid #4a4a8a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            touchAction: 'none', cursor: 'pointer', userSelect: 'none',
            position: 'relative',
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'radial-gradient(circle, #6a6aae, #4a4a8e)',
            border: '1px solid #8a8abe',
          }} />
          <div style={{
            position: 'absolute', bottom: -16, fontSize: 7, color: '#666',
            fontFamily: "'Press Start 2P', monospace", whiteSpace: 'nowrap',
          }}>
            조이스틱 / 방향키
          </div>
        </div>
        <button
          onClick={() => {
            if (duel || quiz) return;
            const eq = charStatesRef.current.find(c => Number(c.id) === equippedId);
            if (!eq) return;
            const nearby = findNearbyCharacter(eq);
            if (nearby) { startDuel(nearby.name, nearby.charId); }
            else { plantFlower(eq.x, eq.y); }
          }}
          style={{
            marginTop: 8, marginLeft: 12, width: 44, height: 44, borderRadius: '50%',
            background: 'radial-gradient(circle, #ff88aa, #cc4466)',
            border: '2px solid #ffccdd',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 18,
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          }}
        >
          🌸
        </button>
        </div>
      )}

      {/* 편집 모드 */}
      {editMode && (
        <div style={{ marginTop: 10, textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: 9, color: '#aaa', marginBottom: 8 }}>
            가구를 드래그하여 이동 | x 버튼으로 치우기
          </div>
          {ownedFurniture.filter(fId => !layout.some(l => l.id === fId)).length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 9, color: '#aaa', marginBottom: 6 }}>치워둔 가구:</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {ownedFurniture.filter(fId => !layout.some(l => l.id === fId)).map(fId => {
                  const f = FURNITURE_DEFS[fId];
                  return (
                    <button
                      key={fId}
                      onClick={() => {
                        playClick();
                        setLayout(prev => [...prev, {
                          id: fId,
                          x: f.wallMount ? 100 : 50 + Math.random() * 150,
                          y: f.wallMount ? 15 : 200 - f.h * SCALE - 10,
                        }]);
                      }}
                      style={{
                        background: '#1a1a5e', border: '1px solid #4a4a8a',
                        borderRadius: 4, padding: '4px 8px', cursor: 'pointer',
                        fontSize: 8, color: '#ccc',
                        fontFamily: "'Press Start 2P', monospace",
                      }}
                    >
                      + {f.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 캐릭터 목록 + 놀러가기 */}
      {!editMode && (
        <div style={{
          marginTop: 10, width: '100%',
          background: '#141450', border: '2px solid #333366',
          borderRadius: 6, padding: '8px 12px',
        }}>
          <div style={{ fontSize: 9, color: '#aaa', marginBottom: 6 }}>
            {visitMode === 'visiting' ? `${visitTarget}의 친구들` : `우리 친구들 (${ownedCharacters.length}마리)`}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {ownedCharacters.map((id) => (
              <div key={id} style={{
                background: id === equippedId ? '#3a2a0e' : '#1a1a5e',
                border: id === equippedId ? '1px solid #ffcc00' : '1px solid transparent',
                borderRadius: 4, padding: '2px 6px',
                fontSize: 8, color: id === equippedId ? '#ffcc00' : '#ccc',
                fontFamily: "'Press Start 2P', monospace",
              }}>
                {id === equippedId ? '▶ ' : ''}{CHARACTER_PALETTES[id]?.name || `#${id}`}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 문 외출 선택 팝업 */}
      {doorChoice && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000,
        }} onClick={() => setDoorChoice(false)}>
          <div style={{
            background: '#1a1a5e', border: '2px solid #4a4a8a', borderRadius: 10,
            padding: 24, minWidth: 240, textAlign: 'center',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, color: 'var(--gold)', marginBottom: 16, fontFamily: "'Press Start 2P', monospace" }}>
              어디로 갈까?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="pixel-btn" onClick={() => {
                playClick();
                setDoorChoice(false);
                // 내 앞마당으로
                setYardOwner(nickname);
                setYardCharPos({ x: 150, y: 160 });
                // 온라인이면 Supabase에서 내 꽃 로드
                if (isOnline()) {
                  getYardFlowers(nickname).then(f => setYardFlowers(f || []));
                } else {
                  try {
                    const saved = localStorage.getItem(`yard_flowers_${nickname}`);
                    setYardFlowers(saved ? JSON.parse(saved) : []);
                  } catch { setYardFlowers([]); }
                }
                setYardMode('own');
              }} style={{ fontSize: 9, padding: '10px 16px' }}>
                내 앞마당
              </button>
              {isOnline() && (
                <button className="pixel-btn gold" onClick={() => {
                  playClick();
                  setDoorChoice(false);
                  // 이미 방문 중이면 현재 방문 채널 정리
                  if (visitMode === 'visiting' && visitChannelRef.current) {
                    leaveVisitRoom(visitChannelRef.current);
                    visitChannelRef.current = null;
                    setGuests([]);
                  }
                  setVisitMode('input');
                  setVisitTarget('');
                  setVisitError('');
                }} style={{ fontSize: 9, padding: '10px 16px' }}>
                  친구방 놀러가기
                </button>
              )}
              <button className="pixel-btn red" onClick={() => { playClick(); setDoorChoice(false); }}
                style={{ fontSize: 8, padding: '6px 12px' }}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 놀러가기 입력 모달 */}
      {visitMode === 'input' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000,
        }} onClick={() => {
          // 취소 시: 이미 방문 채널을 끊었으므로 내 방으로 복귀
          visitModeRef.current = null;
          setVisitMode(null);
          setVisitTarget('');
          setGuests([]);
          try {
            const saved = localStorage.getItem(`room_layout_${nickname}`);
            if (saved) setLayout(JSON.parse(saved));
          } catch {}
          setCharStates(ownedCharacters.map((id, i) => ({
            id, x: 40 + (i * (roomSize.w - 80) / Math.max(ownedCharacters.length, 1)),
            y: floorTop + Math.random() * (floorBottom - floorTop),
            action: 'idle', targetX: null, targetY: null,
            flip: Math.random() > 0.5, actionTimer: Date.now() + randRange(1000, 3000),
            interacting: null, speech: null, speechTimer: Date.now() + randRange(6000, 16000),
          })));
        }}>
          <div style={{
            background: '#1a1a5e', border: '2px solid #4a4a8a', borderRadius: 10,
            padding: 20, minWidth: 250, textAlign: 'center',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, color: 'var(--gold)', marginBottom: 12, fontFamily: "'Press Start 2P', monospace" }}>
              친구 방 놀러가기
            </div>
            <input
              type="text"
              value={visitTarget}
              onChange={e => setVisitTarget(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVisit()}
              placeholder="친구 닉네임 입력"
              style={{
                width: '100%', padding: '8px 10px', fontSize: 12,
                background: '#0a0a3e', border: '1px solid #4a4a8a', borderRadius: 6,
                color: '#fff', fontFamily: "'Press Start 2P', monospace",
                outline: 'none', textAlign: 'center', boxSizing: 'border-box',
              }}
              autoFocus
            />
            {visitError && (
              <div style={{ fontSize: 8, color: '#ff6666', marginTop: 6, fontFamily: "'Press Start 2P', monospace" }}>
                {visitError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
              <button className="pixel-btn" onClick={() => {
                visitModeRef.current = null;
                setVisitMode(null);
                setVisitTarget('');
                setGuests([]);
                try {
                  const saved = localStorage.getItem(`room_layout_${nickname}`);
                  if (saved) setLayout(JSON.parse(saved));
                } catch {}
                setCharStates(ownedCharacters.map((id, i) => ({
                  id, x: 40 + (i * (roomSize.w - 80) / Math.max(ownedCharacters.length, 1)),
                  y: floorTop + Math.random() * (floorBottom - floorTop),
                  action: 'idle', targetX: null, targetY: null,
                  flip: Math.random() > 0.5, actionTimer: Date.now() + randRange(1000, 3000),
                  interacting: null, speech: null, speechTimer: Date.now() + randRange(6000, 16000),
                })));
              }} style={{ fontSize: 9, padding: '5px 12px' }}>
                취소
              </button>
              <button className="pixel-btn gold" onClick={handleVisit} style={{ fontSize: 9, padding: '5px 12px' }}>
                놀러가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 구구단 퀴즈 모달 */}
      {quiz && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10001,
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a5e, #2a2a7e)', border: '3px solid var(--gold)',
            borderRadius: 12, padding: 24, minWidth: 260, textAlign: 'center',
            boxShadow: '0 0 30px rgba(255,215,0,0.3)',
          }}>
            <div style={{ fontSize: 9, color: '#88ccff', marginBottom: 8, fontFamily: "'Press Start 2P', monospace" }}>
              구구단 퀴즈!
            </div>
            <div style={{ fontSize: 18, color: '#fff', marginBottom: 16, fontFamily: "'Press Start 2P', monospace" }}>
              {quiz.a} x {quiz.b} = ?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {quiz.choices.map((c, i) => (
                <button
                  key={i}
                  onClick={() => handleQuizAnswer(c)}
                  className="pixel-btn"
                  style={{
                    fontSize: 13, padding: '10px 0',
                    fontFamily: "'Press Start 2P', monospace",
                    background: quizWrong === c
                      ? 'linear-gradient(135deg, #cc3333, #aa2222)'
                      : 'linear-gradient(135deg, #3a3a8e, #4a4aae)',
                    color: '#fff',
                    border: quizWrong === c ? '2px solid #ff4444' : '2px solid #6a6acc',
                    borderRadius: 8, cursor: 'pointer',
                    transition: 'background 0.2s, border 0.2s',
                    animation: quizWrong === c ? 'quizShake 0.3s ease' : 'none',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 7, color: '#aaa', marginTop: 10, fontFamily: "'Press Start 2P', monospace" }}>
              맞히면 +100P!
            </div>
          </div>
        </div>
      )}

      {/* 1:1 대결 퀴즈 모달 */}
      {duel && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10002,
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a0a3e, #2a1a5e)', border: '3px solid #ff6644',
            borderRadius: 14, padding: 20, minWidth: 280, maxWidth: 320, textAlign: 'center',
            boxShadow: '0 0 40px rgba(255,100,60,0.4)',
          }}>
            {/* VS 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 14 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ position: 'relative', width: 40, height: 40, margin: '0 auto' }}>
                  <RoomCharacter characterId={equippedId} x={20} y={36} flip={false} scale={2} />
                </div>
                <div style={{ fontSize: 7, color: '#ffcc00', fontFamily: "'Press Start 2P', monospace", marginTop: 4 }}>{nickname}</div>
              </div>
              <div style={{
                fontSize: 14, color: '#ff4444', fontFamily: "'Press Start 2P', monospace",
                textShadow: '0 0 10px rgba(255,60,60,0.8)',
                animation: 'zzzFloat 1s ease-in-out infinite',
              }}>VS</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ position: 'relative', width: 40, height: 40, margin: '0 auto' }}>
                  <RoomCharacter characterId={duel.opponentId} x={20} y={36} flip={true} scale={2} />
                </div>
                <div style={{ fontSize: 7, color: '#88ccff', fontFamily: "'Press Start 2P', monospace", marginTop: 4 }}>{duel.opponentName}</div>
              </div>
            </div>

            {/* 타이머 */}
            <div style={{
              fontSize: 10, fontFamily: "'Press Start 2P', monospace", marginBottom: 8,
              color: duel.timeLeft <= 3 ? '#ff4444' : '#ffcc00',
              animation: duel.timeLeft <= 3 ? 'zzzFloat 0.3s ease-in-out infinite' : 'none',
            }}>
              ⏱ {duel.timeLeft}초
            </div>

            {/* 문제 */}
            {!duelResult && (
              <>
                <div style={{ fontSize: 18, color: '#fff', marginBottom: 14, fontFamily: "'Press Start 2P', monospace" }}>
                  {duel.a} x {duel.b} = ?
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {duel.choices.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => handleDuelAnswer(c)}
                      style={{
                        fontSize: 13, padding: '10px 0',
                        fontFamily: "'Press Start 2P', monospace",
                        background: duelWrong === c
                          ? 'linear-gradient(135deg, #cc3333, #aa2222)'
                          : 'linear-gradient(135deg, #3a3a8e, #4a4aae)',
                        color: '#fff',
                        border: duelWrong === c ? '2px solid #ff4444' : '2px solid #6a6acc',
                        borderRadius: 8, cursor: 'pointer',
                        animation: duelWrong === c ? 'quizShake 0.3s ease' : 'none',
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* 결과 */}
            {duelResult && (
              <div style={{ marginTop: 8 }}>
                <div style={{
                  fontSize: 16, fontFamily: "'Press Start 2P', monospace", marginBottom: 10,
                  color: duelResult === 'win' ? '#44ff44' : '#ff4444',
                  textShadow: `0 0 10px ${duelResult === 'win' ? 'rgba(60,255,60,0.6)' : 'rgba(255,60,60,0.6)'}`,
                }}>
                  {duelResult === 'win' ? '승리! +100P' : '시간 초과!'}
                </div>
                <div style={{ fontSize: 9, color: '#aaa', fontFamily: "'Press Start 2P', monospace", marginBottom: 12 }}>
                  정답: {duel.a} x {duel.b} = {duel.answer}
                </div>
                <button className="pixel-btn" onClick={closeDuel} style={{ fontSize: 9, padding: '6px 16px' }}>
                  확인
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
