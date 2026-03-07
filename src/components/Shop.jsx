import { useState } from 'react';
import { CHARACTER_PALETTES } from '../data/characters';
import { purchaseCharacter, equipCharacter, sellCharacter } from '../utils/storage';
import { isOnline, purchaseOnlineCharacter, equipOnlineCharacter, updateSchoolName, sellOnlineCharacter } from '../utils/supabase';
import { playClick, playPurchase } from '../utils/sound';
import PixelCharacter from './PixelCharacter';
import SchoolCardCharacter from './SchoolCardCharacter';
import { containsProfanity } from '../utils/profanityFilter';

const SCHOOL_CARD_ID = 13;
const SCHOOL_CARD_PRICE = 5000;

const CHARACTER_TOOLTIPS = {
  0: '기본 캐릭터\n핑크 에너지볼 공격',
  1: '돌멩이 공격',
  2: '뿔 돌진 공격',
  3: '화염구 공격',
  4: '당근 미사일 공격',
  5: '초록 화염 공격',
  6: '독침 공격',
  7: '말발굽 충격파 공격',
  8: '솜뭉치 공격',
  9: '바나나 공격',
  10: '알 투척 공격',
  11: '뼈다귀 공격',
  12: '핑크 에너지 공격',
  13: '학교 이름을 입력하면\n나만의 학교 카드가\n캐릭터로 만들어져요!',
  14: '로켓 발사 공격',
  15: '레이저 빔 공격',
  16: '수리검 투척 공격',
  17: '성스러운 검기 공격',
  18: '마법 오브 공격',
  19: '대포알 발사 공격',
  20: '에너지 펀치 공격',
  21: '참치캔 투척 공격',
  22: '아이스볼 공격',
  23: '거대 화염구 공격',
  24: '거대 황금 에너지 폭발 공격\n틀려도 점수가 안 깎여요!',
};

function getPrice(id) {
  if (id === 0) return 0;
  if (id === 24) return 10000;
  if (id === SCHOOL_CARD_ID) return SCHOOL_CARD_PRICE;
  const data = CHARACTER_PALETTES[id];
  if (data?.premium) return 3000;
  return 1000;
}

export default function Shop({ player, nickname, onUpdate, onBack }) {
  const [confirm, setConfirm] = useState(null); // { type: 'buy'|'sell', id }
  const [loading, setLoading] = useState(false);
  const [schoolInput, setSchoolInput] = useState('');
  const [schoolError, setSchoolError] = useState('');

  const handleBuy = (id) => {
    playClick();
    if (id === SCHOOL_CARD_ID) {
      setSchoolInput('');
      setSchoolError('');
    }
    setConfirm({ type: 'buy', id });
  };

  const handleSell = (id) => {
    playClick();
    setConfirm({ type: 'sell', id });
  };

  const confirmBuy = async () => {
    if (!confirm || confirm.type !== 'buy') return;
    const id = confirm.id;
    const isSchoolCard = id === SCHOOL_CARD_ID;
    const price = getPrice(id);

    if (isSchoolCard && schoolInput.trim().length < 1) return;
    if (isSchoolCard && containsProfanity(schoolInput.trim())) {
      setSchoolError('사용할 수 없는 이름이에요!');
      return;
    }

    setSchoolError('');
    setLoading(true);

    if (isOnline()) {
      const result = await purchaseOnlineCharacter(nickname, id, price);
      if (result.success) {
        playPurchase();
        if (isSchoolCard) {
          await updateSchoolName(nickname, schoolInput.trim());
        }
        onUpdate({
          score: result.player.score,
          characters: result.player.characters,
          equippedCharacter: result.player.equipped_character,
          schoolName: isSchoolCard ? schoolInput.trim() : player.schoolName,
        });
      }
    } else {
      const result = purchaseCharacter(nickname, id, price);
      if (result.success) {
        playPurchase();
        if (isSchoolCard) {
          result.player.schoolName = schoolInput.trim();
          const players = JSON.parse(localStorage.getItem('gugudan_players') || '{}');
          if (players[nickname]) {
            players[nickname].schoolName = schoolInput.trim();
            localStorage.setItem('gugudan_players', JSON.stringify(players));
          }
        }
        onUpdate(result.player);
      }
    }

    setConfirm(null);
    setLoading(false);
  };

  const confirmSell = async () => {
    if (!confirm || confirm.type !== 'sell') return;
    const id = confirm.id;
    const refund = Math.floor(getPrice(id) / 2);

    setLoading(true);

    if (isOnline()) {
      const result = await sellOnlineCharacter(nickname, id, refund);
      if (result.success) {
        playClick();
        onUpdate({
          score: result.player.score,
          characters: result.player.characters,
          equippedCharacter: result.player.equipped_character,
          schoolName: id === SCHOOL_CARD_ID ? '' : player.schoolName,
        });
      }
    } else {
      const result = sellCharacter(nickname, id, refund);
      if (result.success) {
        playClick();
        onUpdate(result.player);
      }
    }

    setConfirm(null);
    setLoading(false);
  };

  const handleEquip = async (id) => {
    playClick();
    if (isOnline()) {
      const result = await equipOnlineCharacter(nickname, id);
      if (result) {
        onUpdate({
          score: result.score,
          characters: result.characters,
          equippedCharacter: result.equipped_character,
          schoolName: player.schoolName,
        });
      }
    } else {
      const updated = equipCharacter(nickname, id);
      if (updated) onUpdate(updated);
    }
  };

  const characters = Object.entries(CHARACTER_PALETTES).map(([id, data]) => ({
    id: Number(id),
    name: data.name,
    owned: player.characters.includes(Number(id)),
    equipped: player.equippedCharacter === Number(id),
    price: getPrice(Number(id)),
    isSchoolCard: !!data.isSchoolCard,
  }));

  const isPopupOpen = confirm !== null;
  const popupId = confirm?.id;
  const popupType = confirm?.type;

  return (
    <div className="game-container" style={{ justifyContent: 'flex-start', paddingTop: 20 }}>
      <div style={{ fontSize: 14, color: 'var(--gold)', marginBottom: 6, textShadow: '2px 2px 0 #b8860b' }}>
        캐릭터 상점
      </div>
      <div style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 20 }}>
        {player.score.toLocaleString()} P
      </div>

      {/* Popup */}
      {isPopupOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            background: '#141450',
            border: '4px solid #6666aa',
            padding: 30,
            textAlign: 'center',
            maxWidth: 320,
            width: '90%',
          }}>
            {popupId === SCHOOL_CARD_ID ? (
              <SchoolCardCharacter schoolName={popupType === 'buy' ? (schoolInput || '학교') : (player.schoolName || '학교')} pixelSize={4} />
            ) : (
              <PixelCharacter characterId={popupId} pixelSize={4} />
            )}

            {popupType === 'sell' ? (
              <div style={{ fontSize: 10, margin: '16px 0', lineHeight: 2 }}>
                [{CHARACTER_PALETTES[popupId]?.isSchoolCard
                  ? (player.schoolName ? `${player.schoolName}초` : '학교 카드')
                  : CHARACTER_PALETTES[popupId]?.name}]를<br />
                판매할까요?<br />
                <span style={{ color: 'var(--gold)' }}>
                  +{Math.floor(getPrice(popupId) / 2).toLocaleString()}P 환급
                </span>
              </div>
            ) : popupId === SCHOOL_CARD_ID ? (
              <>
                <div style={{ fontSize: 10, margin: '16px 0 10px', lineHeight: 2 }}>
                  학교 이름을 입력하세요<br />
                  (1~4글자)
                </div>
                <input
                  type="text"
                  value={schoolInput}
                  onChange={(e) => { setSchoolInput(e.target.value.slice(0, 4)); setSchoolError(''); }}
                  maxLength={4}
                  placeholder="중촌"
                  autoFocus
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 14,
                    padding: '10px 16px',
                    background: '#0a0a2e',
                    border: '3px solid #6666aa',
                    color: 'white',
                    textAlign: 'center',
                    width: '80%',
                    outline: 'none',
                    marginBottom: 12,
                  }}
                />
                {schoolError && (
                  <div style={{ fontSize: 10, color: '#ff4444', marginBottom: 8 }}>{schoolError}</div>
                )}
                <div style={{ fontSize: 9, color: '#888', marginBottom: 16, lineHeight: 1.8 }}>
                  {SCHOOL_CARD_PRICE.toLocaleString()}점을 사용합니다
                </div>
              </>
            ) : (
              <div style={{ fontSize: 10, margin: '16px 0', lineHeight: 2 }}>
                {getPrice(popupId).toLocaleString()}점을 사용하여<br />
                [{CHARACTER_PALETTES[popupId]?.name}]를<br />
                구매할까요?
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                className={`pixel-btn ${popupType === 'sell' ? '' : 'gold'}`}
                onClick={popupType === 'sell' ? confirmSell : confirmBuy}
                disabled={loading || (popupType === 'buy' && popupId === SCHOOL_CARD_ID && schoolInput.trim().length < 1)}
                style={{ flex: 1, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? '...' : popupType === 'sell' ? '판매' : '구매'}
              </button>
              <button className="pixel-btn red" onClick={() => setConfirm(null)} style={{ flex: 1 }}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Character grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        width: '100%',
        marginBottom: 20,
      }}>
        {characters.map((char) => (
          <div
            key={char.id}
            style={{
              background: char.equipped ? '#1a3a5c' : '#141450',
              border: `3px solid ${char.equipped ? '#5dde9e' : char.owned ? '#6666aa' : char.isSchoolCard ? '#ffd700' : '#333355'}`,
              padding: 14,
              textAlign: 'center',
              opacity: !char.owned && player.score < char.price ? 0.4 : 1,
              transition: 'transform 0.1s',
            }}
          >
            <div className="char-tooltip-wrapper">
              {char.isSchoolCard ? (
                <SchoolCardCharacter schoolName={player.schoolName || '학교'} pixelSize={4} />
              ) : (
                <PixelCharacter characterId={char.id} pixelSize={4} />
              )}
              <div className="char-tooltip">
                {(CHARACTER_TOOLTIPS[char.id] || '').split('\n').map((line, i) => (
                  <span key={i}>{line}{i < (CHARACTER_TOOLTIPS[char.id] || '').split('\n').length - 1 && <br />}</span>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 11, marginTop: 6 }}>
              {char.isSchoolCard ? (player.schoolName ? `${player.schoolName}초` : '학교 카드') : char.name}
            </div>
            <div style={{
              fontSize: 10,
              marginTop: 4,
              color: char.equipped ? '#5dde9e' : char.owned ? '#aaa' : 'var(--gold)',
            }}>
              {char.equipped ? '장착중' : char.owned ? '보유' : `${char.price.toLocaleString()}P`}
            </div>

            {/* Action buttons */}
            <div style={{ marginTop: 8, display: 'flex', gap: 6, justifyContent: 'center' }}>
              {!char.owned && player.score >= char.price && (
                <button
                  onClick={() => handleBuy(char.id)}
                  style={{
                    background: '#b8860b',
                    border: '2px solid #daa520',
                    color: 'white',
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 8,
                    padding: '4px 8px',
                    cursor: 'pointer',
                  }}
                >
                  구매
                </button>
              )}
              {char.owned && !char.equipped && (
                <>
                  <button
                    onClick={() => handleEquip(char.id)}
                    style={{
                      background: '#2a5a3a',
                      border: '2px solid #5dde9e',
                      color: '#5dde9e',
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: 8,
                      padding: '4px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    장착
                  </button>
                  {char.id !== 0 && (
                    <button
                      onClick={() => handleSell(char.id)}
                      style={{
                        background: '#5a2a2a',
                        border: '2px solid #ff6666',
                        color: '#ff6666',
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: 8,
                        padding: '4px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      판매
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        className="pixel-btn red"
        onClick={() => { playClick(); onBack(); }}
      >
        돌아가기
      </button>
    </div>
  );
}
