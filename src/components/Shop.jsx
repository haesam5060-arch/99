import { useState } from 'react';
import { CHARACTER_PALETTES } from '../data/characters';
import { purchaseCharacter, equipCharacter } from '../utils/storage';
import { isOnline, purchaseOnlineCharacter, equipOnlineCharacter, updateSchoolName } from '../utils/supabase';
import { playClick, playPurchase } from '../utils/sound';
import PixelCharacter from './PixelCharacter';
import SchoolCardCharacter from './SchoolCardCharacter';

const SCHOOL_CARD_ID = 13;
const SCHOOL_CARD_PRICE = 5000;

export default function Shop({ player, nickname, onUpdate, onBack }) {
  const [confirm, setConfirm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [schoolInput, setSchoolInput] = useState('');

  const handleBuy = (id) => {
    playClick();
    if (id === SCHOOL_CARD_ID) {
      setSchoolInput('');
    }
    setConfirm(id);
  };

  const confirmBuy = async () => {
    if (confirm === null) return;
    const isSchoolCard = confirm === SCHOOL_CARD_ID;
    const price = isSchoolCard ? SCHOOL_CARD_PRICE : 1000;

    if (isSchoolCard && schoolInput.trim().length < 1) return;

    setLoading(true);

    if (isOnline()) {
      const result = await purchaseOnlineCharacter(nickname, confirm, price);
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
      const result = purchaseCharacter(nickname, confirm, price);
      if (result.success) {
        playPurchase();
        if (isSchoolCard) {
          result.player.schoolName = schoolInput.trim();
          // Save locally
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
    price: Number(id) === 0 ? 0 : Number(id) === SCHOOL_CARD_ID ? SCHOOL_CARD_PRICE : 1000,
    isSchoolCard: !!data.isSchoolCard,
  }));

  return (
    <div className="game-container" style={{ justifyContent: 'flex-start', paddingTop: 20 }}>
      <div style={{ fontSize: 14, color: 'var(--gold)', marginBottom: 6, textShadow: '2px 2px 0 #b8860b' }}>
        캐릭터 상점
      </div>
      <div style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 20 }}>
        {player.score.toLocaleString()} P
      </div>

      {/* Confirm popup */}
      {confirm !== null && (
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
            {confirm === SCHOOL_CARD_ID ? (
              <SchoolCardCharacter schoolName={schoolInput || '학교'} pixelSize={4} />
            ) : (
              <PixelCharacter characterId={confirm} pixelSize={4} />
            )}

            {confirm === SCHOOL_CARD_ID ? (
              <>
                <div style={{ fontSize: 10, margin: '16px 0 10px', lineHeight: 2 }}>
                  학교 이름을 입력하세요<br />
                  (1~4글자)
                </div>
                <input
                  type="text"
                  value={schoolInput}
                  onChange={(e) => setSchoolInput(e.target.value.slice(0, 4))}
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
                <div style={{ fontSize: 9, color: '#888', marginBottom: 16, lineHeight: 1.8 }}>
                  {SCHOOL_CARD_PRICE.toLocaleString()}점을 사용합니다
                </div>
              </>
            ) : (
              <div style={{ fontSize: 10, margin: '16px 0', lineHeight: 2 }}>
                1,000점을 사용하여<br />
                [{CHARACTER_PALETTES[confirm]?.name}]를<br />
                구매할까요?
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                className="pixel-btn gold"
                onClick={confirmBuy}
                disabled={loading || (confirm === SCHOOL_CARD_ID && schoolInput.trim().length < 1)}
                style={{ flex: 1, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? '...' : '구매'}
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
            onClick={() => {
              if (char.owned && !char.equipped) handleEquip(char.id);
              else if (!char.owned && player.score >= char.price) handleBuy(char.id);
            }}
            style={{
              background: char.equipped ? '#1a3a5c' : '#141450',
              border: `3px solid ${char.equipped ? '#5dde9e' : char.owned ? '#6666aa' : char.isSchoolCard ? '#ffd700' : '#333355'}`,
              padding: 14,
              textAlign: 'center',
              cursor: char.owned || player.score >= char.price ? 'pointer' : 'default',
              opacity: !char.owned && player.score < char.price ? 0.4 : 1,
              transition: 'transform 0.1s',
            }}
          >
            {char.isSchoolCard ? (
              <SchoolCardCharacter
                schoolName={player.schoolName || '학교'}
                pixelSize={4}
              />
            ) : (
              <PixelCharacter characterId={char.id} pixelSize={4} />
            )}
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
