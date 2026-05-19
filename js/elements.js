// ─────────────────────────────────────────────
//  VIVUM — Element definitions
//  Species IDs match vivum/species.rs exactly.
// ─────────────────────────────────────────────

export const EL = {
  EMPTY:   0,
  WALL:    1,
  SAND:    2,
  WATER:   3,
  GAS:     4,
  CLONER:  5,
  FIRE:    6,
  WOOD:    7,
  LAVA:    8,
  ICE:     9,
  PLANT:   11,
  ACID:    12,
  STONE:   13,
  DUST:    14,
  MITE:    15,
  OIL:     16,
  ROCKET:  17,
  FUNGUS:  18,
  SEED:    19,
  // Extended — physics only, not in vivum UI
  WIND:    25,
  DIRT:    20,
  CLOUD:   21,
  RAIN:    22,
  SNOW:    23,
  FLOWER:  24,
};

// ── vivum palette colours ─────────────────
// Approximated from the GLSL shader (sand.glsl) by evaluating
// HSV(hue, saturation, lightness) at data.g=0.5 (ra=128).
// Button backgrounds use rgba(r,g,b,0.25) over whitesmoke — same
// technique as vivum's pallette() / readPixels approach.
//
// Order matches vivum's Species enum exactly (Object.keys order).

export const ELEMENTS_UI = [
  { id: EL.EMPTY,  key: 'empty',  color: 'rgba(26,26,26,0.25)'     },
  { id: EL.WALL,   key: 'wall',   color: 'rgba(102,97,92,0.25)'    },
  { id: EL.SAND,   key: 'sand',   color: 'rgba(217,173,108,0.25)'  },
  { id: EL.WATER,  key: 'water',  color: 'rgba(84,135,210,0.25)'   },
  { id: EL.GAS,    key: 'gas',    color: 'rgba(242,195,195,0.25)'  },
  { id: EL.CLONER, key: 'cloner', color: 'rgba(140,98,121,0.25)'   },
  { id: EL.FIRE,   key: 'fire',   color: 'rgba(255,130,80,0.25)'   },
  { id: EL.WOOD,   key: 'wood',   color: 'rgba(114,90,80,0.25)'    },
  { id: EL.LAVA,   key: 'lava',   color: 'rgba(210,122,84,0.25)'   },
  { id: EL.ICE,    key: 'ice',    color: 'rgba(146,184,242,0.25)'  },
  { id: EL.PLANT,  key: 'plant',  color: 'rgba(84,140,90,0.25)'    },
  { id: EL.ACID,   key: 'acid',   color: 'rgba(213,230,23,0.25)'   },
  { id: EL.STONE,  key: 'stone',  color: 'rgba(140,126,139,0.25)'  },
  { id: EL.DUST,   key: 'dust',   color: 'rgba(204,122,122,0.25)'  },
  { id: EL.MITE,   key: 'mite',   color: 'rgba(167,20,204,0.25)'   },
  { id: EL.OIL,    key: 'oil',    color: 'rgba(61,77,77,0.25)'     },
  { id: EL.ROCKET, key: 'rocket', color: 'rgba(230,138,138,0.25)'  },
  { id: EL.FUNGUS, key: 'fungus', color: 'rgba(255,166,179,0.25)'  },
  { id: EL.SEED,   key: 'seed',   color: 'rgba(128,96,255,0.25)'   },
];
