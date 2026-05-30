// The interactive forces layered on top of the curl field: attention points
// (attractors) the viewer places, and a transient pointer swirl while dragging.
// All coordinates are in [0,1] field space (y up), matching the simulation.

const MAX_ATTRACTORS = 8;

export class Field {
  constructor() {
    // Flat [x, y, strength] triples for the shader uniform.
    this.attractors = new Float32Array(MAX_ATTRACTORS * 3);
    this.attractorCount = 0;

    this.pointer = [0.5, 0.5];
    this.pointerVel = [0, 0];
    this.pointerActive = 0;
    this._last = null;
    this._idleTimer = 0;
  }

  addAttractor(x, y, strength) {
    // Reuse the oldest slot once full (ring buffer).
    const i = (this.attractorCount < MAX_ATTRACTORS)
      ? this.attractorCount++
      : (this._ring = ((this._ring || 0) + 1) % MAX_ATTRACTORS);
    const base = i * 3;
    this.attractors[base] = x;
    this.attractors[base + 1] = y;
    this.attractors[base + 2] = strength;
  }

  clear() {
    this.attractorCount = 0;
    this._ring = 0;
  }

  // Called on pointer move while a drag is in progress.
  stir(x, y, dt) {
    if (this._last && dt > 0) {
      const vx = (x - this._last[0]) / dt;
      const vy = (y - this._last[1]) / dt;
      // light smoothing
      this.pointerVel[0] = this.pointerVel[0] * 0.6 + vx * 0.4;
      this.pointerVel[1] = this.pointerVel[1] * 0.6 + vy * 0.4;
    }
    this.pointer[0] = x;
    this.pointer[1] = y;
    this.pointerActive = 1;
    this._last = [x, y];
    this._idleTimer = 0.12; // keep the swirl alive briefly after movement stops
  }

  endStir() {
    this._last = null;
  }

  // Decay the transient swirl when the pointer is still.
  update(dt) {
    if (this._idleTimer > 0) {
      this._idleTimer -= dt;
      if (this._idleTimer <= 0) {
        this.pointerActive = 0;
        this.pointerVel[0] = 0;
        this.pointerVel[1] = 0;
      }
    }
  }
}
