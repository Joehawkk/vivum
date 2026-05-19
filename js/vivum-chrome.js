// ─────────────────────────────────────────────
//  VIVUM — Chrome behaviour + smooth animations
// ─────────────────────────────────────────────
import { xpConfirm } from './dialog.js';
import {
  playWindowOpen, playWindowClose, playMinimize, playRestore,
  playDing, playClick, playNotify, playSave, playRecycle,
  setMasterVolume, startAmbient, playDrawSound, playVolumeTest
} from './sounds.js';

// ── Animation helpers ─────────────────────────

function animShow(el, { dur = 200, fromScale = 0.96, fromY = 0, fromOpacity = 0 } = {}) {
  el.style.display = '';
  el.style.transition = 'none';
  el.style.opacity   = fromOpacity;
  el.style.transform = `scale(${fromScale}) translateY(${fromY}px)`;
  el.getBoundingClientRect(); // force reflow
  el.style.transition = `opacity ${dur}ms cubic-bezier(.2,.8,.4,1),
                          transform ${dur}ms cubic-bezier(.2,.8,.4,1)`;
  el.style.opacity   = '';
  el.style.transform = '';
  return new Promise(r => setTimeout(() => {
    el.style.transition = '';
    r();
  }, dur));
}

function animHide(el, { dur = 160, toScale = 0.96, toY = 0, toOpacity = 0 } = {}) {
  el.style.transition = `opacity ${dur}ms cubic-bezier(.6,0,.8,.4),
                          transform ${dur}ms cubic-bezier(.6,0,.8,.4)`;
  el.style.opacity   = toOpacity;
  el.style.transform = `scale(${toScale}) translateY(${toY}px)`;
  return new Promise(r => setTimeout(() => {
    el.style.display    = 'none';
    el.style.transition = '';
    el.style.opacity    = '';
    el.style.transform  = '';
    r();
  }, dur));
}

// Minimise: squish down toward the taskbar
function animMinimise(el) {
  return animHide(el, { dur: 200, toScale: 0.88, toY: 60, toOpacity: 0 });
}
function animRestore(el) {
  return animShow(el, { dur: 220, fromScale: 0.88, fromY: 60, fromOpacity: 0 });
}

// ── Taskbar clock ──────────────────────────────
function updateClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const d = new Date();
  el.textContent = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
updateClock();
setInterval(updateClock, 15000);

// ── Draggable window ───────────────────────────
(function () {
  const win = document.getElementById('xp-window');
  const bar = document.getElementById('title-bar');
  let ox = 0, oy = 0, dragging = false;

  bar.addEventListener('mousedown', e => {
    if (e.target.closest('.tbtn')) return;
    dragging = true;
    const r = win.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    win.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const desktop  = document.getElementById('desktop');
    const dr       = desktop.getBoundingClientRect();
    const taskbar  = document.getElementById('taskbar');
    const tbH      = taskbar ? taskbar.offsetHeight : 42;

    const maxLeft  = dr.width  - win.offsetWidth;
    const maxTop   = dr.height - win.offsetHeight - tbH;

    const left = Math.max(0, Math.min(maxLeft, e.clientX - ox));
    const top  = Math.max(0, Math.min(maxTop,  e.clientY - oy));

    win.style.left = left + 'px';
    win.style.top  = top  + 'px';
  });

  document.addEventListener('mouseup', () => {
    dragging = false;
    win.style.userSelect = '';
  });
})();

// ── Window chrome ──────────────────────────────
const xpWin = document.getElementById('xp-window');

// Minimize button
document.getElementById('btn-min').addEventListener('click', () => {
  if (!xpWin.dataset.everOpened) return;
  if (xpWin.style.display === 'none') {
    playRestore(); animRestore(xpWin);
    document.getElementById('task-vivum').classList.add('active');
  } else {
    playMinimize(); animMinimise(xpWin);
    document.getElementById('task-vivum').classList.remove('active');
  }
});

// Taskbar task button — same toggle
document.getElementById('task-vivum').addEventListener('click', () => {
  if (!xpWin.dataset.everOpened) return;
  if (xpWin.style.display === 'none') {
    playRestore(); animRestore(xpWin);
    document.getElementById('task-vivum').classList.add('active');
  } else {
    playMinimize(); animMinimise(xpWin);
    document.getElementById('task-vivum').classList.remove('active');
  }
});

// Close button — hide window AND remove task button from taskbar
document.getElementById('btn-close-win').addEventListener('click', async () => {
  playDing();
  const ok = await xpConfirm('Exit vivum?', { icon: '🏖', titleIcon: '🏖' });
  if (!ok) return;
  playWindowClose();
  await animHide(xpWin, { dur: 200, toScale: 0.94, toOpacity: 0 });
  const tb = document.getElementById('task-vivum');
  tb.classList.remove('active');
  tb.style.display = 'none';
  // Allow re-opening via desktop icon double-click
  delete xpWin.dataset.everOpened;
});

// Maximize — no-op for now
document.getElementById('btn-max').addEventListener('click', () => {});

// icon-vivum dblclick — boot.js handles the very first open via { once: true }.
// This handler covers: minimise/restore when open, AND re-open after close.
document.getElementById('icon-vivum').addEventListener('dblclick', () => {
  const tb = document.getElementById('task-vivum');

  if (!xpWin.dataset.everOpened) {
    // Window was closed (everOpened deleted) — re-open it
    xpWin.dataset.everOpened = '1';
    tb.style.display = '';
    tb.classList.add('active');
    playWindowOpen();
    animShow(xpWin, { dur: 240, fromScale: 0.94, fromY: 18, fromOpacity: 0 });
    return;
  }

  if (xpWin.style.display === 'none') {
    tb.style.display = '';
    tb.classList.add('active');
    playRestore();
    animRestore(xpWin);
  } else {
    playMinimize();
    animMinimise(xpWin);
    tb.classList.remove('active');
  }
});

// ── Recycle Bin ───────────────────────────────
document.getElementById('icon-recycle').addEventListener('dblclick', async () => {
  playDing();
  const ok = await xpConfirm('Clear the canvas?', { icon: '🗑️', titleIcon: '🗑️' });
  if (!ok) return;
  playRecycle();
  if (window.reset) window.reset();
  else if (window.u) window.u.reset();
});

// ── Quicksave ─────────────────────────────────
document.getElementById('icon-save').addEventListener('click', () => {
  if (!window.__vivumUniverse) return;
  try {
    window.__vivumQuicksave = window.__vivumUniverse.cells();
    playSave();
    flashStatus('Saved ✓');
  } catch(e) {}
});

// ── Presets window ────────────────────────────
const presetsWin = document.getElementById('presets-window');

function openPresets() {
  if (presetsWin.style.display !== 'none') return;
  animShow(presetsWin, { dur: 200, fromScale: 0.96, fromY: -10 });
}
function closePresets() {
  animHide(presetsWin, { dur: 160, toScale: 0.96, toY: -10 });
}

document.getElementById('icon-presets').addEventListener('dblclick', () => {
  presetsWin.style.display === 'none' ? openPresets() : closePresets();
});
document.getElementById('presets-close').addEventListener('click', closePresets);
document.getElementById('presets-min')  .addEventListener('click', closePresets);

// Drag on presets title bar
(function () {
  const bar = document.getElementById('presets-title-bar');
  let ox = 0, oy = 0, dragging = false;
  bar.style.cursor = 'default';
  bar.addEventListener('mousedown', e => {
    if (e.target.closest('.tbtn')) return;
    dragging = true;
    const r = presetsWin.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    presetsWin.style.userSelect = 'none';
    bar.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const desktop = document.getElementById('desktop');
    const dr      = desktop.getBoundingClientRect();
    const taskbar = document.getElementById('taskbar');
    const tbH     = taskbar ? taskbar.offsetHeight : 42;

    const left = Math.max(0, Math.min(dr.width  - presetsWin.offsetWidth,  e.clientX - ox));
    const top  = Math.max(0, Math.min(dr.height - presetsWin.offsetHeight - tbH, e.clientY - oy));

    presetsWin.style.left = left + 'px';
    presetsWin.style.top  = top  + 'px';
  });
  document.addEventListener('mouseup', () => {
    dragging = false;
    presetsWin.style.userSelect = '';
    bar.style.cursor = 'default';
  });
})();

// Hover description + single-click select
document.querySelectorAll('.picon').forEach(icon => {
  const desc = {
    volcano: 'Lava erupts from a CLONER crater. Island grows as lava meets the sea.',
    glacier: 'A living glacier melts into a blooming spring valley.',
    oasis:   'A CLONER spring floods the desert. Seeds, palms, life.',
    cascade: 'Water cascades down four stone ledges into a jungle pool.',
  };
  icon.addEventListener('mouseenter', () => {
    document.getElementById('presets-status-text').textContent =
      desc[icon.dataset.preset] || 'Double-click to load';
  });
  icon.addEventListener('mouseleave', () => {
    document.getElementById('presets-status-text').textContent =
      'Double-click a scene to load it';
  });
  icon.addEventListener('click', () => {
    document.querySelectorAll('.picon').forEach(p => p.classList.remove('selected'));
    icon.classList.add('selected');
  });
});

// ── Status bar helper ─────────────────────────
function flashStatus(msg, ms = 2000) {
  const sb = document.getElementById('sb-status');
  if (!sb) return;
  sb.textContent = msg;
  setTimeout(() => { if (sb.textContent === msg) sb.textContent = 'Ready'; }, ms);
}

// ── Wind tool ─────────────────────────────────
// Wind is a virtual element (id 20) — not in vivum's Species enum.
// It shifts particles in the brush area toward the mouse-movement direction
// by writing directly into the WASM cell buffer via u.cells().
const WIND_ID    = 20;
const WIND_RADII = [3, 6, 12, 20, 32];            // sim cells per size index
// Species that wind can't move (empty=0, wall=1, cloner=5, wood=7, lava=8, ice=9, stone=13)
const WIND_FIXED = new Set([0, 1, 5, 7, 8, 9, 13]);

function applyWind(canvas, clientX, clientY, vx, vy) {
  const u = window.u;
  if (!u) return;
  const cells = u.cells();
  if (!cells) return;

  const N = 300, S = 4;
  const rect = canvas.getBoundingClientRect();
  const scX  = N / rect.width;
  const scY  = N / rect.height;

  const cx = Math.max(0, Math.min(N - 1, Math.floor((clientX - rect.left) * scX)));
  const cy = Math.max(0, Math.min(N - 1, Math.floor((clientY - rect.top)  * scY)));

  // Wind vector in simulation coordinates
  const dvx   = vx * scX;
  const dvy   = vy * scY;
  const speed = Math.hypot(dvx, dvy);
  if (speed < 0.4) return;

  // Clamp displacement to 1–3 cells
  const str = Math.min(3, Math.max(1, Math.round(speed * 0.35)));
  const wx  = Math.round((dvx / speed) * str);
  const wy  = Math.round((dvy / speed) * str);
  if (wx === 0 && wy === 0) return;

  const sizeIdx = window.__vivumSize ?? 2;
  const radius  = WIND_RADII[Math.max(0, Math.min(4, sizeIdx))];

  // Gather moveable particles inside the brush circle
  const particles = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= N || y < 0 || y >= N) continue;
      const idx = (y * N + x) * S;
      const sp  = cells[idx];
      if (WIND_FIXED.has(sp)) continue;
      particles.push({ x, y, sp, ra: cells[idx + 1], rb: cells[idx + 2] });
    }
  }

  // Process particles furthest in wind direction first → chain-displacement
  // without overwriting a source before it's been read.
  particles.sort((a, b) => (b.x * wx + b.y * wy) - (a.x * wx + a.y * wy));

  for (const { x, y, sp, ra, rb } of particles) {
    const nx  = Math.max(0, Math.min(N - 1, x + wx));
    const ny  = Math.max(0, Math.min(N - 1, y + wy));
    const si  = (y  * N + x)  * S;
    const di  = (ny * N + nx) * S;
    if (cells[di] === 0) {            // destination empty — move
      cells[di] = sp;  cells[di + 1] = ra;  cells[di + 2] = rb;
      cells[si] = 0;   cells[si + 1] = 0;   cells[si + 2] = 0;
    }
    // if occupied — leave particle in place (no deletion)
  }
}

// ── Watch for vivum's universe ───────────
const universeWatcher = setInterval(() => {
  if (window.u) {
    window.__vivumUniverse = window.u;
    clearInterval(universeWatcher);

    // Force unpause — engine sometimes starts paused internally
    window.paused = false;
    if (window.UI && typeof window.UI.setState === 'function') {
      window.UI.setState({ paused: false });
    }

    const sbDim = document.getElementById('sb-dim');
    if (sbDim) sbDim.textContent = '300 × 300';

    // Start ambient wind now that the simulation is live
    startAmbient();

    // Wire draw sounds + wind tool to canvas mouse events
    const canvas = document.getElementById('sand-canvas');
    if (canvas) {
      let drawing = false;

      // Prefer our own element tracker; fall back to vivum state
      function getSelectedElement() {
        if (window.__vivumElem !== undefined) return window.__vivumElem;
        if (window.UI && window.UI.state) return window.UI.state.selectedElement;
        return 0;
      }

      // Wind tracking state
      let _windLastX = 0, _windLastY = 0, _windLastT = 0;

      canvas.addEventListener('mousedown', e => {
        drawing = true;
        _windLastX = e.clientX;
        _windLastY = e.clientY;
        _windLastT = performance.now();
        playDrawSound(getSelectedElement());
      });
      document.addEventListener('mouseup', () => { drawing = false; });

      // Coarse throttle: gate to ~20 calls/sec before hitting sounds.js.
      let _lastMoveSound = 0;
      canvas.addEventListener('mousemove', e => {
        if (!drawing) return;
        const now = performance.now();
        const sel = getSelectedElement();

        if (sel === WIND_ID) {
          // Wind: apply physics on every frame (~60 fps)
          const dt = now - _windLastT;
          if (dt >= 14 && _windLastT > 0) {
            const vx = (e.clientX - _windLastX) / dt * 16;
            const vy = (e.clientY - _windLastY) / dt * 16;
            applyWind(canvas, e.clientX, e.clientY, vx, vy);
            if (now - _lastMoveSound > 80) {
              _lastMoveSound = now;
              playDrawSound(WIND_ID);
            }
          }
          _windLastX = e.clientX;
          _windLastY = e.clientY;
          _windLastT = now;
          return;
        }

        // All other elements: throttled sound only
        if (now - _lastMoveSound < 50) return;
        _lastMoveSound = now;
        playDrawSound(sel);
      });
    }
  }
}, 200);

// ── Re-parent canvases into #canvas-area ─────
// xp-override.css enforces all canvas styles via !important — no need for
// a MutationObserver. Just move the canvases once; CSS handles the rest.
function reparentCanvases() {
  const area  = document.getElementById('canvas-area');
  const sand  = document.getElementById('sand-canvas');
  const fluid = document.getElementById('fluid-canvas');
  if (!area || !sand) return;

  if (sand.parentElement  !== area) area.appendChild(sand);
  if (fluid && fluid.parentElement !== area) area.appendChild(fluid);

  const fps = document.getElementById('fps');
  if (fps && fps.parentElement !== area) area.appendChild(fps);
}

setTimeout(reparentCanvases, 400);
setTimeout(reparentCanvases, 2000);

// Watch body for vivum injecting canvases, then disconnect once stable.
const bodyObserver = new MutationObserver(reparentCanvases);
bodyObserver.observe(document.body, { childList: true });
setTimeout(() => bodyObserver.disconnect(), 8000);


// ── Disable right-click context menu ─────────
document.addEventListener('contextmenu', e => e.preventDefault());

// ══════════════════════════════════════════════
//  🖱️  ICON SYSTEM — drag, multi-select, rubber-band
// ══════════════════════════════════════════════
(function () {
  const desktop = document.getElementById('desktop');

  // ── Grid ──────────────────────────────────────
  const GX = 8, GY = 8, GW = 80, GH = 88;

  function toCell(px, py)    { return { col: Math.round((px - GX) / GW), row: Math.round((py - GY) / GH) }; }
  function fromCell(col, row) { return { x: GX + col * GW, y: GY + row * GH }; }

  // ── Saved positions ───────────────────────────
  const DEFAULTS = {
    'icon-vivum':   { x: 8, y:   8 },
    'icon-recycle': { x: 8, y:  96 },
    'icon-save':    { x: 8, y: 184 },
    'icon-presets': { x: 8, y: 272 },
  };
  const STORE_KEY = 'vivum-icon-pos-v2';

  function loadPos() {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); }
    catch { return Object.assign({}, DEFAULTS); }
  }
  function savePos(p) { try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch {} }

  const pos = loadPos();

  function applyPos() {
    document.querySelectorAll('.desk-icon').forEach(el => {
      const p = pos[el.id] || DEFAULTS[el.id] || { x: GX, y: GY };
      el.style.left = p.x + 'px';
      el.style.top  = p.y + 'px';
    });
  }
  applyPos();

  // ── Selection helpers ─────────────────────────
  function visibleIcons() {
    return [...document.querySelectorAll('.desk-icon')].filter(
      el => !el.classList.contains('hidden-until-open') || el.classList.contains('revealed')
    );
  }
  function getSelected() { return [...document.querySelectorAll('.desk-icon.sel-selected')]; }
  function deselectAll() { document.querySelectorAll('.desk-icon').forEach(i => i.classList.remove('sel-selected')); }

  document.addEventListener('keydown', e => {
    if (e.key === 'a' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); visibleIcons().forEach(i => i.classList.add('sel-selected')); }
    if (e.key === 'Escape') deselectAll();
  });

  // ── Nearest free cell — spiral BFS ───────────
  function findFreeCell(col, row, blocked, maxCol, maxRow) {
    for (let r = 0; r <= 30; r++) {
      for (let dr = -r; dr <= r; dr++) {
        for (let dc = -r; dc <= r; dc++) {
          if (Math.abs(dr) !== r && Math.abs(dc) !== r) continue;
          const c = col + dc, rr = row + dr;
          if (c < 0 || rr < 0 || c > maxCol || rr > maxRow) continue;
          if (!blocked.has(c + ',' + rr)) return { col: c, row: rr };
        }
      }
    }
    return { col, row };
  }

  // ── Drag state ────────────────────────────────
  let dragActive = false, dragMoved = false;
  // each item: { el, startX, startY, savedPos }
  // savedPos = grid-snapped position before drag (used to restore on collision)
  let dragItems = [];
  let mx0 = 0, my0 = 0;

  document.querySelectorAll('.desk-icon').forEach(icon => {
    icon.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();

      // Unselected → clear group, select only this
      if (!icon.classList.contains('sel-selected')) {
        deselectAll();
        icon.classList.add('sel-selected');
      }
      // Already selected → keep full group (multi-drag)

      const dr = desktop.getBoundingClientRect();
      dragItems = getSelected().map(el => {
        const r  = el.getBoundingClientRect();
        const sx = r.left - dr.left;
        const sy = r.top  - dr.top;
        // savedPos is the current snapped grid position for this icon
        const sp = pos[el.id] || DEFAULTS[el.id] || { x: sx, y: sy };
        return { el, startX: sx, startY: sy, savedPos: { x: sp.x, y: sp.y } };
      });

      dragActive = true;
      dragMoved  = false;
      mx0 = e.clientX;
      my0 = e.clientY;
    });
  });

  document.addEventListener('mousemove', e => {
    if (!dragActive) return;
    const dx = e.clientX - mx0, dy = e.clientY - my0;

    if (!dragMoved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      dragMoved = true;
      document.body.classList.add('xp-dragging');
      dragItems.forEach(({ el }) => { el.style.zIndex = '70'; el.style.opacity = '0.65'; });
    }
    if (!dragMoved) return;

    dragItems.forEach(({ el, startX, startY }) => {
      el.style.left = (startX + dx) + 'px';
      el.style.top  = (startY + dy) + 'px';
    });
  });

  document.addEventListener('mouseup', e => {
    if (!dragActive) return;
    dragActive = false;
    document.body.classList.remove('xp-dragging');

    if (!dragMoved) {
      dragItems.forEach(({ el }) => { el.style.zIndex = ''; el.style.opacity = ''; });
      return;
    }

    const dr     = desktop.getBoundingClientRect();
    const dx     = e.clientX - mx0, dy = e.clientY - my0;
    const maxCol = Math.max(0, Math.floor((dr.width  - GX - 74) / GW));
    const maxRow = Math.max(0, Math.floor((dr.height - GY - 42 - 84) / GH));

    // Cells occupied by icons NOT being dragged
    const draggingIds = new Set(dragItems.map(i => i.el.id));
    const blocked = new Set();
    document.querySelectorAll('.desk-icon').forEach(el => {
      if (draggingIds.has(el.id)) return;
      const p = pos[el.id] || DEFAULTS[el.id];
      if (p) { const c = toCell(p.x, p.y); blocked.add(c.col + ',' + c.row); }
    });

    const isGroup  = dragItems.length > 1;
    const assigned = new Set(blocked); // grows as we assign cells to group members

    dragItems.forEach(({ el, startX, startY, savedPos }) => {
      const rawX    = Math.max(GX, Math.min(GX + maxCol * GW, startX + dx));
      const rawY    = Math.max(GY, Math.min(GY + maxRow * GH, startY + dy));
      const pref    = toCell(rawX, rawY);
      const col     = Math.max(0, Math.min(maxCol, pref.col));
      const row     = Math.max(0, Math.min(maxRow, pref.row));
      const cellKey = col + ',' + row;

      let final;
      if (assigned.has(cellKey)) {
        // Cell is taken
        if (isGroup) {
          // Group: place in nearest free cell instead
          const free = findFreeCell(col, row, assigned, maxCol, maxRow);
          assigned.add(free.col + ',' + free.row);
          final = fromCell(free.col, free.row);
        } else {
          // Single icon: snap back to where it started
          final = { x: savedPos.x, y: savedPos.y };
        }
      } else {
        // Cell is free — place here
        assigned.add(cellKey);
        final = fromCell(col, row);
      }

      pos[el.id]       = final;
      el.style.left    = final.x + 'px';
      el.style.top     = final.y + 'px';
      el.style.zIndex  = '';
      el.style.opacity = '';
    });

    savePos(pos);
  });

  // ── Rubber-band selection ─────────────────────
  const selBox = document.createElement('div');
  selBox.id = 'sel-box';
  selBox.style.display = 'none';
  desktop.appendChild(selBox);

  let selActive = false;
  let selOrigin = { x: 0, y: 0 };

  const IGNORE = '.desk-icon, #xp-window, #presets-window, #taskbar, ' +
                 '#start-menu, #vol-popup, #net-popup, #xp-dialog, #boot-screen';

  // Mousedown on EMPTY desktop: start rubber-band, clear previous selection.
  // Note: this is the ONLY place deselectAll() is called for "click on desktop"
  // behaviour. There is no separate 'click' handler — a plain desktop click still
  // reaches this mousedown and clears the selection immediately, then rubber-band
  // ends with a zero-size box selecting nothing. This avoids any race condition
  // where 'click' fired AFTER rubber-band mouseup would erase the fresh selection.
  desktop.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest(IGNORE)) return;
    selActive = true;
    selOrigin = { x: e.clientX, y: e.clientY };
    Object.assign(selBox.style, {
      left: e.clientX + 'px', top: e.clientY + 'px',
      width: '0', height: '0', display: 'block',
    });
    deselectAll();
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!selActive) return;
    const x1 = Math.min(selOrigin.x, e.clientX), y1 = Math.min(selOrigin.y, e.clientY);
    const x2 = Math.max(selOrigin.x, e.clientX), y2 = Math.max(selOrigin.y, e.clientY);
    Object.assign(selBox.style, {
      left: x1 + 'px', top: y1 + 'px',
      width: (x2 - x1) + 'px', height: (y2 - y1) + 'px',
    });
    document.querySelectorAll('.desk-icon').forEach(icon => {
      const r = icon.getBoundingClientRect();
      icon.classList.toggle('sel-selected',
        r.left < x2 && r.right > x1 && r.top < y2 && r.bottom > y1);
    });
  });

  document.addEventListener('mouseup', () => {
    if (!selActive) return;
    selActive = false;
    selBox.style.display = 'none';
    // Selection stays as-is — user can now grab any selected icon to drag the group.
  });
  // No desktop 'click' handler — it would fire right after rubber-band mouseup
  // and wipe the selection before the user can start dragging the group.
})();

// ══════════════════════════════════════════════
//  START MENU
// ══════════════════════════════════════════════
const startMenu = document.getElementById('start-menu');

// ── Editable username ─────────────────────────
(function () {
  const el = document.getElementById('sm-username');
  const KEY = 'vivum-username';

  // Load saved name
  const saved = localStorage.getItem(KEY);
  if (saved) el.textContent = saved;

  el.setAttribute('contenteditable', 'true');
  el.setAttribute('spellcheck', 'false');

  el.addEventListener('focus', () => {
    // Select all text when focused so user can type immediately
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  });

  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      el.blur();
      return;
    }
    // Block any key that would exceed 30 chars (allow nav/delete keys through)
    const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'];
    if (!allowed.includes(e.key) && !e.ctrlKey && !e.metaKey) {
      if (el.textContent.length >= 30) e.preventDefault();
    }
  });

  el.addEventListener('input', () => {
    if (el.textContent.length > 30) {
      el.textContent = el.textContent.slice(0, 30);
      // Restore cursor to end
      const range = document.createRange();
      const sel   = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });

  el.addEventListener('blur', () => {
    // Trim and validate; restore previous if empty
    const name = el.textContent.trim().slice(0, 30);
    if (!name) {
      el.textContent = localStorage.getItem(KEY) || 'user';
    } else {
      el.textContent = name;
      localStorage.setItem(KEY, name);
    }
    window.getSelection().removeAllRanges();
  });

  // Stop click from closing start menu
  el.addEventListener('click', e => e.stopPropagation());
  el.addEventListener('mousedown', e => e.stopPropagation());
})();
const startBtn  = document.getElementById('start-btn');

let smOpen = false;

function openStartMenu() {
  smOpen = true;
  startBtn.classList.add('sm-open');
  startMenu.style.display = '';
  startMenu.style.transition = 'none';
  startMenu.style.opacity   = '0';
  startMenu.style.transform = 'translateY(12px) scale(0.97)';
  startMenu.getBoundingClientRect();
  startMenu.style.transition = 'opacity 160ms ease, transform 160ms cubic-bezier(.2,.8,.4,1)';
  startMenu.style.opacity   = '1';
  startMenu.style.transform = '';
}

function closeStartMenu() {
  if (!smOpen) return;
  smOpen = false;
  startBtn.classList.remove('sm-open');
  startMenu.style.transition = 'opacity 120ms ease, transform 120ms ease';
  startMenu.style.opacity   = '0';
  startMenu.style.transform = 'translateY(8px) scale(0.97)';
  setTimeout(() => {
    startMenu.style.display    = 'none';
    startMenu.style.transition = '';
    startMenu.style.opacity    = '';
    startMenu.style.transform  = '';
  }, 120);
}

startBtn.addEventListener('click', e => {
  e.stopPropagation();
  playClick();
  closeAllTrayPopups();
  smOpen ? closeStartMenu() : openStartMenu();
});

// Close on outside click
document.addEventListener('click', () => {
  closeStartMenu();
});
startMenu.addEventListener('click', e => e.stopPropagation());

// ── Start menu item actions ───────────────────
startMenu.querySelectorAll('[data-sm-action]').forEach(el => {
  el.addEventListener('click', () => {
    playClick();
    const act = el.dataset.smAction;
    closeStartMenu();
    if (act === 'open-vivum') {
      if (xpWin.dataset.everOpened && xpWin.style.display === 'none') {
        const tb = document.getElementById('task-vivum');
        tb.style.display = '';
        tb.classList.add('active');
        playWindowOpen();
        animRestore(xpWin);
      }
    } else if (act === 'open-presets') {
      openPresets();
    } else if (act === 'quicksave') {
      document.getElementById('icon-save').click();
    } else if (act === 'recycle') {
      document.getElementById('icon-recycle').dispatchEvent(new MouseEvent('dblclick'));
    } else if (act === 'github') {
      window.open('https://github.com/Joehawkk', '_blank');
    } else if (act === 'about') {
      xpConfirm('vivum — sand simulation.\nBuilt by Joehawkk', {
        title: 'About vivum', icon: '🏖', titleIcon: '🏖'
      });
    }
  });
});

// Shutdown button
document.getElementById('sm-shutdown').addEventListener('click', async () => {
  closeStartMenu();
  const ok = await xpConfirm('Shut down Windows XD?', { icon: '⏻', titleIcon: '⏻' });
  if (!ok) return;
  await animHide(xpWin, { dur: 200, toScale: 0.94, toOpacity: 0 });
  const tb = document.getElementById('task-vivum');
  tb.classList.remove('active');
  tb.style.display = 'none';
  delete xpWin.dataset.everOpened;
});


// ══════════════════════════════════════════════
//  SYSTEM TRAY POPUPS
// ══════════════════════════════════════════════
const volPopup = document.getElementById('vol-popup');
const netPopup = document.getElementById('net-popup');

function closeAllTrayPopups() {
  [volPopup, netPopup].forEach(p => {
    if (p.style.display !== 'none') hideTrayPopup(p);
  });
}

function showTrayPopup(el) {
  closeAllTrayPopups();
  closeStartMenu();
  el.style.display = '';
  el.style.transition = 'none';
  el.style.opacity   = '0';
  el.style.transform = 'translateY(6px)';
  el.getBoundingClientRect();
  el.style.transition = 'opacity 140ms ease, transform 140ms ease';
  el.style.opacity   = '1';
  el.style.transform = '';
}

function hideTrayPopup(el) {
  el.style.transition = 'opacity 100ms ease, transform 100ms ease';
  el.style.opacity    = '0';
  el.style.transform  = 'translateY(4px)';
  setTimeout(() => {
    el.style.display    = 'none';
    el.style.opacity    = '';
    el.style.transform  = '';
    el.style.transition = '';
  }, 100);
}

// Close tray popups on outside click
document.addEventListener('click', () => closeAllTrayPopups());
volPopup.addEventListener('click', e => e.stopPropagation());
netPopup.addEventListener('click', e => e.stopPropagation());

// Volume icon
let volume = 100;
const volIcon  = document.querySelector('.tray-icon[title="Volume"]');
const volFill  = document.getElementById('vol-fill');
const volThumb = document.getElementById('vol-thumb');
const volLabel = document.getElementById('vol-label');
const volTrack = document.getElementById('vol-track');

let _volTestTimer = null;

function setVolume(v) {
  volume = Math.max(0, Math.min(100, v));
  volFill.style.width  = volume + '%';
  volThumb.style.right = (100 - volume) + '%';
  volLabel.textContent = volume + '%';
  volIcon.textContent  = volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊';
  setMasterVolume(volume / 100);

  // Play a soft test chord ~350 ms after the user stops moving the slider
  // so they hear exactly what the chosen level sounds like.
  clearTimeout(_volTestTimer);
  if (volume > 0) {
    _volTestTimer = setTimeout(playVolumeTest, 350);
  }
}
setVolume(100);

volIcon.addEventListener('click', e => {
  e.stopPropagation();
  volPopup.style.display === 'none' ? showTrayPopup(volPopup) : hideTrayPopup(volPopup);
});

// Drag volume slider
let draggingVol = false;
volTrack.addEventListener('mousedown', e => {
  draggingVol = true;
  e.stopPropagation();
  const update = ev => {
    const r = volTrack.getBoundingClientRect();
    setVolume(Math.round(((ev.clientX - r.left) / r.width) * 100));
  };
  update(e);
  const up = () => { draggingVol = false; document.removeEventListener('mousemove', update); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', update);
  document.addEventListener('mouseup', up);
});

// Network icon
const netIcon = document.querySelector('.tray-icon[title="Network"]');
netIcon.addEventListener('click', e => {
  e.stopPropagation();
  netPopup.style.display === 'none' ? showTrayPopup(netPopup) : hideTrayPopup(netPopup);
});

