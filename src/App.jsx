import { useState, useCallback } from 'react';
import StarBackground from './components/StarBackground';
import NicknameScreen from './components/NicknameScreen';
import MainScreen from './components/MainScreen';
import ModeSelect from './components/ModeSelect';
import GamePlay from './components/GamePlay';
import Shop from './components/Shop';
import Ranking from './components/Ranking';
import HelpScreen from './components/HelpScreen';
import { getPlayer, updatePlayerScore } from './utils/storage';
import { isOnline, getOnlinePlayer, updateOnlineScore } from './utils/supabase';
import { setMuted } from './utils/sound';

function App() {
  const [screen, setScreen] = useState('nickname');
  const [nickname, setNickname] = useState('');
  const [player, setPlayer] = useState(null);
  const [gameMode, setGameMode] = useState(null);
  const [soundOn, setSoundOn] = useState(true);

  const refreshPlayer = useCallback(async () => {
    if (!nickname) return;
    if (isOnline()) {
      const p = await getOnlinePlayer(nickname);
      if (p) {
        setPlayer({
          score: p.score,
          characters: p.characters,
          equippedCharacter: p.equipped_character,
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
        />
      )}
      {screen === 'game' && player && (
        <GamePlay
          mode={gameMode}
          player={player}
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
