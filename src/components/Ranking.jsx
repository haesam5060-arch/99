import { useState, useEffect } from 'react';
import { getRankings } from '../utils/storage';
import { isOnline, getOnlineRankings } from '../utils/supabase';
import { playClick } from '../utils/sound';

export default function Ranking({ nickname, onBack }) {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Get current month label (e.g. "3월")
  const monthLabel = `${new Date().getMonth() + 1}월`;

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
        이번 달 총 획득 점수 기준 · 매월 1일 초기화
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
          gridTemplateColumns: '50px 1fr 120px',
          padding: '14px 16px',
          fontSize: 12,
          color: '#888',
          borderBottom: '2px solid #333366',
        }}>
          <span>순위</span>
          <span>닉네임</span>
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
                gridTemplateColumns: '50px 1fr 120px',
                padding: '14px 16px',
                fontSize: 14,
                borderBottom: '1px solid #222244',
                background: entry.name === nickname ? 'rgba(100, 170, 255, 0.15)' : 'transparent',
                color: entry.name === nickname ? '#6af' : '#fff',
              }}
            >
              <span style={{
                color: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : '#888',
                fontWeight: idx < 3 ? 'bold' : 'normal',
                fontSize: 16,
              }}>
                {idx + 1}
              </span>
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {entry.name}
              </span>
              <span style={{ textAlign: 'right', color: 'var(--gold)', fontSize: 14 }}>
                {entry.totalEarned.toLocaleString()} P
              </span>
            </div>
          ))
        )}

        {/* Show message if all filtered out */}
        {!loading && rankings.length > 0 && rankings.filter(e => e.totalEarned > 0).length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', fontSize: 13, color: '#666' }}>
            이번 달 기록이 없어요
          </div>
        )}
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
