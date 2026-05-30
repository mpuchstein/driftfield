// All GLSL for Driftfield, as ES module strings (keeps the project build-free).
//
// State texture layout (RGBA32F), one texel per particle:
//   .xy = position in [0,1] over the canvas
//   .z  = remaining life in seconds
//   .w  = normalized speed in [0,1] (for coloring)
// A particle's seed is derived deterministically from its texel coordinate, so
// no channel is spent storing it.

// --- shared fullscreen vertex shader ----------------------------------------
export const FULLSCREEN_VS = `#version 300 es
layout(location = 0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// --- Ashima simplex noise (snoise) — used to build a divergence-free flow ----
const SNOISE = `
vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`;

const HASH = `
float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
vec2 hash22(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}`;

// --- simulation: advect every particle through the curl field ----------------
export const SIM_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outState;

uniform sampler2D u_state;
uniform float u_dt;
uniform float u_time;
uniform float u_speed;
uniform float u_fieldScale;
uniform float u_fieldEvolve;
uniform float u_flowStrength;
uniform float u_aspect;
uniform float u_life;

uniform int   u_attractorCount;
uniform vec3  u_attractors[8];   // xy = position [0,1], z = signed strength

uniform vec2  u_pointer;         // [0,1]
uniform vec2  u_pointerVel;      // per-second, in [0,1] space
uniform float u_pointerActive;   // 0 or 1

${SNOISE}
${HASH}

// Streamfunction -> divergence-free 2D velocity (curl of a scalar potential).
float potential(vec2 p, float t){
  vec2 q = p * vec2(u_aspect, 1.0) * u_fieldScale;
  float n = snoise(vec3(q, t));
  // a second, larger-scale octave for long sweeping currents
  n += 0.5 * snoise(vec3(q * 0.4 + 11.3, t * 0.6));
  return n;
}
vec2 curl(vec2 p, float t){
  float e = 0.0015;
  float dy = potential(p + vec2(0.0, e), t) - potential(p - vec2(0.0, e), t);
  float dx = potential(p + vec2(e, 0.0), t) - potential(p - vec2(e, 0.0), t);
  return vec2(dy, -dx) / (2.0 * e);
}

vec2 respawn(vec2 uv, float salt){
  return hash22(uv * 71.0 + salt * 13.0 + u_time * 1.7);
}

void main(){
  vec4 s = texture(u_state, v_uv);
  vec2 pos = s.xy;
  float life = s.z;

  float t = u_time * u_fieldEvolve;
  vec2 vel = curl(pos, t) * u_flowStrength;

  // attention points bend the flow
  for (int i = 0; i < 8; i++){
    if (i >= u_attractorCount) break;
    vec3 a = u_attractors[i];
    vec2 d = a.xy - pos;
    float dist = length(d) + 0.02;
    vel += normalize(d) * a.z * 0.08 / (dist * dist + 0.04);
  }

  // pointer drag stirs a transient swirl
  if (u_pointerActive > 0.5){
    vec2 d = pos - u_pointer;
    float dist = length(d);
    float fall = exp(-dist * dist * 90.0);
    vec2 swirl = vec2(-d.y, d.x);           // tangential
    vel += swirl * fall * 6.0;
    vel += u_pointerVel * fall * 3.0;        // push along the drag
  }

  pos += vel * u_dt * u_speed * 0.06;
  life -= u_dt;

  // reborn when its life ends or it drifts off the canvas
  bool dead = life <= 0.0 || pos.x < -0.02 || pos.x > 1.02 || pos.y < -0.02 || pos.y > 1.02;
  if (dead){
    pos = respawn(v_uv, 1.0);
    life = u_life * (0.4 + 0.6 * hash11(dot(v_uv, vec2(12.9898, 78.233)) + u_time));
  }

  // spread speed across the whole palette rather than saturating at the top
  float speed = clamp(pow(length(vel) * u_flowStrength * 0.11, 0.8), 0.0, 1.0);
  outState = vec4(pos, life, speed);
}`;

// --- render particles as soft additive points into the trail buffer ----------
export const POINT_VS = `#version 300 es
precision highp float;
uniform sampler2D u_state;
uniform int   u_texSize;
uniform float u_pointSize;
out float v_speed;
out float v_life;
void main(){
  int id = gl_VertexID;
  int px = id % u_texSize;
  int py = id / u_texSize;
  vec2 uv = (vec2(float(px), float(py)) + 0.5) / float(u_texSize);
  vec4 s = texture(u_state, uv);
  v_speed = s.w;
  v_life = s.z;
  gl_Position = vec4(s.xy * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = u_pointSize * (0.7 + s.w * 1.3);
}`;

export const POINT_FS = `#version 300 es
precision highp float;
in float v_speed;
in float v_life;
out vec4 frag;
uniform sampler2D u_palette;
void main(){
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float soft = exp(-r2 * 2.6);
  vec3 col = texture(u_palette, vec2(clamp(v_speed, 0.0, 1.0), 0.5)).rgb;
  // fade newborns in and dying particles out so birth/death is gentle
  float lifeFade = smoothstep(0.0, 0.6, v_life);
  // gate brightness by speed: still water stays dark, current glows -> contrast
  float a = soft * lifeFade * (0.12 + 0.88 * v_speed);
  frag = vec4(col * a, a);
}`;

// --- fade the trail buffer toward black (memory slowly forgetting) -----------
export const FADE_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 frag;
uniform sampler2D u_src;
uniform float u_decay;
void main(){
  frag = texture(u_src, v_uv) * u_decay;
}`;

// --- present: tonemap the HDR trail buffer to screen with a soft vignette ----
export const PRESENT_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 frag;
uniform sampler2D u_trail;
uniform float u_exposure;
uniform vec3 u_bg;
void main(){
  vec3 hdr = texture(u_trail, v_uv).rgb * u_exposure;
  // filmic-ish tonemap keeps bright filaments from clipping harshly
  vec3 col = vec3(1.0) - exp(-hdr);
  col = pow(col, vec3(0.86));            // lift midtones
  vec2 q = v_uv - 0.5;
  float vig = smoothstep(1.05, 0.30, length(q) * 1.25);
  col *= mix(0.55, 1.0, vig);             // darken toward the edges
  col += u_bg * (0.5 + 0.5 * vig);        // a faint, edge-darkened ground tone
  frag = vec4(col, 1.0);
}`;
