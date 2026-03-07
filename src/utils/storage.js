const STORAGE_KEY = 'gugudan_players';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getAllPlayers() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function savePlayers(players) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
}

// Reset monthly totalEarned if needed
function checkMonthlyReset(player) {
  if (player.earnedMonth !== getCurrentMonth()) {
    player.totalEarned = 0;
    player.earnedMonth = getCurrentMonth();
  }
  return player;
}

export function getPlayer(nickname) {
  const players = getAllPlayers();
  if (!players[nickname]) return null;
  const player = checkMonthlyReset(players[nickname]);
  savePlayers(players);
  return player;
}

export function createPlayer(nickname) {
  const players = getAllPlayers();
  if (!players[nickname]) {
    players[nickname] = {
      score: 0,
      totalEarned: 0,
      earnedMonth: getCurrentMonth(),
      characters: [0], // worm is default
      equippedCharacter: 0,
      createdAt: new Date().toISOString(),
      lastPlayedAt: new Date().toISOString(),
    };
    savePlayers(players);
  }
  return checkMonthlyReset(players[nickname]);
}

export function updatePlayerScore(nickname, scoreChange) {
  const players = getAllPlayers();
  if (!players[nickname]) return null;
  checkMonthlyReset(players[nickname]);
  players[nickname].score = Math.max(0, players[nickname].score + scoreChange);
  if (scoreChange > 0) {
    players[nickname].totalEarned += scoreChange;
  }
  players[nickname].lastPlayedAt = new Date().toISOString();
  savePlayers(players);
  return players[nickname];
}

export function purchaseCharacter(nickname, characterId) {
  const players = getAllPlayers();
  if (!players[nickname]) return { success: false };
  if (players[nickname].characters.includes(characterId)) return { success: false, reason: 'already_owned' };
  if (players[nickname].score < 1000) return { success: false, reason: 'insufficient' };

  players[nickname].score -= 1000;
  players[nickname].characters.push(characterId);
  players[nickname].equippedCharacter = characterId;
  savePlayers(players);
  return { success: true, player: players[nickname] };
}

export function equipCharacter(nickname, characterId) {
  const players = getAllPlayers();
  if (!players[nickname]) return null;
  if (!players[nickname].characters.includes(characterId)) return null;
  players[nickname].equippedCharacter = characterId;
  savePlayers(players);
  return players[nickname];
}

export function getRankings() {
  const players = getAllPlayers();
  const currentMonth = getCurrentMonth();
  return Object.entries(players)
    .map(([name, data]) => ({
      name,
      totalEarned: data.earnedMonth === currentMonth ? (data.totalEarned || 0) : 0,
      characterCount: data.characters.filter(id => id !== 0).length,
      score: data.score,
    }))
    .sort((a, b) => b.totalEarned - a.totalEarned || b.score - a.score);
}
