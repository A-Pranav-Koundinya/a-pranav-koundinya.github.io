import * as THREE from '../vendor/three.module.min.js';

const TAU = Math.PI * 2;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const gauss = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
};

/* ---------------- Shape generators ---------------- */

function sphere(n) {
  const out = new Float32Array(n * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    let x, y, z;
    if (i % 7 === 0) {
      const r = Math.cbrt(Math.random()) * 2.1;
      const t = rand(0, TAU), p = Math.acos(rand(-1, 1));
      x = r * Math.sin(p) * Math.cos(t); y = r * Math.cos(p); z = r * Math.sin(p) * Math.sin(t);
    } else {
      const yy = 1 - (i / (n - 1)) * 2;
      const rad = Math.sqrt(1 - yy * yy);
      const th = golden * i;
      const ripple = 2.45 + 0.14 * Math.sin(th * 3.0) * Math.cos(yy * 9.0);
      x = Math.cos(th) * rad * ripple; y = yy * ripple; z = Math.sin(th) * rad * ripple;
    }
    out.set([x, y, z], i * 3);
  }
  return out;
}

function network(n) {
  const out = new Float32Array(n * 3);
  const layout = [5, 8, 10, 8, 4];
  const layers = layout.map((count, li) => {
    const x = -3.8 + (li / (layout.length - 1)) * 7.6;
    return Array.from({ length: count }, (_, k) => {
      const y = (k - (count - 1) / 2) * (4.6 / Math.max(count - 1, 1));
      return [x, y, Math.sin(k * 1.7 + li) * 0.6];
    });
  });
  const nodeShare = Math.floor(n * 0.38);
  const allNodes = layers.flat();
  for (let i = 0; i < n; i++) {
    let p;
    if (i < nodeShare) {
      const node = allNodes[i % allNodes.length];
      const r = 0.13;
      p = [node[0] + gauss() * r, node[1] + gauss() * r, node[2] + gauss() * r];
    } else {
      const li = Math.floor(Math.random() * (layers.length - 1));
      const a = layers[li][Math.floor(Math.random() * layers[li].length)];
      const b = layers[li + 1][Math.floor(Math.random() * layers[li + 1].length)];
      const t = Math.random();
      p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + gauss() * 0.01, a[2] + (b[2] - a[2]) * t];
    }
    out.set(p, i * 3);
  }
  return out;
}

function knot(n) {
  const out = new Float32Array(n * 3);
  const p = 2, q = 3;
  for (let i = 0; i < n; i++) {
    const phi = (i / n) * TAU * 1.0 + rand(0, 0.002);
    const r = Math.cos(q * phi) + 2.2;
    const cx = r * Math.cos(p * phi), cy = r * Math.sin(p * phi), cz = -Math.sin(q * phi) * 1.2;
    const tube = 0.28 * Math.sqrt(Math.random());
    const a = rand(0, TAU);
    out.set([
      (cx + Math.cos(a) * tube) * 0.95,
      (cy + Math.sin(a) * tube) * 0.95,
      (cz + Math.sin(a + 1.3) * tube) * 0.95,
    ], i * 3);
  }
  return out;
}

function galaxy(n) {
  const out = new Float32Array(n * 3);
  const arms = 3;
  const tilt = 1.05, ct = Math.cos(tilt), st = Math.sin(tilt);
  for (let i = 0; i < n; i++) {
    const r = Math.pow(Math.random(), 1.4) * 4.2;
    const arm = (i % arms) / arms * TAU;
    const ang = arm + r * 1.15;
    const spread = Math.pow(Math.random(), 3) * (1.1 - r * 0.12);
    const x = Math.cos(ang) * r + (Math.random() < .5 ? 1 : -1) * spread;
    const z = Math.sin(ang) * r + (Math.random() < .5 ? 1 : -1) * spread;
    const y = gauss() * 0.12 * (1.4 - r / 4.2);
    out.set([x, y * ct - z * st, y * st + z * ct], i * 3);
  }
  return out;
}

function helix(n) {
  const out = new Float32Array(n * 3);
  const len = 8.4;
  const rungs = 26;
  for (let i = 0; i < n; i++) {
    let x, y, z;
    if (i % 5 === 0) {
      const k = Math.floor(Math.random() * rungs);
      x = -len / 2 + (k + 0.5) * (len / rungs);
      const a = x * 1.5;
      const t = rand(-1, 1);
      y = Math.cos(a) * 1.25 * t; z = Math.sin(a) * 1.25 * t;
    } else {
      x = rand(-len / 2, len / 2);
      const strand = i % 2 ? 0 : Math.PI;
      const a = x * 1.5 + strand;
      const jitter = 0.09;
      y = Math.cos(a) * 1.25 + gauss() * jitter; z = Math.sin(a) * 1.25 + gauss() * jitter;
    }
    out.set([x, y, z], i * 3);
  }
  return out;
}

const SHAPES = [
  { name: 'neural_sphere', fn: sphere },
  { name: 'neural_network', fn: network },
  { name: 'torus_knot', fn: knot },
  { name: 'galaxy_cluster', fn: galaxy },
  { name: 'double_helix', fn: helix },
];

/* ---------------- Shaders ---------------- */

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform vec3  uMouse;
  uniform float uMouseStrength;
  uniform float uScatter;
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute float aRandom;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;

  float easeInOut(float t) { return t < 0.5 ? 4.0*t*t*t : 1.0 - pow(-2.0*t + 2.0, 3.0) / 2.0; }

  void main() {
    float delay = aRandom * 0.35;
    float p = easeInOut(clamp((uProgress - delay) / (1.0 - 0.35), 0.0, 1.0));
    vec3 mid = (aFrom + aTo) * 0.5 + normalize(aFrom + aTo + 0.0001) * (0.6 + aRandom) * sin(p * 3.14159);
    vec3 pos = mix(mix(aFrom, mid, p), mix(mid, aTo, p), p);

    pos += 0.035 * vec3(
      sin(uTime * 0.9 + aRandom * 40.0 + pos.y * 1.7),
      cos(uTime * 0.8 + aRandom * 30.0 + pos.x * 1.7),
      sin(uTime * 1.1 + aRandom * 20.0 + pos.z * 1.7));

    vec4 world = modelMatrix * vec4(pos, 1.0);

    vec3 d = world.xyz - uMouse;
    float dist = length(d.xy);
    float force = smoothstep(1.6, 0.0, dist) * uMouseStrength;
    world.xyz += normalize(d + vec3(0.0001)) * force * 0.9;

    world.xyz += normalize(world.xyz + vec3(0.0001)) * uScatter * (1.5 + aRandom * 5.0);

    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.35 + aRandom * 0.9) * uPixelRatio * (1.0 / -mv.z) * (1.0 + force * 1.4);

    vColor = mix(aColor, vec3(1.0), force * 0.7);
    vAlpha = (0.45 + 0.55 * (0.5 + 0.5 * sin(uTime * 1.6 + aRandom * 60.0))) * (1.0 - uScatter * 0.8);
  }
`;

const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    core = pow(core, 1.8);
    gl_FragColor = vec4(vColor, core * vAlpha);
  }
`;

/* ---------------- Main ---------------- */

export function initHero(canvas, { onMorph } = {}) {
  const small = window.matchMedia('(max-width: 720px)').matches;
  const COUNT = small ? 5200 : 11000;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  } catch (e) {
    canvas.style.display = 'none';
    return { next() {}, setScroll() {} };
  }
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  const targets = SHAPES.map((s) => s.fn(COUNT));

  const palette = [new THREE.Color('#5ef2ff'), new THREE.Color('#8b5cf6'), new THREE.Color('#ff3d81')];
  const colors = new Float32Array(COUNT * 3);
  const randoms = new Float32Array(COUNT);
  const tmp = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const t = Math.random();
    if (t < 0.5) tmp.copy(palette[0]).lerp(palette[1], t * 2);
    else tmp.copy(palette[1]).lerp(palette[2], (t - 0.5) * 2);
    if (Math.random() < 0.06) tmp.set('#ffffff');
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    randoms[i] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(targets[0].slice(), 3));
  const fromAttr = new THREE.BufferAttribute(targets[0].slice(), 3);
  const toAttr = new THREE.BufferAttribute(targets[0].slice(), 3);
  geo.setAttribute('aFrom', fromAttr);
  geo.setAttribute('aTo', toAttr);
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);

  const uniforms = {
    uTime: { value: 0 },
    uProgress: { value: 1 },
    uPixelRatio: { value: pixelRatio },
    uSize: { value: small ? 56 : 66 },
    uMouse: { value: new THREE.Vector3(99, 99, 0) },
    uMouseStrength: { value: 0 },
    uScatter: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment, uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, material);
  const group = new THREE.Group();
  group.add(points);
  scene.add(group);

  // Distant dust for depth
  const dustCount = small ? 500 : 1400;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) dustPos.set([rand(-22, 22), rand(-14, 14), rand(-20, -4)], i * 3);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0x8b91a8, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(dust);

  /* ----- state ----- */
  let current = 0;
  let morphing = false;
  let morphStart = 0;
  const MORPH_MS = 2600;
  const AUTO_MS = 7000;
  let lastMorph = performance.now();

  function next(index) {
    if (morphing) return;
    const target = typeof index === 'number' ? index : (current + 1) % SHAPES.length;
    fromAttr.array.set(targets[current]);
    toAttr.array.set(targets[target]);
    fromAttr.needsUpdate = true;
    toAttr.needsUpdate = true;
    uniforms.uProgress.value = 0;
    current = target;
    morphing = true;
    morphStart = performance.now();
    lastMorph = morphStart;
    onMorph && onMorph(SHAPES[target].name);
  }

  /* ----- sizing ----- */
  let layout = { x: 0, y: 0, s: 1 };
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const aspect = w / h;
    if (aspect > 1.25) layout = { x: Math.min(3.2, aspect * 1.45), y: 0, s: 1 };
    else if (aspect > 0.9) layout = { x: 1.4, y: -0.4, s: 0.85 };
    else layout = { x: 0, y: -0.6, s: 0.72 };
    group.position.set(layout.x, layout.y, 0);
    group.scale.setScalar(layout.s);
  }
  resize();
  window.addEventListener('resize', resize);

  /* ----- pointer ----- */
  const ndc = new THREE.Vector2(9, 9);
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  let pointerActive = 0;
  let tiltX = 0, tiltY = 0;

  const section = canvas.parentElement;
  section.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    pointerActive = 1;
  });
  section.addEventListener('pointerleave', () => { pointerActive = 0; });
  section.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    next();
  });

  /* ----- visibility ----- */
  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0 }).observe(section);

  let scatter = 0;
  function setScroll(v) { scatter = v; }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();

  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const now = performance.now();
    uniforms.uTime.value += dt * (reduced ? 0.2 : 1);

    if (morphing) {
      const p = Math.min((now - morphStart) / MORPH_MS, 1);
      uniforms.uProgress.value = p;
      if (p >= 1) morphing = false;
    } else if (!reduced && now - lastMorph > AUTO_MS) {
      next();
    }

    raycaster.setFromCamera(ndc, camera);
    if (raycaster.ray.intersectPlane(plane, hit)) uniforms.uMouse.value.lerp(hit, 0.18);
    uniforms.uMouseStrength.value += (pointerActive - uniforms.uMouseStrength.value) * 0.06;
    uniforms.uScatter.value += (scatter - uniforms.uScatter.value) * 0.1;

    tiltX += ((pointerActive ? ndc.y : 0) * 0.25 - tiltX) * 0.04;
    tiltY += ((pointerActive ? ndc.x : 0) * 0.35 - tiltY) * 0.04;
    group.rotation.y += dt * 0.09;
    points.rotation.x = -tiltX;
    points.rotation.z = tiltY * 0.3;
    dust.rotation.y += dt * 0.006;

    camera.position.z = 10 + uniforms.uScatter.value * 2.5;
    renderer.render(scene, camera);
  }
  tick();

  return { next, setScroll, shapes: SHAPES.map((s) => s.name) };
}
