// ─────────────────────────────────────────────
//  VIVUM — XP-styled element toolbar
//  Waits for vivum's React window.UI, then
//  builds a proper Windows XP element picker.
// ─────────────────────────────────────────────

// Element definitions — IDs match vivum's Species enum
const ELEMENTS = [
  { id: 2,  name: 'Sand',   color: '#dcb159' },
  { id: 3,  name: 'Water',  color: '#2389da' },
  { id: 6,  name: 'Fire',   color: '#ff4500' },
  { id: 8,  name: 'Lava',   color: '#e2470d' },
  { id: 9,  name: 'Ice',    color: '#add8e6' },
  { id: 7,  name: 'Wood',   color: '#804618' },
  { id: 11, name: 'Vine',    color: '#007d27' },
  { id: 16, name: 'Oil',    color: '#2a200e' },
  { id: 19, name: 'Seed',   color: '#8db828' },
  { id: 18, name: 'Mold',   color: '#9b009b' },
  { id: 4,  name: 'Gas',    color: '#9090c8' },
  { id: 13, name: 'Stone',  color: '#808088' },
  { id: 1,  name: 'Brick',  color: '#9ba2b2' },
  { id: 14, name: 'Dust',   color: '#d9a060' },
  { id: 15, name: 'Termite',color: '#f5e8a8' },
  { id: 12, name: 'Acid',   color: '#22ff44' },
  { id: 17, name: 'Rocket', color: '#c0c0c8' },
  { id: 5,  name: 'Spawner',color: '#ee00ee' },
  { id: 0,  name: 'Eraser', color: '#555555' },
];

// Visual dot radii — must fit inside the 26px button height (max dot = 24px)
const SIZES = [
  { idx: 0, r: 4,  title: 'Tiny  (1px)'  },
  { idx: 1, r: 6,  title: 'Small (3px)'  },
  { idx: 2, r: 8,  title: 'Med   (7px)'  },
  { idx: 3, r: 10, title: 'Large (19px)' },
  { idx: 4, r: 12, title: 'XL    (39px)' },
];

let currentElem = 2;   // start on Sand
let currentSize = 2;   // start on Medium

// ── Build the toolbar ─────────────────────────
function buildUI() {
  const container = document.getElementById('vivum-ui');
  if (!container || container.dataset.built) return;
  container.dataset.built = '1';

  // ── Element row ─────────────────────────────
  const elemRow = document.createElement('div');
  elemRow.className = 'vui-elem-row';

  ELEMENTS.forEach(el => {
    const btn = document.createElement('button');
    btn.className = 'vui-elem-btn';
    btn.title     = el.name;
    btn.dataset.eid = el.id;
    if (el.id === currentElem) btn.classList.add('selected');

    const sw = document.createElement('span');
    sw.className = 'vui-swatch';
    sw.style.background = el.color;

    // Mite swatch: dark border so it's visible on light bg
    if (el.id === 15) sw.style.borderColor = '#b0a898';

    const lbl = document.createElement('span');
    lbl.textContent = el.name;

    btn.appendChild(sw);
    btn.appendChild(lbl);
    btn.addEventListener('click', () => pickElem(el.id));
    elemRow.appendChild(btn);
  });

  // ── Control row ──────────────────────────────
  const ctrlRow = document.createElement('div');
  ctrlRow.className = 'vui-ctrl-row';

  const sizeLabel = document.createElement('span');
  sizeLabel.className = 'vui-size-label';
  sizeLabel.textContent = 'Brush:';
  ctrlRow.appendChild(sizeLabel);

  SIZES.forEach(sz => {
    const btn = document.createElement('button');
    btn.className  = 'vui-size-btn';
    btn.title      = sz.title;
    btn.dataset.sidx = sz.idx;
    if (sz.idx === currentSize) btn.classList.add('selected');

    const dot = document.createElement('span');
    dot.className = 'vui-dot';
    dot.style.width  = sz.r * 2 + 'px';
    dot.style.height = sz.r * 2 + 'px';
    btn.appendChild(dot);

    btn.addEventListener('click', () => pickSize(sz.idx));
    ctrlRow.appendChild(btn);
  });

  // Separator
  const sep = document.createElement('span');
  sep.className = 'vui-sep';
  ctrlRow.appendChild(sep);

  // Pause / Play
  const pauseBtn = document.createElement('button');
  pauseBtn.className = 'vui-action-btn';
  pauseBtn.id    = 'vui-pause';
  pauseBtn.title = 'Pause / Resume';
  pauseBtn.textContent = '⏸';
  pauseBtn.addEventListener('click', () => {
    window.__vivumUserPaused = !window.__vivumUserPaused;
    window.paused = window.__vivumUserPaused;
    pauseBtn.textContent = window.__vivumUserPaused ? '▶' : '⏸';
    pauseBtn.classList.toggle('selected', !!window.__vivumUserPaused);
    const sb = document.getElementById('sb-status');
    if (sb) sb.textContent = window.__vivumUserPaused ? 'Paused' : 'Ready';
  });
  ctrlRow.appendChild(pauseBtn);

  // Undo
  const undoBtn = document.createElement('button');
  undoBtn.className = 'vui-action-btn';
  undoBtn.title = 'Undo';
  undoBtn.textContent = '↩';
  undoBtn.addEventListener('click', () => {
    if (window.__vivumUniverse && window.__vivumUniverse.pop_undo) {
      window.__vivumUniverse.pop_undo();
    }
  });
  ctrlRow.appendChild(undoBtn);

  container.appendChild(elemRow);
  container.appendChild(ctrlRow);

  // Suppress React's raw #ui output
  suppressReactUI();
}

function suppressReactUI() {
  const ui = document.getElementById('ui');
  if (!ui) return;
  ui.style.cssText = [
    'display:none',
    'width:0',
    'height:0',
    'overflow:hidden',
    'position:absolute',
    'pointer-events:none',
  ].join(';');

  // Keep suppressed even if React re-renders into it
  const obs = new MutationObserver(() => {
    if (ui.style.display !== 'none') {
      ui.style.display = 'none';
    }
  });
  obs.observe(ui, { attributes: true, attributeFilter: ['style'] });
}

// ── Element / size pickers ────────────────────
const WIND_ID = 20;
let _sizeBeforeWind = null; // remembers size so we can restore it

function pickElem(id) {
  currentElem         = id;
  window.__vivumElem  = id;   // shared with vivum-chrome.js

  if (window.UI && typeof window.UI.setState === 'function') {
    if (id === WIND_ID) {
      // Wind is virtual — tell vivum: paint Empty with Tiny brush
      // (1-cell erase at cursor, negligible).  Prevents unknown-species crash.
      _sizeBeforeWind = window.UI.state?.size ?? currentSize;
      window.UI.setState({ selectedElement: 0, size: 0 });
    } else {
      // Switching away from Wind: restore real size
      const restoreSize = _sizeBeforeWind ?? currentSize;
      _sizeBeforeWind   = null;
      window.UI.setState({ selectedElement: id, size: restoreSize });
    }
  }

  document.querySelectorAll('.vui-elem-btn').forEach(b => {
    b.classList.toggle('selected', parseInt(b.dataset.eid) === id);
  });
  const sb = document.getElementById('sb-status');
  const el = ELEMENTS.find(e => e.id === id);
  if (sb && el) sb.textContent = el.name;
}

function pickSize(idx) {
  currentSize          = idx;
  window.__vivumSize   = idx;  // shared with vivum-chrome.js

  if (window.UI && typeof window.UI.setState === 'function') {
    if (currentElem === WIND_ID) {
      // Wind active — don't touch vivum's size (keep it at 0/Tiny)
    } else {
      window.UI.setState({ size: idx });
    }
  }
  document.querySelectorAll('.vui-size-btn').forEach(b => {
    b.classList.toggle('selected', parseInt(b.dataset.sidx) === idx);
  });
}

// ── Wait for React to mount ───────────────────
// Build the UI shell immediately (no setState calls yet),
// then sync state once React's component is ready.
buildUI();

const uiPoll = setInterval(() => {
  if (window.UI && typeof window.UI.setState === 'function') {
    clearInterval(uiPoll);
    window.UI.setState({ selectedElement: currentElem, size: currentSize });
  }
}, 150);
