// Driftfield — bootstrap and orchestration.
//
// A field of GPU particles drifts through a curl-noise current, leaving trails
// that slowly fade. Simple local rules, complex global form, never the same
// twice. Click to place a point of attention; drag to stir; press H for keys.

import { config, PALETTE_ORDER } from './config.js';
import {
  createGL, createFullscreenVAO, createLUTTexture, uploadLUT,
} from './gl/context.js';
import { Simulation } from './gl/simulation.js';
import { Renderer } from './gl/render.js';
import { PaletteManager } from './palettes.js';
import { Field } from './field.js';
import { TextLayer } from './text.js';
import { Ambient } from './audio.js';
import { AmbientPilot } from './ambient_pilot.js';
import { setupUI } from './ui.js';

const glCanvas = document.getElementById('gl');
const textCanvas = document.getElementById('text');

// `?ambient` — autonomous "dreaming" mode for live wallpapers / screensavers:
// the field steers itself and the UI is hidden, but it stays touchable.
const params = new URLSearchParams(location.search);
const AMBIENT = params.has('ambient');
const startPalette = params.get('palette');
if (AMBIENT) document.body.classList.add('ambient');

function fail(msg) {
  document.getElementById('banner-msg').textContent = msg;
  document.getElementById('banner').classList.add('show');
}

const { gl, error } = createGL(glCanvas);
if (error) {
  fail(error + ' Driftfield needs a WebGL2 browser with float render targets.');
  throw new Error(error);
}

// --- core objects ------------------------------------------------------------
const vao = createFullscreenVAO(gl);
const sim = new Simulation(gl, vao, config.texSize, config.particleLife);
const renderer = new Renderer(gl, vao);
const palette = new PaletteManager(config.paletteName);
const lutTex = createLUTTexture(gl);
uploadLUT(gl, lutTex, palette.pixels);
const field = new Field();
const text = new TextLayer(textCanvas);
const audio = new Ambient();

if (startPalette && PALETTE_ORDER.includes(startPalette)) {
  config.paletteName = startPalette;
  palette.setTarget(startPalette);
}
const pilot = AMBIENT ? new AmbientPilot(field, palette) : null;

let dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, config.maxDpr);
  const cssW = window.innerWidth, cssH = window.innerHeight;
  const w = Math.floor(cssW * dpr), h = Math.floor(cssH * dpr);
  glCanvas.width = w; glCanvas.height = h;
  glCanvas.style.width = cssW + 'px'; glCanvas.style.height = cssH + 'px';
  renderer.resize(w, h);
  text.resize(cssW, cssH, dpr);
  aspect = w / h;
}
let aspect = 1;
window.addEventListener('resize', resize);
resize();

// --- UI ----------------------------------------------------------------------
const ui = setupUI(config, {
  onPalette: (name) => palette.setTarget(name),
  onDensity: (texSize) => sim.resize(texSize),
  onPause: () => { config.paused = !config.paused; setSig(config.paused ? 'paused' : 'drifting'); },
  onReseed: () => { sim.reseed(); flashSig('reseeded'); },
  onClear: () => { field.clear(); flashSig('cleared'); },
  onToggleText: () => { config.showText = !config.showText; text.setEnabled(config.showText); ui.reflectText(config.showText); },
  onToggleAudio: async () => {
    const on = await audio.toggle();
    config.audio = on;
    ui.reflectAudio(on);
    flashSig(on ? 'sound on' : 'sound off');
  },
  onFullscreen: () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  },
});
text.setEnabled(config.showText);

const sig = document.getElementById('sig');
let sigTimer = 0;
function setSig(t) { sig.textContent = t; sig.style.opacity = '0.5'; }
function flashSig(t) { sig.textContent = t; sig.style.opacity = '0.9'; sigTimer = 1.6; }

// --- pointer interaction -----------------------------------------------------
let down = false, dragMoved = false, downBtn = 0, downX = 0, downY = 0;
function toField(e) {
  const r = glCanvas.getBoundingClientRect();
  return [
    (e.clientX - r.left) / r.width,
    1 - (e.clientY - r.top) / r.height,
  ];
}
glCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
glCanvas.addEventListener('pointerdown', (e) => {
  down = true; dragMoved = false; downBtn = e.button;
  downX = e.clientX; downY = e.clientY;
  glCanvas.setPointerCapture(e.pointerId);
});
glCanvas.addEventListener('pointermove', (e) => {
  if (!down) return;
  if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 6) dragMoved = true;
  if (dragMoved) {
    const [x, y] = toField(e);
    field.stir(x, y, lastDt || 0.016);
  }
});
glCanvas.addEventListener('pointerup', (e) => {
  if (down && !dragMoved) {
    const [x, y] = toField(e);
    const repel = downBtn === 2 || e.ctrlKey;
    field.addAttractor(x, y, repel ? -1.2 : 1.2);
    flashSig(repel ? 'repel' : 'focus');
  }
  field.endStir();
  down = false;
});

// --- energy readback (drives ambient sound) ----------------------------------
const energyBuf = new Float32Array(16 * 16 * 4);
let energy = 0, energyFrame = 0;
function sampleEnergy() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, sim.fbos[sim.read]);
  gl.readPixels(0, 0, 16, 16, gl.RGBA, gl.FLOAT, energyBuf);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  let s = 0;
  for (let i = 0; i < 16 * 16; i++) s += energyBuf[i * 4 + 3];
  const avg = s / (16 * 16);
  energy = energy * 0.85 + avg * 0.15;
}

// --- main loop ---------------------------------------------------------------
let prev = performance.now();
let simTime = 0;
let lastDt = 0.016;

function frame(now) {
  let dt = (now - prev) / 1000;
  prev = now;
  if (dt > 0.05) dt = 0.05; // guard against tab-switch jumps
  lastDt = dt;

  field.update(dt);
  if (pilot && !config.paused) pilot.update(dt);

  if (!config.paused) {
    simTime += dt;
    sim.step({
      dt,
      time: simTime,
      speed: config.speed,
      fieldScale: config.fieldScale,
      fieldEvolve: config.fieldEvolve,
      flowStrength: config.flowStrength,
      aspect,
      attractorCount: field.attractorCount,
      attractors: field.attractors,
      pointer: field.pointer,
      pointerVel: field.pointerVel,
      pointerActive: field.pointerActive,
    });
  }

  if (palette.update(dt)) uploadLUT(gl, lutTex, palette.pixels);

  renderer.render({
    freeze: config.paused,
    stateTexture: sim.stateTexture,
    count: sim.count,
    texSize: sim.texSize,
    paletteTex: lutTex,
    pointSize: config.pointSize * dpr,
    exposure: config.exposure,
    decay: config.trailDecay,
    bg: palette.bg,
  });

  // ambient sound follows the field's energy
  if (++energyFrame % 12 === 0 && audio.enabled) sampleEnergy();
  audio.setEnergy(energy);
  audio.update(dt);

  text.update(dt);
  text.draw();

  if (sigTimer > 0) { sigTimer -= dt; if (sigTimer <= 0) sig.style.opacity = '0.5'; }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Fade the opening signature in, then to its resting dimness.
setSig('driftfield');
setTimeout(() => setSig('drifting'), 2600);
