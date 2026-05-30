// Ambient autopilot — Driftfield dreaming when no one is watching.
//
// With no hands on it, the field still reaches for things: a single point of
// attention wanders slowly across the world (occasionally flipping to repel),
// and the palette breathes from one mood to the next. This is what powers the
// `?ambient` / live-wallpaper mode. The piece stays fully interactive — anything
// the viewer does layers on top of the dreaming.

import { PALETTE_ORDER } from './config.js';

export class AmbientPilot {
  constructor(field, palette) {
    this.field = field;
    this.palette = palette;
    this.ax = 0.5; this.ay = 0.5;   // current point of attention
    this.tx = 0.5; this.ty = 0.5;   // where it's drifting toward
    this.t = 0;
    this.retargetIn = 0;
    this.paletteIn = 24 + Math.random() * 18;
    this.sign = 1;                  // attract (+) or, sometimes, repel (-)
    this._retarget();
  }

  _retarget() {
    // stay off the very edges so the swirl reads on screen
    this.tx = 0.16 + Math.random() * 0.68;
    this.ty = 0.18 + Math.random() * 0.64;
    this.retargetIn = 7 + Math.random() * 8;
    this.sign = Math.random() < 0.22 ? -1 : 1;
  }

  update(dt) {
    this.t += dt;

    this.retargetIn -= dt;
    if (this.retargetIn <= 0) this._retarget();

    // ease toward the target over ~2s — a slow, unhurried wander
    const k = Math.min(1, dt * 0.5);
    this.ax += (this.tx - this.ax) * k;
    this.ay += (this.ty - this.ay) * k;

    // gently breathing strength
    const strength = this.sign * (0.85 + 0.35 * Math.sin(this.t * 0.35));
    this.field.setRoamingAttractor(this.ax, this.ay, strength);

    this.paletteIn -= dt;
    if (this.paletteIn <= 0) {
      const next = PALETTE_ORDER[Math.floor(Math.random() * PALETTE_ORDER.length)];
      this.palette.setTarget(next);
      this.paletteIn = 26 + Math.random() * 22;
    }
  }
}
