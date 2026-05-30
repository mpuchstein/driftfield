// Renders the simulation to screen in three passes:
//   1. fade   — copy the trail buffer onto itself scaled by decay (forgetting)
//   2. points — additively splat every particle onto the trail buffer
//   3. present — tonemap the HDR trail buffer to the canvas with a vignette
//
// The trail buffer is the "memory" of the piece — it is what persists.

import {
  createProgram, createFloatTexture, createFBO,
} from './context.js';
import {
  FULLSCREEN_VS, POINT_VS, POINT_FS, FADE_FS, PRESENT_FS,
} from './shaders.js';

export class Renderer {
  constructor(gl, fullscreenVAO) {
    this.gl = gl;
    this.vao = fullscreenVAO;
    this.pointProgram = createProgram(gl, POINT_VS, POINT_FS);
    this.fadeProgram = createProgram(gl, FULLSCREEN_VS, FADE_FS);
    this.presentProgram = createProgram(gl, FULLSCREEN_VS, PRESENT_FS);
    // Empty VAO for attribute-less gl_VertexID point drawing.
    this.pointVAO = gl.createVertexArray();
    this.width = 0; this.height = 0;
    this.trailTex = [null, null];
    this.trailFBO = [null, null];
    this.tRead = 0; this.tWrite = 1;
  }

  resize(width, height) {
    if (width === this.width && height === this.height) return;
    const gl = this.gl;
    this.width = width; this.height = height;
    this.trailTex.forEach((t) => t && gl.deleteTexture(t));
    this.trailFBO.forEach((f) => f && gl.deleteFramebuffer(f));
    for (let i = 0; i < 2; i++) {
      this.trailTex[i] = createFloatTexture(gl, width, height, { type: gl.HALF_FLOAT, linear: true });
      this.trailFBO[i] = createFBO(gl, this.trailTex[i]);
      // clear to black
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFBO[i]);
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  render({ stateTexture, count, texSize, paletteTex, pointSize, exposure, decay, bg, freeze }) {
    const gl = this.gl;
    const W = this.width, H = this.height;

    // When paused, leave the trail buffer untouched and just re-present it,
    // so the field holds perfectly still instead of fading to black.
    if (freeze) {
      this._present(this.trailTex[this.tRead], exposure, bg);
      return;
    }

    // pass 1: fade the trail buffer (read -> write, scaled by decay)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFBO[this.tWrite]);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.BLEND);
    let p = this.fadeProgram.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.trailTex[this.tRead]);
    gl.uniform1i(p.loc('u_src'), 0);
    gl.uniform1f(p.loc('u_decay'), decay);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // pass 2: additively splat particles onto the faded buffer
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    p = this.pointProgram.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, stateTexture);
    gl.uniform1i(p.loc('u_state'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, paletteTex);
    gl.uniform1i(p.loc('u_palette'), 1);
    gl.uniform1i(p.loc('u_texSize'), texSize);
    gl.uniform1f(p.loc('u_pointSize'), pointSize);
    gl.bindVertexArray(this.pointVAO);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.disable(gl.BLEND);

    // pass 3: present the freshly written trail buffer to the screen
    this._present(this.trailTex[this.tWrite], exposure, bg);

    const tmp = this.tRead; this.tRead = this.tWrite; this.tWrite = tmp;
  }

  _present(trailTexture, exposure, bg) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.BLEND);
    const p = this.presentProgram.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, trailTexture);
    gl.uniform1i(p.loc('u_trail'), 0);
    gl.uniform1f(p.loc('u_exposure'), exposure);
    gl.uniform3f(p.loc('u_bg'), bg[0], bg[1], bg[2]);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }
}
