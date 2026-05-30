// Thin WebGL2 helpers: context creation, program compilation, textures, FBOs,
// and a fullscreen-triangle VAO. No framework, no abstractions beyond what the
// rest of Driftfield actually needs.

export function createGL(canvas) {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  if (!gl) {
    return { gl: null, error: 'This browser does not support WebGL2.' };
  }
  // Rendering to float textures is the core of the technique.
  const colorBufferFloat = gl.getExtension('EXT_color_buffer_float');
  if (!colorBufferFloat) {
    return { gl, error: 'WebGL2 is present but float render targets (EXT_color_buffer_float) are unavailable.' };
  }
  gl.getExtension('OES_texture_float_linear'); // for linear sampling of the trail buffer
  return { gl, error: null };
}

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    const kind = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
    gl.deleteShader(sh);
    throw new Error(`${kind} shader compile error:\n${log}`);
  }
  return sh;
}

export function createProgram(gl, vsSrc, fsSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`program link error:\n${log}`);
  }
  // Cache uniform locations lazily.
  const uniforms = {};
  const program = {
    handle: prog,
    use() { gl.useProgram(prog); return program; },
    loc(name) {
      if (!(name in uniforms)) uniforms[name] = gl.getUniformLocation(prog, name);
      return uniforms[name];
    },
  };
  return program;
}

// A single fullscreen triangle covering clip space [-1, 3]. Bind its VAO and
// drawArrays(TRIANGLES, 0, 3) for any full-frame pass.
export function createFullscreenVAO(gl) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return vao;
}

// Float texture holding arbitrary data. `type` is gl.FLOAT (RGBA32F) or
// gl.HALF_FLOAT (RGBA16F). NEAREST by default; pass linear=true for the trail buffer.
export function createFloatTexture(gl, w, h, { type = gl.FLOAT, data = null, linear = false } = {}) {
  const internal = type === gl.HALF_FLOAT ? gl.RGBA16F : gl.RGBA32F;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, data);
  const filt = linear ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

export function createFBO(gl, texture) {
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fbo;
}

// A 256x1 RGBA8 lookup texture (the palette ramp), updatable each frame.
export function createLUTTexture(gl) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

export function uploadLUT(gl, tex, pixels /* Uint8Array(256*4) */) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.bindTexture(gl.TEXTURE_2D, null);
}
