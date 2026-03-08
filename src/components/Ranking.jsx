import { useState, useEffect } from 'react';
import { getRankings } from '../utils/storage';
import { isOnline, getOnlineRankings } from '../utils/supabase';
import { playClick } from '../utils/sound';
import PixelCharacter from './PixelCharacter';
import SchoolCardCharacter from './SchoolCardCharacter';
import { CHARACTER_PALETTES } from '../data/characters';

const SCHOOL_CARD_ID = 13;

export default function Ranking({ nickname, onBack }) {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const monthLabel = '이번 주';

  useEffect(() => {
    async function fetchRankings() {
      if (isOnline()) {
        const online = await getOnlineRankings();
        setRankings(online);
      } else {
        setRankings(getRankings());
      }
      setLoading(false);
    }
    fetchRankings();
  }, []);

  return (
    <div className="game-container" style={{ justifyContent: 'flex-start', paddingTop: 20 }}>
      <div style={{
        fontSize: 20,
        color: 'var(--gold)',
        marginBottom: 8,
        textShadow: '2px 2px 0 #b8860b',
      }}>
        {monthLabel} 랭킹
      </div>

      <div style={{ fontSize: 10, color: '#888', marginBottom: 20, textAlign: 'center', lineHeight: 1.8 }}>
        이번 주 총 획득 점수 기준 · 매주 월요일 초기화
      </div>

      <div style={{
        width: '100%',
        background: '#141450',
        border: '3px solid #333366',
        marginBottom: 20,
      }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 60px 100px',
          padding: '14px 12px',
          fontSize: 11,
          color: '#888',
          borderBottom: '2px solid #333366',
          alignItems: 'center',
        }}>
          <span>순위</span>
          <span>닉네임</span>
          <span style={{ textAlign: 'center' }}>보유 캐릭터</span>
          <span style={{ textAlign: 'right' }}>총 획득</span>
        </div>

        {/* Rankings */}
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', fontSize: 13, color: '#666' }}>
            불러오는 중...
          </div>
        ) : rankings.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', fontSize: 13, color: '#666' }}>
            아직 기록이 없어요
          </div>
        ) : (
          rankings.filter(e => e.totalEarned > 0).slice(0, 20).map((entry, idx) => (
            <div
              key={entry.name}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 60px 100px',
                padding: '10px 12px',
                fontSize: 13,
                borderBottom: '1px solid #222244',
                background: entry.name === nickname ? 'rgba(100, 170, 255, 0.15)' : 'transparent',
                color: entry.name === nickname ? '#6af' : '#fff',
                alignItems: 'center',
              }}
            >
              <span style={{
                color: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : '#888',
                fontWeight: idx < 3 ? 'bold' : 'normal',
                fontSize: 15,
              }}>
                {idx + 1}
              </span>
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                {entry.equippedCharacter === SCHOOL_CARD_ID ? (
                  <SchoolCardCharacter schoolName={entry.schoolName || '학교'} pixelSize={2} mode="card" />
                ) : (
                  <PixelCharacter characterId={entry.equippedCharacter || 0} pixelSize={2} />
                )}
                {entry.name}
              </span>
              <span
                onClick={() => { playClick(); setSelectedPlayer(entry); }}
                style={{
                  textAlign: 'center',
                  color: '#aaa',
                  fontSize: 12,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textDecorationColor: '#555',
                }}
              >
                {entry.characterCount + 1}
              </span>
              <span style={{ textAlign: 'right', color: 'var(--gold)', fontSize: 13, whiteSpace: 'nowrap' }}>
                {entry.totalEarned.toLocaleString()} P
              </span>
            </div>
          ))
        )}

        {!loading && rankings.length > 0 && rankings.filter(e => e.totalEarned > 0).length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', fontSize: 13, color: '#666' }}>
            이번 주 기록이 없어요
          </div>
        )}
      </div>

      <button
        className="pixel-btn red"
        onClick={() => { playClick(); onBack(); }}
      >
        돌아가기
      </button>

      {/* Character collection popup */}
      {selectedPlayer && (
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
          onClick={() => setSelectedPlayer(null)}
        >
          <div
            style={{
              background: '#141450',
              border: '3px solid #6666aa',
              padding: '24px 20px',
              maxWidth: 360,
              width: '90%',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              fontSize: 14,
              color: 'var(--gold)',
              marginBottom: 16,
              textShadow: '1px 1px 0 #b8860b',
            }}>
              {selectedPlayer.name}의 캐릭터
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
              marginBottom: 20,
            }}>
              {(selectedPlayer.characters || [0]).map((charId) => (
                <div key={charId} style={{ textAlign: 'center' }}>
                  {charId === SCHOOL_CARD_ID ? (
                    <SchoolCardCharacter schoolName={selectedPlayer.schoolName || '학교'} pixelSize={3} mode="card" />
                  ) : (
                    <PixelCharacter characterId={charId} pixelSize={3} />
                  )}
                  <div style={{ fontSize: 8, color: '#aaa', marginTop: 4 }}>
                    {charId === SCHOOL_CARD_ID
                      ? (selectedPlayer.schoolName ? `${selectedPlayer.schoolName}초` : '학교 카드')
                      : (CHARACTER_PALETTES[charId]?.name || '???')}
                  </div>
                </div>
              ))}
            </div>
            <button
              className="pixel-btn"
              onClick={() => setSelectedPlayer(null)}
              style={{ fontSize: 11 }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
