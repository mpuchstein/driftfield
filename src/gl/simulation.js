// GPU particle simulation: two RGBA32F state textures, ping-ponged each frame.
// One advection pass moves every particle through the curl field (see SIM_FS).

import {
  createProgram, createFloatTexture, createFBO,
} from './context.js';
import { FULLSCREEN_VS, SIM_FS } from './shaders.js';

export class Simulation {
  constructor(gl, fullscreenVAO, texSize, particleLife) {
    this.gl = gl;
    this.vao = fullscreenVAO;
    this.program = createProgram(gl, FULLSCREEN_VS, SIM_FS);
    this.life = particleLife;
    this._build(texSize);
  }

  get count() { return this.texSize * this.texSize; }
  get stateTexture() { return this.textures[this.read]; }

  _build(texSize) {
    const gl = this.gl;
    this.texSize = texSize;
    const seed = new Float32Array(texSize * texSize * 4);
    for (let i = 0; i < texSize * texSize; i++) {
      seed[i * 4]     = Math.random();                 // x
      seed[i * 4 + 1] = Math.random();                 // y
      seed[i * 4 + 2] = Math.random() * this.life;     // life
      seed[i * 4 + 3] = 0;                             // speed
    }
    this.textures = [
      createFloatTexture(gl, texSize, texSize, { type: gl.FLOAT, data: seed }),
      createFloatTexture(gl, texSize, texSize, { type: gl.FLOAT, data: null }),
    ];
    this.fbos = [createFBO(gl, this.textures[0]), createFBO(gl, this.textures[1])];
    this.read = 0;
    this.write = 1;
  }

  // Re-seed in place (R key) — fresh random field, same size.
  reseed() {
    const gl = this.gl;
    this.textures.forEach((t) => gl.deleteTexture(t));
    this.fbos.forEach((f) => gl.deleteFramebuffer(f));
    this._build(this.texSize);
  }

  // Change density (particle count). Rebuilds the textures.
  resize(texSize) {
    if (texSize === this.texSize) return;
    const gl = this.gl;
    this.textures.forEach((t) => gl.deleteTexture(t));
    this.fbos.forEach((f) => gl.deleteFramebuffer(f));
    this._build(texSize);
  }

  // `u` carries per-frame uniforms gathered by main.js.
  step(u) {
    const gl = this.gl;
    const p = this.program.use();

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[this.write]);
    gl.viewport(0, 0, this.texSize, this.texSize);
    gl.disable(gl.BLEND);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.read]);
    gl.uniform1i(p.loc('u_state'), 0);

    gl.uniform1f(p.loc('u_dt'), u.dt);
    gl.uniform1f(p.loc('u_time'), u.time);
    gl.uniform1f(p.loc('u_speed'), u.speed);
    gl.uniform1f(p.loc('u_fieldScale'), u.fieldScale);
    gl.uniform1f(p.loc('u_fieldEvolve'), u.fieldEvolve);
    gl.uniform1f(p.loc('u_flowStrength'), u.flowStrength);
    gl.uniform1f(p.loc('u_aspect'), u.aspect);
    gl.uniform1f(p.loc('u_life'), this.life);

    gl.uniform1i(p.loc('u_attractorCount'), u.attractorCount);
    if (u.attractorCount > 0) gl.uniform3fv(p.loc('u_attractors'), u.attractors);
    gl.uniform2f(p.loc('u_pointer'), u.pointer[0], u.pointer[1]);
    gl.uniform2f(p.loc('u_pointerVel'), u.pointerVel[0], u.pointerVel[1]);
    gl.uniform1f(p.loc('u_pointerActive'), u.pointerActive);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    const tmp = this.read; this.read = this.write; this.write = tmp;
  }
}
