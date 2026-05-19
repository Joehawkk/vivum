// ─────────────────────────────────────────────
//  VIVUM — Renderer
//  Colours are a faithful JS port of vivum's
//  GLSL fragment shader (js/glsl/sand.glsl).
//  Each cell stores ra (data.g) and rb (data.b).
// ─────────────────────────────────────────────

import { EL } from './elements.js';

const STRIDE = 4;

// ── HSV → RGB (mirrors glsl-hsv2rgb used in sand.glsl) ───────────────
// h,s,v all in [0,1].  Returns [r,g,b] in 0-255.
function hsv(h, s, v) {
  h = ((h % 1) + 1) % 1;           // wrap hue to [0,1]
  v = Math.min(1, Math.max(0, v));
  s = Math.min(1, Math.max(0, s));
  if (s === 0) { const c = v * 255 | 0; return [c, c, c]; }
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r=v; g=t; b=p; break;
    case 1: r=q; g=v; b=p; break;
    case 2: r=p; g=v; b=t; break;
    case 3: r=p; g=q; b=v; break;
    case 4: r=t; g=p; b=v; break;
    case 5: r=v; g=p; b=q; break;
    default: r=g=b=v;
  }
  return [r * 255 | 0, g * 255 | 0, b * 255 | 0];
}

// ── Noise functions matching vivum's GLSL sand.glsl ──────────────────
// snoise: approximates snoise3(vec3(pos, t*0.05)) — animated shimmer
// Used for water / fire / lava / acid colour variation.
function snoise(x, y, t) {
  const a = Math.sin(x * 127.1 + y * 311.7 + t * 0.31416);
  const b = Math.sin(x * 269.5 + y * 183.3 - t * 0.27183);
  return (a + b) * 0.5;   // [-1, 1]
}

// ptex: static per-pixel texture modulator (vivum's snoise2 lightness tweak).
// Returns a value in [0.95, 1.0] — applied to ALL non-empty particles.
function ptex(x, y) {
  return 0.975 + Math.sin(x * 127.1 + y * 311.7) * 0.025;
}

// ── Per-species colour functions ──────────────
// All formulas taken directly from sand.glsl.
// data.g = ra/255,  data.b = rb/255
// base lightness = 0.3 + data.g * 0.5
// Signature: (ra, rb, x, y, t) — x/y/t used for noise in animated species.
const COLORS = {
  // type 1 — Wall
  [EL.WALL]: (ra) => {
    return hsv(0.1, 0.1, 0.4);
  },

  // type 2 — Sand
  [EL.SAND]: (ra) => {
    const dg = ra / 255;
    const base = 0.3 + dg * 0.5;
    return hsv(0.1, 0.5, base + 0.3);
  },

  // type 3 — Water  (animated shimmer via snoise)
  [EL.WATER]: (ra, rb, x, y, t) => {
    const dg = ra / 255;
    const n   = snoise(x, y, t) * 0.1;
    return hsv(0.6, 0.6, 0.7 + dg * 0.25 + n);
  },

  // type 4 — Gas
  [EL.GAS]: (ra, rb) => {
    const dg = ra / 255, db = rb / 255;
    const base = 0.3 + dg * 0.5;
    return hsv(0.0, 0.2 + db * 1.5, base + 0.4);
  },

  // type 5 — Cloner
  [EL.CLONER]: (ra) => {
    const dg = ra / 255;
    return hsv(0.9, 0.3, 0.3 + dg * 0.5);
  },

  // type 6 — Fire  (animated shimmer via snoise)
  [EL.FIRE]: (ra, rb, x, y, t) => {
    const dg = ra / 255;
    const n   = snoise(x, y, t);
    return hsv(dg * 0.1, 0.7, Math.min(1, 0.7 + dg * 0.3 + (n + 0.8) * 0.5));
  },

  // type 7 — Wood
  [EL.WOOD]: (ra) => {
    const dg = ra / 255;
    return hsv(dg * 0.1, 0.3, 0.3 + dg * 0.3);
  },

  // type 8 — Lava  (animated shimmer via snoise)
  [EL.LAVA]: (ra, rb, x, y, t) => {
    const dg = ra / 255;
    const n   = snoise(x, y, t) * 0.1;
    return hsv(dg * 0.1, 0.6, 0.7 + dg * 0.25 + n);
  },

  // type 9 — Ice
  [EL.ICE]: (ra) => {
    const dg = ra / 255;
    return hsv(0.6, 0.4, 0.7 + dg * 0.5);
  },

  // type 11 — Plant
  [EL.PLANT]: (ra) => {
    const dg = ra / 255;
    return hsv(0.4, 0.4, 0.3 + dg * 0.5);
  },

  // type 12 — Acid  (animated shimmer via snoise)
  [EL.ACID]: (ra, rb, x, y, t) => {
    const dg = ra / 255;
    const n   = snoise(x, y, t) * 0.05;
    return hsv(0.18, 0.9, 0.8 + dg * 0.2 + n);
  },

  // type 13 — Stone
  [EL.STONE]: (ra) => {
    const dg = ra / 255;
    return hsv(-0.4 + dg * 0.5, 0.1, 0.3 + dg * 0.5);
  },

  // type 14 — Dust  (hue animated by time, approximated with per-cell ra)
  [EL.DUST]: (ra) => {
    const dg = ra / 255;
    const t  = performance.now() * 0.001;
    return hsv(dg * 2.0 + t * 0.0008, 0.4, 0.8);
  },

  // type 15 — Mite
  [EL.MITE]: () => {
    return hsv(0.8, 0.9, 0.8);
  },

  // type 16 — Oil  (hue animated)
  [EL.OIL]: (ra) => {
    const dg = ra / 255;
    const t  = performance.now() * 0.001;
    return hsv(dg * 5.0 + t * 0.008, 0.2, 0.3);
  },

  // type 17 — Rocket
  [EL.ROCKET]: (ra, rb) => {
    const db = rb / 255;
    return hsv(0.0, 0.4 + db, 0.9);
  },

  // type 18 — Fungus
  [EL.FUNGUS]: (ra) => {
    const dg = ra / 255;
    return hsv(
      dg * 0.15 - 0.1,
      Math.max(0, dg * 0.8 - 0.05),
      Math.min(1, 1.5 - dg * 0.2),
    );
  },

  // type 19 — Seed
  [EL.SEED]: (ra, rb) => {
    const dg = ra / 255, db = rb / 255;
    const fract = x => x - Math.floor(x);
    const h = fract(fract(db * 2) * 0.5) - 0.3;
    const s = 0.7 * (dg + 0.4) + db * 0.2;
    const v = 0.9 * (dg + 0.9);
    return hsv(h, s, v);
  },

  // ── Extended (not in vivum core) ──────────
  [EL.DIRT]:   (ra) => { const dg=ra/255; return hsv(0.07, 0.5, 0.3+dg*0.15); },
  [EL.CLOUD]:  (ra) => { const dg=ra/255; return hsv(0.6, 0.1, 0.82+dg*0.1);  },
  [EL.RAIN]:   (ra) => { return hsv(0.6, 0.55, 0.75);                           },
  [EL.SNOW]:   ()   => { return [230, 235, 245];                                 },
  [EL.FLOWER]: (ra) => { const dg=ra/255; return hsv(0.95, 0.7, 0.85);         },
  [EL.WIND]:   (ra) => { return hsv(0.58, 0.25, 0.88);                          },
};

// Alpha (0-255). All species are fully opaque in vivum's shader.
// We add partial transparency for Gas/Rain/Snow/Wind for visual clarity.
const ALPHA = {
  [EL.GAS]:  120,
  [EL.RAIN]: 200,
  [EL.SNOW]: 220,
  [EL.WIND]: 130,
};

// ── Background colour (vivum #f3f3f4) ─────
// As Uint32 little-endian RGBA: a=0xff, b=0xf4, g=0xf3, r=0xf3
const BG = 0xfff4f3f3;

export class Renderer {
  constructor(canvas, simW, simH) {
    this.canvas  = canvas;
    this.simW    = simW;
    this.simH    = simH;
    this.ctx     = canvas.getContext('2d');
    this.imgData = null;
    this.buf32   = null;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (this.imgData && this.imgData.width === w && this.imgData.height === h) return;
    this.imgData = this.ctx.createImageData(w, h);
    this.buf32   = new Uint32Array(this.imgData.data.buffer);
  }

  draw(sim) {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    if (!this.buf32 || this.buf32.length !== cw * ch) { this._resize(); return; }

    const W  = this.simW;
    const H  = this.simH;
    const sx = cw / W;
    const sy = ch / H;
    const buf = sim.buf;

    // Animated time value — matches vivum's `t * 0.05` snoise3 time axis
    const t = performance.now() * 0.001;

    // Fill background (#f3f3f4)
    this.buf32.fill(BG);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const base = (y * W + x) * STRIDE;
        const sp   = buf[base];
        if (!sp) continue;

        const ra = buf[base + 1];
        const rb = buf[base + 2];
        const fn = COLORS[sp];
        if (!fn) continue;

        // Pass x, y, t so animated species (water/fire/lava/acid) can use snoise
        let [r, g, b] = fn(ra, rb, x, y, t);

        // Apply static per-pixel texture (vivum's snoise2 lightness tweak)
        // ptex(x,y) ∈ [0.95, 1.0] — gives particles a subtle grain
        const p = ptex(x, y);
        r = Math.min(255, r * p) | 0;
        g = Math.min(255, g * p) | 0;
        b = Math.min(255, b * p) | 0;

        const a = ALPHA[sp] ?? 255;
        // little-endian RGBA in Uint32: byte0=R, byte1=G, byte2=B, byte3=A
        const col = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;

        const px0 = x * sx | 0;
        const py0 = y * sy | 0;
        const px1 = Math.max(px0 + 1, ((x + 1) * sx) | 0);
        const py1 = Math.max(py0 + 1, ((y + 1) * sy) | 0);

        for (let py = py0; py < py1 && py < ch; py++) {
          const row = py * cw;
          for (let px = px0; px < px1 && px < cw; px++) {
            this.buf32[row + px] = col;
          }
        }
      }
    }

    this.ctx.putImageData(this.imgData, 0, 0);
  }
}
