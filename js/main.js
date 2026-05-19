// ─────────────────────────────────────────────
//  VIVUM — Main entry point
//  Windows XP Luna Blue theme
// ─────────────────────────────────────────────

import { Simulation } from './simulation.js';
import { Renderer }   from './renderer.js';
import { EL, ELEMENTS_UI } from './elements.js';
import { initDesktop }                                   from './desktop.js';
import { loadBeach, loadVolcano, loadGarden, loadSpace } from './presets.js';

// ── Brush sizes (vivum sizeMap) ───────────
const sizeMap = [2, 5, 10, 18, 30, 45];
let sizeIdx   = 2;   // default = 10

// ── State ─────────────────────────────────────
let paused    = false;
let curEl     = EL.SAND;
let painting  = false;
let lastPaint = null;
let repeatTimer = null;

// ── Canvas element (needed early for event listeners) ──
const canvas = document.getElementById('sand-canvas');

// ── Build UI first so the toolbar renders before we measure canvas-area ──
buildUI();

// ── Compute simulation dimensions from the actual canvas-area size ──
//    (measured AFTER buildUI so toolbar height is included in layout)
const ratio  = window.devicePixelRatio > 1 ? 3 : 4;
const area   = document.getElementById('canvas-area');
const SIM_W  = Math.ceil((area.clientWidth  || window.innerWidth)  / ratio);
const SIM_H  = Math.ceil((area.clientHeight || window.innerHeight) / ratio);

canvas.width  = SIM_W * ratio;
canvas.height = SIM_H * ratio;

// ── Create simulation & renderer ──────────────
const sim = new Simulation(SIM_W, SIM_H);
const ren = new Renderer(canvas, SIM_W, SIM_H);

// ── Status bar: show sim dimensions ───────────
const sbDim = document.getElementById('sb-dim');
if (sbDim) sbDim.textContent = `${SIM_W} × ${SIM_H}`;

// ── Undo buffer ───────────────────────────────
const undoStack = [];
function pushUndo() {
  undoStack.push(sim.buf.slice());
  if (undoStack.length > 20) undoStack.shift();
}
function undoStep() {
  if (undoStack.length) sim.buf.set(undoStack.pop());
}

// ── Paint helpers (vivum smooth-paint) ────
function eventDist(a, b) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function paintAtEvent(e) {
  if (!painting) return;
  const rect = canvas.getBoundingClientRect();
  const cx = Math.min(Math.floor((e.clientX - rect.left) * SIM_W / rect.width),  SIM_W - 1);
  const cy = Math.min(Math.floor((e.clientY - rect.top)  * SIM_H / rect.height), SIM_H - 1);
  if (cx < 0 || cy < 0) return;
  sim.paint(cx, cy, sizeMap[sizeIdx], curEl);
}

function smoothPaint(e) {
  clearInterval(repeatTimer);
  repeatTimer = setInterval(() => paintAtEvent(e), 100);
  if (!painting) return;

  const cur  = { clientX: e.clientX, clientY: e.clientY };
  const size = sizeMap[sizeIdx];
  const step = Math.max(size / 5, 1);

  if (lastPaint) {
    let from = { ...lastPaint };
    let i = 0;
    while (eventDist(from, cur) > step && i < 1000) {
      const d  = eventDist(from, cur);
      const nx = from.clientX + (cur.clientX - from.clientX) / d * Math.min(step, d);
      const ny = from.clientY + (cur.clientY - from.clientY) / d * Math.min(step, d);
      from = { clientX: nx, clientY: ny };
      paintAtEvent(from);
      i++;
    }
  }
  paintAtEvent(cur);
  lastPaint = cur;
}

// ── Mouse input ───────────────────────────────
canvas.addEventListener('mousedown', e => {
  e.preventDefault();
  pushUndo();
  painting    = true;
  clearInterval(repeatTimer);
  repeatTimer = setInterval(() => paintAtEvent(e), 100);
  paintAtEvent(e);
  lastPaint   = e;
});

document.body.addEventListener('mouseup', e => {
  clearInterval(repeatTimer);
  if (painting) { e.preventDefault(); lastPaint = null; painting = false; }
});

canvas.addEventListener('mousemove', smoothPaint);
canvas.addEventListener('mouseleave', () => { clearInterval(repeatTimer); lastPaint = null; });

// ── Touch input ───────────────────────────────
canvas.addEventListener('touchstart', e => {
  pushUndo();
  if (e.cancelable) e.preventDefault();
  painting  = true;
  lastPaint = e;
  handleTouches(e);
}, { passive: false });

canvas.addEventListener('touchend', e => {
  if (e.cancelable) e.preventDefault();
  lastPaint = null; painting = false; clearInterval(repeatTimer);
});

canvas.addEventListener('touchmove', e => {
  if (!paused && e.cancelable) e.preventDefault();
  clearInterval(repeatTimer);
  handleTouches(e);
}, { passive: false });

function handleTouches(e) {
  const touches = Array.from(e.touches);
  if (touches.length === 1) smoothPaint(touches[0]);
  else touches.forEach(t => paintAtEvent(t));
}

// ── FPS / status ──────────────────────────────
let frameCount = 0, lastFpsTime = performance.now();

function updateFPS(now) {
  frameCount++;
  if (now - lastFpsTime >= 500) {
    const fps = (frameCount / ((now - lastFpsTime) / 1000)) | 0;
    frameCount  = 0;
    lastFpsTime = now;
    document.getElementById('fps').textContent = `${fps} fps`;
    const sb = document.getElementById('sb-status');
    if (sb) sb.textContent = `${fps} fps`;
  }
}

// ── Game loop ──────────────────────────────────
function loop(now) {
  if (!paused) sim.step();
  ren.draw(sim);
  updateFPS(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ── Boot animation ────────────────────────────
//    Mirrors vivum's boot.js exactly (300×300 origin),
//    scaled to our actual sim dimensions.
let stopBoot = false;
canvas.addEventListener('mousedown',  () => { stopBoot = true; }, { once: true });
canvas.addEventListener('touchstart', () => { stopBoot = true; }, { once: true });

async function boot() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // vivum boot.js is tuned for a 300×300 grid — scale to our size
  const sx = SIM_W / 300;
  const sy = SIM_H / 300;
  const ss = Math.min(sx, sy);

  // Pass 1: wavy sand ridge near the bottom
  for (let x = 5; x <= SIM_W - 5; x += Math.max(1, Math.round(10 * sx))) {
    if (stopBoot) return;
    const y = Math.floor(SIM_H - 40 * sy + 5 * sy * Math.sin(x / (20 * sx)));
    sim.paint(x, y, Math.max(2, Math.round((Math.random() * 6 + 10) * ss)), EL.SAND);
    await sleep(16);
  }

  // Pass 2: seeds that sprout into flowers
  for (let x = Math.round(40 * sx); x <= SIM_W - Math.round(40 * sx); x += Math.round((50 + Math.random() * 10) * sx)) {
    if (stopBoot) return;
    const y = Math.floor(SIM_H / 2 + 20 * sy * Math.sin(x / (20 * sx)));
    sim.paint(x, y, Math.max(2, Math.round(6 * ss)), EL.SEED);
    await sleep(180);
  }
}
boot();

// ── Window chrome behaviour ───────────────────
document.getElementById('btn-min').addEventListener('click', () => {
  const win = document.getElementById('xp-window');
  win.style.display = win.style.display === 'none' ? '' : 'none';
});

document.getElementById('task-vivum').addEventListener('click', () => {
  const win = document.getElementById('xp-window');
  win.style.display = win.style.display === 'none' ? '' : 'none';
});

document.getElementById('btn-close-win').addEventListener('click', () => {
  if (confirm('Exit vivum?')) {
    document.getElementById('xp-window').style.display = 'none';
    document.getElementById('task-vivum').classList.remove('active');
  }
});

document.getElementById('btn-max').addEventListener('click', () => {
  // already maximized — do nothing visual (XP max button on a maximized window)
});

// ── Taskbar clock ─────────────────────────────
function updateClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  el.textContent = `${h}:${m}`;
}
updateClock();
setInterval(updateClock, 15000);

// ── Build UI ──────────────────────────────────
function buildUI() {
  const ui = document.getElementById('ui');

  // ── Row 1: control buttons ──────────────────
  const controls = document.createElement('div');
  controls.id = 'controls';

  // Pause / Play
  const pauseBtn = document.createElement('button');
  pauseBtn.id = 'btn-pause';
  pauseBtn.innerHTML = pauseSVG();
  pauseBtn.title = 'Pause';
  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.innerHTML = paused ? playSVG() : pauseSVG();
    pauseBtn.title = paused ? 'Play' : 'Pause';
  });
  controls.appendChild(pauseBtn);

  // Undo
  const undoBtn = document.createElement('button');
  undoBtn.textContent = '↺';
  undoBtn.title = 'Undo';
  undoBtn.addEventListener('click', () => undoStep());
  controls.appendChild(undoBtn);

  // Clear
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'clear';
  clearBtn.title = 'Clear';
  clearBtn.addEventListener('click', () => {
    if (confirm('Clear the canvas?')) sim.clear();
  });
  controls.appendChild(clearBtn);

  ui.appendChild(controls);

  // ── Row 2: brush size selector ──────────────
  for (let i = 0; i < sizeMap.length; i++) {
    const r   = sizeMap[i] / 3;
    const btn = document.createElement('button');
    btn.title = `Brush size ${sizeMap[i]}`;
    btn.innerHTML = `<svg viewBox="0 0 26 26" width="26" height="26">
      <circle cx="13" cy="13" r="${Math.min(11, Math.max(1.5, r))}" fill="currentColor"/>
    </svg>`;
    if (i === sizeIdx) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      sizeIdx = i;
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    btn.classList.add('size-btn');
    ui.appendChild(btn);
  }

  // ── Element buttons ─────────────────────────
  for (const def of ELEMENTS_UI) {
    const btn = document.createElement('button');
    btn.textContent = def.key;
    btn.dataset.elId = String(def.id);
    btn.title = def.key;
    btn.style.backgroundColor = def.color;
    btn.style.color = 'black';
    btn.addEventListener('click', () => selectElement(def.id));
    ui.appendChild(btn);

    if (def.id === EL.SAND) {
      btn.classList.add('selected');
      btn.style.backgroundColor = '';
    }
  }
}

function selectElement(id) {
  curEl = id;
  document.querySelectorAll('[data-el-id]').forEach(b => {
    b.classList.remove('selected');
    const def = ELEMENTS_UI.find(d => d.id === +b.dataset.elId);
    if (def) b.style.backgroundColor = def.color;
  });
  const active = document.querySelector(`[data-el-id="${id}"]`);
  if (active) {
    active.classList.add('selected');
    active.style.backgroundColor = '';
  }
}

// ── Desktop (icons, drag, quicksave, presets) ─────────────────────────────
initDesktop({
  sim, EL, SIM_W, SIM_H,
  presets: {
    beach:   loadBeach,
    volcano: loadVolcano,
    garden:  loadGarden,
    space:   loadSpace,
  },
});

// vivum desktop icon: double-click toggles the main window
document.getElementById('icon-vivum').addEventListener('dblclick', () => {
  const win = document.getElementById('xp-window');
  win.style.display = win.style.display === 'none' ? '' : 'none';
});

// ── SVG icons ─────────────────────────────────
function pauseSVG() {
  return `<svg viewBox="0 0 26 26" width="26" height="26">
    <rect x="6"  y="5" width="4" height="16" fill="currentColor"/>
    <rect x="16" y="5" width="4" height="16" fill="currentColor"/>
  </svg>`;
}
function playSVG() {
  return `<svg viewBox="0 0 26 26" width="26" height="26">
    <polygon points="7,4 22,13 7,22" fill="currentColor"/>
  </svg>`;
}
