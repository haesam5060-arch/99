// Web Audio API 8-bit style sound effects
let audioCtx = null;
let muted = false;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function resumeCtx() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();
}

export function setMuted(val) {
  muted = val;
}

export function isMuted() {
  return muted;
}

function playTone(freq, duration, type = 'square', volume = 0.15) {
  if (muted) return;
  resumeCtx();
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playNotes(notes, type = 'square', volume = 0.15) {
  if (muted) return;
  resumeCtx();
  const ctx = getCtx();
  let time = ctx.currentTime;
  notes.forEach(([freq, dur]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + dur);
    time += dur;
  });
}

// Coin / correct answer sound (Mario-like)
export function playCorrect() {
  playNotes([
    [988, 0.08],   // B5
    [1319, 0.15],  // E6
  ], 'square', 0.12);
}

// Wrong answer / hit sound
export function playWrong() {
  playNotes([
    [200, 0.1],
    [150, 0.15],
    [100, 0.2],
  ], 'sawtooth', 0.1);
}

// Stage start
export function playStageStart() {
  playNotes([
    [523, 0.1],  // C5
    [659, 0.1],  // E5
    [784, 0.1],  // G5
    [1047, 0.2], // C6
  ], 'square', 0.1);
}

// Stage clear
export function playStageClear() {
  playNotes([
    [523, 0.1],
    [659, 0.1],
    [784, 0.1],
    [1047, 0.15],
    [784, 0.1],
    [1047, 0.25],
  ], 'square', 0.1);
}

// Game complete fanfare
export function playGameComplete() {
  playNotes([
    [523, 0.1],
    [523, 0.1],
    [523, 0.1],
    [523, 0.2],
    [415, 0.2],
    [466, 0.2],
    [523, 0.15],
    [466, 0.08],
    [523, 0.35],
  ], 'square', 0.12);
}

// Purchase / power-up
export function playPurchase() {
  playNotes([
    [440, 0.08],
    [554, 0.08],
    [659, 0.08],
    [880, 0.2],
  ], 'square', 0.1);
}

// UI click
export function playClick() {
  playTone(800, 0.05, 'square', 0.08);
}

// UI select move
export function playSelect() {
  playTone(600, 0.04, 'square', 0.06);
}

// Explosion (planet destroy)
export function playExplosion() {
  if (muted) return;
  resumeCtx();
  const ctx = getCtx();
  const bufferSize = ctx.sampleRate * 0.3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

// Goal celebration (whistle + fanfare)
export function playGoal() {
  if (muted) return;
  resumeCtx();
  const ctx = getCtx();
  // 휘슬 (높은 사인파)
  const whistle = ctx.createOscillator();
  const wGain = ctx.createGain();
  whistle.type = 'sine';
  whistle.frequency.setValueAtTime(2800, ctx.currentTime);
  whistle.frequency.setValueAtTime(3200, ctx.currentTime + 0.15);
  whistle.frequency.setValueAtTime(2800, ctx.currentTime + 0.3);
  wGain.gain.setValueAtTime(0.12, ctx.currentTime);
  wGain.gain.setValueAtTime(0.12, ctx.currentTime + 0.3);
  wGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
  whistle.connect(wGain);
  wGain.connect(ctx.destination);
  whistle.start(ctx.currentTime);
  whistle.stop(ctx.currentTime + 0.45);
  // 팡파레 (휘슬 직후)
  const fanfare = [
    [523, 0.1],  // C5
    [659, 0.1],  // E5
    [784, 0.1],  // G5
    [1047, 0.12], // C6
    [784, 0.08],  // G5
    [1047, 0.3],  // C6 (길게)
  ];
  let time = ctx.currentTime + 0.5;
  fanfare.forEach(([freq, dur]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + dur);
    time += dur;
  });
}

// BGM - simple looping melody
let bgmInterval = null;
const BGM_NOTES_MENU = [
  [523, 0.25], [587, 0.25], [659, 0.25], [698, 0.25],
  [784, 0.25], [698, 0.25], [659, 0.25], [587, 0.25],
];
const BGM_NOTES_GAME = [
  [330, 0.15], [392, 0.15], [440, 0.15], [523, 0.15],
  [440, 0.15], [392, 0.15], [330, 0.15], [294, 0.15],
];

export function startBGM(type = 'menu') {
  stopBGM();
  const notes = type === 'game' ? BGM_NOTES_GAME : BGM_NOTES_MENU;
  const totalDuration = notes.reduce((sum, [, d]) => sum + d, 0) * 1000;

  const playMelody = () => {
    if (muted) return;
    playNotes(notes, 'triangle', 0.05);
  };

  playMelody();
  bgmInterval = setInterval(playMelody, totalDuration);
}

export function stopBGM() {
  if (bgmInterval) {
    clearInterval(bgmInterval);
    bgmInterval = null;
  }
}
