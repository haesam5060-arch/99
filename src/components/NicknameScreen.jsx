import { useState } from 'react';
import { getPlayer, createPlayer } from '../utils/storage';
import { isOnline, checkNicknameExists, registerPlayer, loginPlayer } from '../utils/supabase';
import { playClick } from '../utils/sound';

export default function NicknameScreen({ onStart }) {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const online = isOnline();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) { setError('닉네임을 입력해주세요!'); return; }
    if (trimmed.length > 8) { setError('8자 이하로 입력해주세요!'); return; }
    if (trimmed.includes(' ')) { setError('공백은 사용할 수 없어요!'); return; }

    if (online && !/^\d{4}$/.test(password)) {
      setError('비밀번호는 숫자 4자리를 입력해주세요!');
      return;
    }

    playClick();

    if (!online) {
      // Offline mode (localStorage only)
      let player = getPlayer(trimmed);
      if (!player) player = createPlayer(trimmed);
      onStart(trimmed, player);
      return;
    }

    // Online mode
    setLoading(true);
    setError('');

    try {
      const exists = await checkNicknameExists(trimmed);

      if (exists) {
        // Login
        const result = await loginPlayer(trimmed, password);
        if (result.success) {
          const player = {
            score: result.player.score,
            characters: result.player.characters,
            equippedCharacter: result.player.equipped_character,
            schoolName: result.player.school_name || '',
          };
          onStart(trimmed, player);
        } else {
          setError('비밀번호가 틀렸어요!');
        }
      } else {
        // Register
        const result = await registerPlayer(trimmed, password);
        if (result.success) {
          const player = { score: 0, characters: [0], equippedCharacter: 0, schoolName: '' };
          onStart(trimmed, player);
        } else if (result.error === 'duplicate') {
          setError('이미 존재하는 닉네임이에요!');
        } else {
          setError('서버 오류가 발생했어요. 다시 시도해주세요.');
        }
      }
    } catch {
      setError('서버 연결 실패! 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="game-container" style={{ justifyContent: 'center' }}>
      <div className="game-title">
        구구단<br />행성 디펜스
      </div>
      <div className="game-subtitle">
        지구를 지켜라!
      </div>

      <form onSubmit={handleSubmit} style={{ textAlign: 'center', width: '100%' }}>
        <div style={{ marginBottom: 16, fontSize: 16 }}>
          닉네임을 입력하세요
        </div>
        <input
          type="text"
          value={nickname}
          onChange={(e) => { setNickname(e.target.value); setError(''); }}
          maxLength={8}
          placeholder="닉네임"
          autoFocus
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 18,
            padding: '16px 24px',
            background: '#141450',
            border: '3px solid #6666aa',
            color: 'white',
            textAlign: 'center',
            width: '85%',
            maxWidth: 360,
            outline: 'none',
          }}
        />

        {online && (
          <>
            <div style={{ marginTop: 28, marginBottom: 16, fontSize: 12, color: '#aaa' }}>
              숫자 4자리 비밀번호
            </div>
            <input
              type="password"
              inputMode="numeric"
              value={password}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPassword(val);
                setError('');
              }}
              maxLength={4}
              placeholder="1234"
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 22,
                padding: '14px 24px',
                background: '#141450',
                border: '3px solid #6666aa',
                color: 'white',
                textAlign: 'center',
                width: '85%',
                maxWidth: 360,
                outline: 'none',
                letterSpacing: '8px',
              }}
            />
            <div style={{ fontSize: 9, color: '#666', marginTop: 14, lineHeight: 1.8 }}>
              비밀번호를 잊으면 찾을 수 없으니<br />
              쉬운 숫자 4자리를 입력해주세요!<br />
              처음이면 자동으로 가입됩니다.
            </div>
          </>
        )}

        {error && (
          <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 16 }}>
            {error}
          </div>
        )}
        <div style={{ marginTop: 28 }}>
          <button
            type="submit"
            className="pixel-btn gold"
            disabled={loading}
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '접속중...' : '시작하기'}
          </button>
        </div>
      </form>
    </div>
  );
}
