import { useState } from 'react';
import { CHARACTER_PALETTES } from '../data/characters';
import { purchaseCharacter, equipCharacter } from '../utils/storage';
import { isOnline, purchaseOnlineCharacter, equipOnlineCharacter } from '../utils/supabase';
import { playClick, playPurchase } from '../utils/sound';
import PixelCharacter from './PixelCharacter';

export default function Shop({ player, nickname, onUpdate, onBack }) {
  const [confirm, setConfirm] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleBuy = (id) => {
    playClick();
    setConfirm(id);
  };

  const confirmBuy = async () => {
    if (confirm === null) return;
    setLoading(true);

    if (isOnline()) {
      const result = await purchaseOnlineCharacter(nickname, confirm);
      if (result.success) {
        playPurchase();
        onUpdate({
          score: result.player.score,
          characters: result.player.characters,
          equippedCharacter: result.player.equipped_character,
        });
      }
    } else {
      const result = purchaseCharacter(nickname, confirm);
      if (result.success) {
        playPurchase();
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
    price: Number(id) === 0 ? 0 : 1000,
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
          }}>
            <PixelCharacter characterId={confirm} pixelSize={4} />
            <div style={{ fontSize: 10, margin: '16px 0', lineHeight: 2 }}>
              1,000점을 사용하여<br />
              [{CHARACTER_PALETTES[confirm]?.name}]를<br />
              구매할까요?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="pixel-btn gold"
                onClick={confirmBuy}
                disabled={loading}
              >
                {loading ? '...' : '구매'}
              </button>
              <button className="pixel-btn red" onClick={() => setConfirm(null)}>
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
              else if (!char.owned && player.score >= 1000) handleBuy(char.id);
            }}
            style={{
              background: char.equipped ? '#1a3a5c' : '#141450',
              border: `3px solid ${char.equipped ? '#5dde9e' : char.owned ? '#6666aa' : '#333355'}`,
              padding: 14,
              textAlign: 'center',
              cursor: char.owned || player.score >= 1000 ? 'pointer' : 'default',
              opacity: !char.owned && player.score < 1000 ? 0.4 : 1,
              transition: 'transform 0.1s',
            }}
          >
            <PixelCharacter characterId={char.id} pixelSize={4} />
            <div style={{ fontSize: 11, marginTop: 6 }}>{char.name}</div>
            <div style={{
              fontSize: 10,
              marginTop: 4,
              color: char.equipped ? '#5dde9e' : char.owned ? '#aaa' : 'var(--gold)',
            }}>
              {char.equipped ? '장착중' : char.owned ? '보유' : `${char.price}P`}
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
