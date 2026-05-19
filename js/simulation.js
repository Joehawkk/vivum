// ─────────────────────────────────────────────
//  VIVUM — Simulation engine
//  Faithful JavaScript port of vivum physics.
//  Physics: crate/src/species.rs + crate/src/lib.rs
//  Wind/fluid: simplified approximation of vivum's
//  Navier-Stokes fluid.js — fire emits upward wind that
//  diffuses upward each tick, pushing gas/dust/fire up.
// ─────────────────────────────────────────────

import { EL } from './elements.js';

// ── Cell encoding ────────────────────────────
// Each cell is 4 bytes in a flat Uint8Array:
//   [0] species   (element id)
//   [1] ra        (color variation / lifetime)
//   [2] rb        (secondary state)
//   [3] clock     (generation flag — double-update guard)
const STRIDE = 4;
const F_SP  = 0;
const F_RA  = 1;
const F_RB  = 2;
const F_CLK = 3;

// ── Wind encoding ────────────────────────────
// Each cell stores 4 floats: [wy, wx, pressure, density]
//   wy  negative = upward force  (fire → -120)
//   wx  positive = rightward     (fire → +20)
//   pressure  accumulates; > 120 triggers dust/stone/ice crumbling
//   density   smoke density (not used for physics currently)
const W_WY = 0;   // vertical wind (negative = up)
const W_WX = 1;   // horizontal wind
const W_PR = 2;   // pressure
const W_DN = 3;   // density

// ── blow_wind threshold per species ──────────
// Matches vivum's blow_wind threshold table exactly.
// Particle is blown only if |wind| > threshold.
const BLOW_THRESHOLD = new Float32Array(256).fill(500); // default: immovable
BLOW_THRESHOLD[EL.GAS]    =  5;
BLOW_THRESHOLD[EL.FIRE]   =  5;
BLOW_THRESHOLD[EL.DUST]   = 10;
BLOW_THRESHOLD[EL.MITE]   = 30;
BLOW_THRESHOLD[EL.SAND]   = 30;
BLOW_THRESHOLD[EL.ROCKET] = 30;
BLOW_THRESHOLD[EL.SEED]   = 35;
BLOW_THRESHOLD[EL.OIL]    = 50;
BLOW_THRESHOLD[EL.FUNGUS] = 54;
BLOW_THRESHOLD[EL.ICE]    = 60;
BLOW_THRESHOLD[EL.LAVA]   = 60;
BLOW_THRESHOLD[EL.PLANT]  = 60;
BLOW_THRESHOLD[EL.WOOD]   = 70;
BLOW_THRESHOLD[EL.STONE]  = 70;
BLOW_THRESHOLD[EL.WATER]  = 40;
BLOW_THRESHOLD[EL.ACID]   = 40;

// ── Heavy particles that can skip 2 cells upward in blow_wind ──
// vivum: Sand/Water/Lava/Acid/Mite/Dust/Oil/Rocket jump dy=-2
const BLOW_DOUBLE = new Uint8Array(256);
BLOW_DOUBLE[EL.SAND]   = 1;
BLOW_DOUBLE[EL.WATER]  = 1;
BLOW_DOUBLE[EL.LAVA]   = 1;
BLOW_DOUBLE[EL.ACID]   = 1;
BLOW_DOUBLE[EL.MITE]   = 1;
BLOW_DOUBLE[EL.DUST]   = 1;
BLOW_DOUBLE[EL.OIL]    = 1;
BLOW_DOUBLE[EL.ROCKET] = 1;

export class Simulation {
  constructor(width, height) {
    this.W = width;
    this.H = height;
    const n = width * height;

    // Cell buffer
    this.buf = new Uint8Array(n * STRIDE);
    this.generation = 0;

    // Wind/fluid buffers — two-buffer system matching vivum's winds/burns.
    // winds: read by blow_wind each tick.
    // burns: written by particles via set_fluid() during the update pass.
    // After each tick: burns is diffused upward and blended into winds.
    this.winds = new Float32Array(n * 4);  // [wy, wx, pressure, density]
    this.burns = new Float32Array(n * 4);
  }

  // ── Fluid: emit (called by particles) ────────
  // Equivalent to vivum's api.set_fluid(Wind{...}).
  // Writes to burns at the particle's current position.
  _setFluid(x, y, wy, wx, pressure, density) {
    const i = (y * this.W + x) * 4;
    this.burns[i + W_WY] += wy;
    this.burns[i + W_WX] += wx;
    this.burns[i + W_PR] += pressure;
    this.burns[i + W_DN] += density;
  }

  // ── Fluid: read (called by particles) ────────
  // Returns {wy, wx, pressure, density} from the winds buffer.
  _getFluid(x, y) {
    const i = (y * this.W + x) * 4;
    return {
      wy:       this.winds[i + W_WY],
      wx:       this.winds[i + W_WX],
      pressure: this.winds[i + W_PR],
      density:  this.winds[i + W_DN],
    };
  }

  // ── Fluid: diffuse burns → winds ─────────────
  // After the update pass, this propagates wind upward (fire's upward draft
  // reaches gas cells above it) and blends with decaying previous winds.
  _diffuseWind() {
    const W = this.W, H = this.H;
    const b = this.burns;
    const w = this.winds;

    // Decay previous winds and fold in new burns.
    // Burns are summed contributions — normalize by capping at ±200/200.
    for (let i = 0, n = W * H * 4; i < n; i++) {
      w[i] = w[i] * 0.75 + b[i];
      // cap to reasonable range
      if (w[i] >  200) w[i] =  200;
      if (w[i] < -200) w[i] = -200;
    }

    // Upward diffusion: wind from cell below spreads to cell above.
    // Cascade bottom-to-top: each row inherits from the (already-updated) row below,
    // so a single fire particle's wind fills ~8-10 cells above it per tick.
    for (let y = H - 2; y >= 0; y--) {
      for (let x = 0; x < W; x++) {
        const above = (y * W + x) * 4;
        const below = ((y + 1) * W + x) * 4;
        w[above + W_WY] += w[below + W_WY] * 0.45;
        w[above + W_WX] += w[below + W_WX] * 0.20;
        w[above + W_PR] += w[below + W_PR] * 0.45;
        if (w[above + W_WY] < -200) w[above + W_WY] = -200;
        if (w[above + W_PR] >  200) w[above + W_PR] =  200;
      }
    }
  }

  // ── blow_wind pass ────────────────────────────
  // Exact port of vivum's blow_wind() — reads winds buffer, moves
  // particles that exceed their species threshold.
  // Scan: column-major top-to-bottom, NO x alternation (vivum pass 1).
  _blowWind(gen) {
    const W = this.W, H = this.H;
    const buf = this.buf;
    const winds = this.winds;

    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        const b = (y * W + x) * STRIDE;
        const sp = buf[b + F_SP];

        if (sp === EL.EMPTY) continue;

        // vivum: skip if clock - generation == 1
        // (particle was just placed by blow_wind in this same pass)
        const clk = buf[b + F_CLK];
        const diff = (clk - gen + 256) % 256;
        if (diff === 1) continue;

        const threshold = BLOW_THRESHOLD[sp];
        if (threshold >= 400) continue;  // immovable

        const wi = (y * W + x) * 4;
        const wy = winds[wi + W_WY];
        const wx = winds[wi + W_WX];

        let dx = 0, dy = 0;
        if (wx >  threshold) dx =  1;
        if (wx < -threshold) dx = -1;
        if (wy >  threshold) dy =  1;
        if (wy < -threshold) dy = -1;

        if (dx === 0 && dy === 0) continue;

        // Check target cell
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const nb = (ny * W + nx) * STRIDE;
        if (buf[nb + F_SP] !== EL.EMPTY) continue;

        // Move the particle
        buf[nb + F_SP]  = sp;
        buf[nb + F_RA]  = buf[b + F_RA];
        buf[nb + F_RB]  = buf[b + F_RB];
        buf[nb + F_CLK] = (gen + 1) % 256;  // mark as placed
        buf[b  + F_SP]  = EL.EMPTY;
        buf[b  + F_RA]  = 0;
        buf[b  + F_RB]  = 0;
        buf[b  + F_CLK] = (gen + 1) % 256;

        // Double-jump: heavy particles fly 2 cells upward if dy==-1
        if (dy === -1 && BLOW_DOUBLE[sp]) {
          const ny2 = ny - 1;
          if (ny2 >= 0) {
            const nb2 = (ny2 * W + nx) * STRIDE;
            if (buf[nb2 + F_SP] === EL.EMPTY) {
              buf[nb2 + F_SP]  = sp;
              buf[nb2 + F_RA]  = buf[nb + F_RA];
              buf[nb2 + F_RB]  = buf[nb + F_RB];
              buf[nb2 + F_CLK] = (gen + 1) % 256;
              buf[nb  + F_SP]  = EL.EMPTY;
              buf[nb  + F_RA]  = 0;
              buf[nb  + F_RB]  = 0;
              buf[nb  + F_CLK] = (gen + 1) % 256;
            }
          }
        }
      }
    }
  }

  // ── Low-level helpers ────────────────────────
  _base(x, y) { return (y * this.W + x) * STRIDE; }
  inBounds(x, y) { return x >= 0 && x < this.W && y >= 0 && y < this.H; }

  _getCellAbs(x, y) {
    if (!this.inBounds(x, y)) return { sp: EL.WALL, ra: 0, rb: 0 };
    const b = this._base(x, y);
    return { sp: this.buf[b+F_SP], ra: this.buf[b+F_RA], rb: this.buf[b+F_RB] };
  }

  // set() stamps clock = (gen + 1) % 256 — exactly like vivum's set().
  // The update pass checks: skip if clock == gen (already processed this tick).
  // Since blow_wind runs at gen-1 and stamps gen-1+1=gen, those cells ARE
  // skipped during update — which is fine, blow_wind already moved them.
  // Within the update pass (gen=G), moved cells get clock=G, skip check clock==G → skip. ✓
  _setCellAbs(x, y, sp, ra = 0, rb = 0, gen = 0) {
    if (!this.inBounds(x, y)) return;
    const b = this._base(x, y);
    this.buf[b+F_SP]  = sp;
    this.buf[b+F_RA]  = ra;
    this.buf[b+F_RB]  = rb;
    this.buf[b+F_CLK] = gen;
  }

  // ── SandApi (per-cell context) ────────────────
  _makeApi(cx, cy, gen) {
    const sim = this;

    return {
      get(dx, dy) {
        return sim._getCellAbs(cx + dx, cy + dy);
      },
      set(dx, dy, sp, ra = 0, rb = 0) {
        // Stamp clock = gen + 1 — exactly like vivum's set().
        // Skip check in update pass: (clock - gen) % 256 === 1 → skipped.
        // blow_wind also stamps gen+1 (with blow_gen = gen-1), so after gen
        // increments, blown cells have clock=gen, diff=0 → NOT skipped by update. ✓
        sim._setCellAbs(cx + dx, cy + dy, sp, ra, rb, (gen + 1) % 256);
      },
      // Set fluid at current cell (writes to burns buffer)
      set_fluid(wy, wx, pressure, density) {
        sim._setFluid(cx, cy, wy, wx, pressure, density);
      },
      // Get fluid at current cell (reads from winds buffer)
      get_fluid() {
        return sim._getFluid(cx, cy);
      },
      // rand_int(n): random integer in [0, n)
      rand_int(n) { return Math.random() * n | 0; },
      // rand_dir(): -1, 0, or 1 with equal probability (vivum: (i%3)-1)
      rand_dir() { return (Math.random() * 3 | 0) - 1; },
      // rand_dir_2(): -1 or 1 (50/50)
      rand_dir_2() { return Math.random() < 0.5 ? -1 : 1; },
      // once_in(n): true with probability 1/n
      once_in(n) { return (Math.random() * n | 0) === 0; },
      // rand_vec(): one of 9 directions (0,0 included) — vivum: i%9
      rand_vec() {
        switch (Math.random() * 9 | 0) {
          case 0: return [ 1,  1];
          case 1: return [ 1,  0];
          case 2: return [ 1, -1];
          case 3: return [ 0, -1];
          case 4: return [-1, -1];
          case 5: return [-1,  0];
          case 6: return [-1,  1];
          case 7: return [ 0,  1];
          default: return [ 0,  0];
        }
      },
      // rand_vec_8(): one of 8 directions (no 0,0)
      rand_vec_8() {
        switch (Math.random() * 8 | 0) {
          case 0: return [ 1,  1];
          case 1: return [ 1,  0];
          case 2: return [ 1, -1];
          case 3: return [ 0, -1];
          case 4: return [-1, -1];
          case 5: return [-1,  0];
          case 6: return [-1,  1];
          default: return [ 0,  1];
        }
      },
      W: sim.W, H: sim.H, cx, cy,
    };
  }

  // ── Main step ─────────────────────────────────
  // Matches vivum tick() exactly:
  //   1. blow_wind pass (gen, col-major top-down, no x-alt)
  //   2. generation++
  //   3. particle update pass (col-major top-down, alternating x)
  //   4. generation++
  //   5. diffuse fluid burns → winds
  step() {
    const W = this.W, H = this.H;
    const buf = this.buf;

    // ── Phase 1: blow_wind ────────────────────
    this._blowWind(this.generation);

    // ── generation++ (between blow_wind and update) ──
    this.generation = (this.generation + 1) % 256;
    const gen = this.generation;

    // ── Phase 2: reset burns + particle update ──
    this.burns.fill(0);

    // Scan: column-major top-to-bottom, alternating x each generation.
    // vivum: for x { scanx = alt(x); for y { update } }
    // Top-to-bottom is critical — sand falls ONE cell per tick.
    // The moved cell gets clock=gen, so when scan reaches it at y+1 it's skipped.
    const scanLeft = (gen % 2 === 0);

    for (let xi = 0; xi < W; xi++) {
      const x = scanLeft ? xi : (W - 1 - xi);
      for (let y = 0; y < H; y++) {
        const b = (y * W + x) * STRIDE;

        if (buf[b + F_SP] === EL.EMPTY) continue;

        // Skip check matches vivum's update_cell guard:
        //   skip if (clock - gen) % 256 == 1
        // Cells moved by update pass get clock = gen+1 → diff=1 → skip. ✓
        // Cells moved by blow_wind get clock = blow_gen+1 = gen → diff=0 → NOT skipped. ✓
        if (((buf[b + F_CLK] - gen + 256) % 256) === 1) continue;

        const sp = buf[b + F_SP];
        const ra = buf[b + F_RA];
        const rb = buf[b + F_RB];

        const api = this._makeApi(x, y, gen);

        switch (sp) {
          case EL.SAND:   update_sand  ({ sp, ra, rb }, api); break;
          case EL.DUST:   update_dust  ({ sp, ra, rb }, api); break;
          case EL.WATER:  update_water ({ sp, ra, rb }, api); break;
          case EL.STONE:  update_stone ({ sp, ra, rb }, api); break;
          case EL.GAS:    update_gas   ({ sp, ra, rb }, api); break;
          case EL.FIRE:   update_fire  ({ sp, ra, rb }, api); break;
          case EL.LAVA:   update_lava  ({ sp, ra, rb }, api); break;
          case EL.ICE:    update_ice   ({ sp, ra, rb }, api); break;
          case EL.WOOD:   update_wood  ({ sp, ra, rb }, api); break;
          case EL.PLANT:  update_plant ({ sp, ra, rb }, api); break;
          case EL.SEED:   update_seed  ({ sp, ra, rb }, api); break;
          case EL.FUNGUS: update_fungus({ sp, ra, rb }, api); break;
          case EL.ACID:   update_acid  ({ sp, ra, rb }, api); break;
          case EL.OIL:    update_oil   ({ sp, ra, rb }, api); break;
          case EL.MITE:   update_mite  ({ sp, ra, rb }, api); break;
          case EL.CLONER: update_cloner({ sp, ra, rb }, api); break;
          case EL.ROCKET: update_rocket({ sp, ra, rb }, api); break;
          // Extended elements
          case EL.WIND:   update_wind  ({ sp, ra, rb }, api); break;
          case EL.DIRT:   update_dirt  ({ sp, ra, rb }, api); break;
          case EL.CLOUD:  update_cloud ({ sp, ra, rb }, api); break;
          case EL.RAIN:   update_rain  ({ sp, ra, rb }, api); break;
          case EL.SNOW:   update_snow  ({ sp, ra, rb }, api); break;
          case EL.FLOWER: update_flower({ sp, ra, rb }, api); break;
        }
      }
    }

    // ── generation++ (vivum increments twice per tick) ──
    this.generation = (this.generation + 1) % 256;

    // ── Phase 3: diffuse fluid burns → winds ──
    this._diffuseWind();
  }

  // ── Public API ────────────────────────────────
  paint(cx, cy, radius, element) {
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx*dx + dy*dy > r2) continue;
        const x = cx + dx, y = cy + dy;
        if (!this.inBounds(x, y)) continue;

        if (element === EL.EMPTY) {
          this._setCellAbs(x, y, EL.EMPTY, 0, 0, 0);
          continue;
        }

        let ra = 100 + (Math.random() * 50 | 0);
        let rb = 0;

        if (element === EL.WIND) {
          ra = Math.random() < 0.5 ? 60 : 190;
          rb = 200 + (Math.random() * 55 | 0);
        }
        if (element === EL.ROCKET) { ra = 120; rb = 0; }

        this._setCellAbs(x, y, element, ra, rb, 0);
      }
    }
  }

  clear() {
    this.buf.fill(0);
    this.winds.fill(0);
    this.burns.fill(0);
  }

  particleCount() {
    let n = 0;
    for (let i = 0; i < this.buf.length; i += STRIDE) {
      if (this.buf[i] !== EL.EMPTY) n++;
    }
    return n;
  }
}

// ═══════════════════════════════════════════
//  ELEMENT UPDATE FUNCTIONS
//  Faithful port of vivum crate/src/species.rs
// ═══════════════════════════════════════════

// ── Sand ─────────────────────────────────────
function update_sand(cell, api) {
  const dx = api.rand_dir_2();
  const nbr = api.get(0, 1);

  if (nbr.sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY);
    api.set(0, 1, cell.sp, cell.ra, cell.rb);
  } else if (api.get(dx, 1).sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY);
    api.set(dx, 1, cell.sp, cell.ra, cell.rb);
  } else if (
    nbr.sp === EL.WATER || nbr.sp === EL.GAS ||
    nbr.sp === EL.OIL   || nbr.sp === EL.ACID
  ) {
    api.set(0, 0, nbr.sp, nbr.ra, nbr.rb);
    api.set(0, 1, cell.sp, cell.ra, cell.rb);
  } else {
    api.set(0, 0, cell.sp, cell.ra, cell.rb);
  }
}

// ── Dust ─────────────────────────────────────
// Ignites explosively when fluid pressure > 120.
function update_dust(cell, api) {
  const dx = api.rand_dir();
  const fluid = api.get_fluid();

  // Pressure ignition
  if (fluid.pressure > 120) {
    api.set(0, 0, EL.FIRE, (150 + (cell.ra / 10)) | 0, 0);
    api.set_fluid(-80, -80, 80, 5);  // dust explosion: upward blast + high pressure
    return;
  }

  const nbr = api.get(0, 1);
  if (nbr.sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY);
    api.set(0, 1, cell.sp, cell.ra, cell.rb);
  } else if (nbr.sp === EL.WATER) {
    api.set(0, 0, nbr.sp, nbr.ra, nbr.rb);
    api.set(0, 1, cell.sp, cell.ra, cell.rb);
  } else if (api.get(dx, 1).sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY);
    api.set(dx, 1, cell.sp, cell.ra, cell.rb);
  } else {
    api.set(0, 0, cell.sp, cell.ra, cell.rb);
  }
}

// ── Stone ────────────────────────────────────
// Crumbles to sand under high pressure.
function update_stone(cell, api) {
  if (api.get(-1, -1).sp === EL.STONE && api.get(1, -1).sp === EL.STONE) return;

  const fluid = api.get_fluid();
  if (fluid.pressure > 120 && api.rand_int(2) === 0) {
    api.set(0, 0, EL.SAND, cell.ra, 0);
    return;
  }

  const nbr = api.get(0, 1);
  if (nbr.sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY);
    api.set(0, 1, cell.sp, cell.ra, cell.rb);
  } else if (
    nbr.sp === EL.WATER || nbr.sp === EL.GAS ||
    nbr.sp === EL.OIL   || nbr.sp === EL.ACID
  ) {
    api.set(0, 0, nbr.sp, nbr.ra, nbr.rb);
    api.set(0, 1, cell.sp, cell.ra, cell.rb);
  } else {
    api.set(0, 0, cell.sp, cell.ra, cell.rb);
  }
}

// ── Water ────────────────────────────────────
function update_water(cell, api) {
  let dx = api.rand_dir();
  const below = api.get(0, 1);
  const dx1   = api.get(dx, 1);

  if (below.sp === EL.EMPTY || below.sp === EL.OIL) {
    let ra = cell.ra;
    if (api.once_in(20)) ra = 100 + api.rand_int(50);
    api.set(0, 0, below.sp, below.ra, below.rb);
    api.set(0, 1, cell.sp, ra, cell.rb);
    return;
  }
  if (dx1.sp === EL.EMPTY || dx1.sp === EL.OIL) {
    api.set(0, 0, dx1.sp, dx1.ra, dx1.rb);
    api.set(dx, 1, cell.sp, cell.ra, cell.rb);
    return;
  }
  if (api.get(-dx, 1).sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY);
    api.set(-dx, 1, cell.sp, cell.ra, cell.rb);
    return;
  }

  const left = (cell.ra % 2 === 0);
  dx = left ? 1 : -1;
  const dx0 = api.get(dx, 0);
  const dxd = api.get(dx * 2, 0);

  if (dx0.sp === EL.EMPTY && dxd.sp === EL.EMPTY) {
    api.set(0, 0, dxd.sp, dxd.ra, dxd.rb);
    api.set(dx * 2, 0, cell.sp, cell.ra, 6);
    const [ndx, ndy] = api.rand_vec_8();
    const nbr2 = api.get(ndx, ndy);
    if (nbr2.sp === EL.WATER && (nbr2.ra % 2) !== (cell.ra % 2)) {
      api.set(ndx, ndy, EL.WATER, cell.ra, nbr2.rb);
    }
  } else if (dx0.sp === EL.EMPTY || dx0.sp === EL.OIL) {
    api.set(0, 0, dx0.sp, dx0.ra, dx0.rb);
    api.set(dx, 0, cell.sp, cell.ra, 3);
    const [ndx, ndy] = api.rand_vec_8();
    const nbr2 = api.get(ndx, ndy);
    if (nbr2.sp === EL.WATER && (nbr2.ra % 2) !== (cell.ra % 2)) {
      api.set(ndx, ndy, EL.WATER, cell.ra, nbr2.rb);
    }
  } else if (cell.rb === 0) {
    if (api.get(-dx, 0).sp === EL.EMPTY) {
      api.set(0, 0, cell.sp, ((cell.ra + dx + 256) % 256), cell.rb);
    }
  } else {
    api.set(0, 0, cell.sp, cell.ra, cell.rb - 1);
  }
}

// ── Oil ──────────────────────────────────────
function update_oil(cell, api) {
  const rb = cell.rb;
  const [dx, dy] = api.rand_vec();
  const nbr = api.get(dx, dy);

  let new_rb = rb;
  let new_ra = cell.ra;

  // Rust operator precedence: `if rb==0 && Fire || Lava || (Oil&&...)`
  // parses as: (rb==0 && Fire) || Lava || (burning Oil)
  if (
    (rb === 0 && nbr.sp === EL.FIRE) ||
    nbr.sp === EL.LAVA ||
    (nbr.sp === EL.OIL && nbr.rb > 1 && nbr.rb < 20)
  ) {
    new_rb = 50;
  }

  if (rb > 1) {
    new_rb = rb - 1;
    // Oil burning: hot upward wind + thick black smoke density
    api.set_fluid(-60, 8, 5, 180);
    if (rb % 4 !== 0 && nbr.sp === EL.EMPTY) {
      const ra = 20 + api.rand_int(30);
      api.set(dx, dy, EL.FIRE, ra, 0);
    }
    if (nbr.sp === EL.WATER) { new_ra = 50; new_rb = 0; }
  } else if (rb === 1) {
    api.set(0, 0, EL.EMPTY);
    return;
  }

  const ddx = api.rand_dir();
  if (api.get(0, 1).sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY); api.set(0, 1, cell.sp, new_ra, new_rb);
  } else if (api.get(ddx, 1).sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY); api.set(ddx, 1, cell.sp, new_ra, new_rb);
  } else if (api.get(-ddx, 1).sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY); api.set(-ddx, 1, cell.sp, new_ra, new_rb);
  } else if (api.get(ddx, 0).sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY); api.set(ddx, 0, cell.sp, new_ra, new_rb);
  } else if (api.get(-ddx, 0).sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY); api.set(-ddx, 0, cell.sp, new_ra, new_rb);
  } else {
    api.set(0, 0, cell.sp, new_ra, new_rb);
  }
}

// ── Gas ──────────────────────────────────────
// Pure rand_vec() — no upward bias. Gas rises because fire's
// set_fluid(wy=-120) creates upward wind, which blow_wind uses to
// push gas up. Without fire, gas disperses randomly.
function update_gas(cell, api) {
  const [dx, dy] = api.rand_vec();
  const nbr = api.get(dx, dy);

  // Normalize rb so fresh gas molecules accumulate into clouds
  const rb = cell.rb === 0 ? 5 : cell.rb;

  if (nbr.sp === EL.EMPTY) {
    if (rb < 3) {
      // single molecule wanders
      api.set(0, 0, EL.EMPTY);
      api.set(dx, dy, cell.sp, cell.ra, rb);
    } else {
      api.set(0, 0, cell.sp, cell.ra, 1);
      api.set(dx, dy, cell.sp, cell.ra, rb - 1);
    }
  } else if ((dx !== 0 || dy !== 0) && nbr.sp === EL.GAS && nbr.rb < 4) {
    api.set(0, 0, EL.EMPTY);
    api.set(dx, dy, cell.sp, cell.ra, nbr.rb + rb);
  } else {
    api.set(0, 0, cell.sp, cell.ra, rb);
  }
}

// ── Fire ─────────────────────────────────────
// Sets upward wind each tick — this is what makes gas rise above fire.
// The fire particle itself moves randomly (rand_vec).
function update_fire(cell, api) {
  const ra = cell.ra;
  const degraded_ra = Math.max(0, ra - (2 + api.rand_dir()));

  const [dx, dy] = api.rand_vec();

  // Fire emits strong upward wind — equivalent to vivum's:
  //   set_fluid(Wind { dx: 0, dy: 150, pressure: 1, density: 120 })
  // In our float system: wy=-120 (strong up), wx=+20 (slight right), pr=1, dn=120
  api.set_fluid(-120, 20, 1, 120);

  const nbr = api.get(dx, dy);

  // Ignite flammable neighbors
  if (nbr.sp === EL.GAS || nbr.sp === EL.DUST) {
    // Gas/dust explodes — burst pressure
    api.set(dx, dy, EL.FIRE, (150 + api.rand_int(30)) & 0xFF, 0);
    api.set_fluid(0, 0, 80, 40);
  } else if (nbr.sp === EL.OIL) {
    api.set(dx, dy, EL.OIL, nbr.ra, 50);
  } else if (nbr.sp === EL.WOOD && nbr.rb === 0) {
    api.set(dx, dy, EL.WOOD, nbr.ra, 90);
  } else if (nbr.sp === EL.PLANT && nbr.rb === 0) {
    api.set(dx, dy, EL.PLANT, nbr.ra, 20);
  } else if (nbr.sp === EL.FUNGUS && nbr.rb === 0) {
    api.set(dx, dy, EL.FUNGUS, nbr.ra, 10);
  } else if (nbr.sp === EL.SEED) {
    api.set(dx, dy, EL.FIRE, 5, 0);
  }

  if (ra < 5 || nbr.sp === EL.WATER) {
    api.set(0, 0, EL.EMPTY);
  } else if (nbr.sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY);
    api.set(dx, dy, EL.FIRE, degraded_ra, 0);
  } else {
    api.set(0, 0, EL.FIRE, degraded_ra, 0);
  }
}

// ── Lava ─────────────────────────────────────
// vivum Wind{dx:0, dy:10} → wy = 0-126 = -126, wx = 10-126 = -116
// Lava is hot: emits strong upward thermal wind (same magnitude as fire)
// plus high density for the heavy molten look.
function update_lava(cell, api) {
  api.set_fluid(-120, -90, 0, 60);

  const dx = api.rand_dir_2();
  const nbr_below = api.get(0, 1);
  const nbr_rand  = api.get(dx, 0);

  // Ignite flammable gas / dust on contact
  if (nbr_below.sp === EL.GAS || nbr_below.sp === EL.DUST) {
    api.set(0, 1, EL.FIRE, 150, 0);
  }
  if (nbr_rand.sp === EL.GAS || nbr_rand.sp === EL.DUST) {
    api.set(dx, 0, EL.FIRE, 150, 0);
  }

  // Lava + water → stone (lava cools, water evaporates)
  if (nbr_below.sp === EL.WATER || nbr_below.sp === EL.ICE) {
    api.set(0, 0, EL.STONE, cell.ra, 0);
    api.set(0, 1, EL.EMPTY);
    return;
  }
  if (nbr_rand.sp === EL.WATER || nbr_rand.sp === EL.ICE) {
    api.set(0, 0, EL.STONE, cell.ra, 0);
    api.set(dx, 0, EL.EMPTY);
    return;
  }

  // Gravity: fall straight down, then diagonal, then sideways
  if (nbr_below.sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY); api.set(0, 1, cell.sp, cell.ra, cell.rb);
  } else if (api.get(dx, 1).sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY); api.set(dx, 1, cell.sp, cell.ra, cell.rb);
  } else if (api.get(-dx, 1).sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY); api.set(-dx, 1, cell.sp, cell.ra, cell.rb);
  } else if (nbr_rand.sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY); api.set(dx, 0, cell.sp, cell.ra, cell.rb);
  } else {
    api.set(0, 0, cell.sp, cell.ra, cell.rb);
  }
}

// ── Wood ─────────────────────────────────────
function update_wood(cell, api) {
  const rb = cell.rb;
  const [dx, dy] = api.rand_vec();
  const nbr_sp = api.get(dx, dy).sp;

  // Rust: (rb==0 && Fire) || Lava
  if ((rb === 0 && nbr_sp === EL.FIRE) || nbr_sp === EL.LAVA) {
    api.set(0, 0, cell.sp, cell.ra, 90);
  }

  if (rb > 1) {
    api.set(0, 0, cell.sp, cell.ra, rb - 1);
    if (rb % 4 === 0 && nbr_sp === EL.EMPTY) {
      api.set(dx, dy, EL.FIRE, 30 + api.rand_int(60), 0);
    }
    if (nbr_sp === EL.WATER) {
      // Water extinguishes — dense smoke
      api.set(0, 0, cell.sp, 50, 0);
      api.set_fluid(0, 0, 0, 220);
    }
  } else if (rb === 1) {
    api.set(0, 0, EL.EMPTY);
  }
}

// ── Ice ──────────────────────────────────────
// Melts under fire, lava, or high pressure. Freezes adjacent water.
function update_ice(cell, api) {
  const [dx, dy] = api.rand_vec();
  const fluid = api.get_fluid();

  if (fluid.pressure > 120 && api.rand_int(2) === 0) {
    api.set(0, 0, EL.WATER, cell.ra, 0);
    return;
  }

  const nbr_sp = api.get(dx, dy).sp;
  if (nbr_sp === EL.FIRE || nbr_sp === EL.LAVA) {
    api.set(0, 0, EL.WATER, cell.ra, cell.rb);
  } else if (nbr_sp === EL.WATER && api.rand_int(100) < 7) {
    api.set(dx, dy, EL.ICE, cell.ra, cell.rb);
  }
}

// ── Plant ────────────────────────────────────
function update_plant(cell, api) {
  const rb = cell.rb;
  const ra = cell.ra;
  let i = api.rand_int(100);
  const [dx, dy] = api.rand_vec();
  const nbr = api.get(dx, dy);

  // Rust: (rb==0 && Fire) || Lava
  if ((rb === 0 && nbr.sp === EL.FIRE) || nbr.sp === EL.LAVA) {
    api.set(0, 0, cell.sp, ra, 20);
  }

  if (nbr.sp === EL.WOOD) {
    const [dx2, dy2] = api.rand_vec();
    const drift = (i % 15) - 7;
    const newra = (ra + drift + 256) % 256;
    if (api.get(dx2, dy2).sp === EL.EMPTY) {
      api.set(dx2, dy2, EL.PLANT, newra, 0);
    }
  }

  if (api.rand_int(100) > 80 && (
    nbr.sp === EL.WATER ||
    (nbr.sp === EL.FUNGUS && (
      api.get(-dx, dy).sp === EL.EMPTY ||
      api.get(-dx, dy).sp === EL.WATER ||
      api.get(-dx, dy).sp === EL.FUNGUS
    ))
  )) {
    i = api.rand_int(100);
    const drift = (i % 15) - 7;
    const newra = (ra + drift + 256) % 256;
    api.set(dx, dy, cell.sp, newra, 0);
    api.set(-dx, dy, EL.EMPTY);
  }

  if (rb > 1) {
    api.set(0, 0, cell.sp, ra, rb - 1);
    if (nbr.sp === EL.EMPTY) {
      api.set(dx, dy, EL.FIRE, 20 + api.rand_int(30), 0);
    }
    if (nbr.sp === EL.WATER) {
      api.set(0, 0, cell.sp, 50, 0);
    }
  } else if (rb === 1) {
    api.set(0, 0, EL.EMPTY);
    return;
  }

  if (ra > 50 && api.get(1, 1).sp !== EL.PLANT && api.get(-1, 1).sp !== EL.PLANT) {
    if (api.get(0, 1).sp === EL.EMPTY) {
      const rr = Math.random() * Math.random() * 100 | 0;
      const dec = api.rand_int(30) - 20;
      if ((rr + ra) > 165) {
        api.set(0, 1, cell.sp, (ra + dec + 256) % 256, 0);
      }
    } else {
      api.set(0, 0, cell.sp, ra > 0 ? ra - 1 : 0, rb);
    }
  }
}

// ── Seed ─────────────────────────────────────
function update_seed(cell, api) {
  const rb = cell.rb;
  const ra = cell.ra;
  const [dx, dy] = api.rand_vec();
  const nbr = api.get(dx, dy);

  if (nbr.sp === EL.FIRE || nbr.sp === EL.LAVA) {
    api.set(0, 0, EL.FIRE, 5, 0);
    return;
  }

  if (rb === 0) {
    const dxf = api.rand_dir();
    const belowSp = api.get(dxf, 1).sp;

    if (belowSp === EL.SAND || belowSp === EL.PLANT || belowSp === EL.FUNGUS) {
      api.set(0, 0, cell.sp, ra, (api.rand_int(253) + 1));
      return;
    }

    const below = api.get(0, 1);
    if (below.sp === EL.EMPTY) {
      api.set(0, 0, EL.EMPTY); api.set(0, 1, cell.sp, ra, rb);
    } else if (api.get(dxf, 1).sp === EL.EMPTY) {
      api.set(0, 0, EL.EMPTY); api.set(dxf, 1, cell.sp, ra, rb);
    } else if (
      below.sp === EL.WATER || below.sp === EL.GAS ||
      below.sp === EL.OIL   || below.sp === EL.ACID
    ) {
      api.set(0, 0, below.sp, below.ra, below.rb);
      api.set(0, 1, cell.sp, ra, rb);
    } else {
      api.set(0, 0, cell.sp, ra, rb);
    }
  } else {
    if (ra > 60) {
      // Stem phase: grow upward
      const dxr = api.rand_dir();
      if (api.rand_int(100) > 75) {
        if (
          (api.get(dxr, -1).sp === EL.EMPTY ||
           api.get(dxr, -1).sp === EL.SAND  ||
           api.get(dxr, -1).sp === EL.SEED) &&
          api.get(1, -1).sp !== EL.PLANT &&
          api.get(-1, -1).sp !== EL.PLANT
        ) {
          const newra = (ra - api.rand_int(10) + 256) % 256;
          api.set(dxr, -1, cell.sp, newra, rb);
          api.set(0, 0, EL.PLANT, 80 + api.rand_int(30), 0);
        } else {
          api.set(0, 0, EL.EMPTY);
        }
      }
    } else if (ra > 40) {
      // Petal phase
      const [mdx, mdy] = api.rand_vec();
      const [ldx, ldy] = adjacency_left(mdx, mdy);
      const [rdx, rdy] = adjacency_right(mdx, mdy);
      if (
        (api.get(mdx, mdy).sp === EL.EMPTY || api.get(mdx, mdy).sp === EL.PLANT) &&
        (api.get(ldx, ldy).sp === EL.EMPTY || api.get(rdx, rdy).sp === EL.EMPTY)
      ) {
        const rr = Math.random() * Math.random() * 100 | 0;
        const dec = 9 - api.rand_int(3);
        if ((rr + ra) > 100) {
          api.set(mdx, mdy, cell.sp, (ra - dec + 256) % 256, rb);
        }
      }
    } else {
      if (nbr.sp === EL.WATER) {
        api.set(dx, dy, EL.SEED, ra, rb);
      }
    }
  }
}

// ── Fungus ───────────────────────────────────
function update_fungus(cell, api) {
  const rb = cell.rb;
  const [dx, dy] = api.rand_vec();
  const nbr_sp = api.get(dx, dy).sp;

  // Rust: (rb==0 && Fire) || Lava
  if ((rb === 0 && nbr_sp === EL.FIRE) || nbr_sp === EL.LAVA) {
    api.set(0, 0, cell.sp, cell.ra, 10);
  }

  let i = api.rand_int(100);

  if (
    nbr_sp !== EL.EMPTY && nbr_sp !== EL.FUNGUS &&
    nbr_sp !== EL.FIRE  && nbr_sp !== EL.ICE
  ) {
    const [dx2, dy2] = api.rand_vec();
    const drift = (i % 15) - 7;
    const newra = (cell.ra + drift + 256) % 256;
    if (api.get(dx2, dy2).sp === EL.EMPTY) {
      api.set(dx2, dy2, EL.FUNGUS, newra, 0);
    }
  }

  if (
    i > 9 && nbr_sp === EL.WOOD &&
    api.get(-dx, dy).sp === EL.WOOD &&
    api.get(dx, -dy).sp === EL.WOOD &&
    api.get(dx, dy).ra % 4 !== 0
  ) {
    i = api.rand_int(100);
    const drift = (i % 15) - 7;
    const newra = (cell.ra + drift + 256) % 256;
    api.set(dx, dy, cell.sp, newra, 0);
  }

  if (rb > 1) {
    api.set(0, 0, cell.sp, cell.ra, rb - 1);
    if (nbr_sp === EL.EMPTY) {
      api.set(dx, dy, EL.FIRE, 10 + api.rand_int(10), 0);
    }
    if (nbr_sp === EL.WATER) {
      api.set(0, 0, cell.sp, 50, 0);
    }
  } else if (rb === 1) {
    api.set(0, 0, EL.EMPTY);
  }

  const ra = cell.ra;
  if (ra > 120) {
    const [mdx, mdy] = api.rand_vec();
    const [ldx, ldy] = adjacency_left(mdx, mdy);
    const [rdx, rdy] = adjacency_right(mdx, mdy);
    if (
      api.get(mdx, mdy).sp === EL.EMPTY &&
      api.get(ldx, ldy).sp !== EL.FUNGUS &&
      api.get(rdx, rdy).sp !== EL.FUNGUS
    ) {
      const rr = Math.random() * Math.random() * 100 | 0;
      const dec = 15 - api.rand_int(20);
      if ((rr + ra) > 165) {
        api.set(mdx, mdy, cell.sp, (ra - dec + 256) % 256, 0);
      }
    }
  }
}

// ── Acid ─────────────────────────────────────
function update_acid(cell, api) {
  const dx = api.rand_dir();
  const ra = cell.ra;
  let degraded_ra = ra - 60;
  let degraded_sp = cell.sp;
  if (degraded_ra < 80) {
    degraded_sp = EL.EMPTY;
    degraded_ra = 0;
  }

  if (api.get(0, 1).sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY); api.set(0, 1, cell.sp, ra, cell.rb);
  } else if (api.get(dx, 0).sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY); api.set(dx, 0, cell.sp, ra, cell.rb);
  } else if (api.get(-dx, 0).sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY); api.set(-dx, 0, cell.sp, ra, cell.rb);
  } else {
    const b0 = api.get(0, 1);
    const bx = api.get(dx, 0);
    const nbx = api.get(-dx, 0);
    const u0 = api.get(0, -1);
    if (b0.sp !== EL.WALL && b0.sp !== EL.ACID) {
      api.set(0, 0, EL.EMPTY); api.set(0, 1, degraded_sp, degraded_ra, 0);
    } else if (bx.sp !== EL.WALL && bx.sp !== EL.ACID) {
      api.set(0, 0, EL.EMPTY); api.set(dx, 0, degraded_sp, degraded_ra, 0);
    } else if (nbx.sp !== EL.WALL && nbx.sp !== EL.ACID) {
      api.set(0, 0, EL.EMPTY); api.set(-dx, 0, degraded_sp, degraded_ra, 0);
    } else if (u0.sp !== EL.WALL && u0.sp !== EL.ACID && u0.sp !== EL.EMPTY) {
      api.set(0, 0, EL.EMPTY); api.set(0, -1, degraded_sp, degraded_ra, 0);
    } else {
      api.set(0, 0, cell.sp, ra, cell.rb);
    }
  }
}

// ── Mite ─────────────────────────────────────
function update_mite(cell, api) {
  let i = api.rand_int(100);
  let dx = 0;
  if (cell.ra < 20) dx = (cell.ra) - 1;
  let dy = 1;
  let new_rb = cell.rb;

  if (cell.rb > 10) { new_rb = cell.rb - 1; dy = -1; }
  else if (cell.rb > 1) { new_rb = cell.rb - 1; }
  else { dx = 0; }

  const nbr = api.get(dx, dy);

  const sx = (i % 3) - 1;
  i = api.rand_int(1000);
  const sy = (i % 3) - 1;
  const sample_sp = api.get(sx, sy).sp;

  if (
    sample_sp === EL.FIRE || sample_sp === EL.LAVA ||
    sample_sp === EL.WATER || sample_sp === EL.OIL
  ) {
    api.set(0, 0, EL.EMPTY);
    return;
  }
  if ((sample_sp === EL.PLANT || sample_sp === EL.WOOD || sample_sp === EL.SEED) && i > 800) {
    api.set(0, 0, EL.EMPTY);
    api.set(sx, sy, cell.sp, cell.ra, cell.rb);
    return;
  }
  if (sample_sp === EL.DUST) {
    api.set(sx, sy, i > 800 ? cell.sp : EL.EMPTY, cell.ra, cell.rb);
  }

  if (nbr.sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY);
    api.set(dx, dy, cell.sp, cell.ra, new_rb);
  } else if (dy === 1 && i > 800) {
    i = api.rand_int(100);
    let ndx = (i % 3) - 1;
    if (i < 6) ndx = dx;
    const hop = 10 + (i % 10);
    api.set(0, 0, cell.sp, (1 + ndx + 256) % 256, hop);
  } else {
    if (
      api.get(-1, 0).sp === EL.MITE &&
      api.get(1, 0).sp  === EL.MITE &&
      api.get(0, -1).sp === EL.MITE
    ) {
      api.set(0, 0, EL.EMPTY);
    } else if (api.get(0, 1).sp === EL.ICE) {
      if (api.get(dx, 0).sp === EL.EMPTY) {
        api.set(0, 0, EL.EMPTY);
        api.set(dx, 0, cell.sp, cell.ra, new_rb);
      }
    } else {
      api.set(0, 0, cell.sp, cell.ra, new_rb);
    }
  }
}

// ── Cloner ───────────────────────────────────
function update_cloner(cell, api) {
  let clone_sp = cell.rb;
  const g = api.rand_int(127);

  for (let ddx = -1; ddx <= 1; ddx++) {
    for (let ddy = -1; ddy <= 1; ddy++) {
      if (cell.rb === 0) {
        const nbr_sp = api.get(ddx, ddy).sp;
        if (nbr_sp !== EL.EMPTY && nbr_sp !== EL.CLONER && nbr_sp !== EL.WALL) {
          clone_sp = nbr_sp;
          api.set(0, 0, cell.sp, 200, clone_sp);
          break;
        }
      } else {
        if (api.rand_int(100) > 90 && api.get(ddx, ddy).sp === EL.EMPTY) {
          const ra = (80 + api.rand_int(30) + Math.abs((g % 127) - 60)) & 0xFF;
          api.set(ddx, ddy, clone_sp, ra, 0);
          break;
        }
      }
    }
  }
}

// ── Rocket ───────────────────────────────────
function update_rocket(cell, api) {
  if (cell.rb === 0) {
    api.set(0, 0, EL.ROCKET, 0, 100);
    return;
  }

  const clone_sp = cell.rb !== 100 ? cell.rb : EL.SAND;
  const [sx, sy] = api.rand_vec();
  const sample = api.get(sx, sy);

  if (
    cell.rb === 100 &&
    sample.sp !== EL.EMPTY && sample.sp !== EL.ROCKET &&
    sample.sp !== EL.WALL  && sample.sp !== EL.CLONER
  ) {
    api.set(0, 0, EL.ROCKET, 1, sample.sp);
    return;
  }

  const ra = cell.ra;

  if (ra === 0) {
    // Dormant: fall like sand
    const dx = api.rand_dir();
    const nbr = api.get(0, 1);
    if (nbr.sp === EL.EMPTY) {
      api.set(0, 0, EL.EMPTY); api.set(0, 1, cell.sp, ra, cell.rb);
    } else if (api.get(dx, 1).sp === EL.EMPTY) {
      api.set(0, 0, EL.EMPTY); api.set(dx, 1, cell.sp, ra, cell.rb);
    } else if (
      nbr.sp === EL.WATER || nbr.sp === EL.GAS ||
      nbr.sp === EL.OIL   || nbr.sp === EL.ACID
    ) {
      api.set(0, 0, nbr.sp, nbr.ra, nbr.rb);
      api.set(0, 1, cell.sp, ra, cell.rb);
    } else {
      api.set(0, 0, cell.sp, ra, cell.rb);
    }
  } else if (ra === 1) {
    api.set(0, 0, EL.ROCKET, 2, cell.rb);
  } else if (ra === 2) {
    let [dx, dy] = api.rand_vec_8();
    if (api.get(dx, dy).sp !== EL.EMPTY) { dx = -dx; dy = -dy; }
    api.set(0, 0, EL.ROCKET, 100 + join_dy_dx(dx, dy), cell.rb);
  } else if (ra > 50) {
    const [dx, dy] = split_dy_dx(ra - 100);
    const nbr2 = api.get(dx, dy * 2);
    if (nbr2.sp === EL.EMPTY || nbr2.sp === EL.FIRE || nbr2.sp === EL.ROCKET) {
      api.set(0, 0, clone_sp, 0, 0);
      api.set(0, dy, clone_sp, 0, 0);
      const nd = api.rand_int(100) % 5;
      let ndx = dx, ndy = dy;
      if (nd === 0) { [ndx, ndy] = adjacency_left(dx, dy); }
      else if (nd === 1) { [ndx, ndy] = adjacency_right(dx, dy); }
      api.set(dx, dy * 2, EL.ROCKET, 100 + join_dy_dx(ndx, ndy), cell.rb);
    } else {
      api.set(0, 0, EL.EMPTY);
    }
  }
}

// ── Extended elements (not in vivum core) ──

function update_wind(cell, api) {
  const dx = cell.ra < 128 ? 1 : -1;
  const nbr = api.get(dx, 0);
  if (nbr.sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY);
    api.set(dx, 0, cell.sp, cell.ra, cell.rb > 0 ? cell.rb - 1 : 0);
  } else {
    api.set(0, 0, cell.sp, cell.ra, cell.rb > 0 ? cell.rb - 1 : 0);
  }
  if (cell.rb === 0) api.set(0, 0, EL.EMPTY);
  api.set_fluid(0, dx * 60, 0, 0);
}

function update_dirt(cell, api) {
  const dx = api.rand_dir_2();
  const nbr = api.get(0, 1);
  if (nbr.sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY); api.set(0, 1, cell.sp, cell.ra, cell.rb);
  } else if (api.get(dx, 1).sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY); api.set(dx, 1, cell.sp, cell.ra, cell.rb);
  } else if (nbr.sp === EL.WATER) {
    api.set(0, 0, nbr.sp, nbr.ra, nbr.rb);
    api.set(0, 1, cell.sp, cell.ra, cell.rb);
  } else {
    api.set(0, 0, cell.sp, cell.ra, cell.rb);
  }
}

function update_cloud(cell, api) {
  if (api.once_in(60)) {
    const dx = api.rand_dir();
    if (api.get(dx, 0).sp === EL.EMPTY) {
      api.set(0, 0, EL.EMPTY); api.set(dx, 0, cell.sp, cell.ra, cell.rb);
    }
  }
  if (api.once_in(40) && api.get(0, 1).sp === EL.EMPTY) {
    api.set(0, 1, EL.RAIN, 200, 0);
  }
}

function update_rain(cell, api) {
  const nbr = api.get(0, 1);
  if (nbr.sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY); api.set(0, 1, cell.sp, cell.ra, cell.rb);
  } else if (nbr.sp === EL.WATER || nbr.sp === EL.SAND || nbr.sp === EL.DIRT) {
    api.set(0, 0, EL.WATER, cell.ra, 0);
  } else {
    api.set(0, 0, EL.WATER, cell.ra, 0);
  }
}

function update_snow(cell, api) {
  const dx = api.rand_dir();
  const nbr = api.get(0, 1);
  if (nbr.sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY); api.set(0, 1, cell.sp, cell.ra, cell.rb);
  } else if (api.get(dx, 1).sp === EL.EMPTY) {
    api.set(0, 0, EL.EMPTY); api.set(dx, 1, cell.sp, cell.ra, cell.rb);
  } else if (nbr.sp === EL.WATER || nbr.sp === EL.FIRE || nbr.sp === EL.LAVA) {
    api.set(0, 0, EL.WATER, cell.ra, 0);
  } else {
    api.set(0, 0, cell.sp, cell.ra, cell.rb);
  }
}

function update_flower(cell, api) {
  // Flower doesn't move — purely decorative
  api.set(0, 0, cell.sp, cell.ra, cell.rb);
}

// ── Rocket helpers (from vivum's utils) ──
function join_dy_dx(dx, dy) {
  return (dy + 1) * 3 + (dx + 1);
}
function split_dy_dx(n) {
  const dy = ((n / 3) | 0) - 1;
  const dx = (n % 3) - 1;
  return [dx, dy];
}
function adjacency_left(dx, dy) {
  // Rotate 90° counter-clockwise
  return [dy, -dx];
}
function adjacency_right(dx, dy) {
  // Rotate 90° clockwise
  return [-dy, dx];
}
