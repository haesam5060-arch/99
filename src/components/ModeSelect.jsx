import { playClick } from '../utils/sound';

export default function ModeSelect({ onSelect, onBack }) {
  const handleSelect = (mode) => {
    playClick();
    onSelect(mode);
  };

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
