import { useState, useEffect, useRef } from 'react';
import { playClick, playStageStart } from '../utils/sound';
import { joinLobby, leaveLobby, createRoom, joinRoom, subscribeRoom, leaveRoom, updateLobbyPresence } from '../utils/realtime';
import PixelCharacter from './PixelCharacter';

export default function CoopLobby({ nickname, player, onStart, onBack }) {
  const [phase, setPhase] = useState('menu'); // menu, create, join, waiting
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [rooms, setRooms] = useState([]);
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState('');

  const roomChannelRef = useRef(null);
  const lobbyChannelRef = useRef(null);
  const lobbyBrowseRef = useRef(null);

  // Browse lobby for room list
  useEffect(() => {
    if (phase === 'menu' || phase === 'join') {
      const ch = joinLobby((r) => setRooms(r));
      lobbyBrowseRef.current = ch;
      return () => leaveLobby(ch);
    }
  }, [phase]);

  // Listen for game start broadcast in waiting room
  useEffect(() => {
    if (phase !== 'waiting') return;
    // Already subscribed via subscribeRoom
  }, [phase]);

  const handleCreate = async () => {
    playClick();
    const result = await createRoom(nickname, player.equippedCharacter);
    if (!result) { setError('온라인 모드가 필요합니다'); return; }

    const { roomCode: code, lobbyChannel, roomChannel } = result;
    setRoomCode(code);
    setIsHost(true);
    lobbyChannelRef.current = lobbyChannel;
    roomChannelRef.current = roomChannel;

    subscribeRoom(roomChannel, nickname, player.equippedCharacter, {
      onPlayersUpdate: (p) => {
        setPlayers(p);
        // Update lobby with player count
        updateLobbyPresence(lobbyChannel, {
          roomCode: code,
          hostNickname: nickname,
          hostCharacter: player.equippedCharacter,
          status: 'waiting',
          playerCount: p.length,
        });
      },
      onBroadcast: () => {},
    });

    setPhase('waiting');
  };

  const handleJoin = async (code) => {
    playClick();
    const targetCode = code || inputCode.trim();
    if (!targetCode || targetCode.length < 4) {
      setError('방 코드 4자리를 입력하세요');
      return;
    }
    setError('');

    const result = await joinRoom(targetCode, nickname, player.equippedCharacter);
    if (!result) { setError('온라인 모드가 필요합니다'); return; }

    const { roomChannel } = result;
    setRoomCode(targetCode);
    setIsHost(false);
    roomChannelRef.current = roomChannel;

    subscribeRoom(roomChannel, nickname, player.equippedCharacter, {
      onPlayersUpdate: (p) => setPlayers(p),
      onBroadcast: (payload) => {
        if (payload.type === 'game-start') {
          onStart({
            isHost: false,
            roomCode: targetCode,
            roomChannel,
            lobbyChannel: null,
            players: payload.players,
            dan: payload.dan,
          });
        }
      },
    });

    setPhase('waiting');
  };

  const handleStartGame = () => {
    if (players.length < 1) return;
    playStageStart();

    const roomChannel = roomChannelRef.current;
    const lobbyChannel = lobbyChannelRef.current;

    // Update lobby status
    updateLobbyPresence(lobbyChannel, {
      roomCode,
      hostNickname: nickname,
      hostCharacter: player.equippedCharacter,
      status: 'playing',
      playerCount: players.length,
    });

    // Broadcast game start
    roomChannel.send({
      type: 'broadcast',
      event: 'game',
      payload: { type: 'game-start', players, dan: 2 },
    });

    // Navigate host to game
    onStart({
      isHost: true,
      roomCode,
      roomChannel,
      lobbyChannel,
      players,
      dan: 2,
    });
  };

  const handleBack = () => {
    playClick();
    if (phase === 'waiting' || phase === 'join' || phase === 'create') {
      leaveRoom(roomChannelRef.current, lobbyChannelRef.current);
      roomChannelRef.current = null;
      lobbyChannelRef.current = null;
      setPhase('menu');
      setPlayers([]);
      setRoomCode('');
      setError('');
    } else {
      onBack();
    }
  };

  // --- Menu ---
  if (phase === 'menu') {
    return (
      <div className="game-container" style={{ justifyContent: 'center' }}>
        <div className="game-title" style={{ fontSize: 18 }}>
          협동 지키기
        </div>
        <div style={{ fontSize: 10, color: '#aaa', marginBottom: 30, textAlign: 'center', lineHeight: 2 }}>
          최대 4명이 함께 지구를 지켜요!<br />
          점수 2배, 벌점도 2배!
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 300 }}>
          <button className="pixel-btn gold" onClick={handleCreate}>
            방 만들기
          </button>

          <button className="pixel-btn" onClick={() => { playClick(); setPhase('join'); }}>
            방 참여
          </button>

          {rooms.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: '#ffd700', marginBottom: 8 }}>대기중인 방</div>
              {rooms.map((room) => (
                <button
                  key={room.roomCode}
                  onClick={() => handleJoin(room.roomCode)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    marginBottom: 6,
                    background: '#141450',
                    border: '2px solid #333366',
                    color: '#fff',
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 9,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{room.hostNickname}의 방</span>
                  <span style={{ color: '#aaa' }}>{room.playerCount}/4</span>
                </button>
              ))}
            </div>
          )}

          <button className="pixel-btn red" onClick={handleBack} style={{ marginTop: 10 }}>
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // --- Join (enter code) ---
  if (phase === 'join') {
    return (
      <div className="game-container" style={{ justifyContent: 'center' }}>
        <div className="game-title" style={{ fontSize: 18 }}>
          방 참여
        </div>
        <div style={{ fontSize: 10, color: '#aaa', marginBottom: 30, textAlign: 'center', lineHeight: 2 }}>
          방 코드 4자리를 입력하세요
        </div>

        <input
          type="text"
          maxLength={4}
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
          placeholder="0000"
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 24,
            textAlign: 'center',
            width: 160,
            padding: '12px 0',
            background: '#141450',
            border: '3px solid #333366',
            color: '#fff',
            marginBottom: 20,
            letterSpacing: 8,
          }}
        />

        {error && (
          <div style={{ fontSize: 9, color: '#ff4444', marginBottom: 12 }}>{error}</div>
        )}

        {rooms.length > 0 && (
          <div style={{ width: '100%', maxWidth: 300, marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: '#ffd700', marginBottom: 6 }}>또는 방 선택:</div>
            {rooms.map((room) => (
              <button
                key={room.roomCode}
                onClick={() => handleJoin(room.roomCode)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  marginBottom: 4,
                  background: '#141450',
                  border: '2px solid #333366',
                  color: '#fff',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{room.hostNickname}의 방</span>
                <span style={{ color: '#aaa' }}>코드: {room.roomCode} ({room.playerCount}/4)</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}>
          <button
            className="pixel-btn gold"
            onClick={() => handleJoin()}
            disabled={inputCode.length < 4}
            style={{ opacity: inputCode.length < 4 ? 0.4 : 1 }}
          >
            참여
          </button>
          <button className="pixel-btn red" onClick={handleBack}>
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // --- Waiting room ---
  return (
    <div className="game-container" style={{ justifyContent: 'flex-start', paddingTop: 20 }}>
      <div className="game-title" style={{ fontSize: 16 }}>
        대기실
      </div>

      <div style={{
        fontSize: 28,
        color: '#ffd700',
        marginBottom: 6,
        letterSpacing: 6,
        fontFamily: "'Press Start 2P', monospace",
      }}>
        {roomCode}
      </div>
      <div style={{ fontSize: 9, color: '#aaa', marginBottom: 24 }}>
        친구에게 이 코드를 알려주세요
      </div>

      <div style={{
        width: '100%',
        maxWidth: 340,
        background: '#141450',
        border: '3px solid #333366',
        padding: 16,
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 10, color: '#aaa', marginBottom: 12 }}>
          참여자 ({players.length}/4)
        </div>
        {players.length === 0 ? (
          <div style={{ fontSize: 10, color: '#555', textAlign: 'center', padding: 16 }}>
            접속 중...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {players.map((p, i) => (
              <div key={p.nickname} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 8px',
                background: p.nickname === nickname ? 'rgba(100, 170, 255, 0.1)' : 'transparent',
                border: p.nickname === nickname ? '1px solid rgba(100, 170, 255, 0.3)' : '1px solid transparent',
              }}>
                <span style={{
                  fontSize: 12,
                  color: i === 0 ? '#ffd700' : '#aaa',
                  width: 20,
                }}>
                  {i === 0 ? '★' : `${i + 1}`}
                </span>
                <PixelCharacter characterId={p.equippedCharacter || 0} pixelSize={3} />
                <span style={{ fontSize: 11, color: '#fff' }}>{p.nickname}</span>
                {p.nickname === nickname && (
                  <span style={{ fontSize: 8, color: '#6af' }}>(나)</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}>
        {isHost ? (
          <button
            className="pixel-btn gold"
            onClick={handleStartGame}
            disabled={players.length < 1}
            style={{ opacity: players.length < 1 ? 0.4 : 1 }}
          >
            게임 시작 ({players.length}명)
          </button>
        ) : (
          <div style={{ fontSize: 10, color: '#aaa', textAlign: 'center', padding: 10 }}>
            방장이 시작할 때까지 대기 중...
          </div>
        )}
        <button className="pixel-btn red" onClick={handleBack}>
          나가기
        </button>
      </div>
    </div>
  );
}
