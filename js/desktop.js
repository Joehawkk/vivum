// ─────────────────────────────────────────────
//  VIVUM — Desktop manager
//  Icon selection, window dragging, z-index,
//  Recycle Bin, Quicksave, Presets window.
// ─────────────────────────────────────────────

// ── Public entry point ─────────────────────────
export function initDesktop({ sim, EL, SIM_W, SIM_H, presets }) {
  initIconSelection();
  initRecycleBin(sim);
  initQuicksave(sim);
  initPresetsWindow(sim, SIM_W, SIM_H, presets);
  makeDraggable(
    document.getElementById('xp-window'),
    document.getElementById('title-bar')
  );
  makeDraggable(
    document.getElementById('presets-window'),
    document.getElementById('presets-title-bar')
  );
  initWindowFocus();
}

// ── Icon selection ─────────────────────────────
// Single click = XP blue highlight.
// Click desktop background = deselect all.
function initIconSelection() {
  const icons = document.querySelectorAll('.desk-icon');
  icons.forEach(icon => {
    icon.addEventListener('click', e => {
      e.stopPropagation();
      icons.forEach(i => i.classList.remove('selected'));
      icon.classList.add('selected');
    });
  });
  document.getElementById('desktop').addEventListener('click', () => {
    icons.forEach(i => i.classList.remove('selected'));
  });
}

// ── Recycle Bin ────────────────────────────────
// Icon emoji swaps: empty (🗑️) when canvas is clear, full (🗑) when not.
// Double-click: confirm → clear canvas.
function initRecycleBin(sim) {
  const binImg = document.querySelector('#icon-recycle .desk-icon-img');

  setInterval(() => {
    binImg.textContent = sim.particleCount() > 0 ? '🗑' : '🗑️';
  }, 1000);

  document.getElementById('icon-recycle').addEventListener('dblclick', () => {
    if (confirm('Empty Recycle Bin?\nThis will clear the canvas.')) sim.clear();
  });
}

// ── Quicksave ──────────────────────────────────
// localStorage key: 'vivum-save'
// Double-click:
//   • No save → save immediately
//   • Save exists → confirm: OK = Load, Cancel = Save over
// Label shows "Quicksave ●" when a save exists.
function initQuicksave(sim) {
  const icon  = document.getElementById('icon-save');
  const label = icon.querySelector('.desk-icon-label');
  const KEY   = 'vivum-save';

  function refreshLabel() {
    label.textContent = localStorage.getItem(KEY) ? 'Quicksave ●' : 'Quicksave';
  }
  refreshLabel();

  icon.addEventListener('dblclick', () => {
    const hasSave = !!localStorage.getItem(KEY);
    if (!hasSave) {
      localStorage.setItem(KEY, JSON.stringify(Array.from(sim.buf)));
      refreshLabel();
    } else {
      // OK = Load,  Cancel = Save over
      if (confirm('A save already exists.\n\nOK → Load saved state\nCancel → Overwrite with current')) {
        const data = JSON.parse(localStorage.getItem(KEY));
        sim.buf.set(new Uint8Array(data));
      } else {
        localStorage.setItem(KEY, JSON.stringify(Array.from(sim.buf)));
        refreshLabel();
      }
    }
  });
}

// ── Presets window ─────────────────────────────
// Opens via Presets icon double-click.
// Closes via × button.
// Preset card double-click: close window + load scene.
function initPresetsWindow(sim, SIM_W, SIM_H, presets) {
  const win = document.getElementById('presets-window');

  document.getElementById('icon-presets').addEventListener('dblclick', () => {
    win.style.display = '';
    bringToFront(win);
  });

  document.getElementById('presets-close').addEventListener('click', () => {
    win.style.display = 'none';
  });

  document.querySelectorAll('.preset-card').forEach(card => {
    card.addEventListener('dblclick', async () => {
      const name = card.dataset.preset;
      win.style.display = 'none';
      if (presets[name]) await presets[name](sim, SIM_W, SIM_H);
    });
  });
}

// ── Z-index / window focus ─────────────────────
let topZ = 110;

function bringToFront(el) {
  el.style.zIndex = ++topZ;
}

function initWindowFocus() {
  ['xp-window', 'presets-window'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('mousedown', () => bringToFront(el), true);
  });
}

// ── Window dragging ────────────────────────────
// Drag by title bar.  Detaches from CSS layout on first drag
// (removes right/bottom constraints) so the window can move freely.
// Touch support included.
function makeDraggable(win, handle) {
  if (!win || !handle) return;

  let dragging = false, offX = 0, offY = 0;

  function startDrag(cx, cy) {
    dragging = true;
    handle.style.cursor = 'grabbing';
    const r = win.getBoundingClientRect();
    offX = cx - r.left;
    offY = cy - r.top;
    // Switch from CSS layout (right/bottom) to absolute position (left/top)
    win.style.right  = 'auto';
    win.style.bottom = 'auto';
    win.style.left   = r.left + 'px';
    win.style.top    = r.top  + 'px';
    bringToFront(win);
  }

  function moveDrag(cx, cy) {
    if (!dragging) return;
    const x = Math.max(0, Math.min(window.innerWidth  - 120, cx - offX));
    const y = Math.max(0, Math.min(window.innerHeight -  40, cy - offY));
    win.style.left = x + 'px';
    win.style.top  = y + 'px';
  }

  function stopDrag() {
    if (!dragging) return;
    dragging = false;
    handle.style.cursor = 'grab';
  }

  handle.style.cursor = 'grab';

  // Mouse
  handle.addEventListener('mousedown', e => {
    if (e.target.classList.contains('tbtn')) return;
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY));
  document.addEventListener('mouseup',   stopDrag);

  // Touch
  handle.addEventListener('touchstart', e => {
    if (e.cancelable) e.preventDefault();
    startDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  document.addEventListener('touchmove', e => {
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  document.addEventListener('touchend', stopDrag);
}
