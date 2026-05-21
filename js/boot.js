// ─────────────────────────────────────────────
//  VIVUM — Boot sequence
import { playStartup, playWindowOpen, playBootSwell } from './sounds.js';
//  1. XP splash screen (~4 s)
//  2. Fades out → desktop with only vivum icon
//  3. Icon pulses → user double-clicks
//  4. Window slides in, other icons stagger in
// ─────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runBoot() {
  const screen = document.getElementById('boot-screen');
  const icon   = document.getElementById('icon-vivum');

  // Звук появления экрана загрузки
  playBootSwell();

  // Boot screen is visible by default; progress bar runs via CSS.
  // Click anywhere to skip
  let skipped = false;
  const skipBoot = () => { skipped = true; };
  screen.addEventListener('click', skipBoot, { once: true });

  const BOOT_MS = 2500;
  const step = 50;
  for (let t = 0; t < BOOT_MS; t += step) {
    if (skipped) break;
    await sleep(step);
  }

  // Fade out boot screen + play XP startup sound
  screen.classList.add('fade-out');
  playStartup();
  await sleep(1700); // чуть больше CSS transition (1.6s) — даём ей полностью завершиться
  screen.style.display = 'none';

  // Vivum icon pulses — hint to double-click
  icon.style.animation = 'icon-pulse 2s ease-in-out infinite';

  // Wait for the user's double-click
  icon.addEventListener('dblclick', openGame, { once: true });
}

function openGame() {
  const win    = document.getElementById('xp-window');
  const icon   = document.getElementById('icon-vivum');
  const hidden = document.querySelectorAll('.hidden-until-open');

  icon.style.animation = '';

  // Mark so vivum-chrome.js knows it can toggle
  win.dataset.everOpened = '1';

  // Slide + fade in from slightly below
  win.style.display    = '';
  win.style.opacity    = '0';
  win.style.transform  = 'scale(0.94) translateY(18px)';
  win.style.transition = 'none';
  win.getBoundingClientRect(); // force reflow
  win.style.transition = 'opacity 260ms cubic-bezier(.2,.8,.4,1), transform 260ms cubic-bezier(.2,.8,.4,1)';
  win.style.opacity    = '1';
  win.style.transform  = '';
  playWindowOpen();
  setTimeout(() => {
    win.style.transition = '';
    win.style.opacity    = '';
    win.style.transform  = '';
  }, 280);

  // Show and mark taskbar button active
  const taskBtn = document.getElementById('task-vivum');
  taskBtn.style.display = '';
  taskBtn.classList.add('active');

  // Stagger-reveal the other desktop icons
  let delay = 220;
  hidden.forEach(el => {
    setTimeout(() => el.classList.add('revealed'), delay);
    delay += 110;
  });
}

// Inject pulse keyframes
const s = document.createElement('style');
s.textContent = `
  @keyframes icon-pulse {
    0%, 100% { filter: drop-shadow(0 0 0px rgba(255,255,255,0)); }
    50%       { filter: drop-shadow(0 0 9px rgba(255,255,255,0.75)); }
  }
`;
document.head.appendChild(s);

runBoot();
