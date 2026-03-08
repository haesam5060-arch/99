const STORAGE_KEY = 'gugudan_players';

function getCurrentWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const date = String(monday.getDate()).padStart(2, '0');
  return `${year}-W${month}${date}`;
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

// Reset weekly totalEarned if needed
function checkWeeklyReset(player) {
  if (player.earnedMonth !== getCurrentWeek()) {
    player.totalEarned = 0;
    player.earnedMonth = getCurrentWeek();
  }
  return player;
}

export function getPlayer(nickname) {
  const players = getAllPlayers();
  if (!players[nickname]) return null;
  const player = checkWeeklyReset(players[nickname]);
  savePlayers(players);
  return player;
}

export function createPlayer(nickname) {
  const players = getAllPlayers();
  if (!players[nickname]) {
    players[nickname] = {
      score: 0,
      totalEarned: 0,
      earnedMonth: getCurrentWeek(),
      characters: [0], // worm is default
      equippedCharacter: 0,
      createdAt: new Date().toISOString(),
      lastPlayedAt: new Date().toISOString(),
    };
    savePlayers(players);
  }
  return checkWeeklyReset(players[nickname]);
}

export function updatePlayerScore(nickname, scoreChange) {
  const players = getAllPlayers();
  if (!players[nickname]) return null;
  checkWeeklyReset(players[nickname]);
  players[nickname].score = Math.max(0, players[nickname].score + scoreChange);
  if (scoreChange > 0) {
    players[nickname].totalEarned += scoreChange;
  }
  players[nickname].lastPlayedAt = new Date().toISOString();
  savePlayers(players);
  return players[nickname];
}

export function purchaseCharacter(nickname, characterId, price = 1000) {
  const players = getAllPlayers();
  if (!players[nickname]) return { success: false };
  if (players[nickname].characters.includes(characterId)) return { success: false, reason: 'already_owned' };
  if (players[nickname].score < price) return { success: false, reason: 'insufficient' };

  players[nickname].score -= price;
  players[nickname].characters.push(characterId);
  players[nickname].equippedCharacter = characterId;
  savePlayers(players);
  return { success: true, player: players[nickname] };
}

export function sellCharacter(nickname, characterId, refund) {
  const players = getAllPlayers();
  if (!players[nickname]) return { success: false };
  if (!players[nickname].characters.includes(characterId)) return { success: false };
  if (characterId === 0) return { success: false };

  players[nickname].characters = players[nickname].characters.filter(c => c !== characterId);
  if (players[nickname].equippedCharacter === characterId) {
    players[nickname].equippedCharacter = 0;
  }
  players[nickname].score += refund;
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
  const currentMonth = getCurrentWeek();
  return Object.entries(players)
    .map(([name, data]) => ({
      name,
      totalEarned: data.earnedMonth === currentMonth ? (data.totalEarned || 0) : 0,
      characters: data.characters,
      characterCount: data.characters.filter(id => id !== 0).length,
      equippedCharacter: data.equippedCharacter,
      score: data.score,
    }))
    .sort((a, b) => b.totalEarned - a.totalEarned || b.score - a.score);
}
