import { createClient } from '@supabase/supabase-js';

// TODO: Replace with your Supabase project credentials
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Check if online mode is available
export const isOnline = () => !!supabase;

// --- Monthly reset helper ---
function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Check if player needs monthly total_earned reset
function needsMonthlyReset(player) {
  return player.earned_month !== getCurrentMonth();
}

async function resetMonthlyIfNeeded(player) {
  if (!supabase || !needsMonthlyReset(player)) return player;
  const { data } = await supabase
    .from('players')
    .update({
      total_earned: 0,
      earned_month: getCurrentMonth(),
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
      earned_month: getCurrentMonth(),
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return { success: false, error: 'duplicate' };
    return { success: false, error: error.message };
  }
  return { success: true, player: data };
}

// Login (verify nickname + password) — also resets monthly if needed
export async function loginPlayer(nickname, password) {
  if (!supabase) return { success: false, error: 'offline' };
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('nickname', nickname)
    .eq('password', password)
    .single();
  if (error || !data) return { success: false, error: 'wrong_password' };
  const player = await resetMonthlyIfNeeded(data);
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
  return await resetMonthlyIfNeeded(data);
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
export async function purchaseOnlineCharacter(nickname, characterId) {
  if (!supabase) return { success: false };
  const player = await getOnlinePlayer(nickname);
  if (!player) return { success: false };
  if (player.score < 1000) return { success: false, error: 'not_enough' };
  if (player.characters.includes(characterId)) return { success: false, error: 'already_owned' };

  const newChars = [...player.characters, characterId];
  const newScore = player.score - 1000;
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

// Get online rankings (sorted by monthly total_earned, then score)
export async function getOnlineRankings() {
  if (!supabase) return [];
  const currentMonth = getCurrentMonth();
  const { data } = await supabase
    .from('players')
    .select('nickname, score, total_earned, earned_month, characters')
    .order('total_earned', { ascending: false });
  if (!data) return [];

  return data
    .map((p) => ({
      name: p.nickname,
      score: p.score,
      totalEarned: p.earned_month === currentMonth ? p.total_earned : 0,
      characterCount: p.characters.filter((c) => c !== 0).length,
    }))
    .sort((a, b) => b.totalEarned - a.totalEarned || b.score - a.score);
}
