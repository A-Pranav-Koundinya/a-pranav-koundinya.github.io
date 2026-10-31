/* =========================================================
   Live project visualizations (Canvas 2D)
   Each viz: (ctx, S) => draw(t, dt)   — S = { w, h, mouse }
   ========================================================= */

const C = {
  cyan: '#5ef2ff', violet: '#8b5cf6', pink: '#ff3d81', lime: '#c6ff4d', amber: '#ffb347',
  text: '#eceef6', muted: '#8b91a8', dim: '#5a6075', grid: 'rgba(255,255,255,0.06)',
};
const TAU = Math.PI * 2;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b));
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function txt(ctx, s, x, y, { color = C.dim, size = 10, weight = 500, align = 'left', base = 'alphabetic', font = 'mono' } = {}) {
  ctx.font = `${weight} ${size}px ${font === 'mono' ? '"JetBrains Mono", ui-monospace, monospace' : '"Manrope", system-ui, sans-serif'}`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(s, x, y);
}
function glowDot(ctx, x, y, r, color, glow = 3, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * glow);
  g.addColorStop(0, rgba(color, 0.55 * alpha)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * glow, 0, TAU); ctx.fill();
  ctx.fillStyle = rgba(color, alpha); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
/* ---------------------------------------------------------
   1. Influencer graph — GraphSAGE-style message passing
   --------------------------------------------------------- */
function graph(ctx, S) {
  const { w, h } = S;
  const N = Math.max(30, Math.min(70, Math.round((w * h) / 3800)));
  const cols = [C.cyan, C.pink, C.violet];
  const nodes = Array.from({ length: N }, (_, i) => ({
    x: rand(w * 0.08, w * 0.92), y: rand(h * 0.12, h * 0.88), vx: 0, vy: 0, g: i % 3, r: rand(1.8, 4.2),
  }));
  const brand = nodes[0];
  Object.assign(brand, { x: w / 2, y: h / 2, r: 7, brand: true });

  const edges = []; const seen = new Set();
  nodes.forEach((a, i) => {
    nodes.map((b, j) => [j, (a.x - b.x) ** 2 + (a.y - b.y) ** 2]).filter(([j]) => j !== i)
      .sort((p, q) => p[1] - q[1]).slice(0, 2)
      .forEach(([j]) => { const k = i < j ? `${i}-${j}` : `${j}-${i}`; if (!seen.has(k)) { seen.add(k); edges.push([i, j]); } });
  });

  const packets = [];
  let recs = []; let lastPick = -10;
  const L = Math.min(w, h) * 0.17;

  return (t) => {
    if (t - lastPick > 3.4) {
      lastPick = t;
      recs = Array.from({ length: N - 1 }, (_, i) => i + 1).sort(() => Math.random() - 0.5).slice(0, 5);
    }
    const ct = t - lastPick;

    for (let i = 0; i < N; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < N; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = Math.max(dx * dx + dy * dy, 30);
        const f = 700 / d2;
        const d = Math.sqrt(d2);
        a.vx += (dx / d) * f * 0.05; a.vy += (dy / d) * f * 0.05;
        b.vx -= (dx / d) * f * 0.05; b.vy -= (dy / d) * f * 0.05;
      }
    }
    for (const [i, j] of edges) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const f = (d - L) * 0.0025;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    const m = S.mouse;
    for (const n of nodes) {
      n.vx += (w / 2 - n.x) * 0.0009; n.vy += (h / 2 - n.y) * 0.0012;
      if (m.in) {
        const dx = m.x - n.x, dy = m.y - n.y, d = Math.hypot(dx, dy);
        if (d < 120) { n.vx += dx * 0.004 * (1 - d / 120); n.vy += dy * 0.004 * (1 - d / 120); }
      }
      if (n.brand) { n.vx += (w / 2 - n.x) * 0.02; n.vy += (h / 2 - n.y) * 0.02; }
      n.vx *= 0.86; n.vy *= 0.86;
      n.x = clamp(n.x + n.vx, 10, w - 10); n.y = clamp(n.y + n.vy, 10, h - 10);
    }

    if (Math.random() < 0.35 && packets.length < 40) packets.push({ e: pick(edges), t: 0, rev: Math.random() < 0.5, s: rand(0.6, 1.2) });

    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath();
    for (const [i, j] of edges) { ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); }
    ctx.stroke();

    const recAlpha = clamp(ct / 0.6) * clamp((3.4 - ct) / 0.5);
    ctx.save();
    ctx.setLineDash([4, 5]); ctx.lineDashOffset = -t * 30;
    for (const k of recs) {
      const n = nodes[k];
      const g = ctx.createLinearGradient(brand.x, brand.y, n.x, n.y);
      g.addColorStop(0, rgba(C.lime, 0.8 * recAlpha)); g.addColorStop(1, rgba(C.lime, 0.15 * recAlpha));
      ctx.strokeStyle = g; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(brand.x, brand.y); ctx.lineTo(n.x, n.y); ctx.stroke();
    }
    ctx.restore();

    ctx.globalCompositeOperation = 'lighter';
    for (let p = packets.length - 1; p >= 0; p--) {
      const pk = packets[p]; pk.t += 0.012 * pk.s;
      if (pk.t >= 1) { packets.splice(p, 1); continue; }
      const [i, j] = pk.e; const a = pk.rev ? nodes[j] : nodes[i], b = pk.rev ? nodes[i] : nodes[j];
      glowDot(ctx, lerp(a.x, b.x, pk.t), lerp(a.y, b.y, pk.t), 1.3, C.violet, 4, 0.9);
    }
    for (const n of nodes) {
      const isRec = recs.includes(nodes.indexOf(n));
      const col = n.brand ? C.lime : cols[n.g];
      glowDot(ctx, n.x, n.y, n.r, col, n.brand ? 5 : 3, n.brand ? 1 : 0.85);
      if (isRec) {
        ctx.strokeStyle = rgba(C.lime, 0.7 * recAlpha); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 4 + Math.sin(t * 5) * 1.5, 0, TAU); ctx.stroke();
      }
    }
    const pulse = (t * 0.8) % 1;
    ctx.strokeStyle = rgba(C.lime, 0.6 * (1 - pulse)); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(brand.x, brand.y, 8 + pulse * 40, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';

    txt(ctx, 'brand query', brand.x, brand.y - 16, { color: C.lime, align: 'center', size: 9 });
    txt(ctx, 'GraphSAGE · CLIP · FAISS top-k', 16, 22);
    const lx = w - 16; let ly = 22;
    [['youtube', C.cyan], ['instagram', C.pink], ['cross-platform', C.violet], ['recommended', C.lime]].forEach(([s, c]) => {
      txt(ctx, s, lx - 12, ly, { align: 'right', size: 9 }); glowDot(ctx, lx - 4, ly - 3, 2.5, c, 2); ly += 15;
    });
  };
}

/* ---------------------------------------------------------
   2. Creative Studios — film strip render pipeline
   --------------------------------------------------------- */
function video(ctx, S) {
  const { w, h } = S;
  const stripH = h * 0.5, stripY = h * 0.18;
  const fw = stripH * 0.6, gap = 14;
  const stages = ['storyline.llm()', 'visuals.seedance()', 'transition.auto()', 'gameplay.capture()', 'render.final()'];
  const kinds = ['ai', 'game', 'live', 'voice'];
  const frames = Array.from({ length: 40 }, (_, i) => ({ hue: (i * 53 + 190) % 360, kind: kinds[i % 4], seed: Math.random() }));

  function drawFrame(x, f, focus) {
    const y = stripY;
    ctx.save();
    rr(ctx, x, y, fw, stripH, 6); ctx.clip();
    const g = ctx.createLinearGradient(x, y, x + fw, y + stripH);
    g.addColorStop(0, `hsla(${f.hue},80%,${focus ? 42 : 22}%,1)`);
    g.addColorStop(1, `hsla(${(f.hue + 60) % 360},85%,${focus ? 16 : 8}%,1)`);
    ctx.fillStyle = g; ctx.fillRect(x, y, fw, stripH);
    if (f.kind === 'game') {
      const cell = fw / 5;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        ctx.fillStyle = `rgba(255,255,255,${(r * 4 + c + Math.floor(f.seed * 9)) % 3 ? 0.12 : 0.42})`;
        rr(ctx, x + cell * 0.5 + c * cell, y + stripH * 0.3 + r * cell, cell * 0.82, cell * 0.82, 3); ctx.fill();
      }
    } else if (f.kind === 'ai') {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.arc(x + fw * 0.62, y + stripH * 0.32, fw * 0.16, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.moveTo(x, y + stripH); ctx.lineTo(x + fw * 0.35, y + stripH * 0.55); ctx.lineTo(x + fw * 0.65, y + stripH * 0.75);
      ctx.lineTo(x + fw, y + stripH * 0.5); ctx.lineTo(x + fw, y + stripH); ctx.fill();
    } else if (f.kind === 'live') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.arc(x + fw / 2, y + stripH * 0.42, fw * 0.15, 0, TAU); ctx.fill();
      rr(ctx, x + fw * 0.25, y + stripH * 0.6, fw * 0.5, stripH * 0.5, 30); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let k = 0; k < 9; k++) {
        const bh = (0.15 + Math.abs(Math.sin(k * 1.3 + f.seed * 10)) * 0.4) * stripH * 0.5;
        rr(ctx, x + fw * 0.14 + k * fw * 0.08, y + stripH * 0.5 - bh / 2, fw * 0.045, bh, 2); ctx.fill();
      }
    }
    ctx.restore();
    txt(ctx, f.kind, x + 6, y + stripH - 7, { color: focus ? '#fff' : 'rgba(255,255,255,.5)', size: 8 });
  }

  return (t) => {
    const speed = 42;
    const total = fw + gap;
    const offset = (t * speed) % total;
    const first = Math.floor((t * speed) / total);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let x = -offset; x < w + 20; x += 14) {
      rr(ctx, x, stripY - 12, 7, 5, 1.5); ctx.fill();
      rr(ctx, x, stripY + stripH + 7, 7, 5, 1.5); ctx.fill();
    }
    const centerX = w / 2;
    for (let i = 0; i * total - offset < w + total; i++) {
      const x = i * total - offset;
      const f = frames[(first + i) % frames.length];
      const focus = x < centerX && x + fw > centerX;
      ctx.globalAlpha = focus ? 1 : 0.5;
      drawFrame(x, f, focus);
      ctx.globalAlpha = 1;
      if (x + fw + gap / 2 > centerX - 40 && x + fw + gap / 2 < centerX + 40) {
        const cx = x + fw + gap / 2;
        const g = ctx.createLinearGradient(cx - 10, 0, cx + 10, 0);
        g.addColorStop(0, rgba(C.cyan, 0)); g.addColorStop(0.5, rgba(C.cyan, 0.5)); g.addColorStop(1, rgba(C.cyan, 0));
        ctx.fillStyle = g; ctx.fillRect(cx - 10, stripY, 20, stripH);
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    const pg = ctx.createLinearGradient(0, stripY - 20, 0, stripY + stripH + 20);
    pg.addColorStop(0, rgba(C.cyan, 0)); pg.addColorStop(0.5, rgba(C.cyan, 0.9)); pg.addColorStop(1, rgba(C.cyan, 0));
    ctx.fillStyle = pg; ctx.fillRect(centerX - 1, stripY - 20, 2, stripH + 40);
    ctx.globalCompositeOperation = 'source-over';

    const wy = h * 0.86, bars = Math.floor(w / 5);
    for (let i = 0; i < bars; i++) {
      const x = i * 5 + 1;
      const amp = Math.abs(Math.sin(i * 0.31 + t * 3.2) * Math.cos(i * 0.07 - t * 1.1)) * 0.7 + Math.random() * 0.15;
      const bh = 3 + amp * h * 0.12;
      ctx.fillStyle = x < centerX ? rgba(C.violet, 0.75) : 'rgba(255,255,255,0.12)';
      ctx.fillRect(x, wy - bh / 2, 2.5, bh);
    }
    const si = Math.floor(t / 1.6) % stages.length;
    txt(ctx, `> ${stages[si]}`, 16, 22, { color: C.cyan });
    stages.forEach((_, i) => {
      ctx.fillStyle = i <= si ? C.cyan : 'rgba(255,255,255,0.15)';
      rr(ctx, w - 16 - (stages.length - i) * 16, 14, 12, 4, 2); ctx.fill();
    });
  };
}

/* ---------------------------------------------------------
   3. Markov chain — puzzle-state transitions to D1
   --------------------------------------------------------- */
function markov(ctx, S) {
  const { w, h } = S;
  const N = {
    S: { x: .09, y: .52, l: 'D0', c: C.violet },
    A: { x: .31, y: .26, l: 'P1·e', c: C.cyan },
    B: { x: .31, y: .78, l: 'P1·h', c: C.cyan },
    C: { x: .56, y: .26, l: 'P2', c: C.cyan },
    D: { x: .56, y: .78, l: 'P3', c: C.cyan },
    R: { x: .86, y: .3, l: 'D1✓', c: C.lime, end: true },
    X: { x: .86, y: .76, l: 'churn', c: C.pink, end: true },
  };
  Object.values(N).forEach((n) => { n.px = n.x * w; n.py = n.y * h; n.flash = 0; });
  const E = [
    ['S', 'A', .62], ['S', 'B', .38], ['A', 'C', .71], ['A', 'D', .29], ['B', 'D', .55], ['B', 'X', .45],
    ['C', 'R', .68], ['C', 'X', .32], ['D', 'R', .41], ['D', 'X', .59],
  ].map(([a, b, p]) => {
    const A = N[a], B = N[b];
    const mx = (A.px + B.px) / 2, my = (A.py + B.py) / 2;
    const dx = B.px - A.px, dy = B.py - A.py;
    return { a, b, p, cx: mx - dy * 0.12, cy: my + dx * 0.12 };
  });
  const out = {}; E.forEach((e) => (out[e.a] = out[e.a] || []).push(e));
  const qp = (e, t) => {
    const A = N[e.a], B = N[e.b];
    const u = 1 - t;
    return [u * u * A.px + 2 * u * t * e.cx + t * t * B.px, u * u * A.py + 2 * u * t * e.cy + t * t * B.py];
  };
  const parts = [];
  let ret = 0, churn = 0, spawn = 0;
  const R = Math.max(11, Math.min(16, h * 0.065));

  return (t, dt) => {
    spawn += dt;
    if (spawn > 0.12) { spawn = 0; parts.push({ node: 'S', e: null, t: 0 }); }
    const m = S.mouse;
    let hover = null;
    if (m.in) for (const [k, n] of Object.entries(N)) if (Math.hypot(m.x - n.px, m.y - n.py) < R + 8) hover = k;

    for (const e of E) {
      const active = hover ? (e.a === hover || e.b === hover) : true;
      ctx.strokeStyle = active ? rgba(N[e.b].end ? N[e.b].c : C.violet, hover ? 0.75 : 0.3) : 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 0.6 + e.p * 3;
      ctx.beginPath(); ctx.moveTo(N[e.a].px, N[e.a].py); ctx.quadraticCurveTo(e.cx, e.cy, N[e.b].px, N[e.b].py); ctx.stroke();
      const [lx, ly] = qp(e, 0.5);
      txt(ctx, e.p.toFixed(2), lx, ly - 4, { color: active ? C.muted : C.dim, size: 9, align: 'center' });
    }

    ctx.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (!p.e) {
        const opts = out[p.node];
        let r = Math.random(), acc = 0;
        p.e = opts.find((o) => (acc += o.p) >= r) || opts[opts.length - 1];
        p.t = 0;
      }
      p.t += dt * 0.9;
      if (p.t >= 1) {
        const dest = N[p.e.b];
        if (dest.end) {
          dest.flash = 1;
          if (p.e.b === 'R') ret++; else churn++;
          parts.splice(i, 1); continue;
        }
        p.node = p.e.b; p.e = null; continue;
      }
      const [x, y] = qp(p.e, easeInOut(p.t));
      glowDot(ctx, x, y, 1.6, N[p.e.b].end ? N[p.e.b].c : C.cyan, 4, 0.9);
    }
    ctx.globalCompositeOperation = 'source-over';

    for (const [k, n] of Object.entries(N)) {
      n.flash *= 0.9;
      ctx.fillStyle = '#0a0c13';
      ctx.beginPath(); ctx.arc(n.px, n.py, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(n.c, 0.6 + n.flash * 0.4 + (hover === k ? 0.4 : 0)); ctx.lineWidth = 1.5 + n.flash * 2;
      ctx.stroke();
      if (n.flash > 0.05 || hover === k) { glowDot(ctx, n.px, n.py, R * 0.5, n.c, 3, 0.25 + n.flash * 0.3); }
      txt(ctx, n.l, n.px, n.py + 0.5, { color: '#fff', size: 9, align: 'center', base: 'middle', weight: 700 });
    }
    const total = ret + churn;
    txt(ctx, `simulated D1 retention: ${total ? ((ret / total) * 100).toFixed(1) : '--'}%`, 16, h - 14, { color: C.lime });
    txt(ctx, 'markov · transition p(s→s′)', 16, 20);
  };
}

/* ---------------------------------------------------------
   4. Revenue dashboard — spend bars, ROAS & forecast band
   --------------------------------------------------------- */
function revenue(ctx, S) {
  const { w, h } = S;
  const M = 14, HIST = 9;
  const pad = { l: 34, r: 16, t: 38, b: 26 };
  const cw = w - pad.l - pad.r, chh = h - pad.t - pad.b;
  const spend = Array.from({ length: M }, (_, i) => 0.35 + 0.25 * Math.sin(i * 0.8) + 0.12 * Math.random() + i * 0.02);
  const roas = Array.from({ length: M }, (_, i) => 0.3 + 0.45 * (1 - Math.exp(-i / 4)) + 0.05 * Math.sin(i * 1.7));
  const X = (i) => pad.l + (i + 0.5) * (cw / M);
  const Y = (v) => pad.t + chh * (1 - v);
  const CYCLE = 8;

  return (t) => {
    const p = (t % CYCLE) / CYCLE;
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const y = pad.t + (chh / 4) * k;
      ctx.beginPath(); ctx.moveTo(pad.l, y + .5); ctx.lineTo(w - pad.r, y + .5); ctx.stroke();
      txt(ctx, `${(1 - k / 4).toFixed(2)}x`, pad.l - 6, y + 3, { align: 'right', size: 8 });
    }
    const bw = (cw / M) * 0.52;
    for (let i = 0; i < M; i++) {
      const g = clamp((p - i * 0.018) / 0.2);
      const v = spend[i] * easeOut(g);
      const isF = i >= HIST;
      ctx.fillStyle = isF ? rgba(C.violet, 0.16) : rgba(C.violet, 0.45);
      rr(ctx, X(i) - bw / 2, Y(v), bw, chh * v, 3); ctx.fill();
    }
    const lp = clamp((p - 0.25) / 0.3);
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.beginPath();
    const histEnd = (HIST - 1) * lp;
    for (let s = 0; s <= histEnd; s += 0.1) {
      const i = Math.floor(s), f = s - i;
      const v = lerp(roas[i], roas[Math.min(i + 1, M - 1)], f);
      s === 0 ? ctx.moveTo(X(s), Y(v)) : ctx.lineTo(X(s), Y(v));
    }
    ctx.stroke();

    const fp = clamp((p - 0.58) / 0.22);
    if (fp > 0) {
      const endIdx = HIST - 1 + (M - HIST) * fp;
      ctx.beginPath();
      const up = [], dn = [];
      for (let s = HIST - 1; s <= endIdx; s += 0.1) {
        const i = Math.floor(s), f = s - i;
        const v = lerp(roas[i], roas[Math.min(i + 1, M - 1)], f);
        const band = (s - (HIST - 1)) * 0.035;
        up.push([X(s), Y(v + band)]); dn.push([X(s), Y(v - band)]);
      }
      if (up.length) {
        ctx.moveTo(up[0][0], up[0][1]); up.forEach(([x, y]) => ctx.lineTo(x, y));
        dn.reverse().forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath();
        ctx.fillStyle = rgba(C.cyan, 0.12); ctx.fill();
      }
      ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let s = HIST - 1; s <= endIdx; s += 0.1) {
        const i = Math.floor(s), f = s - i;
        const v = lerp(roas[i], roas[Math.min(i + 1, M - 1)], f);
        s === HIST - 1 ? ctx.moveTo(X(s), Y(v)) : ctx.lineTo(X(s), Y(v));
      }
      ctx.stroke(); ctx.restore();
    }
    const todayX = (X(HIST - 1) + X(HIST)) / 2;
    ctx.save(); ctx.setLineDash([2, 4]); ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.moveTo(todayX, pad.t - 6); ctx.lineTo(todayX, h - pad.b); ctx.stroke(); ctx.restore();
    txt(ctx, 'today', todayX + 4, pad.t - 2, { size: 8, color: C.muted });

    if (lp > 0.99) glowDot(ctx, X(HIST - 1), Y(roas[HIST - 1]), 3, C.cyan, 4);

    const m = S.mouse;
    if (m.in && m.x > pad.l && m.x < w - pad.r) {
      const i = clamp(Math.floor((m.x - pad.l) / (cw / M)), 0, M - 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.moveTo(X(i), pad.t); ctx.lineTo(X(i), h - pad.b); ctx.stroke();
      glowDot(ctx, X(i), Y(roas[i]), 3.5, C.cyan, 3);
      const label = `${i >= HIST ? 'forecast' : 'actual'} · m${i + 1}`;
      const bx = clamp(X(i) + 8, 0, w - 110);
      rr(ctx, bx, Y(roas[i]) - 30, 104, 22, 6); ctx.fillStyle = 'rgba(16,19,29,.95)'; ctx.fill();
      ctx.strokeStyle = C.grid; ctx.stroke();
      txt(ctx, label, bx + 8, Y(roas[i]) - 15, { color: C.text, size: 9 });
    }
    txt(ctx, '▮ spend', 16, 20, { color: C.violet, size: 9 });
    txt(ctx, '— ROAS', 76, 20, { color: C.cyan, size: 9 });
    txt(ctx, '┄ forecast', 132, 20, { color: C.muted, size: 9 });
  };
}

/* ---------------------------------------------------------
   5. LTV curves — GCC markets
   --------------------------------------------------------- */
function ltv(ctx, S) {
  const { w, h } = S;
  const pad = { l: 22, r: 40, t: 34, b: 26 };
  const cw = w - pad.l - pad.r, chh = h - pad.t - pad.b;
  const markets = [
    { k: 'SA', c: C.cyan, a: 0.92, tau: 55 },
    { k: 'AE', c: C.violet, a: 0.78, tau: 48 },
    { k: 'KW', c: C.pink, a: 0.63, tau: 62 },
    { k: 'QA', c: C.lime, a: 0.5, tau: 40 },
  ];
  const D = 180;
  const f = (m, d) => m.a * (1 - Math.exp(-d / m.tau)) * (0.85 + 0.15 * Math.log1p(d) / Math.log1p(D));
  const dots = markets.map((m) => Array.from({ length: 16 }, () => { const d = rand(3, D); return [d, f(m, d) + rand(-0.035, 0.035)]; }));
  const X = (d) => pad.l + (d / D) * cw, Y = (v) => pad.t + chh * (1 - v);
  const CYCLE = 7;

  return (t) => {
    const p = clamp(((t % CYCLE) / CYCLE) / 0.6);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    [0, 30, 60, 90, 120, 150, 180].forEach((d) => {
      ctx.beginPath(); ctx.moveTo(X(d) + .5, pad.t); ctx.lineTo(X(d) + .5, h - pad.b); ctx.stroke();
      txt(ctx, `D${d}`, X(d), h - pad.b + 14, { size: 8, align: 'center' });
    });
    markets.forEach((m, mi) => {
      ctx.globalAlpha = 0.6;
      dots[mi].forEach(([d, v]) => { if (d / D <= p) { ctx.fillStyle = rgba(m.c, 0.5); ctx.beginPath(); ctx.arc(X(d), Y(v), 1.6, 0, TAU); ctx.fill(); } });
      ctx.globalAlpha = 1;
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let d = 0; d <= D * p; d += 2) { const v = m.a * 0.85 * (d / D) ** 0.6; d === 0 ? ctx.moveTo(X(d), Y(v)) : ctx.lineTo(X(d), Y(v)); }
      ctx.stroke(); ctx.restore();
      ctx.strokeStyle = m.c; ctx.lineWidth = 2; ctx.shadowColor = m.c; ctx.shadowBlur = 8; ctx.beginPath();
      for (let d = 0; d <= D * p; d += 1.5) { const v = f(m, d); d === 0 ? ctx.moveTo(X(d), Y(v)) : ctx.lineTo(X(d), Y(v)); }
      ctx.stroke(); ctx.shadowBlur = 0;
      const dEnd = D * p;
      glowDot(ctx, X(dEnd), Y(f(m, dEnd)), 2.6, m.c, 3);
      if (p > 0.98) txt(ctx, m.k, X(D) + 8, Y(f(m, D)) + 3, { color: m.c, size: 9, weight: 700 });
    });
    const mm = S.mouse;
    if (mm.in && mm.x > pad.l && mm.x < pad.l + cw) {
      const d = ((mm.x - pad.l) / cw) * D;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(mm.x, pad.t); ctx.lineTo(mm.x, h - pad.b); ctx.stroke();
      markets.forEach((m) => glowDot(ctx, mm.x, Y(f(m, d)), 2.5, m.c, 2));
      txt(ctx, `D${Math.round(d)}`, mm.x + 5, pad.t + 10, { color: C.text, size: 9 });
    }
    txt(ctx, 'pred. LTV(d) · game × CLI × country', 16, 20);
    txt(ctx, '┄ baseline', w - 16, 20, { align: 'right', size: 9 });
  };
}

/* ---------------------------------------------------------
   6. Static creative generator — tiles regenerate under scan
   --------------------------------------------------------- */
function tiles(ctx, S) {
  const { w, h } = S;
  const cols = w > 420 ? 5 : 4, rows = 3;
  const gx = 16, gy = 34, gap = 9;
  const tw = (w - gx * 2 - gap * (cols - 1)) / cols;
  const th = (h - gy - 16 - gap * (rows - 1)) / rows;
  const borders = ['solid', 'double', 'dashed', 'glow'];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const make = () => ({
    h1: randi(0, 360), h2: randi(0, 360), b: pick(borders), angle: rand(0, TAU),
    word: Array.from({ length: randi(3, 6) }, () => letters[randi(0, 26)]).join(''),
    nums: Array.from({ length: 6 }, () => randi(1, 26)), layout: randi(0, 3), flash: 0,
  });
  const grid = Array.from({ length: cols * rows }, make);
  let generated = 0, lastIdx = -1;

  return (t) => {
    const per = 0.32;
    const idx = Math.floor(t / per) % grid.length;
    if (idx !== lastIdx) { lastIdx = idx; grid[idx] = make(); grid[idx].flash = 1; generated++; }

    grid.forEach((g, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x = gx + c * (tw + gap), y = gy + r * (th + gap);
      ctx.save();
      rr(ctx, x, y, tw, th, 7); ctx.clip();
      const gr = ctx.createLinearGradient(x, y, x + tw * Math.cos(g.angle) + tw, y + th);
      gr.addColorStop(0, `hsl(${g.h1},70%,${22 + g.flash * 20}%)`); gr.addColorStop(1, `hsl(${g.h2},75%,10%)`);
      ctx.fillStyle = gr; ctx.fillRect(x, y, tw, th);
      const n = Math.min(g.word.length, 5);
      const bs = Math.min((tw - 14) / n - 3, th * 0.32);
      const startX = x + (tw - (bs + 3) * n + 3) / 2;
      const by = g.layout === 0 ? y + th * 0.22 : g.layout === 1 ? y + th * 0.4 : y + th * 0.3;
      for (let k = 0; k < n; k++) {
        const bx = startX + k * (bs + 3);
        ctx.fillStyle = 'rgba(255,255,255,0.88)'; rr(ctx, bx, by, bs, bs, 2); ctx.fill();
        txt(ctx, g.word[k], bx + bs / 2, by + bs / 2 + 1, { color: '#111', size: Math.max(7, bs * 0.55), weight: 700, align: 'center', base: 'middle' });
        txt(ctx, String(g.nums[k]), bx + bs / 2, by + bs + 8, { color: 'rgba(255,255,255,.7)', size: 7, align: 'center' });
      }
      ctx.restore();
      ctx.save();
      rr(ctx, x + 0.5, y + 0.5, tw - 1, th - 1, 7);
      if (g.b === 'dashed') ctx.setLineDash([4, 3]);
      ctx.strokeStyle = g.b === 'glow' ? rgba(C.cyan, 0.9) : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = g.b === 'double' ? 3 : 1.2;
      if (g.b === 'glow') { ctx.shadowColor = C.cyan; ctx.shadowBlur = 10; }
      ctx.stroke(); ctx.restore();
      if (g.flash > 0.02) {
        ctx.fillStyle = `rgba(255,255,255,${g.flash * 0.35})`; rr(ctx, x, y, tw, th, 7); ctx.fill();
        g.flash *= 0.9;
      }
    });
    const c = idx % cols, r = Math.floor(idx / cols);
    const sx = gx + c * (tw + gap) + tw * ((t % per) / per);
    const sy = gy + r * (th + gap);
    ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createLinearGradient(sx - 14, 0, sx, 0);
    sg.addColorStop(0, rgba(C.lime, 0)); sg.addColorStop(1, rgba(C.lime, 0.75));
    ctx.fillStyle = sg; ctx.fillRect(sx - 14, sy, 14, th);
    ctx.globalCompositeOperation = 'source-over';
    txt(ctx, `batch_render · ${String(generated).padStart(4, '0')} creatives`, 16, 21, { color: C.lime });
    txt(ctx, 'text·bg·border·font·layout', w - 16, 21, { align: 'right', size: 9 });
  };
}

/* ---------------------------------------------------------
   7. LLM content pipeline — generation + duplicate detection
   --------------------------------------------------------- */
function words(ctx, S) {
  const { w, h } = S;
  const bank = [
    ['ORBIT', 'Path of a planet'], ['CIPHER', 'Secret code'], ['QUARTZ', 'Watch crystal'], ['LAGOON', 'Shallow coastal pool'],
    ['SAFFRON', 'Priciest spice'], ['ECLIPSE', 'Sun blocker, briefly'], ['MOSAIC', 'Tile artwork'], ['TUNDRA', 'Frozen plain'],
    ['ZEPHYR', 'Gentle breeze'], ['NEBULA', 'Star nursery'], ['PRISM', 'Light splitter'], ['ATLAS', 'Book of maps'],
  ];
  const split = w > 380;
  const listW = split ? w * 0.56 : w - 32;
  const plotX = split ? w * 0.6 : 0, plotW = w - plotX - 16, plotY = 40, plotH = h - 60;
  const hist = Array.from({ length: 60 }, () => [rand(0.05, 0.95), rand(0.05, 0.95)]);
  const rows = [];
  let next = 0, timer = 0, probe = null;

  function spawn() {
    const [word, clue] = bank[next++ % bank.length];
    const dup = Math.random() < 0.3;
    const target = dup ? pick(hist).map((v) => v + rand(-0.015, 0.015)) : [rand(0.05, 0.95), rand(0.05, 0.95)];
    rows.unshift({ word, clue, age: 0, dup, status: 'gen', target });
    probe = { from: [0.5, -0.2], to: target, t: 0, dup };
    if (rows.length > 6) rows.pop();
  }
  spawn();

  return (t, dt) => {
    timer += dt;
    if (timer > 1.9) { timer = 0; spawn(); }
    const rowH = 26;
    rows.forEach((r, i) => {
      r.age += dt;
      const y = 44 + i * rowH;
      if (y > h - 10) return;
      const alpha = clamp(1 - i * 0.16);
      ctx.globalAlpha = alpha;
      if (r.age > 1.2 && r.status === 'gen') r.status = r.dup ? 'dup' : 'ok';
      txt(ctx, r.word, 16, y, { color: C.text, size: 11, weight: 700 });
      const n = Math.floor(clamp(r.age / 0.9) * r.clue.length);
      const maxChars = Math.max(6, Math.floor((listW - 160) / 6));
      const clue = r.clue.slice(0, Math.min(n, maxChars)) + (n < r.clue.length && r.age < 0.9 ? '▌' : '');
      txt(ctx, clue, 84, y, { color: C.muted, size: 9.5 });
      const bx = listW - 54;
      if (r.status !== 'gen') {
        const ok = r.status === 'ok';
        rr(ctx, bx, y - 11, 56, 15, 7); ctx.fillStyle = rgba(ok ? C.lime : C.pink, 0.14); ctx.fill();
        txt(ctx, ok ? '✓ valid' : '✕ dup·regen', bx + 28, y - 1, { color: ok ? C.lime : C.pink, size: 8, align: 'center' });
      } else {
        txt(ctx, '…', bx + 28, y - 1, { color: C.dim, size: 9, align: 'center' });
      }
      ctx.globalAlpha = 1;
    });

    if (split) {
      rr(ctx, plotX, plotY - 8, plotW, plotH + 8, 10); ctx.strokeStyle = C.grid; ctx.stroke();
      const PX = (v) => plotX + 8 + v * (plotW - 16), PY = (v) => plotY + v * (plotH - 10);
      hist.forEach(([x, y]) => { ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.arc(PX(x), PY(y), 1.8, 0, TAU); ctx.fill(); });
      if (probe) {
        probe.t = Math.min(probe.t + dt / 1.1, 1);
        const e = easeOut(probe.t);
        const x = PX(lerp(probe.from[0], probe.to[0], e)), y = PY(lerp(probe.from[1], probe.to[1], e));
        const col = probe.t < 1 ? C.cyan : probe.dup ? C.pink : C.lime;
        if (probe.t >= 1) {
          ctx.strokeStyle = rgba(col, 0.6); ctx.setLineDash([2, 3]);
          ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        }
        glowDot(ctx, x, y, 3, col, 4);
      }
      txt(ctx, 'embedding space · 223 records', plotX + 8, plotY + plotH + 14 > h - 4 ? h - 6 : plotY + plotH + 14, { size: 8 });
    }
    txt(ctx, 'word → clue → source → cite → fact-check', 16, 20, { color: C.cyan, size: 9 });
  };
}

/* ---------------------------------------------------------
   8. Playwright agent — deterministic browser workflow
   --------------------------------------------------------- */
function agent(ctx, S) {
  const { w, h } = S;
  const nets = ['inmobi', 'mintegral', 'ironsource', 'ogury', 'bigo', 'media.net', 'pubnative', 'vidazoo', 'bidmachine', 'mobilefuse'];
  const logW = w > 440 ? 132 : 0;
  const bx = 14, by = 30, bw = w - 28 - logW - (logW ? 10 : 0), bh = h - 44;
  const steps = ['login', 'date 1st–25th', 'run report', 'screenshot', 'export csv', 'fuse → xlsx'];
  const STEP = 0.75;
  const T = {
    login: [bx + bw * 0.5, by + bh * 0.55],
    date: [bx + bw * 0.78, by + 46],
    run: [bx + bw * 0.9, by + 46],
    shot: [bx + bw * 0.55, by + bh * 0.6],
    exp: [bx + bw - 36, by + bh - 20],
    fuse: [bx + bw - 36, by + bh - 20],
  };
  const targets = [T.login, T.date, T.run, T.shot, T.exp, T.fuse];

  return (t) => {
    const cycle = steps.length * STEP + 0.8;
    const ct = t % cycle;
    const net = nets[Math.floor(t / cycle) % nets.length];
    const si = Math.min(Math.floor(ct / STEP), steps.length);
    const lp = (ct % STEP) / STEP;

    rr(ctx, bx, by, bw, bh, 10); ctx.fillStyle = '#0d1018'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; rr(ctx, bx, by, bw, 24, 10); ctx.fill();
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(bx + 12 + i * 11, by + 12, 3.2, 0, TAU); ctx.fill(); });
    rr(ctx, bx + 52, by + 6, bw - 64, 13, 6); ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();
    txt(ctx, `https://dashboard.${net}.com/reports`, bx + 60, by + 15.5, { size: 8, color: C.muted });

    if (si === 0) {
      const fx = bx + bw * 0.3, fw = bw * 0.4;
      ['user', 'password'].forEach((s, i) => {
        rr(ctx, fx, by + bh * 0.28 + i * 22, fw, 16, 4); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
        txt(ctx, s === 'password' ? '•'.repeat(Math.floor(lp * 10)) : 'finance@…', fx + 6, by + bh * 0.28 + i * 22 + 11, { size: 8, color: C.muted });
      });
      rr(ctx, fx, by + bh * 0.55 - 8, fw, 16, 8); ctx.fillStyle = rgba(C.violet, 0.6); ctx.fill();
      txt(ctx, 'sign in', fx + fw / 2, by + bh * 0.55 + 3, { size: 8, color: '#fff', align: 'center' });
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(bx, by + 24, 46, bh - 24);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(ctx, bx + 10, by + 40 + i * 16, 26, 5, 2); ctx.fill(); }
      rr(ctx, bx + bw * 0.78 - 34, by + 38, 68, 16, 5); ctx.fillStyle = si >= 2 ? rgba(C.cyan, 0.18) : 'rgba(255,255,255,0.06)'; ctx.fill();
      txt(ctx, si >= 2 ? '01 → 25' : 'date ▾', bx + bw * 0.78, by + 49, { size: 8, align: 'center', color: si >= 2 ? C.cyan : C.muted });
      rr(ctx, bx + bw * 0.9 - 14, by + 38, 28, 16, 5); ctx.fillStyle = rgba(C.violet, 0.5); ctx.fill();
      txt(ctx, 'run', bx + bw * 0.9, by + 49, { size: 8, align: 'center', color: '#fff' });
      const rowsShown = si >= 3 ? 6 : si === 2 ? Math.floor(lp * 6) : 0;
      for (let r = 0; r < rowsShown; r++) {
        const y = by + 66 + r * 14;
        if (y > by + bh - 34) break;
        ctx.fillStyle = r % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
        ctx.fillRect(bx + 56, y, bw - 66, 11);
        ctx.fillStyle = rgba(C.cyan, 0.4); ctx.fillRect(bx + bw - 60, y + 3, (Math.sin(r * 2.1) * 0.5 + 0.6) * 40, 5);
      }
      rr(ctx, bx + bw - 66, by + bh - 28, 60, 16, 5); ctx.fillStyle = si >= 4 ? rgba(C.lime, 0.25) : 'rgba(255,255,255,0.06)'; ctx.fill();
      txt(ctx, 'export ↓', bx + bw - 36, by + bh - 17, { size: 8, align: 'center', color: si >= 4 ? C.lime : C.muted });
    }
    if (si === 3) {
      ctx.fillStyle = `rgba(255,255,255,${(1 - lp) * 0.25})`; rr(ctx, bx, by, bw, bh, 10); ctx.fill();
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.5; const c = 12;
      [[bx + 6, by + 30, 1, 1], [bx + bw - 6, by + 30, -1, 1], [bx + 6, by + bh - 6, 1, -1], [bx + bw - 6, by + bh - 6, -1, -1]].forEach(([x, y, sx, sy]) => {
        ctx.beginPath(); ctx.moveTo(x, y + c * sy); ctx.lineTo(x, y); ctx.lineTo(x + c * sx, y); ctx.stroke();
      });
      ctx.lineWidth = 1;
    }
    if (si >= 5) {
      rr(ctx, bx + bw / 2 - 70, by + bh / 2 - 13, 140, 26, 13); ctx.fillStyle = rgba(C.lime, 0.9 * (si === 5 ? lp : 1)); ctx.fill();
      txt(ctx, `${net}_2026.xlsx ✓`, bx + bw / 2, by + bh / 2 + 4, { size: 9, color: '#05060a', weight: 700, align: 'center' });
    }

    const from = targets[Math.max(0, Math.min(si, steps.length - 1) - 1)] || T.login;
    const to = targets[Math.min(si, steps.length - 1)];
    const mp = easeInOut(clamp(lp / 0.6));
    const cx = lerp(from[0], to[0], si === 0 ? 1 : mp), cy = lerp(from[1], to[1], si === 0 ? 1 : mp);
    if (lp > 0.6 && lp < 0.95 && si < steps.length) {
      const rp = (lp - 0.6) / 0.35;
      ctx.strokeStyle = rgba(C.cyan, 1 - rp); ctx.beginPath(); ctx.arc(cx, cy, 4 + rp * 14, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = '#fff'; ctx.beginPath();
    ctx.moveTo(cx, cy); ctx.lineTo(cx + 9, cy + 4); ctx.lineTo(cx + 4, cy + 5); ctx.lineTo(cx + 2, cy + 10); ctx.closePath(); ctx.fill();

    if (logW) {
      const lx = w - logW - 14;
      rr(ctx, lx, by, logW, bh, 10); ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fill(); ctx.strokeStyle = C.grid; ctx.stroke();
      txt(ctx, `site: ${net}`, lx + 10, by + 16, { size: 8, color: C.cyan });
      steps.forEach((s, i) => {
        const y = by + 36 + i * 17;
        if (y > by + bh - 6) return;
        const done = i < si, cur = i === si;
        txt(ctx, `${done ? '✓' : cur ? '›' : '·'} ${s}`, lx + 10, y, { size: 8.5, color: done ? C.lime : cur ? C.text : C.dim });
      });
    }
    txt(ctx, 'playwright · 25+ networks · zero LLM calls', 16, 20, { size: 9 });
  };
}

/* ---------------------------------------------------------
   9. U-Net — road segmentation scan + hover lens
   --------------------------------------------------------- */
function segment(ctx, S) {
  const { w, h, dpr } = S;
  const mk = () => { const c = document.createElement('canvas'); c.width = w * dpr; c.height = h * dpr; const x = c.getContext('2d'); x.scale(dpr, dpr); return [c, x]; };
  const [base, b] = mk();
  const [mask, mctx] = mk();

  b.fillStyle = '#0b100e'; b.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    b.fillStyle = `hsla(${rand(80, 140)},${rand(15, 35)}%,${rand(8, 16)}%,${rand(0.4, 0.9)})`;
    b.beginPath(); b.ellipse(rand(0, w), rand(0, h), rand(20, 70), rand(12, 40), rand(0, TAU), 0, TAU); b.fill();
  }
  for (let i = 0; i < 90; i++) {
    b.fillStyle = `rgba(${randi(70, 120)},${randi(70, 110)},${randi(70, 100)},${rand(0.3, 0.7)})`;
    b.fillRect(rand(0, w), rand(0, h), rand(4, 12), rand(4, 12));
  }
  const roads = [];
  for (let i = 0; i < 3; i++) {
    const y0 = rand(0.1, 0.9) * h;
    roads.push([[-20, y0], [w * 0.33, rand(0, h)], [w * 0.66, rand(0, h)], [w + 20, rand(0.1, 0.9) * h], rand(6, 10)]);
  }
  for (let i = 0; i < 2; i++) {
    const x0 = rand(0.15, 0.85) * w;
    roads.push([[x0, -20], [rand(0, w), h * 0.4], [rand(0, w), h * 0.6], [rand(0.15, 0.85) * w, h + 20], rand(5, 8)]);
  }
  const strokeRoads = (c, color, extra = 0) => {
    roads.forEach(([p0, p1, p2, p3, lw]) => {
      c.strokeStyle = color; c.lineWidth = lw + extra; c.lineCap = 'round';
      c.beginPath(); c.moveTo(...p0); c.bezierCurveTo(...p1, ...p2, ...p3); c.stroke();
    });
  };
  strokeRoads(b, '#3b4049', 2);
  strokeRoads(b, '#4d535e');
  b.save(); b.setLineDash([5, 7]);
  roads.forEach(([p0, p1, p2, p3]) => { b.strokeStyle = 'rgba(255,230,150,.35)'; b.lineWidth = 1; b.beginPath(); b.moveTo(...p0); b.bezierCurveTo(...p1, ...p2, ...p3); b.stroke(); });
  b.restore();
  strokeRoads(mctx, C.cyan);

  return (t) => {
    ctx.drawImage(base, 0, 0, w, h);
    const sx = ((t * 0.22) % 1.25) * w;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, Math.min(sx, w), h); ctx.clip();
    ctx.fillStyle = 'rgba(5,6,10,0.55)'; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.85;
    ctx.drawImage(mask, 0, 0, w, h);
    ctx.restore();

    const m = S.mouse;
    if (m.in) {
      ctx.save(); ctx.beginPath(); ctx.arc(m.x, m.y, 48, 0, TAU); ctx.clip();
      ctx.fillStyle = 'rgba(5,6,10,0.6)'; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(mask, 0, 0, w, h);
      ctx.restore();
      ctx.strokeStyle = rgba(C.cyan, 0.8); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(m.x, m.y, 48, 0, TAU); ctx.stroke();
    }
    if (sx < w) {
      const g = ctx.createLinearGradient(sx - 30, 0, sx, 0);
      g.addColorStop(0, rgba(C.cyan, 0)); g.addColorStop(1, rgba(C.cyan, 0.5));
      ctx.fillStyle = g; ctx.fillRect(sx - 30, 0, 30, h);
      ctx.fillStyle = C.cyan; ctx.fillRect(sx - 1, 0, 2, h);
    }
    if (w > 340) {
      const ux = w - 120, uy = h - 26;
      const sizes = [26, 20, 14, 8, 14, 20, 26];
      sizes.forEach((s, i) => {
        const x = ux + i * 14;
        const active = Math.floor((t * 4) % sizes.length) === i;
        ctx.fillStyle = active ? C.cyan : 'rgba(255,255,255,0.25)';
        rr(ctx, x, uy - s, 8, s, 2); ctx.fill();
      });
      ctx.strokeStyle = 'rgba(94,242,255,0.35)'; ctx.setLineDash([2, 2]);
      [[0, 6], [1, 5], [2, 4]].forEach(([a, bb]) => { const y = uy - sizes[a] - 4 - a * 3; ctx.beginPath(); ctx.moveTo(ux + a * 14 + 4, y); ctx.lineTo(ux + bb * 14 + 4, y); ctx.stroke(); });
      ctx.setLineDash([]);
    }
    rr(ctx, 12, 10, 150, 18, 9); ctx.fillStyle = 'rgba(5,6,10,0.7)'; ctx.fill();
    txt(ctx, 'U-Net mask · acc 91.17%', 20, 22.5, { color: C.cyan, size: 9 });
  };
}

/* ---------------------------------------------------------
   10. Inventory — dynamic threshold alerts + categories
   --------------------------------------------------------- */
function inventory(ctx, S) {
  const { w, h } = S;
  const pad = { l: 16, r: 16, t: 34, b: h > 200 ? 54 : 30 };
  const chh = h - pad.t - pad.b;
  const step = 4;
  const n = Math.ceil((w - pad.l - pad.r) / step) + 2;
  let level = 0.8;
  const vals = [];
  const gen = () => {
    level -= rand(0.004, 0.022);
    if (level < rand(0.12, 0.3)) level = rand(0.75, 0.95);
    return clamp(level + rand(-0.02, 0.02), 0.02, 1);
  };
  for (let i = 0; i < n; i++) vals.push(gen());
  const cats = [['Electronics', C.cyan, 0], ['Grocery', C.lime, 0], ['Apparel', C.pink, 0], ['Home', C.amber, 0]];
  let acc = 0;
  const Y = (v) => pad.t + chh * (1 - v);
  const win = 28;

  return (t, dt) => {
    acc += dt * 26;
    while (acc >= 1) {
      acc -= 1; vals.shift(); vals.push(gen());
      if (Math.random() < 0.3) cats[randi(0, 4)][2] += 1;
    }
    const thr = vals.map((_, i) => {
      const s = vals.slice(Math.max(0, i - win), i + 1);
      const mean = s.reduce((a, b) => a + b, 0) / s.length;
      const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length);
      return clamp(mean - 1.1 * sd, 0.05, 1);
    });
    const X = (i) => pad.l + i * step - (acc * step);

    ctx.beginPath();
    thr.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    ctx.lineTo(X(n - 1), Y(0)); ctx.lineTo(X(0), Y(0)); ctx.closePath();
    ctx.fillStyle = rgba(C.pink, 0.08); ctx.fill();
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = rgba(C.pink, 0.6); ctx.lineWidth = 1; ctx.beginPath();
    thr.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)))); ctx.stroke(); ctx.restore();

    const g = ctx.createLinearGradient(0, pad.t, 0, pad.t + chh);
    g.addColorStop(0, rgba(C.cyan, 0.25)); g.addColorStop(1, rgba(C.cyan, 0));
    ctx.beginPath(); vals.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    ctx.lineTo(X(n - 1), Y(0)); ctx.lineTo(X(0), Y(0)); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.8; ctx.beginPath();
    vals.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)))); ctx.stroke();

    let alerts = 0;
    for (let i = 1; i < n; i++) {
      if (vals[i] < thr[i] && vals[i - 1] >= thr[i - 1]) {
        alerts++;
        const x = X(i), y = Y(vals[i]);
        const pulse = (t * 2 + i * 0.1) % 1;
        ctx.strokeStyle = rgba(C.pink, 1 - pulse); ctx.beginPath(); ctx.arc(x, y, 3 + pulse * 12, 0, TAU); ctx.stroke();
        glowDot(ctx, x, y, 2.6, C.pink, 3);
        if (x > 60 && x < w - 60) txt(ctx, 'reorder', x, y - 12, { color: C.pink, size: 8, align: 'center' });
      }
    }

    if (h > 200) {
      const total = cats.reduce((a, c) => a + c[2], 0) || 1;
      const bw = (w - pad.l - pad.r - 9) / 4;
      cats.forEach(([name, col, cnt], i) => {
        const x = pad.l + i * (bw + 3), y = h - 32;
        rr(ctx, x, y, bw, 22, 6); ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fill();
        rr(ctx, x, y, Math.max(6, bw * (cnt / total)), 22, 6); ctx.fillStyle = rgba(col, 0.25); ctx.fill();
        txt(ctx, `${name} ${cnt}`, x + 8, y + 14.5, { color: col, size: 8.5 });
      });
    }
    txt(ctx, 'stock level · dynamic threshold μ − 1.1σ', 16, 20, { size: 9 });
    txt(ctx, `alerts in window: ${alerts}`, w - 16, 20, { size: 9, color: C.pink, align: 'right' });
  };
}

const VIZ = { graph, video, markov, revenue, ltv, tiles, words, agent, segment, inventory };

/* ---------------- Runner ---------------- */
export function initViz() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = [];

  document.querySelectorAll('canvas[data-viz]').forEach((canvas) => {
    const make = VIZ[canvas.dataset.viz];
    if (!make) return;
    const ctx = canvas.getContext('2d');
    const host = canvas.closest('.card') || canvas.parentElement;
    const S = { w: 0, h: 0, dpr: 1, mouse: { x: -999, y: -999, in: false } };
    const item = { canvas, ctx, S, draw: null, visible: false, t: Math.random() * 4, last: 0 };

    const setup = () => {
      const r = canvas.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      S.dpr = Math.min(window.devicePixelRatio || 1, 2);
      S.w = r.width; S.h = r.height;
      canvas.width = Math.round(r.width * S.dpr); canvas.height = Math.round(r.height * S.dpr);
      ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      item.draw = make(ctx, S);
      if (reduced) renderOnce(item, 3.5);
    };
    let rt;
    new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(setup, 80); }).observe(canvas);
    host.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      S.mouse.x = e.clientX - r.left; S.mouse.y = e.clientY - r.top;
      S.mouse.in = S.mouse.y >= 0 && S.mouse.y <= r.height && S.mouse.x >= 0 && S.mouse.x <= r.width;
    });
    host.addEventListener('pointerleave', () => { S.mouse.in = false; });
    new IntersectionObserver(([en]) => { item.visible = en.isIntersecting; }, { rootMargin: '100px' }).observe(canvas);
    items.push(item);
  });

  function renderOnce(item, t) {
    if (!item.draw) return;
    item.ctx.clearRect(0, 0, item.S.w, item.S.h);
    for (let k = 0; k < 90; k++) { item.ctx.clearRect(0, 0, item.S.w, item.S.h); item.draw(t + k / 60, 1 / 60); }
  }

  if (reduced) return;
  let prev = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    for (const it of items) {
      if (!it.visible || !it.draw || it.canvas.offsetParent === null) continue;
      it.t += dt;
      it.ctx.clearRect(0, 0, it.S.w, it.S.h);
      it.draw(it.t, dt);
    }
  }
  requestAnimationFrame(loop);
}
