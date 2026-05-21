// ─────────────────────────────────────────────
//  VIVUM — soft XP-style sounds  (v2)
//
//  Design rules:
//   • Sine waves — warmest, least fatiguing
//   • Attack ≥ 25 ms — eliminates click transients
//   • Peak vol ≤ 0.08 for UI sounds, 0.05 for ambient
//   • Exponential decay — natural tail, no abrupt cut-off
//   • Bell helper: layered harmonics → real instrument feel
// ─────────────────────────────────────────────

let _ctx  = null;
let _masterGain = null;

// Shared 3-second white noise buffer — allocated once, reused for all
// nburst/noise calls. Eliminates per-call Float32Array allocation + fill
// which was the biggest GC/CPU bottleneck.
let _noiseBuf = null;
function getNoiseBuf(c) {
  if (_noiseBuf) return _noiseBuf;
  const buf = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  _noiseBuf = buf;
  return buf;
}

function ctx() {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
    _masterGain = _ctx.createGain();
    _masterGain.gain.value = 1.0;
    _masterGain.connect(_ctx.destination);
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

const _resume = () => { ctx(); document.removeEventListener('click', _resume); };
document.addEventListener('click', _resume);

// ── Master volume ────────────────────────────
export function setMasterVolume(v) {
  const c = ctx();
  _masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), c.currentTime, 0.05);
}

// ── Primitive: single sine tone ──────────────
// attack is always ≥ 25 ms so there's never a click
function tone(freq, offset, dur, vol = 0.06, type = 'sine') {
  const c   = ctx();
  const osc = c.createOscillator();
  const g   = c.createGain();
  osc.connect(g); g.connect(_masterGain);
  osc.type = type;
  osc.frequency.value = freq;
  const t   = c.currentTime + offset;
  const atk = Math.min(0.03, dur * 0.18);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + atk);
  g.gain.setValueAtTime(vol, t + Math.max(atk + 0.01, dur - 0.20));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t); osc.stop(t + dur + 0.06);
}

// ── Bell: fundamental + two harmonics, fast decay ──
// Sounds like a small xylophone / glockenspiel key.
function bell(freq, offset, sustain = 0.60, vol = 0.07) {
  tone(freq,          offset, sustain,        vol);
  tone(freq * 2.756,  offset, sustain * 0.45, vol * 0.28);
  tone(freq * 5.404,  offset, sustain * 0.22, vol * 0.12);
}

// ── Soft noise burst (filtered) ─────────────
function noise(offset, dur, vol, lowHz, highHz) {
  const c  = ctx();
  const src = c.createBufferSource();
  src.buffer = getNoiseBuf(c);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = highHz;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = lowHz;
  const g  = c.createGain();
  src.connect(lp); lp.connect(hp); hp.connect(g); g.connect(_masterGain);
  const t   = c.currentTime + offset;
  const atk = 0.012;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  // Random start offset so repeated sounds don't have identical noise texture
  src.start(t, Math.random() * (3 - dur - 0.1));
  src.stop(t + dur + 0.05);
}

// ══════════════════════════════════════════════
//  🎵  STARTUP — warm ascending chord bloom
//  Inspired by the Brian Eno XP sound:
//  soft low pad → rising harmonic arpegg → shimmer
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
//  🌅  BOOT SWELL — звук появления экрана загрузки
//  Атмосферный подъём: суббас → мид-аккорд → мерцание.
//  A minor: торжественно, спокойно, красиво.
// ══════════════════════════════════════════════
export function playBootSwell() {
  const c = ctx(), t = c.currentTime;

  // Треугольная огибающая: линейный подъём → пик → линейный спад
  // Никакого hold + exponential — только плавные прямые линии
  function swell(freq, offset, totalDur, peakAt, vol) {
    const osc = c.createOscillator();
    const lp  = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = freq * 4;
    const g = c.createGain();
    osc.connect(lp); lp.connect(g); g.connect(_masterGain);
    osc.type = 'sine';
    osc.frequency.value = freq;
    const ts = t + offset;
    g.gain.setValueAtTime(0, ts);
    g.gain.linearRampToValueAtTime(vol,    ts + peakAt);       // подъём
    g.gain.linearRampToValueAtTime(0,      ts + totalDur);     // спад — такой же плавный
    osc.start(ts);
    osc.stop(ts + totalDur + 0.05);
  }

  // swell(freq, offset, totalDur, peakAt, vol)
  // Суббас — самый долгий, пик почти в середине
  swell(55,  0.00, 4.20, 1.40, 0.034);  // A1
  swell(82,  0.08, 4.00, 1.30, 0.028);  // E2

  // Бас A minor
  swell(110, 0.16, 3.80, 1.20, 0.032);  // A2
  swell(165, 0.24, 3.60, 1.10, 0.026);  // E3
  swell(220, 0.34, 3.30, 1.00, 0.022);  // A3

  // Мид — чуть позже и короче
  swell(261, 0.46, 3.00, 0.90, 0.018);  // C4
  swell(330, 0.58, 2.70, 0.80, 0.015);  // E4

  // Высокий блеск — появляется ближе к пику и тихо тает
  swell(880,  0.80, 2.20, 0.60, 0.018); // A5
  swell(1760, 1.10, 1.80, 0.50, 0.009); // A6
}

export function playStartup() {
  // Low warm pad (almost inaudible foundation)
  tone(82,  0.00, 3.80, 0.045);  // E2
  tone(165, 0.00, 3.40, 0.038);  // E3

  // Chord 1 — gentle opening
  tone(247, 0.00, 2.60, 0.042);  // B3
  tone(330, 0.12, 2.30, 0.050);  // E4

  // Bell arpegg rising — the "famous part" feel
  bell(415, 0.38, 1.90, 0.055);  // G#4
  bell(494, 0.56, 1.75, 0.048);  // B4
  bell(659, 1.00, 2.60, 0.065);  // E5  ← climax bell
  bell(830, 1.14, 2.20, 0.038);  // G#5
  bell(988, 1.30, 1.80, 0.026);  // B5

  // Soft shimmer overtone
  tone(1319, 1.10, 1.40, 0.016); // E6
}

// ══════════════════════════════════════════════
//  🪟  WINDOW OPEN — two rising bell notes
// ══════════════════════════════════════════════
export function playWindowOpen() {
  bell(660, 0.00, 0.38, 0.055);
  bell(880, 0.10, 0.38, 0.045);
}

// ══════════════════════════════════════════════
//  🪟  WINDOW CLOSE — two falling bell notes
// ══════════════════════════════════════════════
export function playWindowClose() {
  bell(880, 0.00, 0.36, 0.048);
  bell(660, 0.10, 0.36, 0.038);
}

// ══════════════════════════════════════════════
//  📉  MINIMIZE — soft descending whoosh
// ══════════════════════════════════════════════
export function playMinimize() {
  tone(660, 0.00, 0.14, 0.044);
  tone(523, 0.07, 0.14, 0.036);
  tone(392, 0.14, 0.18, 0.026);
}

// ══════════════════════════════════════════════
//  📈  RESTORE — soft ascending whoosh
// ══════════════════════════════════════════════
export function playRestore() {
  tone(392, 0.00, 0.14, 0.028);
  tone(523, 0.07, 0.14, 0.036);
  tone(660, 0.14, 0.20, 0.044);
}

// ══════════════════════════════════════════════
//  ❌  DING — close-button click / dialog open
//  A soft descending chime — NOT a harsh beep.
//  Feels like a gentle "are you sure?" question.
// ══════════════════════════════════════════════
export function playDing() {
  bell(659, 0.00, 0.55, 0.062);  // E5  — warm, not piercing
  bell(523, 0.13, 0.48, 0.042);  // C5
  bell(440, 0.24, 0.42, 0.028);  // A4  — soft landing
}

// ══════════════════════════════════════════════
//  🖱️  CLICK — barely audible soft tick
// ══════════════════════════════════════════════
export function playClick() {
  tone(880, 0.00, 0.055, 0.030);
  tone(660, 0.02, 0.050, 0.018);
}

// ══════════════════════════════════════════════
//  🎶  NOTIFY — three rising bell chimes
// ══════════════════════════════════════════════
export function playNotify() {
  bell(659, 0.00, 0.38, 0.055);  // E5
  bell(784, 0.16, 0.38, 0.048);  // G5
  bell(988, 0.32, 0.48, 0.042);  // B5
}

// ══════════════════════════════════════════════
//  💾  SAVE — pleasant two-note confirmation
// ══════════════════════════════════════════════
export function playSave() {
  bell(523, 0.00, 0.32, 0.052);  // C5
  bell(784, 0.12, 0.40, 0.045);  // G5
}

// ══════════════════════════════════════════════
//  🗑️  RECYCLE — soft three-note descend
// ══════════════════════════════════════════════
export function playRecycle() {
  bell(523, 0.00, 0.28, 0.050);  // C5
  bell(440, 0.10, 0.26, 0.038);  // A4
  bell(330, 0.20, 0.32, 0.028);  // E4
}

// ══════════════════════════════════════════════
//  🔊  VOLUME TEST — plays at current master vol
//  Three soft ascending notes: user hears exactly
//  what the chosen level sounds like.
// ══════════════════════════════════════════════
export function playVolumeTest() {
  bell(523, 0.00, 0.28, 0.080);  // C5
  bell(659, 0.13, 0.28, 0.070);  // E5
  bell(784, 0.26, 0.36, 0.060);  // G5  — C major triad
}

// ══════════════════════════════════════════════
//  🌬️  AMBIENT WIND — looping background hum
// ══════════════════════════════════════════════
let _ambientSource   = null;
let _ambientGainNode = null;

export function startAmbient() {
  if (_ambientSource) return;
  const c  = ctx();
  const sr = c.sampleRate;

  const buf  = c.createBuffer(1, sr * 3, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf; src.loop = true;

  const lp = c.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = 280;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 110; bp.Q.value = 0.35;

  const gain = c.createGain(); gain.gain.value = 0;

  // Slow LFO swell (0.07 Hz)
  const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.07;
  const lfoG = c.createGain(); lfoG.gain.value = 0.012;
  lfo.connect(lfoG); lfoG.connect(gain.gain);

  src.connect(lp); lp.connect(bp); bp.connect(gain); gain.connect(_masterGain);

  // Fade in over 4 s so it doesn't startle
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(0.038, c.currentTime + 4);

  lfo.start(); src.start();
  _ambientSource   = src;
  _ambientGainNode = gain;
}

export function stopAmbient() {
  if (!_ambientSource) return;
  const c = ctx();
  _ambientGainNode.gain.linearRampToValueAtTime(0, c.currentTime + 1.5);
  const src = _ambientSource;
  setTimeout(() => { try { src.stop(); } catch(_) {} }, 1600);
  _ambientSource = _ambientGainNode = null;
}

// ══════════════════════════════════════════════
//  🎨  DRAW SOUNDS — ASMR element feedback (v3)
//
//  Design principles:
//   • Per-element cooldown: switching elements feels instant
//   • Every sound randomised slightly each call — never mechanical
//   • Layered components: texture + body + tail = richness
//   • All peak volumes ≤ 0.065 to stay comfortable
// ══════════════════════════════════════════════

const DRAW_CD  = 160;  // ms per-element cooldown (~6/sec max)
const _drawTs  = {};   // { elementId → lastTimestamp }

// Noise burst — uses shared buffer, no per-call allocation
function nburst(c, t, offset, durS, vol, loHz, hiHz) {
  const src = c.createBufferSource();
  src.buffer = getNoiseBuf(c);
  const lp  = c.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = hiHz;
  const hp  = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = loHz;
  const g   = c.createGain();
  src.connect(lp); lp.connect(hp); hp.connect(g); g.connect(_masterGain);
  const ts  = t + offset;
  const atk = Math.min(0.012, durS * 0.15);
  g.gain.setValueAtTime(0.0001, ts);
  g.gain.linearRampToValueAtTime(vol, ts + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, ts + durS);
  src.start(ts, Math.random() * (3 - durS - 0.1));
  src.stop(ts + durS + 0.03);
}

export function playDrawSound(elementId) {
  const now = performance.now();
  if (now - (_drawTs[elementId] || 0) < DRAW_CD) return;
  _drawTs[elementId] = now;

  const c = ctx(), t = c.currentTime;
  switch (elementId) {
    case 2:  drawSand(c, t);    break;  // Sand
    case 3:  drawWater(c, t);   break;  // Water
    case 6:  drawFire(c, t);    break;  // Fire
    case 8:  drawLava(c, t);    break;  // Lava
    case 9:  drawIce(c, t);     break;  // Ice
    case 4:  drawGas(c, t);     break;  // Gas
    case 7:  drawWood(c, t);    break;  // Wood
    case 12: drawAcid(c, t);    break;  // Acid
    case 11: drawPlant(c, t);   break;  // Plant
    case 13: drawStone(c, t);   break;  // Stone
    case 1:  drawWall(c, t);    break;  // Wall
    case 14: drawDust(c, t);    break;  // Dust
    case 15: drawMite(c, t);    break;  // Mite
    case 16: drawOil(c, t);     break;  // Oil
    case 19: drawSeed(c, t);    break;  // Seed
    case 18: drawFungus(c, t);  break;  // Fungus
    case 17: drawRocket(c, t);  break;  // Rocket
    case 5:  drawCloner(c, t);  break;  // Cloner
    case 20: drawWind(c, t);    break;  // Wind (virtual)
    case 0:  drawErase(c, t);   break;  // Erase
    default: break;
  }
}

// ── SAND — dry grain pour ──────────────────────
// Two layers: high-freq grain texture + soft mid impact.
function drawSand(c, t) {
  const r = 0.82 + Math.random() * 0.36;
  // Grain hiss
  nburst(c, t, 0,     0.095, 0.048, 3100 * r, 9000);
  // Impact thud
  nburst(c, t, 0,     0.042, 0.026,  320 * r,  700);
  // Tiny delayed second grain (echo of falling)
  nburst(c, t, 0.045, 0.055, 0.022, 3600 * r, 9000);
}

// ── WATER — drop + splash + surface ring ───────
// The classic ASMR water drop, fully layered.
function drawWater(c, t) {
  const p = 0.82 + Math.random() * 0.36;

  // 1. Descending sine (the drop itself)
  const osc = c.createOscillator(), g = c.createGain();
  osc.connect(g); g.connect(_masterGain); osc.type = 'sine';
  osc.frequency.setValueAtTime(1100 * p, t);
  osc.frequency.exponentialRampToValueAtTime(340 * p, t + 0.24);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.062, t + 0.010);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  osc.start(t); osc.stop(t + 0.32);

  // 2. Splash — bandpass burst at impact
  nburst(c, t, 0.035, 0.055, 0.036, 380, 3200);

  // 3. Surface ring — tiny high sine, fading slowly
  const osc2 = c.createOscillator(), g2 = c.createGain();
  osc2.connect(g2); g2.connect(_masterGain); osc2.type = 'sine';
  osc2.frequency.value = 2600 * p;
  const t2 = t + 0.07;
  g2.gain.setValueAtTime(0.0001, t2);
  g2.gain.linearRampToValueAtTime(0.016, t2 + 0.014);
  g2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.38);
  osc2.start(t2); osc2.stop(t2 + 0.42);
}

// ── FIRE — layered micro-crackles ─────────────
// 4 staggered bandpass noise bursts at random freqs.
function drawFire(c, t) {
  const f = 0.70 + Math.random() * 0.60;
  const crk = (off, freq, vol, dur) => nburst(c, t, off, dur, vol, freq * 0.7, freq * 1.8);
  crk(0.000,               500 * f, 0.052, 0.038);
  crk(0.022,               360 * f, 0.036, 0.030);
  crk(0.050 + Math.random() * 0.02, 820 * f, 0.026, 0.026);
  crk(0.095 + Math.random() * 0.03, 260 * f, 0.015, 0.035);
}

// ── LAVA — thick bubble burst ──────────────────
// Rising sine (bubble forming) + low rumble bed.
function drawLava(c, t) {
  const p = 0.75 + Math.random() * 0.50;

  // Bubble tone: slow rise then pop
  const osc = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 220;
  osc.connect(lp); lp.connect(g); g.connect(_masterGain); osc.type = 'sine';
  osc.frequency.setValueAtTime(52 * p, t);
  osc.frequency.linearRampToValueAtTime(88 * p, t + 0.14);
  osc.frequency.exponentialRampToValueAtTime(36 * p, t + 0.30);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.058, t + 0.032);
  g.gain.setValueAtTime(0.058, t + 0.14);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
  osc.start(t); osc.stop(t + 0.38);

  // Rumble noise bed
  nburst(c, t, 0, 0.22, 0.030, 30, 130);
}

// ── ICE — crystal clink with frost ────────────
// Three bell partials + a breath of frost noise.
function drawIce(c, t) {
  const base = 1550 + Math.random() * 950;
  bell(base,         0,     0.52, 0.050);
  bell(base * 1.49,  0.007, 0.32, 0.028);
  bell(base * 2.38,  0.013, 0.20, 0.014);
  // Frost: barely-there high noise
  nburst(c, t, 0, 0.04, 0.010, 5000, 14000);
}

// ── GAS — soft whisper exhale ─────────────────
// Slow-attack narrow bandpass: a gentle hiss.
function drawGas(c, t) {
  const p = 0.75 + Math.random() * 0.50;
  nburst(c, t, 0, 0.16, 0.026, 220 * p, 850 * p);
  // Subtle high shimmer
  nburst(c, t, 0.02, 0.10, 0.010, 1200 * p, 2400 * p);
}

// ── WOOD — hollow resonant knock ──────────────
// Triangle pitch-drop (body) + mid noise (grain).
function drawWood(c, t) {
  const p = 0.80 + Math.random() * 0.40;

  // Tonal body
  const osc = c.createOscillator(), g = c.createGain();
  osc.connect(g); g.connect(_masterGain); osc.type = 'triangle';
  osc.frequency.setValueAtTime(230 * p, t);
  osc.frequency.exponentialRampToValueAtTime(72 * p, t + 0.20);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.060, t + 0.007);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
  osc.start(t); osc.stop(t + 0.30);

  // Woody grain texture
  nburst(c, t, 0, 0.028, 0.032, 580 * p, 2200 * p);
}

// ── ACID — micro-fizz chain ────────────────────
// 4 tiny high-pass bursts at random intervals.
function drawAcid(c, t) {
  const pop = (off) => nburst(c, t, off, 0.022, 0.028,
    1800 + Math.random() * 3200, 12000);
  pop(0);
  pop(0.016 + Math.random() * 0.010);
  pop(0.034 + Math.random() * 0.012);
  pop(0.058 + Math.random() * 0.016);
}

// ── PLANT — leaf swish ─────────────────────────
// Bandpass noise with gentle swell and fade.
function drawPlant(c, t) {
  const p   = 0.80 + Math.random() * 0.40;
  const src = c.createBufferSource();
  src.buffer = getNoiseBuf(c);
  const bp  = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900 * p; bp.Q.value = 0.85;
  const lp  = c.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = 5500;
  const g   = c.createGain();
  src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(_masterGain);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.028, t + 0.032);
  g.gain.setValueAtTime(0.028, t + 0.075);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  src.start(t, Math.random() * 2.7);
  src.stop(t + 0.25);
}

// ── STONE — solid thock ────────────────────────
// Triangle thud + hard impact noise.
function drawStone(c, t) {
  const p = 0.75 + Math.random() * 0.50;
  const osc = c.createOscillator(), g = c.createGain();
  osc.connect(g); g.connect(_masterGain); osc.type = 'triangle';
  osc.frequency.setValueAtTime(165 * p, t);
  osc.frequency.exponentialRampToValueAtTime(50 * p, t + 0.13);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.058, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
  osc.start(t); osc.stop(t + 0.20);
  nburst(c, t, 0, 0.030, 0.028, 160, 1800);
}

// ── WALL — dense thud ─────────────────────────
function drawWall(c, t) {
  const p = 0.85 + Math.random() * 0.30;
  nburst(c, t, 0, 0.045, 0.040, 100, 1100);
  const osc = c.createOscillator(), g = c.createGain();
  osc.connect(g); g.connect(_masterGain); osc.type = 'sine';
  osc.frequency.setValueAtTime(88 * p, t);
  osc.frequency.exponentialRampToValueAtTime(48 * p, t + 0.09);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.044, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
  osc.start(t); osc.stop(t + 0.14);
}

// ── DUST — fine powder whisper ────────────────
function drawDust(c, t) {
  const p = 0.85 + Math.random() * 0.30;
  nburst(c, t, 0,     0.080, 0.018, 2600 * p, 8000);
  nburst(c, t, 0.025, 0.050, 0.010, 4200 * p, 11000);
}

// ── MITE — tiny scurry tick ───────────────────
function drawMite(c, t) {
  tone(2100 + Math.random() * 900, 0.000, 0.022, 0.024);
  tone(1700 + Math.random() * 500, 0.010, 0.018, 0.014);
}

// ── OIL — slow viscous drop ───────────────────
// Like water but an octave lower and slower.
function drawOil(c, t) {
  const p = 0.55 + Math.random() * 0.30;
  const osc = c.createOscillator(), g = c.createGain();
  osc.connect(g); g.connect(_masterGain); osc.type = 'sine';
  osc.frequency.setValueAtTime(680 * p, t);
  osc.frequency.exponentialRampToValueAtTime(170 * p, t + 0.38);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.055, t + 0.022);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.44);
  osc.start(t); osc.stop(t + 0.48);
  // Viscous gurgle
  nburst(c, t, 0.05, 0.06, 0.018, 60, 420);
}

// ── SEED — light pitter-patter ────────────────
function drawSeed(c, t) {
  const p = 0.90 + Math.random() * 0.60;
  tone(1900 * p, 0.000, 0.036, 0.030);
  tone(1500 * p, 0.018, 0.030, 0.018);
}

// ── FUNGUS — soft spore puff ──────────────────
function drawFungus(c, t) {
  nburst(c, t, 0, 0.14, 0.015, 180, 1300);
  tone(90 + Math.random() * 35, 0, 0.16, 0.020);
}

// ── ROCKET — ignition whoosh ──────────────────
function drawRocket(c, t) {
  // Rising sawtooth sweep
  const osc = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 900;
  osc.connect(lp); lp.connect(g); g.connect(_masterGain); osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(75, t);
  osc.frequency.exponentialRampToValueAtTime(340, t + 0.14);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.044, t + 0.014);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
  osc.start(t); osc.stop(t + 0.24);
  // Hiss
  nburst(c, t, 0, 0.16, 0.030, 700, 5000);
}

// ── CLONER — harmonic shimmer ─────────────────
function drawCloner(c, t) {
  const base = 560 + Math.random() * 240;
  tone(base,         0.00, 0.20, 0.030);
  tone(base * 1.26,  0.02, 0.17, 0.020);
  tone(base * 1.50,  0.04, 0.14, 0.014);
  tone(base * 2.00,  0.06, 0.12, 0.008);
}

// ── WIND — rushing air ────────────────────────
// Three overlapping bandpass noise layers at low-to-mid frequencies.
// Pitch shifts slightly each call so it never sounds identical.
function drawWind(c, t) {
  const p = 0.80 + Math.random() * 0.40;
  // Low body — the "woosh" foundation
  nburst(c, t, 0.000, 0.20, 0.022,  90 * p,  420 * p);
  // Mid flutter — moving air texture
  nburst(c, t, 0.030, 0.16, 0.014, 280 * p,  900 * p);
  // High shimmer — leaves / dust in the breeze
  nburst(c, t, 0.070, 0.12, 0.008, 800 * p, 2600 * p);
}

// ══════════════════════════════════════════════
//  💥  XP ERROR SOUNDS — cascade error variants
//  Each variant mimics a different Windows XP system sound:
//  0 = Critical Stop  1 = Error  2 = Exclamation  3 = Asterisk
// ══════════════════════════════════════════════
export function playXpError(variant = 0) {
  const c = ctx(), t = c.currentTime;

  function harsh(freq, offset, dur, vol, type = 'square') {
    const osc = c.createOscillator();
    const lp  = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    const g   = c.createGain();
    osc.connect(lp); lp.connect(g); g.connect(_masterGain);
    osc.type = type;
    osc.frequency.value = freq;
    const ts = t + offset, atk = 0.004;
    g.gain.setValueAtTime(0.0001, ts);
    g.gain.linearRampToValueAtTime(vol, ts + atk);
    g.gain.setValueAtTime(vol, ts + Math.max(atk + 0.01, dur - 0.12));
    g.gain.exponentialRampToValueAtTime(0.0001, ts + dur);
    osc.start(ts); osc.stop(ts + dur + 0.04);
  }

  switch (variant % 4) {
    case 0:
      // Critical Stop — два резких нисходящих тона
      harsh(987,  0.00, 0.18, 0.055);
      harsh(784,  0.10, 0.16, 0.048);
      harsh(523,  0.20, 0.22, 0.038);
      nburst(c, t, 0, 0.08, 0.018, 200, 900);
      break;
    case 1:
      // Windows XP Error — один грубый короткий звук
      harsh(880,  0.00, 0.28, 0.060);
      harsh(880,  0.00, 0.28, 0.030, 'sawtooth');
      nburst(c, t, 0.01, 0.06, 0.020, 300, 1200);
      break;
    case 2:
      // Exclamation — восходящий дубль
      harsh(660,  0.00, 0.14, 0.050);
      harsh(1047, 0.12, 0.20, 0.055);
      nburst(c, t, 0.12, 0.05, 0.015, 400, 1800);
      break;
    case 3:
      // Asterisk — мягче, с дребезгом
      harsh(740,  0.00, 0.10, 0.045);
      harsh(740,  0.14, 0.10, 0.040);
      harsh(740,  0.28, 0.14, 0.032);
      nburst(c, t, 0, 0.12, 0.012, 600, 2000);
      break;
  }
}

// ── BSOD — continuous frozen-PC squeal ───────────
// Имитирует зависший компьютер: непрерывный гудок PC-спикера
// (~440 Hz square wave) с нарастающим шумом, длится ~5 с.
export function playBSOD() {
  const c = ctx(), t = c.currentTime;
  const DUR = 5.2;

  // Основной тон — PC speaker (square, 440 Hz)
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 440;

  // Лёгкая ЛЧ-фильтрация чтобы не резало уши
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;

  const g = c.createGain();
  osc.connect(lp); lp.connect(g); g.connect(_masterGain);

  // Атака 20 мс → держим → плавное затухание за последние 0.4 с
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.055, t + 0.02);
  g.gain.setValueAtTime(0.055, t + DUR - 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + DUR);

  osc.start(t);
  osc.stop(t + DUR + 0.05);

  // Фоновый белый шум — "артефакт" замёрзшего звука
  const src = c.createBufferSource();
  src.buffer = getNoiseBuf(c);
  src.loop = true;
  const ng = c.createGain();
  const nlp = c.createBiquadFilter();
  nlp.type = 'lowpass'; nlp.frequency.value = 600;
  src.connect(nlp); nlp.connect(ng); ng.connect(_masterGain);
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.linearRampToValueAtTime(0.018, t + 0.15);
  ng.gain.setValueAtTime(0.018, t + DUR - 0.4);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + DUR);
  src.start(t);
  src.stop(t + DUR + 0.05);
}

// ── ERASE — soft pencil/rubber swipe ──────────
// Layered: papery high hiss + gentle mid scrub + faint low tone.
// Feels like erasing pencil marks on paper — ASMR satisfying.
function drawErase(c, t) {
  const p = 0.85 + Math.random() * 0.30;

  // 1. High paper-grain hiss (eraser surface texture)
  nburst(c, t, 0.000, 0.110, 0.032, 3800 * p, 10000);

  // 2. Mid scrub layer (the friction against paper)
  nburst(c, t, 0.010, 0.095, 0.022,  900 * p,  3200 * p);

  // 3. Second sweep — slight delay, like two eraser strokes
  nburst(c, t, 0.065, 0.085, 0.018, 4200 * p, 11000);

  // 4. Barely-there low tone — the paper resonance
  tone(180 * p, 0, 0.12, 0.010, 'sine');
}
