import { useState, useEffect, useRef, useCallback } from 'react';
import { CHARACTER_SPRITES, CHARACTER_PALETTES, getRandomSkill } from '../data/characters';
import { renderSprite } from '../utils/pixelRenderer';
import { playClick } from '../utils/sound';
import { FURNITURE_DEFS } from './Shop';

const ROOM_W = 300;
const ROOM_H = 200;
const WALL_H = 60;
const SCALE = 2;

const ACTION_DURATION = { idle: [2000, 4000], walk: [1500, 3000], sleep: [4000, 7000], sit: [3000, 5000] };

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

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
  return <canvas ref={canvasRef} width={w} height={h} style={{ width: w, height: h, imageRendering: 'pixelated' }} />;
}

function RoomCharacter({ characterId, xPct, yPct, flip, sleeping, scale = 2 }) {
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
        left: `${xPct}%`,
        bottom: `${100 - yPct}%`,
        width: canvasSize,
        height: canvasSize,
        imageRendering: 'pixelated',
        transform: `scaleX(${flip ? -1 : 1})${sleeping ? ' rotate(90deg) translateY(8px)' : ''}`,
        transition: 'left 0.5s linear, bottom 0.3s linear',
        zIndex: Math.floor(yPct),
      }}
    />
  );
}

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
  const roomRef = useRef(null);
  const animFrameRef = useRef(null);

  const ownedCharacters = player.characters || [0];

  useEffect(() => {
    localStorage.setItem(`room_layout_${nickname}`, JSON.stringify(layout));
  }, [layout, nickname]);

  // 바닥 영역: WALL_H(60) ~ ROOM_H(200), 즉 y% = 30% ~ 95%
  const FLOOR_MIN_Y = ((WALL_H + 20) / ROOM_H) * 100; // ~40%
  const FLOOR_MAX_Y = 92; // 바닥 근처

  useEffect(() => {
    const states = ownedCharacters.map((id, i) => ({
      id,
      x: (10 + (i * 20) % 80), // x를 %로 관리 (0~100)
      y: FLOOR_MAX_Y - Math.random() * 5,
      action: 'idle',
      targetX: null,
      flip: Math.random() > 0.5,
      actionTimer: Date.now() + randRange(1000, 3000),
      interacting: null,
      speech: null,       // { text, until }
    }));
    setCharStates(states);
  }, [ownedCharacters.length]);

  // 랜덤으로 캐릭터가 기술명을 외침
  useEffect(() => {
    if (editMode || charStates.length === 0) return;
    const interval = setInterval(() => {
      setCharStates(prev => {
        const awake = prev.filter(ch => ch.action !== 'sleep');
        if (awake.length === 0) return prev;
        const target = awake[Math.floor(Math.random() * awake.length)];
        return prev.map(ch => {
          if (ch !== target) return ch;
          return { ...ch, speech: { text: getRandomSkill(ch.id), until: Date.now() + 2500 } };
        });
      });
    }, randRange(3000, 6000));
    return () => clearInterval(interval);
  }, [editMode, charStates.length]);

  const findInteraction = useCallback((type) => {
    for (const item of layout) {
      const f = FURNITURE_DEFS[item.id];
      if (f?.interaction === type) {
        // layout의 x,y는 ROOM 좌표(0~300, 0~200) → %로 변환
        return { x: ((item.x + f.w) / ROOM_W) * 100, y: (item.y / ROOM_H) * 100 };
      }
    }
    return null;
  }, [layout]);

  useEffect(() => {
    if (editMode) return;

    const tick = () => {
      setCharStates(prev => prev.map(ch => {
        const now = Date.now();
        // 말풍선 만료 처리
        const speechExpired = ch.speech && now > ch.speech.until;
        const updatedSpeech = speechExpired ? null : ch.speech;

        if (now < ch.actionTimer) {
          if (ch.action === 'walk' && ch.targetX != null) {
            const dx = ch.targetX - ch.x;
            if (Math.abs(dx) < 1) {
              const nextAction = ch.interacting || 'idle';
              return { ...ch, x: ch.targetX, action: nextAction, targetX: null, speech: updatedSpeech };
            }
            return { ...ch, x: ch.x + Math.sign(dx) * 0.3, flip: dx < 0, speech: updatedSpeech };
          }
          if (speechExpired) return { ...ch, speech: null };
          return ch;
        }

        const roll = Math.random();
        let newAction;
        if (roll < 0.35) newAction = 'walk';
        else if (roll < 0.55 && findInteraction('sleep')) newAction = 'sleep';
        else if (roll < 0.7 && findInteraction('sit')) newAction = 'sit';
        else newAction = 'idle';

        const duration = randRange(...ACTION_DURATION[newAction]);

        if (newAction === 'walk') {
          const tx = 5 + Math.random() * 85; // 0~100% 범위
          return { ...ch, action: 'walk', targetX: tx, flip: tx < ch.x, actionTimer: now + duration, interacting: null };
        }
        if (newAction === 'sleep') {
          const pos = findInteraction('sleep');
          if (pos && Math.abs(ch.x - pos.x) > 10) {
            return { ...ch, action: 'walk', targetX: pos.x, flip: pos.x < ch.x, actionTimer: now + 2000, interacting: 'sleep' };
          }
          return { ...ch, action: 'sleep', targetX: null, actionTimer: now + duration, interacting: 'sleep' };
        }
        if (newAction === 'sit') {
          const pos = findInteraction('sit');
          if (pos && Math.abs(ch.x - pos.x) > 10) {
            return { ...ch, action: 'walk', targetX: pos.x, flip: pos.x < ch.x, actionTimer: now + 2000, interacting: 'sit' };
          }
          return { ...ch, action: 'sit', targetX: null, actionTimer: now + duration, interacting: 'sit' };
        }
        return { ...ch, action: 'idle', targetX: null, actionTimer: now + duration, interacting: null };
      }));
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [editMode, findInteraction]);

  const handleRemoveFurniture = (idx) => {
    playClick();
    setLayout(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePointerDown = (e, idx) => {
    if (!editMode) return;
    e.preventDefault();
    const rect = roomRef.current.getBoundingClientRect();
    const scaleX = ROOM_W / rect.width;
    const scaleY = ROOM_H / rect.height;
    setDragging({
      idx,
      offsetX: (e.clientX - rect.left) * scaleX - layout[idx].x,
      offsetY: (e.clientY - rect.top) * scaleY - layout[idx].y,
    });
  };

  const handlePointerMove = (e) => {
    if (!dragging || !roomRef.current) return;
    const rect = roomRef.current.getBoundingClientRect();
    const scaleX = ROOM_W / rect.width;
    const scaleY = ROOM_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX - dragging.offsetX;
    const my = (e.clientY - rect.top) * scaleY - dragging.offsetY;
    setLayout(prev => prev.map((item, i) => {
      if (i !== dragging.idx) return item;
      const f = FURNITURE_DEFS[item.id];
      return {
        ...item,
        x: Math.max(0, Math.min(ROOM_W - f.w * SCALE, mx)),
        y: Math.max(0, Math.min(ROOM_H - f.h * SCALE, my)),
      };
    }));
  };

  const handlePointerUp = () => setDragging(null);

  return (
    <div className="game-container" style={{ justifyContent: 'flex-start', paddingTop: 10 }}>
      <style>{`
        @keyframes zzzFloat {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-8px); }
        }
        @keyframes speechBubble {
          0% { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.5); }
          15% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.05); }
          25% { transform: translateX(-50%) translateY(0) scale(1); }
          75% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(0.9); }
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
          aspectRatio: `${ROOM_W} / ${ROOM_H}`,
          background: 'linear-gradient(180deg, #2a2a5e 0%, #1e1e4a 100%)',
          borderRadius: 8,
          overflow: 'hidden',
          border: editMode ? '2px dashed var(--gold)' : '2px solid #333366',
          touchAction: 'none',
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: `${(WALL_H / ROOM_H) * 100}%`,
          background: 'linear-gradient(180deg, #3a3a6e 0%, #2a2a5e 100%)',
          borderBottom: '3px solid #5c5c8a',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: `${((ROOM_H - WALL_H) / ROOM_H) * 100}%`,
          background: 'repeating-conic-gradient(#4a3728 0% 25%, #5a4738 0% 50%) 0 0 / 20px 20px',
        }} />
        <div style={{
          position: 'absolute', top: `${((WALL_H - 4) / ROOM_H) * 100}%`, left: 0, right: 0,
          height: 4, background: '#7a6a5a',
        }} />

        {/* 가구 */}
        {layout.map((item, idx) => {
          const f = FURNITURE_DEFS[item.id];
          if (!f) return null;
          return (
            <div
              key={`f-${idx}`}
              onPointerDown={(e) => handlePointerDown(e, idx)}
              style={{
                position: 'absolute',
                left: `${(item.x / ROOM_W) * 100}%`,
                top: `${(item.y / ROOM_H) * 100}%`,
                cursor: editMode ? 'grab' : 'default',
                zIndex: f.wallMount ? 1 : Math.floor(item.y),
                filter: editMode ? 'brightness(1.2) drop-shadow(0 0 4px var(--gold))' : 'none',
                transition: dragging?.idx === idx ? 'none' : 'left 0.1s, top 0.1s',
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

        {/* 캐릭터 */}
        {!editMode && charStates.map((ch, idx) => (
          <div key={`char-${idx}`}>
            <RoomCharacter
              characterId={ch.id}
              x={`${(ch.x / ROOM_W) * 100}%`}
              y={`${(ch.y / ROOM_H) * 100}%`}
              flip={ch.flip}
              sleeping={ch.action === 'sleep'}
              scale={SCALE}
            />
            {ch.action === 'sleep' && (
              <div style={{
                position: 'absolute',
                left: `${((ch.x + 20) / ROOM_W) * 100}%`,
                top: `${((ch.y - 40) / ROOM_H) * 100}%`,
                fontSize: 10, color: '#aaccff',
                fontFamily: "'Press Start 2P', monospace",
                animation: 'zzzFloat 2s ease-in-out infinite',
                zIndex: 9999, pointerEvents: 'none',
              }}>
                z Z z
              </div>
            )}
            {ch.speech && (
              <div
                key={ch.speech.text + ch.speech.until}
                style={{
                  position: 'absolute',
                  left: `${ch.x}%`,
                  top: `${ch.y - 22}%`,
                  transform: 'translateX(-50%)',
                  background: '#fff',
                  color: CHARACTER_PALETTES[ch.id]?.colors?.[1] || '#333',
                  border: `2px solid ${CHARACTER_PALETTES[ch.id]?.colors?.[2] || '#666'}`,
                  borderRadius: 6,
                  padding: '3px 6px',
                  fontSize: 7,
                  fontFamily: "'Press Start 2P', monospace",
                  whiteSpace: 'nowrap',
                  zIndex: 9999,
                  pointerEvents: 'none',
                  animation: 'speechBubble 2.5s ease-out forwards',
                  textShadow: 'none',
                  boxShadow: '1px 1px 0 rgba(0,0,0,0.2)',
                }}
              >
                {ch.speech.text}
                <div style={{
                  position: 'absolute',
                  bottom: -6,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0, height: 0,
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderTop: `6px solid ${CHARACTER_PALETTES[ch.id]?.colors?.[2] || '#666'}`,
                }} />
              </div>
            )}
          </div>
        ))}

        {layout.length === 0 && !editMode && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
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
                          x: f.wallMount ? 100 : ROOM_W / 2 - f.w,
                          y: f.wallMount ? 20 : ROOM_H - f.h * SCALE - 5,
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
