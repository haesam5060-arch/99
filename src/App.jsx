import { useState, useCallback, Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ color: '#ff4444', padding: 20, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', position: 'relative', zIndex: 10 }}>
          <div style={{ fontSize: 16, marginBottom: 10 }}>에러 발생!</div>
          <div>{this.state.error.message}</div>
          <div style={{ fontSize: 10, marginTop: 10, color: '#999' }}>{this.state.error.stack}</div>
          <button onClick={() => { this.setState({ error: null }); if (this.props.onReset) this.props.onReset(); }}
            style={{ marginTop: 10, padding: '8px 16px', background: '#333', color: '#fff', border: '1px solid #666', borderRadius: 4, cursor: 'pointer' }}>
            돌아가기
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import StarBackground from './components/StarBackground';
import NicknameScreen from './components/NicknameScreen';
import MainScreen from './components/MainScreen';
import ModeSelect from './components/ModeSelect';
import GamePlay from './components/GamePlay';
import Shop from './components/Shop';
import Ranking from './components/Ranking';
import HelpScreen from './components/HelpScreen';
import CoopLobby from './components/CoopLobby';
import CoopGame from './components/CoopGame';
import MyRoom from './components/MyRoom';
import { getPlayer, updatePlayerScore } from './utils/storage';
import { isOnline, getOnlinePlayer, updateOnlineScore } from './utils/supabase';
import { setMuted } from './utils/sound';

function App() {
  const [screen, setScreen] = useState('nickname');
  const [nickname, setNickname] = useState('');
  const [player, setPlayer] = useState(null);
  const [gameMode, setGameMode] = useState(null);
  const [soundOn, setSoundOn] = useState(true);
  const [coopData, setCoopData] = useState(null);

  const refreshPlayer = useCallback(async () => {
    if (!nickname) return;
    if (isOnline()) {
      const p = await getOnlinePlayer(nickname);
      if (p) {
        setPlayer({
          score: p.score,
          characters: p.characters,
          equippedCharacter: p.equipped_character,
          schoolName: p.school_name || '',
        });
      }
    } else {
      const p = getPlayer(nickname);
      if (p) setPlayer(p);
    }
  }, [nickname]);

  const handleNicknameStart = (name, playerData) => {
    setNickname(name);
    setPlayer(playerData);
    setScreen('main');
  };

  const handleNavigate = (target) => {
    if (target === 'nickname') {
      setScreen('nickname');
      setNickname('');
      setPlayer(null);
    } else {
      setScreen(target);
    }
  };

  const handleModeSelect = (mode) => {
    setGameMode(mode);
    setScreen('game');
  };

  const handleStageClear = async (totalEarned) => {
    if (totalEarned !== 0) {
      if (isOnline()) {
        await updateOnlineScore(nickname, totalEarned);
      } else {
        updatePlayerScore(nickname, totalEarned);
      }
    }
    await refreshPlayer();
    setScreen('main');
  };

  const handleShopUpdate = (updatedPlayer) => {
    setPlayer(updatedPlayer);
  };

  const toggleSound = () => {
    const newVal = !soundOn;
    setSoundOn(newVal);
    setMuted(!newVal);
  };

  return (
    <>
      <StarBackground />
      <button className="sound-toggle" onClick={toggleSound}>
        {soundOn ? '♪' : '♪̸'}
      </button>

      {screen === 'nickname' && (
        <NicknameScreen onStart={handleNicknameStart} />
      )}
      {screen === 'main' && player && (
        <MainScreen
          player={player}
          nickname={nickname}
          onNavigate={handleNavigate}
        />
      )}
      {screen === 'modeSelect' && (
        <ModeSelect
          onSelect={handleModeSelect}
          onBack={() => setScreen('main')}
          onCoop={() => setScreen('coopLobby')}
        />
      )}
      {screen === 'coopLobby' && player && (
        <CoopLobby
          nickname={nickname}
          player={player}
          onStart={(data) => { setCoopData(data); setScreen('coopGame'); }}
          onBack={() => setScreen('modeSelect')}
        />
      )}
      {screen === 'coopGame' && player && coopData && (
        <CoopGame
          coopData={coopData}
          player={player}
          nickname={nickname}
          onEnd={async (totalEarned) => {
            if (totalEarned !== 0) {
              if (isOnline()) {
                await updateOnlineScore(nickname, totalEarned);
              } else {
                updatePlayerScore(nickname, totalEarned);
              }
            }
            await refreshPlayer();
            setCoopData(null);
            setScreen('main');
          }}
        />
      )}
      {screen === 'game' && player && (
        <GamePlay
          mode={gameMode}
          player={player}
          nickname={nickname}
          onStageClear={handleStageClear}
        />
      )}
      {screen === 'shop' && player && (
        <Shop
          player={player}
          nickname={nickname}
          onUpdate={handleShopUpdate}
          onBack={async () => { await refreshPlayer(); setScreen('main'); }}
        />
      )}
      {screen === 'ranking' && (
        <Ranking
          nickname={nickname}
          onBack={() => setScreen('main')}
        />
      )}
      {screen === 'help' && (
        <HelpScreen onBack={() => setScreen('main')} />
      )}
      {screen === 'myroom' && player && (
        <ErrorBoundary onReset={() => setScreen('main')}>
          <MyRoom
            player={player}
            nickname={nickname}
            onBack={async () => { await refreshPlayer(); setScreen('main'); }}
            onUpdate={handleShopUpdate}
          />
        </ErrorBoundary>
      )}

      <div style={{
        position: 'fixed',
        bottom: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 9,
        color: 'rgba(255,255,255,0.15)',
        fontFamily: "'Press Start 2P', monospace",
        pointerEvents: 'none',
        zIndex: 9999,
      }}>
        Made by HR's Dad
      </div>
    </>
  );
}

export default App;
