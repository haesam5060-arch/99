import { useState, useEffect, useRef, useCallback } from 'react';
import { CHARACTER_SPRITES, CHARACTER_PALETTES, getRandomSkill } from '../data/characters';
import { renderSprite } from '../utils/pixelRenderer';
import { playClick } from '../utils/sound';
import { FURNITURE_DEFS } from './Shop';
import { isOnline, saveRoomData, getRoomData } from '../utils/supabase';

const SCALE = 2;

const ACTION_DURATION = { idle: [2000, 4000], walk: [3000, 6000], sleep: [4000, 7000], sit: [3000, 5000], eat: [3000, 5000], eat_at: [4000, 6000], play: [3000, 5000], watch: [4000, 6000], music: [3000, 5000], ball: [2000, 4000], goout: [5000, 5000] };

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
  const ballPhysicsRef = useRef({}); // { layoutIdx: { x, y, vx, vy } } 가상좌표
  const charStatesRef = useRef([]); // 축구공 물리용 최신 캐릭터 상태 참조
  const roomRef = useRef(null);
  const animFrameRef = useRef(null);

  const ownedCharacters = player.characters || [0];

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

  useEffect(() => {
    localStorage.setItem(`room_layout_${nickname}`, JSON.stringify(layout));
    if (isOnline()) {
      const furniture = JSON.parse(localStorage.getItem(`room_furniture_${nickname}`) || '[]');
      saveRoomData(nickname, layout, furniture);
    }
  }, [layout, nickname]);

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
      speechTimer: Date.now() + randRange(3000, 8000),
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
        const py = (vy / 200) * roomSize.h;
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

    const tick = () => {
      setCharStates(prev => prev.map(ch => {
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
            const speed = 1.8;
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
          return { ...ch, speech: null, speechTimer: now + randRange(5000, 12000) };
        }
        if (!ch.speech && now > ch.speechTimer && ch.action !== 'sleep') {
          // 20% 확률로 기술명, 80% 확률로 종합 대사 (주인 이름, 구구단 퀴즈 포함)
          const msg = Math.random() < 0.2
            ? getRandomSkill(ch.id)
            : getRandomSpeech(nickname);
          return { ...ch, speech: msg, speechTimer: now + 3000 };
        }
        return ch;
      }));
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

  return (
    <div className="game-container" style={{ justifyContent: 'flex-start', paddingTop: 10 }}>
      <style>{`
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
      `}</style>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10 }}>
        <button
          className="pixel-btn"
          onClick={() => { playClick(); onBack(); }}
          style={{ fontSize: 10, minWidth: 50, padding: '6px 8px' }}
        >
          뒤로
        </button>
        <span style={{ fontSize: 13, color: 'var(--gold)' }}>
          {nickname}의 방
        </span>
        <button
          className={`pixel-btn ${editMode ? 'gold' : ''}`}
          onClick={() => { playClick(); setEditMode(!editMode); }}
          style={{ fontSize: 10, minWidth: 50, padding: '6px 8px' }}
        >
          {editMode ? '완료' : '꾸미기'}
        </button>
      </div>

      {/* 방 */}
      <div
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

        {/* 가구 (가상 300x200 → %로 변환) */}
        {layout.map((item, idx) => {
          const f = FURNITURE_DEFS[item.id];
          if (!f) return null;
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
      </div>

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

      {/* 캐릭터 목록 */}
      {!editMode && (
        <div style={{
          marginTop: 10, width: '100%',
          background: '#141450', border: '2px solid #333366',
          borderRadius: 6, padding: '8px 12px',
        }}>
          <div style={{ fontSize: 9, color: '#aaa', marginBottom: 6 }}>
            우리 친구들 ({ownedCharacters.length}마리)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {ownedCharacters.map((id) => (
              <div key={id} style={{
                background: '#1a1a5e', borderRadius: 4, padding: '2px 6px',
                fontSize: 8, color: '#ccc',
                fontFamily: "'Press Start 2P', monospace",
              }}>
                {CHARACTER_PALETTES[id]?.name || `#${id}`}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
