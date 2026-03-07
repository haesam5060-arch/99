import { useState } from 'react';
import { playClick } from '../utils/sound';

export default function ModeSelect({ onSelect, onBack }) {
  const [showCustom, setShowCustom] = useState(false);
  const [selectedDans, setSelectedDans] = useState([]);

  const handleSelect = (mode) => {
    playClick();
    onSelect(mode);
  };

  const toggleDan = (dan) => {
    playClick();
    setSelectedDans((prev) =>
      prev.includes(dan) ? prev.filter((d) => d !== dan) : [...prev, dan].sort((a, b) => a - b)
    );
  };

  const startCustom = () => {
    if (selectedDans.length === 0) return;
    playClick();
    onSelect({ type: 'custom', dans: selectedDans });
  };

  if (showCustom) {
    return (
      <div className="game-container" style={{ justifyContent: 'flex-start', paddingTop: 20 }}>
        <div className="game-title" style={{ fontSize: 18 }}>
          원하는 단 선택
        </div>
        <div style={{ fontSize: 10, color: '#aaa', marginBottom: 20, textAlign: 'center', lineHeight: 2 }}>
          도전할 단을 선택하세요<br />
          선택한 순서대로 진행됩니다
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 8,
          width: '100%',
          marginBottom: 20,
        }}>
          {Array.from({ length: 19 }, (_, i) => i + 2).map((dan) => (
            <button
              key={dan}
              onClick={() => toggleDan(dan)}
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 12,
                padding: '12px 4px',
                background: selectedDans.includes(dan) ? '#2a5a3a' : '#141450',
                border: `3px solid ${selectedDans.includes(dan) ? '#5dde9e' : '#333366'}`,
                color: selectedDans.includes(dan) ? '#5dde9e' : '#888',
                cursor: 'pointer',
                transition: 'all 0.1s',
              }}
            >
              {dan}단
            </button>
          ))}
        </div>

        {selectedDans.length > 0 && (
          <div style={{ fontSize: 10, color: '#aaa', marginBottom: 16, textAlign: 'center' }}>
            선택: {selectedDans.map((d) => `${d}단`).join(', ')}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
          <button
            className="pixel-btn gold"
            onClick={startCustom}
            disabled={selectedDans.length === 0}
            style={{ opacity: selectedDans.length === 0 ? 0.4 : 1 }}
          >
            시작 ({selectedDans.length}단)
          </button>
          <button
            className="pixel-btn red"
            onClick={() => { playClick(); setShowCustom(false); setSelectedDans([]); }}
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container" style={{ justifyContent: 'center' }}>
      <div className="game-title" style={{ fontSize: 22 }}>
        게임 모드 선택
      </div>
      <div style={{ fontSize: 13, color: '#aaa', marginBottom: 40, textAlign: 'center', lineHeight: 2 }}>
        2단부터 20단까지<br />
        순서대로 도전합니다
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <button className="pixel-btn gold" onClick={() => handleSelect('sequential')}>
          순서대로
        </button>
        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: -12 }}>
          2x1, 2x2, 2x3 ...
        </div>

        <button className="pixel-btn" onClick={() => handleSelect('random')}>
          랜덤
        </button>
        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: -12 }}>
          각 단 내 문제 순서 랜덤
        </div>

        <button className="pixel-btn" onClick={() => { playClick(); setShowCustom(true); }}>
          원하는 단만
        </button>
        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: -12 }}>
          선택한 단만 도전
        </div>

        <button
          className="pixel-btn red"
          onClick={() => { playClick(); onBack(); }}
          style={{ marginTop: 20 }}
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}
