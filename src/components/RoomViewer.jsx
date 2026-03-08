import { FurnitureCanvas } from './MyRoom';
import { FURNITURE_DEFS } from './Shop';
import PixelCharacter from './PixelCharacter';
import SchoolCardCharacter from './SchoolCardCharacter';
import { playClick } from '../utils/sound';

const SCALE = 2;
const SCHOOL_CARD_ID = 13;

export default function RoomViewer({ playerName, roomLayout, equippedCharacter, schoolName, onClose }) {
  const layout = roomLayout || [];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#141450',
          border: '3px solid #6666aa',
          padding: '16px 14px',
          maxWidth: 400,
          width: '92%',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          fontSize: 14,
          color: 'var(--gold)',
          marginBottom: 12,
          textShadow: '1px 1px 0 #b8860b',
        }}>
          {playerName}의 방
        </div>

        {/* 방 */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '3 / 2',
          background: 'linear-gradient(180deg, #2a2a5e 0%, #1e1e4a 100%)',
          borderRadius: 6,
          overflow: 'hidden',
          border: '2px solid #333366',
        }}>
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

          {/* 가구 */}
          {layout.map((item, idx) => {
            const f = FURNITURE_DEFS[item.id];
            if (!f) return null;
            return (
              <div
                key={`f-${idx}`}
                style={{
                  position: 'absolute',
                  left: `${(item.x / 300) * 100}%`,
                  top: `${(item.y / 200) * 100}%`,
                  zIndex: f.wallMount ? 1 : Math.floor(item.y) + 10,
                }}
              >
                <FurnitureCanvas furnitureId={item.id} scale={SCALE} />
              </div>
            );
          })}

          {/* 캐릭터 (중앙에 정적으로 표시) */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '60%',
            transform: 'translate(-50%, -100%)',
            zIndex: 150,
          }}>
            {equippedCharacter === SCHOOL_CARD_ID ? (
              <SchoolCardCharacter schoolName={schoolName || '학교'} pixelSize={3} mode="card" />
            ) : (
              <PixelCharacter characterId={equippedCharacter || 0} pixelSize={3} />
            )}
          </div>

          {/* 가구 없을 때 */}
          {layout.length === 0 && (
            <div style={{
              position: 'absolute', top: '45%', left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: 9, color: '#666', textAlign: 'center',
              fontFamily: "'Press Start 2P', monospace",
            }}>
              아직 가구가 없어요
            </div>
          )}
        </div>

        <button
          className="pixel-btn"
          onClick={() => { playClick(); onClose(); }}
          style={{ fontSize: 11, marginTop: 14 }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
