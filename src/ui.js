// Wires the control panel, keyboard shortcuts, and help overlay to the config
// object and a set of action handlers provided by main.js. Pure DOM glue.

import { PALETTE_ORDER, DENSITY_PRESETS } from './config.js';

export function setupUI(config, handlers) {
  const $ = (id) => document.getElementById(id);

  // ---- palette segmented buttons ----
  const palSeg = $('palette-seg');
  const palButtons = {};
  PALETTE_ORDER.forEach((name) => {
    const b = document.createElement('button');
    b.textContent = name;
    b.onclick = () => setPalette(name);
    palSeg.appendChild(b);
    palButtons[name] = b;
  });
  function setPalette(name) {
    config.paletteName = name;
    $('v-palette').textContent = name;
    Object.entries(palButtons).forEach(([n, b]) => b.classList.toggle('active', n === name));
    handlers.onPalette(name);
  }

  // ---- density segmented buttons ----
  const denSeg = $('density-seg');
  const denButtons = {};
  DENSITY_PRESETS.forEach((preset) => {
    const b = document.createElement('button');
    b.textContent = preset.label;
    b.onclick = () => setDensity(preset);
    denSeg.appendChild(b);
    denButtons[preset.texSize] = b;
  });
  function setDensity(preset) {
    config.texSize = preset.texSize;
    $('v-density').textContent = preset.label;
    Object.entries(denButtons).forEach(([ts, b]) => b.classList.toggle('active', +ts === preset.texSize));
    handlers.onDensity(preset.texSize);
  }

  // ---- sliders ----
  const sliders = [
    ['s-speed', 'v-speed', 'speed', (v) => v.toFixed(2)],
    ['s-scale', 'v-scale', 'fieldScale', (v) => v.toFixed(2)],
    ['s-decay', 'v-decay', 'trailDecay', (v) => v.toFixed(3)],
    ['s-exposure', 'v-exposure', 'exposure', (v) => v.toFixed(2)],
  ];
  sliders.forEach(([sid, vid, key, fmt]) => {
    const el = $(sid);
    el.value = config[key];
    $(vid).textContent = fmt(config[key]);
    el.addEventListener('input', () => {
      config[key] = parseFloat(el.value);
      $(vid).textContent = fmt(config[key]);
    });
  });

  // ---- toggles ----
  const tText = $('t-text');
  const tAudio = $('t-audio');
  function refreshToggle(btn, on) { btn.classList.toggle('active', on); }
  refreshToggle(tText, config.showText);
  tText.onclick = () => { handlers.onToggleText(); };
  tAudio.onclick = () => { handlers.onToggleAudio(); };

  // ---- panel collapse + idle hide ----
  const panel = $('panel');
  $('panel-head').onclick = () => panel.classList.toggle('collapsed');
  let idle;
  function poke() {
    panel.classList.remove('idle');
    clearTimeout(idle);
    idle = setTimeout(() => panel.classList.add('idle'), 4000);
  }
  window.addEventListener('mousemove', poke);
  poke();

  // ---- help overlay ----
  const help = $('help');
  function toggleHelp() { help.classList.toggle('show'); }
  help.onclick = () => help.classList.remove('show');

  // ---- keyboard ----
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.key.toLowerCase()) {
      case ' ': e.preventDefault(); handlers.onPause(); break;
      case 'r': handlers.onReseed(); break;
      case 'p': {
        const i = PALETTE_ORDER.indexOf(config.paletteName);
        setPalette(PALETTE_ORDER[(i + 1) % PALETTE_ORDER.length]);
        break;
      }
      case 'c': handlers.onClear(); break;
      case 't': handlers.onToggleText(); break;
      case 'm': handlers.onToggleAudio(); break;
      case 'f': handlers.onFullscreen(); break;
      case 'h': case '?': toggleHelp(); break;
    }
  });

  // initial highlight
  setPalette(config.paletteName);
  const initialDensity = DENSITY_PRESETS.find((p) => p.texSize === config.texSize) || DENSITY_PRESETS[1];
  setDensity(initialDensity);

  // expose a couple of setters main.js needs to keep the UI in sync
  return {
    reflectText(on) { refreshToggle(tText, on); },
    reflectAudio(on) { refreshToggle(tAudio, on); },
  };
}
