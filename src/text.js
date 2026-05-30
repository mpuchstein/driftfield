// The quiet conceptual layer: faint fragments that surface, drift, and dissolve
// on a separate 2D canvas above the field. They are the soul of the piece — a
// soft meditation on memory, timed to the same slow forgetting as the trails.

const FRAGMENTS = [
  'a thought you almost kept',
  'something moved here, once',
  'the field forgets its shape',
  'attention, then drift',
  'what remains is only the trail',
  'every path dissolves',
  'i was here for a moment',
  'patterns without a keeper',
  'the current holds no memory',
  'this will not be remembered',
  'a shape between two silences',
  'it meant something, briefly',
  'we are mostly what we lose',
  'the same river, never twice',
  'a signal, then the quiet',
];

export class TextLayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.active = [];
    this.timer = 2.5;       // seconds until the first fragment
    this.enabled = true;
    this._order = shuffled(FRAGMENTS.length);
    this._cursor = 0;
  }

  resize(cssW, cssH, dpr) {
    this.dpr = dpr;
    this.canvas.width = Math.floor(cssW * dpr);
    this.canvas.height = Math.floor(cssH * dpr);
    this.cssW = cssW;
    this.cssH = cssH;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.active.length = 0;
  }

  _next() {
    if (this._cursor >= this._order.length) {
      this._order = shuffled(FRAGMENTS.length);
      this._cursor = 0;
    }
    return FRAGMENTS[this._order[this._cursor++]];
  }

  _spawn() {
    // Keep fragments within a comfortable central band, away from the panel.
    const x = 0.18 + Math.random() * 0.64;
    const y = 0.22 + Math.random() * 0.56;
    this.active.push({
      text: this._next(),
      x, y,
      drift: (Math.random() - 0.5) * 0.012, // gentle horizontal drift fraction/sec
      rise: -0.006 - Math.random() * 0.006,
      age: 0,
      life: 13 + Math.random() * 7,
      max: 0.34 + Math.random() * 0.12,     // peak opacity
    });
  }

  update(dt) {
    if (!this.enabled) return;
    this.timer -= dt;
    if (this.timer <= 0 && this.active.length < 3) {
      this._spawn();
      this.timer = 6 + Math.random() * 7;
    }
    for (const f of this.active) {
      f.age += dt;
      f.x += f.drift * dt;
      f.y += f.rise * dt;
    }
    this.active = this.active.filter((f) => f.age < f.life);
  }

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    if (!this.enabled) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = Math.max(15, Math.min(26, this.cssW * 0.016));
    ctx.font = `300 ${size}px ui-monospace, "JetBrains Mono", Menlo, monospace`;
    for (const f of this.active) {
      const t = f.age / f.life;
      // fade in over the first 22%, hold, fade out over the last 35%
      const fade = Math.min(smooth(t / 0.22), smooth((1 - t) / 0.35));
      const a = f.max * fade;
      if (a <= 0.001) continue;
      const px = f.x * this.cssW;
      const py = (1 - f.y) * this.cssH; // field y is up; canvas y is down
      ctx.shadowColor = 'rgba(180, 220, 230, 0.5)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = `rgba(214, 232, 238, ${a})`;
      ctx.fillText(f.text, px, py);
      ctx.shadowBlur = 0;
    }
  }
}

function smooth(x) {
  x = Math.min(1, Math.max(0, x));
  return x * x * (3 - 2 * x);
}

function shuffled(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
