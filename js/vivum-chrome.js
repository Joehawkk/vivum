// ─────────────────────────────────────────────
//  VIVUM — Chrome behaviour + smooth animations
// ─────────────────────────────────────────────
import { xpConfirm } from './dialog.js';
import {
  playWindowOpen, playWindowClose, playMinimize, playRestore,
  playDing, playClick, playNotify, playSave, playRecycle,
  setMasterVolume, startAmbient, playDrawSound, playVolumeTest,
  playXpError, playBSOD
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

  function startDrag(cx, cy) {
    const r = win.getBoundingClientRect();
    ox = cx - r.left; oy = cy - r.top;
    dragging = true;
    win.style.userSelect = 'none';
  }
  function moveDrag(cx, cy) {
    if (!dragging) return;
    const dr  = document.getElementById('desktop').getBoundingClientRect();
    const tbH = document.getElementById('taskbar')?.offsetHeight ?? 42;
    win.style.left = Math.max(0, Math.min(dr.width  - win.offsetWidth,  cx - ox)) + 'px';
    win.style.top  = Math.max(0, Math.min(dr.height - win.offsetHeight - tbH, cy - oy)) + 'px';
  }
  function endDrag() { dragging = false; win.style.userSelect = ''; }

  bar.addEventListener('mousedown', e => { if (!e.target.closest('.tbtn')) { startDrag(e.clientX, e.clientY); e.preventDefault(); } });
  document.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY));
  document.addEventListener('mouseup', endDrag);

  // Touch
  bar.addEventListener('touchstart', e => { if (!e.target.closest('.tbtn')) { const t = e.touches[0]; startDrag(t.clientX, t.clientY); e.preventDefault(); } }, { passive: false });
  document.addEventListener('touchmove', e => { if (dragging) { const t = e.touches[0]; moveDrag(t.clientX, t.clientY); e.preventDefault(); } }, { passive: false });
  document.addEventListener('touchend', endDrag);
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

// Показывает одиночное XP-окно ошибки (тот же стиль что cascade errors)
function showXpError(title, text) {
  const desktop = document.getElementById('desktop');
  const W = 360, H = 180;
  const left = Math.max(0, window.innerWidth  / 2 - W / 2);
  const top  = Math.max(0, window.innerHeight / 2 - H / 2);

  const win = document.createElement('div');
  win.className = 'xp-err-win';
  win.style.left   = left + 'px';
  win.style.top    = top  + 'px';
  win.style.zIndex = '9500';

  win.innerHTML = `
    <div class="xp-err-titlebar">
      <div class="xp-err-titlebar-left">
        <svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <polygon points="8,1 15,15 1,15" fill="#ffe400" stroke="#c88000" stroke-width="1"/>
          <text x="8" y="13.5" font-size="9" text-anchor="middle" fill="#000" font-weight="bold" font-family="Arial">!</text>
        </svg>
        <span>${title}</span>
      </div>
      <button class="tbtn tbtn-close xp-err-close-btn">✕</button>
    </div>
    <div class="xp-err-body">
      <svg class="xp-err-icon" width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="15" fill="#c00"/>
        <circle cx="16" cy="16" r="13" fill="#f33"/>
        <line x1="10" y1="10" x2="22" y2="22" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
        <line x1="22" y1="10" x2="10" y2="22" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      </svg>
      <span class="xp-err-msg">${text}</span>
    </div>
    <div class="xp-err-footer">
      <button class="xp-err-ok-btn">OK</button>
    </div>`;

  desktop.appendChild(win);

  // Drag
  const bar = win.querySelector('.xp-err-titlebar');
  let drag = false, ox = 0, oy = 0;
  bar.addEventListener('mousedown', e => {
    if (e.target.closest('.tbtn')) return;
    drag = true;
    const r = win.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!drag) return;
    win.style.left = (e.clientX - ox) + 'px';
    win.style.top  = (e.clientY - oy) + 'px';
  });
  document.addEventListener('mouseup', () => { drag = false; });

  win.querySelector('.xp-err-close-btn').addEventListener('click', () => win.remove());
  win.querySelector('.xp-err-ok-btn').addEventListener('click', () => win.remove());
}

// Maximize — show error
document.getElementById('btn-max').addEventListener('click', () => {
  playDing();
  showXpError(
    'vivum',
    'Невозможно развернуть окно.\n\nУвеличение разрешения дестабилизирует симуляцию частиц.\n\nОперация отменена.'
  );
});

// ── Double-tap helper for touch devices ──────────────
function onDoubleTap(el, fn) {
  let last = 0;
  el.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - last < 350) { e.preventDefault(); fn(); }
    last = now;
  });
}

// icon-vivum dblclick — boot.js handles the very first open via { once: true }.
// This handler covers: minimise/restore when open, AND re-open after close.
function iconVivumActivate() {
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
}
document.getElementById('icon-vivum').addEventListener('dblclick', iconVivumActivate);
onDoubleTap(document.getElementById('icon-vivum'), iconVivumActivate);

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

// ── Fluid Wind ────────────────────────────────
// ── Watch for vivum's universe ───────────
const universeWatcher = setInterval(() => {
  if (window.u) {
    window.__vivumUniverse = window.u;
    clearInterval(universeWatcher);

    // Force unpause — engine sometimes starts paused internally
    window.__vivumUserPaused = false;
    window.paused = false;
    if (window.UI && typeof window.UI.setState === 'function') {
      window.UI.setState({ paused: false });
    }

    // Throttle simulation to 60 TPS regardless of monitor refresh rate
    const TARGET_MS = 1000 / 60;
    let _lastTick = performance.now();
    function _throttle(now) {
      if (window.__vivumUserPaused) {
        window.paused = true;
      } else if (now - _lastTick >= TARGET_MS) {
        window.paused = false;
        _lastTick = now;
      } else {
        window.paused = true;
      }
      requestAnimationFrame(_throttle);
    }
    requestAnimationFrame(_throttle);

    const sbDim = document.getElementById('sb-dim');
    if (sbDim) {
      const c = document.getElementById('sand-canvas');
      if (c) sbDim.textContent = `${c.width} × ${c.height}`;
    }

    startAmbient();

    // ── Wire draw sounds ───────────────────────
    const canvas = document.getElementById('sand-canvas');
    if (canvas) {
      let drawing = false;

      function getSelectedElement() {
        if (window.__vivumElem !== undefined) return window.__vivumElem;
        if (window.UI && window.UI.state) return window.UI.state.selectedElement;
        return 0;
      }

      canvas.addEventListener('mousedown', e => {
        drawing = true;
        playDrawSound(getSelectedElement());
      });
      document.addEventListener('mouseup', () => { drawing = false; });

      let _lastMoveSound = 0;
      canvas.addEventListener('mousemove', e => {
        if (!drawing) return;
        const now = performance.now();
        if (now - _lastMoveSound < 50) return;
        _lastMoveSound = now;
        playDrawSound(getSelectedElement());
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
      xpConfirm('Vivum — sand simulation.\nBuilt by Joehawkk', {
        title: 'About Vivum', icon: '🏖', titleIcon: '🏖'
      });
    }
  });
});

// Shutdown button
const ERR_MESSAGES = [
  {
    title: 'vivum.exe — Ошибка приложения',
    text:  'Инструкция по адресу 0x00SAND4F обратилась к памяти\nпо адресу 0x00000000. Память не может быть «прочитана».\n\nЧастицы потеряны безвозвратно.',
  },
  {
    title: 'Windows XD — Критическая ошибка',
    text:  'vivum.exe заблокировал поток завершения работы.\n\nОперативная память заполнена песком на 99.8%.\n\nКод ошибки: 0x0000SAND',
  },
  {
    title: 'Ядро симуляции — Сбой',
    text:  'Обнаружена нестабильность частиц в ядре симуляции.\nvivum.exe удерживает 847 частиц и отказывается их\nотпускать. Выход из системы невозможен.\n\nКод: SAND_OVERFLOW',
  },
];

const BSOD_TRIGGER = 38;
let _errCount = 0;
let _lastWin = null;

function showBSOD() {
  // Убираем все окна с ошибками
  document.querySelectorAll('.xp-err-win').forEach(w => w.remove());

  const bsod = document.createElement('div');
  bsod.id = 'xp-bsod';
  bsod.innerHTML = `<pre id="xp-bsod-text">A problem has been detected and Windows has been shut down to prevent damage
to your computer.

VIVUM_SAND_OVERFLOW_ERROR

If this is the first time you've seen this Stop error screen,
restart your computer. If this screen appears again, follow
these steps:

Check to make sure any new hardware or software is properly installed.
If this is a new installation, ask your hardware or software manufacturer
for any Windows updates you might need.

If problems continue, disable or remove any newly installed hardware
or software. Disable BIOS memory options such as caching or shadowing.
If you need to use Safe Mode to remove or disable components, restart
your computer, press F8 to select Advanced Startup Options, and then
select Safe Mode.

Technical information:

*** STOP: 0x0000SAND (0x00000847, 0xC0000034, 0x00000000, 0x00000000)

*** vivum.exe - Address F8C2B01D base at F8C20000, DateStamp 4d672ec4

Beginning dump of physical memory
Physical memory dump complete.
Contact your system administrator or technical support group for further
assistance.</pre>`;

  document.body.appendChild(bsod);

  playBSOD();
  setTimeout(() => location.reload(), 5000);
}

function spawnNextError() {
  const desktop = document.getElementById('desktop');
  _errCount++;

  if (_errCount > BSOD_TRIGGER) {
    showBSOD();
    return;
  }

  const msg = ERR_MESSAGES[(_errCount - 1) % ERR_MESSAGES.length];

  // Позиция: случайная + небольшое диагональное смещение от предыдущего
  let left, top;
  const W = 385, H = 160;
  const maxL = Math.max(0, window.innerWidth  - W - 10);
  const maxT = Math.max(0, window.innerHeight - H - 50);
  if (_lastWin && Math.random() < 0.6) {
    // 60% — со смещением по диагонали
    const offX = (Math.random() * 40 + 16) * (Math.random() < 0.5 ? 1 : -1);
    const offY = (Math.random() * 30 + 12) * (Math.random() < 0.5 ? 1 : -1);
    left = Math.max(0, Math.min(maxL, (parseFloat(_lastWin.style.left) || 0) + offX));
    top  = Math.max(0, Math.min(maxT, (parseFloat(_lastWin.style.top)  || 0) + offY));
  } else {
    // 40% — полностью случайная позиция
    left = Math.random() * maxL;
    top  = Math.random() * maxT;
  }

  playXpError(_errCount - 1);

  const win = document.createElement('div');
  win.className = 'xp-err-win';
  win.style.left    = left + 'px';
  win.style.top     = top  + 'px';
  win.style.zIndex  = 500 + _errCount;
  _lastWin = win;

  win.innerHTML = `
    <div class="xp-err-titlebar">
      <div class="xp-err-titlebar-left">
        <svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <polygon points="8,1 15,15 1,15" fill="#ffe400" stroke="#c88000" stroke-width="1"/>
          <text x="8" y="13.5" font-size="9" text-anchor="middle" fill="#000" font-weight="bold" font-family="Arial">!</text>
        </svg>
        <span>${msg.title}</span>
      </div>
      <button class="tbtn tbtn-close xp-err-close-btn">✕</button>
    </div>
    <div class="xp-err-body">
      <svg class="xp-err-icon" width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="15" fill="#c00"/>
        <circle cx="16" cy="16" r="13" fill="#f33"/>
        <line x1="10" y1="10" x2="22" y2="22" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
        <line x1="22" y1="10" x2="10" y2="22" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      </svg>
      <span class="xp-err-msg">${msg.text}</span>
    </div>
    <div class="xp-err-footer">
      <button class="xp-err-ok-btn">OK</button>
    </div>`;

  desktop.appendChild(win);

  // Drag
  const bar = win.querySelector('.xp-err-titlebar');
  let drag = false, ox = 0, oy = 0;
  bar.addEventListener('mousedown', e => {
    if (e.target.closest('.tbtn')) return;
    drag = true;
    const r = win.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    win.style.zIndex = 700 + _errCount;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!drag) return;
    win.style.left = (e.clientX - ox) + 'px';
    win.style.top  = (e.clientY - oy) + 'px';
  });
  document.addEventListener('mouseup', () => { drag = false; });

  // X closes the window; OK does NOT — windows pile up like in the GIF
  win.querySelector('.xp-err-close-btn').addEventListener('click', () => win.remove());
  win.querySelector('.xp-err-ok-btn').addEventListener('click', () => {});
}

function spawnCascadeErrors() {
  _errCount = 0;
  _lastWin  = null;

  spawnNextError();
  const interval = setInterval(() => {
    if (_errCount >= BSOD_TRIGGER) {
      clearInterval(interval);
      showBSOD();
      return;
    }
    spawnNextError();
  }, 85);
}

document.getElementById('sm-shutdown').addEventListener('click', async () => {
  closeStartMenu();
  playDing();
  const ok = await xpConfirm('Shut down Windows XD?', { icon: '⏻', titleIcon: '⏻' });
  if (!ok) return;
  spawnCascadeErrors();
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

function setVolume(v, { save = false, test = false } = {}) {
  volume = Math.max(0, Math.min(100, v));
  volFill.style.width  = volume + '%';
  volThumb.style.right = (100 - volume) + '%';
  volLabel.textContent = volume + '%';
  volIcon.textContent  = volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊';
  setMasterVolume(volume / 100);

  if (save) {
    try { localStorage.setItem('vivum-volume', volume); } catch {}
  }

  if (test) {
    clearTimeout(_volTestTimer);
    if (volume > 0) _volTestTimer = setTimeout(playVolumeTest, 350);
  }
}

// Restore saved volume, fallback to 100
const _savedVol = (() => { try { const v = localStorage.getItem('vivum-volume'); return v !== null ? Number(v) : 100; } catch { return 100; } })();
setVolume(_savedVol);

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
    setVolume(Math.round(((ev.clientX - r.left) / r.width) * 100), { save: true, test: true });
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

