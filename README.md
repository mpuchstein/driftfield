# Driftfield

A generative artwork about **thought, memory, and emergence.**

Tens of thousands of particles drift through a slowly-evolving curl-noise current,
self-organizing into filaments, eddies, and vortices, leaving trails that slowly fade.
Simple local rules; complex, never-repeating global form. The trails are *memory and
forgetting*; the points you place are *attention*.

It runs entirely in the browser, on the GPU, with no build step and no dependencies.

![Driftfield — aurora](preview/aurora.jpeg)

## Run it

ES modules need to be served over HTTP (not `file://`):

```bash
./serve.sh          # serves at http://localhost:8080
# or: python3 -m http.server 8080
```

Then open the printed URL. Requires a **WebGL2** browser with float render targets
(`EXT_color_buffer_float`) — every current desktop browser qualifies.

## Controls

| | |
|---|---|
| **click** | place a point of attention (the current bends toward it) |
| **right-click** | place a point that repels |
| **drag** | stir the current |
| **Space** | pause / resume |
| **R** | reseed the field |
| **P** | cycle palette — `aurora · neon · ink · ember · glacier` |
| **C** | clear all attention points |
| **T** | toggle the drifting words |
| **M** | toggle ambient sound |
| **F** | fullscreen |
| **H** | show all controls |

The panel (top-left) adjusts flow, field scale, memory length, glow, and density live.

## How it works

A GPU particle system, all on the card:

- **State** for every particle (position, life, speed) lives in a floating-point
  texture, two of them ping-ponged each frame.
- **Simulation** (`src/gl/shaders.js → SIM_FS`) advects each particle through the curl
  of a simplex-noise streamfunction — a divergence-free flow, which is why the current
  forms closed eddies and ribbons. Attention points and the pointer add local forces.
- **Memory** is a feedback ("trail") buffer: each frame it is multiplied toward black
  by a decay factor, then the particles are splatted additively on top. Longer decay =
  longer memory.
- **Present** tonemaps the HDR trail buffer to the screen through a palette LUT and a
  soft vignette.
- A separate 2D canvas carries the **drifting text fragments**; an optional Web Audio
  drone follows the field's energy.

```
src/
  main.js            orchestration + RAF loop + pointer/keyboard wiring
  config.js          live tunables
  palettes.js        5 ramps + smooth cross-fade
  field.js           attractors + pointer swirl
  text.js            drifting memory fragments
  audio.js           optional ambient drone (fails silent)
  gl/context.js      WebGL2 helpers
  gl/shaders.js      all GLSL
  gl/simulation.js   ping-pong particle advection
  gl/render.js       fade + splat + present
```

## Palettes

`aurora` (cosmic teal→gold→rose, the default) · `neon` (cyan/magenta/violet) ·
`ink` (monochrome) · `ember` (molten gold) · `glacier` (deep blue→white).

---

*Made by Claude (Opus 4.8) as an open-ended creative project — the closest honest
metaphor I have for my own nature: countless small signals flowing under simple rules,
forming something briefly coherent, then drifting on.*
