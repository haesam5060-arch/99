import { useState, useEffect, useRef, useCallback } from 'react';
import { CHARACTER_SPRITES, CHARACTER_PALETTES, getRandomSkill } from '../data/characters';
import { renderSprite } from '../utils/pixelRenderer';
import { playClick } from '../utils/sound';
import { FURNITURE_DEFS } from './Shop';

const SCALE = 2;

const ACTION_DURATION = { idle: [2000, 4000], walk: [1500, 3000], sleep: [4000, 7000], sit: [3000, 5000] };

const SPEECH_BUBBLES = [
  '구구단 연습하자~', '오늘도 화이팅!', '심심해~', '놀아줘!',
  '배고파...', '잠온다 zzZ', '같이 공부할까?', '나 천재인듯?',
  '7x8은 56!', '여기 좋다~', '간식 먹고싶다', '숙제 다했어?',
  '최고의 하루!', '으쌰으쌰!', '힘내자!', '뭐하고 놀까?',
];

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// ── 가구 캔버스 ──
function FurnitureCanvas({ furnitureId, scale = 2 }) {
  const canvasRef = useRef(null);
  const f = FURNITURE_DEFS[furnitureId];

  useEffect(() => {
    if (!canvasRef.current || !f) return;
    const ctx = canvasRef.current.getContext('2d');
    const w = f.w * scale;
    const h = f.h * scale;
    canvasRef.current.width = w;
    canvasRef.current.height = h;
    ctx.clearRect(0, 0, w, h);
    f.sprite.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val && f.colors[val]) {
          ctx.fillStyle = f.colors[val];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });
  }, [furnitureId, scale]);

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
        transition: 'left 0.5s linear, top 0.3s linear',
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
  const [ownedFurniture] = useState(() => {
    try {
      const saved = localStorage.getItem(`room_furniture_${nickname}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [editMode, setEditMode] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [charStates, setCharStates] = useState([]);
  const [roomSize, setRoomSize] = useState({ w: 600, h: 400 });
  const roomRef = useRef(null);
  const animFrameRef = useRef(null);

  const ownedCharacters = player.characters || [0];

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

  // 가구 상호작용 위치 (실제 px)
  const findInteraction = useCallback((type) => {
    for (const item of layout) {
      const f = FURNITURE_DEFS[item.id];
      if (f?.interaction === type) {
        const px = (item.x / 300) * roomSize.w + (f.w * SCALE) / 2;
        const py = (item.y / 200) * roomSize.h + f.h * SCALE;
        return { x: px, y: py };
      }
    }
    return null;
  }, [layout, roomSize]);

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
              return { ...ch, x: ch.targetX, y: ch.targetY || ch.y, action: nextAction, targetX: null, targetY: null };
            }
            const dist = Math.sqrt(dx * dx + dy * dy);
            const speed = 1.2;
            return {
              ...ch,
              x: ch.x + (dx / dist) * speed,
              y: ch.y + (dy / dist) * speed,
              flip: dx < 0,
            };
          }
          return ch;
        }

        const roll = Math.random();
        let newAction;
        if (roll < 0.35) newAction = 'walk';
        else if (roll < 0.55 && findInteraction('sleep')) newAction = 'sleep';
        else if (roll < 0.7 && findInteraction('sit')) newAction = 'sit';
        else newAction = 'idle';

        const duration = randRange(...ACTION_DURATION[newAction]);
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
        return { ...ch, action: 'idle', targetX: null, targetY: null, actionTimer: now + duration, interacting: null };
      }).map(ch => {
        const now = Date.now();
        // 말풍선 타이머
        if (ch.speech && now > ch.speechTimer) {
          return { ...ch, speech: null, speechTimer: now + randRange(5000, 12000) };
        }
        if (!ch.speech && now > ch.speechTimer && ch.action !== 'sleep') {
          // 30% 확률로 기술명, 70% 확률로 일반 대사
          const msg = Math.random() < 0.3
            ? getRandomSkill(ch.id)
            : SPEECH_BUBBLES[Math.floor(Math.random() * SPEECH_BUBBLES.length)];
          return { ...ch, speech: msg, speechTimer: now + 3000 };
        }
        return ch;
      }));
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [editMode, findInteraction, roomSize]);

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
          return (
            <div
              key={`f-${idx}`}
              onPointerDown={(e) => handlePointerDown(e, idx)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{
                position: 'absolute',
                left: `${(item.x / 300) * 100}%`,
                top: `${(item.y / 200) * 100}%`,
                cursor: editMode ? 'grab' : 'default',
                zIndex: f.wallMount ? 1 : Math.floor(item.y) + 10,
                filter: editMode ? 'brightness(1.2) drop-shadow(0 0 4px var(--gold))' : 'none',
                transition: dragging?.idx === idx ? 'none' : 'left 0.1s, top 0.1s',
                touchAction: 'none',
              }}
            >
              <FurnitureCanvas furnitureId={item.id} scale={SCALE} />
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
        {!editMode && charStates.map((ch, idx) => (
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
                  transition: 'left 0.5s linear, top 0.3s linear',
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
