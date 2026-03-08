import { createClient } from '@supabase/supabase-js';

// TODO: Replace with your Supabase project credentials
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Check if online mode is available
export const isOnline = () => !!supabase;

// --- Weekly reset helper ---
function getCurrentWeek() {
  const now = new Date();
  // Get Monday of current week
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const date = String(monday.getDate()).padStart(2, '0');
  return `${year}-W${month}${date}`;
}

// Check if player needs weekly total_earned reset
function needsWeeklyReset(player) {
  return player.earned_month !== getCurrentWeek();
}

async function resetWeeklyIfNeeded(player) {
  if (!supabase || !needsWeeklyReset(player)) return player;
  const { data } = await supabase
    .from('players')
    .update({
      total_earned: 0,
      earned_month: getCurrentWeek(),
      updated_at: new Date().toISOString(),
    })
    .eq('nickname', player.nickname)
    .select()
    .single();
  return data || player;
}

// --- Player CRUD ---

// Check if nickname exists
export async function checkNicknameExists(nickname) {
  if (!supabase) return false;
  const { data } = await supabase
    .from('players')
    .select('nickname')
    .eq('nickname', nickname)
    .single();
  return !!data;
}

// Register new player (returns { success, error })
export async function registerPlayer(nickname, password) {
  if (!supabase) return { success: false, error: 'offline' };
  const { data, error } = await supabase
    .from('players')
    .insert({
      nickname,
      password,
      score: 0,
      characters: [0],
      equipped_character: 0,
      total_earned: 0,
      earned_month: getCurrentWeek(),
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return { success: false, error: 'duplicate' };
    return { success: false, error: error.message };
  }
  return { success: true, player: data };
}

// Login (verify nickname + password) — also resets weekly if needed
export async function loginPlayer(nickname, password) {
  if (!supabase) return { success: false, error: 'offline' };
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('nickname', nickname)
    .eq('password', password)
    .single();
  if (error || !data) return { success: false, error: 'wrong_password' };
  const player = await resetWeeklyIfNeeded(data);
  return { success: true, player };
}

// Get player by nickname (no password check)
export async function getOnlinePlayer(nickname) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('players')
    .select('*')
    .eq('nickname', nickname)
    .single();
  if (!data) return null;
  return await resetWeeklyIfNeeded(data);
}

// Update player score (add to existing) — also adds to total_earned for ranking
export async function updateOnlineScore(nickname, scoreToAdd) {
  if (!supabase) return null;
  const player = await getOnlinePlayer(nickname);
  if (!player) return null;
  const newScore = Math.max(0, player.score + scoreToAdd);
  const earnedAdd = scoreToAdd > 0 ? scoreToAdd : 0;
  const { data } = await supabase
    .from('players')
    .update({
      score: newScore,
      total_earned: player.total_earned + earnedAdd,
      updated_at: new Date().toISOString(),
    })
    .eq('nickname', nickname)
    .select()
    .single();
  return data;
}

// Purchase character (deducts from score, NOT from total_earned)
export async function purchaseOnlineCharacter(nickname, characterId, price = 1000) {
  if (!supabase) return { success: false };
  const player = await getOnlinePlayer(nickname);
  if (!player) return { success: false };
  if (player.score < price) return { success: false, error: 'not_enough' };
  if (player.characters.includes(characterId)) return { success: false, error: 'already_owned' };

  const newChars = [...player.characters, characterId];
  const newScore = player.score - price;
  const { data } = await supabase
    .from('players')
    .update({
      score: newScore,
      characters: newChars,
      equipped_character: characterId,
      updated_at: new Date().toISOString(),
    })
    .eq('nickname', nickname)
    .select()
    .single();
  return { success: true, player: data };
}

// Equip character
export async function equipOnlineCharacter(nickname, characterId) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('players')
    .update({ equipped_character: characterId, updated_at: new Date().toISOString() })
    .eq('nickname', nickname)
    .select()
    .single();
  return data;
}

// Sell character (refund partial price)
export async function sellOnlineCharacter(nickname, characterId, refund) {
  if (!supabase) return { success: false };
  const player = await getOnlinePlayer(nickname);
  if (!player) return { success: false };
  if (!player.characters.includes(characterId)) return { success: false };
  if (characterId === 0) return { success: false };

  const newChars = player.characters.filter(c => c !== characterId);
  const newEquipped = player.equipped_character === characterId ? 0 : player.equipped_character;
  const { data } = await supabase
    .from('players')
    .update({
      score: player.score + refund,
      characters: newChars,
      equipped_character: newEquipped,
      updated_at: new Date().toISOString(),
    })
    .eq('nickname', nickname)
    .select()
    .single();
  return { success: true, player: data };
}

// Save room layout & furniture to Supabase
export async function saveRoomData(nickname, layout, furniture) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('players')
    .update({
      room_layout: layout,
      room_furniture: furniture,
      updated_at: new Date().toISOString(),
    })
    .eq('nickname', nickname)
    .select()
    .single();
  return data;
}

// Get room data for a specific player
export async function getRoomData(nickname) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('players')
    .select('room_layout, room_furniture, characters, equipped_character, school_name')
    .eq('nickname', nickname)
    .single();
  return data;
}

// Update school name
export async function updateSchoolName(nickname, schoolName) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('players')
    .update({ school_name: schoolName, updated_at: new Date().toISOString() })
    .eq('nickname', nickname)
    .select()
    .single();
  return data;
}

// Get online rankings (sorted by weekly total_earned, then score)
export async function getOnlineRankings() {
  if (!supabase) return [];
  const currentWeek = getCurrentWeek();
  const { data } = await supabase
    .from('players')
    .select('nickname, score, total_earned, earned_month, characters, equipped_character, school_name')
    .order('total_earned', { ascending: false });
  if (!data) return [];

  return data
    .map((p) => ({
      name: p.nickname,
      score: p.score,
      totalEarned: p.earned_month === currentWeek ? p.total_earned : 0,
      characters: p.characters,
      characterCount: p.characters.filter((c) => c !== 0).length,
      equippedCharacter: p.equipped_character,
      schoolName: p.school_name || '',
    }))
    .sort((a, b) => b.totalEarned - a.totalEarned || b.score - a.score);
}

// ── 방 방문 (Realtime) ──

// 방 방문 채널 생성 & 접속
export function joinVisitRoom(hostNickname, visitorNickname, visitorCharId, { onGuestUpdate, onHostUpdate, onReady }) {
  if (!supabase) return null;
  const channelName = `visit-room-${hostNickname}`;
  const channel = supabase.channel(channelName, {
    config: { broadcast: { self: false, ack: false } },
  });

  // 게스트 위치 수신 (방 주인 측)
  channel.on('broadcast', { event: 'guest-move' }, ({ payload }) => {
    if (onGuestUpdate) onGuestUpdate(payload);
  });

  // 호스트 캐릭터 위치 수신 (방문자 측)
  channel.on('broadcast', { event: 'host-chars' }, ({ payload }) => {
    if (onHostUpdate) onHostUpdate(payload);
  });

  // presence로 접속자 감지
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    const visitors = [];
    Object.values(state).forEach(presences => {
      presences.forEach(p => { if (p.role === 'visitor') visitors.push(p); });
    });
    if (onGuestUpdate) onGuestUpdate({ type: 'presence', visitors });
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        nickname: visitorNickname,
        characterId: visitorCharId,
        role: 'visitor',
      });
      if (onReady) onReady();
    }
  });

  return channel;
}

// 호스트가 자기 방 채널 열기 (방문자 수신 대기)
export function hostVisitRoom(hostNickname, hostCharId, { onGuestUpdate, onReady }) {
  if (!supabase) return null;
  const channelName = `visit-room-${hostNickname}`;
  const channel = supabase.channel(channelName, {
    config: { broadcast: { self: false, ack: false } },
  });

  channel.on('broadcast', { event: 'guest-move' }, ({ payload }) => {
    if (onGuestUpdate) onGuestUpdate(payload);
  });

  // 호스트도 host-chars를 수신할 수 있도록 등록 (자기 메시지는 self:false로 안 옴)
  channel.on('broadcast', { event: 'host-chars' }, () => {});

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    const visitors = [];
    Object.values(state).forEach(presences => {
      presences.forEach(p => { if (p.role === 'visitor') visitors.push(p); });
    });
    if (onGuestUpdate) onGuestUpdate({ type: 'presence', visitors });
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        nickname: hostNickname,
        characterId: hostCharId,
        role: 'host',
      });
      if (onReady) onReady();
    }
  });

  return channel;
}

// 위치 브로드캐스트 (채널 구독 완료 후에만 전송)
export function broadcastVisitPosition(channel, eventName, payload) {
  if (!channel) return;
  // Supabase Realtime v2: state 프로퍼티로 채널 상태 확인
  if (channel.state && channel.state !== 'joined') {
    console.warn('[broadcast] 채널 미참여 상태:', channel.state, eventName);
    return;
  }
  channel.send({ type: 'broadcast', event: eventName, payload });
}

// 방 나가기
export function leaveVisitRoom(channel) {
  if (!channel || !supabase) return;
  channel.untrack();
  supabase.removeChannel(channel);
}

// ── 로비 시스템 (Presence 기반 방문 요청/승낙) ──

// 호스트: 개인 로비 채널 (Presence로 방문 요청 감지)
export function joinLobby(nickname, { onVisitRequest }) {
  if (!supabase) return null;
  const channel = supabase.channel(`lobby-${nickname}`, {
    config: { presence: { key: 'host' } },
  });

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    // host 키 외의 모든 presence = 방문 요청자
    Object.entries(state).forEach(([key, presences]) => {
      if (key === 'host') return;
      presences.forEach(p => {
        if (p.action === 'visit-request' && onVisitRequest) {
          onVisitRequest({ from: p.nickname, characterId: p.characterId });
        }
      });
    });
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ nickname, role: 'host' });
    }
  });
  return channel;
}

// 게스트: 호스트 로비에 접속하여 방문 요청 (Presence로)
export function sendVisitRequest(hostNickname, fromNickname, fromCharId, { onAccepted, onDeclined }) {
  if (!supabase) return null;
  const channel = supabase.channel(`lobby-${hostNickname}`, {
    config: { presence: { key: fromNickname } },
  });

  let responded = false;
  channel.on('presence', { event: 'sync' }, () => {
    if (responded) return;
    const state = channel.presenceState();
    const hostPresences = state['host'] || [];
    hostPresences.forEach(p => {
      if (p.acceptedVisitor === fromNickname) {
        responded = true;
        if (onAccepted) onAccepted();
      }
      if (p.declinedVisitor === fromNickname) {
        responded = true;
        if (onDeclined) onDeclined();
      }
    });
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        nickname: fromNickname,
        action: 'visit-request',
        characterId: fromCharId,
      });
    }
  });
  return channel;
}

// 호스트: 방문 승낙/거절 (Presence 상태 업데이트)
export function respondVisitRequest(lobbyChannel, nickname, visitorNickname, accepted) {
  if (!lobbyChannel) return;
  lobbyChannel.track({
    nickname,
    role: 'host',
    ...(accepted
      ? { acceptedVisitor: visitorNickname }
      : { declinedVisitor: visitorNickname }),
  });
}

// 로비 채널 나가기
export function leaveLobby(channel) {
  if (!channel || !supabase) return;
  channel.untrack();
  supabase.removeChannel(channel);
}

// Get top 10 rankings (lightweight, for game screen)
export async function getTop10Rankings() {
  if (!supabase) return [];
  const currentWeek = getCurrentWeek();
  const { data } = await supabase
    .from('players')
    .select('nickname, score, total_earned, earned_month')
    .order('total_earned', { ascending: false })
    .limit(30);
  if (!data) return [];

  return data
    .map((p) => ({
      name: p.nickname,
      totalEarned: p.earned_month === currentWeek ? p.total_earned : 0,
      score: p.score,
    }))
    .filter((p) => p.totalEarned > 0)
    .sort((a, b) => b.totalEarned - a.totalEarned || b.score - a.score)
    .slice(0, 10);
}
