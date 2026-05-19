// ─────────────────────────────────────────────
//  VIVUM — XP-style confirm dialog
//  Usage: await xpConfirm('Message text')
//  Returns true (OK) or false (Cancel / close)
// ─────────────────────────────────────────────

export function xpConfirm(message, { title = 'vivum', icon = '❓', titleIcon = '⚠️' } = {}) {
  return new Promise(resolve => {
    const overlay  = document.getElementById('xp-dialog');
    const msgEl    = document.getElementById('xp-dialog-msg');
    const titleEl  = document.getElementById('xp-dialog-title');
    const tIconEl  = document.getElementById('xp-dialog-icon');
    const imgEl    = document.getElementById('xp-dialog-img');
    const okBtn    = document.getElementById('xp-dialog-ok');
    const cancelBtn= document.getElementById('xp-dialog-cancel');
    const closeBtn = document.getElementById('xp-dialog-close');

    // Set content
    msgEl.textContent   = message;
    titleEl.textContent = title;
    tIconEl.textContent = titleIcon;
    imgEl.textContent   = icon;

    // Show with animation
    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('visible'));
    });

    function finish(result) {
      overlay.classList.remove('visible');
      setTimeout(() => { overlay.style.display = 'none'; }, 180);
      cleanup();
      resolve(result);
    }

    function cleanup() {
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      closeBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('mousedown', onOverlayClick);
      document.removeEventListener('keydown', onKey);
    }

    const onOk     = () => finish(true);
    const onCancel = () => finish(false);
    const onOverlayClick = e => { if (e.target === overlay) finish(false); };
    const onKey = e => {
      if (e.key === 'Enter')  { e.preventDefault(); finish(true);  }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
    overlay.addEventListener('mousedown', onOverlayClick);
    document.addEventListener('keydown', onKey);

    // Focus OK by default
    setTimeout(() => okBtn.focus(), 20);
  });
}

// Make globally available for non-module scripts
window.xpConfirm = xpConfirm;
