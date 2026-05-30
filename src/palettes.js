// Palette ramps. Each maps particle speed (0 = slow/dim, 1 = fast/bright) to a
// color. We bake a ramp into a 256-entry RGBA8 LUT and cross-fade between the
// current and target ramp when the palette changes.
//
// Each palette also carries a background tone that the present pass settles the
// field onto.

const PALETTES = {
  aurora: {
    bg: [0.020, 0.022, 0.045],
    stops: [
      [0.00, [0.02, 0.03, 0.10]],
      [0.30, [0.04, 0.22, 0.28]],
      [0.52, [0.10, 0.55, 0.42]],
      [0.70, [0.45, 0.78, 0.40]],
      [0.85, [0.95, 0.80, 0.42]],
      [1.00, [1.00, 0.55, 0.62]],
    ],
  },
  neon: {
    bg: [0.018, 0.012, 0.030],
    stops: [
      [0.00, [0.03, 0.02, 0.08]],
      [0.32, [0.05, 0.45, 0.70]],
      [0.55, [0.10, 0.95, 0.95]],
      [0.74, [0.85, 0.25, 0.95]],
      [1.00, [1.00, 0.30, 0.62]],
    ],
  },
  ink: {
    bg: [0.0, 0.0, 0.0],
    stops: [
      [0.00, [0.02, 0.02, 0.03]],
      [0.45, [0.30, 0.28, 0.26]],
      [0.78, [0.80, 0.76, 0.70]],
      [1.00, [1.00, 0.97, 0.92]],
    ],
  },
  ember: {
    bg: [0.028, 0.010, 0.008],
    stops: [
      [0.00, [0.05, 0.01, 0.01]],
      [0.34, [0.45, 0.07, 0.03]],
      [0.58, [0.92, 0.30, 0.05]],
      [0.80, [1.00, 0.65, 0.18]],
      [1.00, [1.00, 0.95, 0.70]],
    ],
  },
  glacier: {
    bg: [0.012, 0.020, 0.040],
    stops: [
      [0.00, [0.02, 0.04, 0.10]],
      [0.36, [0.06, 0.26, 0.55]],
      [0.62, [0.20, 0.62, 0.92]],
      [0.82, [0.55, 0.86, 0.98]],
      [1.00, [0.93, 0.98, 1.00]],
    ],
  },
};

function sampleRamp(stops, t) {
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const span = b[0] - a[0] || 1;
  const k = Math.min(1, Math.max(0, (t - a[0]) / span));
  return [
    a[1][0] + (b[1][0] - a[1][0]) * k,
    a[1][1] + (b[1][1] - a[1][1]) * k,
    a[1][2] + (b[1][2] - a[1][2]) * k,
  ];
}

// Build a Float32 256x3 ramp (linear color, 0..1) for a palette name.
function buildRamp(name) {
  const p = PALETTES[name] || PALETTES.aurora;
  const ramp = new Float32Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const c = sampleRamp(p.stops, i / 255);
    ramp[i * 3] = c[0]; ramp[i * 3 + 1] = c[1]; ramp[i * 3 + 2] = c[2];
  }
  return ramp;
}

export function backgroundOf(name) {
  return (PALETTES[name] || PALETTES.aurora).bg;
}

export function paletteNames() {
  return Object.keys(PALETTES);
}

// Holds the live LUT and animates a smooth cross-fade between palettes.
export class PaletteManager {
  constructor(name) {
    this.current = buildRamp(name);
    this.from = this.current.slice();
    this.target = this.current.slice();
    this.fromBg = backgroundOf(name).slice();
    this.targetBg = backgroundOf(name).slice();
    this.bg = backgroundOf(name).slice();
    this.t = 1; // 1 = settled
    this.pixels = new Uint8Array(256 * 4);
    this._bake();
  }

  setTarget(name) {
    this.from = this.current.slice();
    this.target = buildRamp(name);
    this.fromBg = this.bg.slice();
    this.targetBg = backgroundOf(name).slice();
    this.t = 0;
  }

  // dt in seconds. Returns true while still transitioning (LUT needs re-upload).
  update(dt) {
    if (this.t >= 1) return false;
    this.t = Math.min(1, this.t + dt / 0.8);
    const k = this.t * this.t * (3 - 2 * this.t); // smoothstep
    for (let i = 0; i < this.current.length; i++) {
      this.current[i] = this.from[i] + (this.target[i] - this.from[i]) * k;
    }
    for (let i = 0; i < 3; i++) {
      this.bg[i] = this.fromBg[i] + (this.targetBg[i] - this.fromBg[i]) * k;
    }
    this._bake();
    return true;
  }

  _bake() {
    const p = this.pixels, c = this.current;
    for (let i = 0; i < 256; i++) {
      p[i * 4]     = Math.round(Math.min(1, Math.max(0, c[i * 3]))     * 255);
      p[i * 4 + 1] = Math.round(Math.min(1, Math.max(0, c[i * 3 + 1])) * 255);
      p[i * 4 + 2] = Math.round(Math.min(1, Math.max(0, c[i * 3 + 2])) * 255);
      p[i * 4 + 3] = 255;
    }
  }
}
