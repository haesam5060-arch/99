import PixelCharacter from './PixelCharacter';
import SchoolCardCharacter from './SchoolCardCharacter';
import { CHARACTER_PALETTES } from '../data/characters';
import { playClick } from '../utils/sound';

const SCHOOL_CARD_ID = 13;

export default function MainScreen({ player, nickname, onNavigate }) {
  const isSchoolCard = player.equippedCharacter === SCHOOL_CARD_ID;
  const charName = isSchoolCard
    ? (player.schoolName ? `${player.schoolName}초` : '학교 카드')
    : (CHARACTER_PALETTES[player.equippedCharacter]?.name || '지렁이');

  const handleNav = (screen) => {
    playClick();
    onNavigate(screen);
  };

  return (
    <div className="game-container" style={{ justifyContent: 'center' }}>
      <div className="game-title">
        구구단<br />행성 디펜스
      </div>

      <div style={{ margin: '24px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 16, marginBottom: 10, color: '#aaaaff' }}>
          {nickname}
        </div>
        {isSchoolCard ? (
          <SchoolCardCharacter schoolName={player.schoolName || '학교'} pixelSize={6} mode="card" />
        ) : (
          <PixelCharacter characterId={player.equippedCharacter} pixelSize={6} />
        )}
        <div style={{ fontSize: 12, marginTop: 8, color: '#aaa' }}>
          {charName}
        </div>
      </div>

      <div style={{
        fontSize: 20,
        color: 'var(--gold)',
        marginBottom: 36,
        textAlign: 'center',
      }}>
        {player.score.toLocaleString()} P
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <button className="pixel-btn gold" onClick={() => handleNav('modeSelect')}>
          게임 시작
        </button>
        <button className="pixel-btn" onClick={() => handleNav('shop')}>
          캐릭터 상점
        </button>
        <button className="pixel-btn" onClick={() => handleNav('ranking')}>
          랭킹
        </button>
        <button className="pixel-btn" onClick={() => handleNav('help')} style={{ fontSize: 12 }}>
          도움말
        </button>
        <button
          className="pixel-btn red"
          onClick={() => handleNav('nickname')}
          style={{ fontSize: 12 }}
        >
          닉네임 변경
        </button>
      </div>
    </div>
  );
}
