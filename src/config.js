// Driftfield — tunable defaults.
// These are the live parameters; the UI mutates this object in place and
// modules read from it each frame, so changes take effect immediately.

export const config = {
  // Simulation grid: texSize * texSize particles. 256 -> ~65k, 512 -> ~262k.
  texSize: 256,

  // Flow.
  speed: 1.0,        // global multiplier on advection
  fieldScale: 1.5,   // spatial frequency of the curl-noise field
  fieldEvolve: 0.05, // how fast the field morphs over time
  flowStrength: 1.0, // base magnitude of the curl velocity

  // Memory (the trail feedback buffer).
  trailDecay: 0.965, // per-frame multiply of the accumulation buffer (closer to 1 = longer memory)

  // Look.
  pointSize: 1.3,    // base particle size in device pixels (scaled by dpr)
  exposure: 1.05,    // tonemap exposure in the present pass
  paletteName: 'aurora',

  // Particle lifetime, in seconds, before a particle is reborn elsewhere.
  particleLife: 7.0,

  // Layers.
  showText: true,
  audio: false,

  // Runtime / quality.
  maxDpr: 1.5,
  paused: false,
};

// Ordered palette names for cycling with the P key / segmented buttons.
export const PALETTE_ORDER = ['aurora', 'neon', 'ink', 'ember', 'glacier'];

// Density presets surfaced in the UI (label -> texSize).
export const DENSITY_PRESETS = [
  { label: 'soft', texSize: 128 },
  { label: 'full', texSize: 256 },
  { label: 'dense', texSize: 384 },
];
