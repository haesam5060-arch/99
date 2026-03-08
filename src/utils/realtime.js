import { supabase } from './supabase';

const LOBBY_CHANNEL = 'coop-lobby';

// Generate 4-digit room code
function generateRoomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// --- Lobby: discover available rooms ---

export function joinLobby(onRoomsUpdate) {
  if (!supabase) return null;

  const channel = supabase.channel(LOBBY_CHANNEL);

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    const rooms = [];
    Object.values(state).forEach((presences) => {
      presences.forEach((p) => {
        if (p.roomCode && p.status === 'waiting') {
          rooms.push(p);
        }
      });
    });
    onRoomsUpdate(rooms);
  });

  channel.subscribe();
  return channel;
}

export function leaveLobby(channel) {
  if (channel) {
    channel.untrack();
    supabase.removeChannel(channel);
  }
}

// --- Room management ---

export async function createRoom(nickname, equippedCharacter) {
  if (!supabase) return null;

  const roomCode = generateRoomCode();

  // Announce in lobby
  const lobbyChannel = supabase.channel(LOBBY_CHANNEL);
  await lobbyChannel.subscribe();
  await lobbyChannel.track({
    roomCode,
    hostNickname: nickname,
    hostCharacter: equippedCharacter,
    status: 'waiting',
    playerCount: 1,
  });

  // Create the room channel
  const roomChannel = supabase.channel(`coop-room-${roomCode}`);

  return { roomCode, lobbyChannel, roomChannel };
}

export async function joinRoom(roomCode, nickname, equippedCharacter) {
  if (!supabase) return null;

  const roomChannel = supabase.channel(`coop-room-${roomCode}`);
  return { roomChannel };
}

export function subscribeRoom(roomChannel, nickname, equippedCharacter, callbacks) {
  const { onPlayersUpdate, onBroadcast } = callbacks;

  // Presence: track players in room
  roomChannel.on('presence', { event: 'sync' }, () => {
    const state = roomChannel.presenceState();
    const players = [];
    Object.values(state).forEach((presences) => {
      presences.forEach((p) => {
        if (p.nickname) players.push(p);
      });
    });
    onPlayersUpdate(players);
  });

  // Broadcast: game events
  roomChannel.on('broadcast', { event: 'game' }, ({ payload }) => {
    onBroadcast(payload);
  });

  roomChannel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await roomChannel.track({ nickname, equippedCharacter });
    }
  });
}

export function broadcastGame(roomChannel, payload) {
  roomChannel.send({
    type: 'broadcast',
    event: 'game',
    payload,
  });
}

export function leaveRoom(roomChannel, lobbyChannel) {
  if (roomChannel) {
    roomChannel.untrack();
    supabase.removeChannel(roomChannel);
  }
  if (lobbyChannel) {
    lobbyChannel.untrack();
    supabase.removeChannel(lobbyChannel);
  }
}

// Update lobby presence (player count, status)
export async function updateLobbyPresence(lobbyChannel, updates) {
  if (!lobbyChannel) return;
  await lobbyChannel.track(updates);
}
