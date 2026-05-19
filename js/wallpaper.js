(function () {
  'use strict';

  const canvas = document.getElementById('px-wallpaper');
  if (!canvas) return;

  // Pixel size = how many screen-pixels per "game pixel"
  // vivum runs ~200px wide in a ~1000px window = 5px/cell
  const PXSIZE = 3;

  // Game colour palette — sampled from Bliss + clamped to ~20 colours
  // (like an old SNES scene)
  const PALETTE = [
    [14,  54, 148],  // deep sky
    [28,  82, 182],  // sky
    [50, 118, 210],  // sky mid
    [80, 148, 226],  // sky light
    [118, 178, 242], // sky pale
    [160, 208, 252], // horizon
    [255, 255, 255], // cloud white
    [220, 232, 248], // cloud shadow
    [148, 210,  18], // grass bright (hilltop)
    [108, 180,  10], // grass mid
    [ 74, 148,   6], // grass dark
    [ 48, 108,   2], // grass shadow
    [ 28,  72,   0], // grass deep
    [120, 145, 105], // distant hills light
    [ 88, 112,  78], // distant hills dark
    [168, 188, 148], // distant hills pale
  ];

  function nearestPaletteColor(r, g, b) {
    let best = PALETTE[0], bestD = Infinity;
    for (const c of PALETTE) {
      // Weighted distance: human eye is more sensitive to green
      const d = 2*(r-c[0])**2 + 4*(g-c[1])**2 + 1.5*(b-c[2])**2;
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function renderPixelated(sourceImg) {
    const VW = Math.floor(window.innerWidth  / PXSIZE);
    const VH = Math.floor(window.innerHeight / PXSIZE);

    // 1. Draw full image onto a tiny canvas
    const tiny = document.createElement('canvas');
    tiny.width  = VW;
    tiny.height = VH;
    const tc = tiny.getContext('2d');
    tc.imageSmoothingEnabled = true;
    tc.imageSmoothingQuality = 'high';
    tc.drawImage(sourceImg, 0, 0, VW, VH);

    // 2. Quantise every pixel to the game palette
    const id   = tc.getImageData(0, 0, VW, VH);
    const data = id.data;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = nearestPaletteColor(data[i], data[i+1], data[i+2]);
      data[i] = r; data[i+1] = g; data[i+2] = b;
    }

    // 3. Blit to display canvas (CSS scales it up with image-rendering:pixelated)
    canvas.width  = VW;
    canvas.height = VH;
    canvas.getContext('2d').putImageData(id, 0, 0);
  }

  const img = new Image();
  img.onload  = () => renderPixelated(img);
  img.src = 'assets/bliss.jpg';
})();
