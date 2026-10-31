/* =========================================================
   Skill constellation — force-directed, draggable graph
   ========================================================= */

const GROUPS = [
  { name: 'Programming & Data', color: '#5ef2ff', skills: ['Python', 'SQL', 'NumPy', 'Pandas', 'PySpark'] },
  { name: 'Machine Learning', color: '#8b5cf6', skills: ['scikit-learn', 'Feature Eng.', 'Classification', 'Regression', 'Clustering', 'Model Eval'] },
  { name: 'Deep Learning', color: '#ff3d81', skills: ['PyTorch', 'CNNs', 'Transformers', 'GNNs'] },
  { name: 'Generative AI', color: '#c6ff4d', skills: ['LLMs', 'RAG', 'Prompting', 'Embeddings', 'FAISS'] },
  { name: 'Tools', color: '#ffb347', skills: ['Git', 'Databricks', 'Tableau', 'FastAPI', 'React', 'Streamlit', 'Playwright'] },
];

const CROSS = [
  ['Python', 'PyTorch'], ['Python', 'FastAPI'], ['Python', 'Pandas'], ['PySpark', 'Databricks'], ['SQL', 'Tableau'],
  ['Pandas', 'scikit-learn'], ['NumPy', 'PyTorch'], ['Embeddings', 'Transformers'], ['FAISS', 'Embeddings'],
  ['RAG', 'FAISS'], ['LLMs', 'Transformers'], ['LLMs', 'Prompting'], ['CNNs', 'PyTorch'], ['GNNs', 'PyTorch'],
  ['Classification', 'GNNs'], ['Model Eval', 'Regression'], ['Streamlit', 'Python'], ['React', 'FastAPI'],
  ['Clustering', 'Embeddings'], ['Feature Eng.', 'PySpark'], ['Playwright', 'Python'], ['RAG', 'LLMs'],
];

const TAU = Math.PI * 2;
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function initSkills(canvas, { onCount } = {}) {
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, dpr = 1;
  let nodes = [], links = [];
  const byName = {};
  const mouse = { x: -999, y: -999, in: false };
  let hover = null, drag = null, focusGroup = -1;
  const packets = [];

  function build() {
    nodes = []; links = [];
    const R = Math.min(w, h) * 0.3;
    GROUPS.forEach((g, gi) => {
      const a = (gi / GROUPS.length) * TAU - Math.PI / 2;
      const hub = { id: g.name, label: g.name, hub: true, group: gi, x: w / 2 + Math.cos(a) * R, y: h / 2 + Math.sin(a) * R, vx: 0, vy: 0, r: 7 };
      nodes.push(hub); byName[g.name] = hub;
      g.skills.forEach((s, si) => {
        const b = a + (si - g.skills.length / 2) * 0.35;
        const n = { id: s, label: s, group: gi, x: hub.x + Math.cos(b) * 60, y: hub.y + Math.sin(b) * 60, vx: 0, vy: 0, r: 3.6 };
        nodes.push(n); byName[s] = n;
        links.push({ a: hub, b: n, len: Math.min(w, h) * 0.13, cross: false });
      });
    });
    for (let i = 0; i < GROUPS.length; i++) {
      links.push({ a: byName[GROUPS[i].name], b: byName[GROUPS[(i + 1) % GROUPS.length].name], len: Math.min(w, h) * 0.42, cross: false, ring: true });
    }
    CROSS.forEach(([a, b]) => byName[a] && byName[b] && links.push({ a: byName[a], b: byName[b], len: Math.min(w, h) * 0.3, cross: true }));
    onCount && onCount(nodes.filter((n) => !n.hub).length);
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  const neighbors = (n) => {
    const s = new Set([n]);
    links.forEach((l) => { if (l.a === n) s.add(l.b); if (l.b === n) s.add(l.a); });
    return s;
  };

  function step() {
    const k = 1;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = Math.random(); dy = Math.random(); d2 = 1; }
        const d = Math.sqrt(d2);
        const f = Math.min(1200 / d2, 4) * k;
        a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
    }
    for (const l of links) {
      const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y, d = Math.hypot(dx, dy) || 1;
      const s = l.cross ? 0.0006 : l.ring ? 0.002 : 0.006;
      const f = (d - l.len) * s;
      l.a.vx += (dx / d) * f; l.a.vy += (dy / d) * f; l.b.vx -= (dx / d) * f; l.b.vy -= (dy / d) * f;
    }
    for (const n of nodes) {
      n.vx += (w / 2 - n.x) * 0.0008; n.vy += (h / 2 - n.y) * 0.0008;
      if (mouse.in && !drag) {
        const dx = n.x - mouse.x, dy = n.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < 90 && d > 0) { n.vx += (dx / d) * (1 - d / 90) * 0.6; n.vy += (dy / d) * (1 - d / 90) * 0.6; }
      }
      if (n === drag) { n.x += (mouse.x - n.x) * 0.35; n.y += (mouse.y - n.y) * 0.35; n.vx = n.vy = 0; continue; }
      n.vx *= 0.82; n.vy *= 0.82;
      n.x = Math.max(20, Math.min(w - 20, n.x + n.vx));
      n.y = Math.max(20, Math.min(h - 36, n.y + n.vy));
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);

    ctx.save(); ctx.translate(w / 2, h / 2);
    for (let i = 1; i <= 3; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.035 - i * 0.006})`; ctx.setLineDash([2, 8]); ctx.lineDashOffset = t * (i % 2 ? 10 : -10);
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * (0.16 * i), 0, TAU); ctx.stroke();
    }
    ctx.restore(); ctx.setLineDash([]);

    const hl = hover ? neighbors(hover) : null;
    const isLit = (n) => (hl ? hl.has(n) : focusGroup >= 0 ? n.group === focusGroup : true);

    for (const l of links) {
      const lit = hl ? hl.has(l.a) && hl.has(l.b) && (l.a === hover || l.b === hover) : focusGroup >= 0 ? l.a.group === focusGroup && l.b.group === focusGroup : true;
      const col = GROUPS[l.b.group].color;
      ctx.strokeStyle = lit ? rgba(col, l.cross ? 0.35 : 0.5) : 'rgba(255,255,255,0.04)';
      ctx.lineWidth = lit && hl ? 1.4 : 1;
      if (l.cross) ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(l.a.x, l.a.y); ctx.lineTo(l.b.x, l.b.y); ctx.stroke();
      ctx.setLineDash([]);
    }

    if (!reduced && Math.random() < 0.25 && packets.length < 30) {
      const l = links[Math.floor(Math.random() * links.length)];
      packets.push({ l, t: 0, s: 0.008 + Math.random() * 0.012 });
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i]; p.t += p.s;
      if (p.t >= 1) { packets.splice(i, 1); continue; }
      const x = p.l.a.x + (p.l.b.x - p.l.a.x) * p.t, y = p.l.a.y + (p.l.b.y - p.l.a.y) * p.t;
      const col = GROUPS[p.l.b.group].color;
      ctx.fillStyle = rgba(col, isLit(p.l.a) ? 0.9 : 0.15);
      ctx.beginPath(); ctx.arc(x, y, 1.4, 0, TAU); ctx.fill();
    }

    for (const n of nodes) {
      const col = GROUPS[n.group].color;
      const lit = isLit(n);
      const r = n.r * (n === hover ? 1.6 : 1);
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * (n.hub ? 6 : 4));
      g.addColorStop(0, rgba(col, lit ? 0.45 : 0.08)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, r * (n.hub ? 6 : 4), 0, TAU); ctx.fill();
      ctx.fillStyle = rgba(col, lit ? 1 : 0.25);
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, TAU); ctx.fill();
      if (n.hub) {
        ctx.strokeStyle = rgba(col, lit ? 0.6 : 0.15); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 5 + Math.sin(t * 2 + n.group) * 2, 0, TAU); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    for (const n of nodes) {
      const lit = isLit(n);
      ctx.font = n.hub ? '700 12px "Syne", "Manrope", sans-serif' : '500 10.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = n.hub ? (lit ? '#eceef6' : 'rgba(236,238,246,.25)') : (lit ? 'rgba(236,238,246,.8)' : 'rgba(236,238,246,.15)');
      ctx.fillText(n.label, n.x, n.y + n.r + (n.hub ? 10 : 5));
    }
  }

  const pos = (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; };
  canvas.addEventListener('pointermove', (e) => {
    pos(e); mouse.in = true;
    if (!drag) {
      hover = null;
      let best = 22;
      for (const n of nodes) { const d = Math.hypot(n.x - mouse.x, n.y - mouse.y); if (d < best) { best = d; hover = n; } }
    }
  });
  canvas.addEventListener('pointerdown', (e) => {
    pos(e);
    if (hover) { drag = hover; canvas.setPointerCapture(e.pointerId); }
  });
  const release = () => { drag = null; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => { mouse.in = false; hover = null; });

  let rt;
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(resize, 80); }).observe(canvas);
  resize();

  let visible = false;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { rootMargin: '100px' }).observe(canvas);

  if (reduced) {
    for (let i = 0; i < 300; i++) step();
    draw(0);
    const redraw = () => draw(0);
    canvas.addEventListener('pointermove', redraw);
  } else {
    for (let i = 0; i < 120; i++) step();
    const start = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop);
      if (!visible) return;
      step();
      draw((now - start) / 1000);
    })(start);
  }

  return {
    focus(i) { focusGroup = i; if (reduced) draw(0); },
  };
}
