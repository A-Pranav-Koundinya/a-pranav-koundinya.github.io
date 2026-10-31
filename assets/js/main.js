import { initHero } from './hero.js';
import { initViz } from './viz.js';
import { initSkills } from './skills.js';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* =========================================================
   Text utilities
   ========================================================= */
const GLYPHS = '!<>-_\\/[]{}—=+*^?#01ABCDEFXYZ';

function scramble(el, to, { duration = 0.9 } = {}) {
  if (reduced) { el.textContent = to; return; }
  const from = el.textContent;
  const len = Math.max(from.length, to.length);
  const queue = Array.from({ length: len }, (_, i) => {
    const start = Math.floor(Math.random() * 18);
    return { from: from[i] || '', to: to[i] || '', start, end: start + Math.floor(Math.random() * 22) + 8, ch: '' };
  });
  const frames = Math.round(duration * 60);
  let frame = 0;
  cancelAnimationFrame(el._scr);
  const tick = () => {
    let out = '', done = 0;
    for (const q of queue) {
      const f = frame * (40 / frames);
      if (f >= q.end) { done++; out += q.to; }
      else if (f >= q.start) {
        if (!q.ch || Math.random() < 0.28) q.ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        out += `<span style="color:var(--cyan);opacity:.7">${q.ch}</span>`;
      } else out += q.from;
    }
    el.innerHTML = out;
    frame++;
    if (done < queue.length) el._scr = requestAnimationFrame(tick);
    else el.textContent = to;
  };
  tick();
}

const GRAD_STOPS = [[94, 242, 255], [139, 92, 246], [255, 61, 129]];
function gradAt(t) {
  const seg = t < 0.5 ? 0 : 1, k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const [a, b] = [GRAD_STOPS[seg], GRAD_STOPS[seg + 1]];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;
}

// Splits text into .char spans grouped in unbreakable .word spans, preserving inline elements.
// Gradient-text elements (.grad) get per-character colours, since background-clip:text breaks on transformed children.
function splitChars(root) {
  const chars = [];
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/([ \u00a0]+)/).forEach((part) => {
          if (!part) return;
          if (/^[ \u00a0]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const word = document.createElement('span');
          word.className = 'word';
          for (const ch of part) {
            const s = document.createElement('span');
            s.className = 'char';
            s.textContent = ch;
            word.appendChild(s);
            chars.push(s);
          }
          frag.appendChild(word);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1) {
        const before = chars.length;
        walk(child);
        if (child.classList.contains('grad')) {
          child.classList.remove('grad');
          const own = chars.slice(before);
          own.forEach((c, i) => { c.style.color = gradAt(own.length > 1 ? i / (own.length - 1) : 0); });
        }
      }
    });
  };
  walk(root);
  return chars;
}

function splitLines(el) {
  const parts = el.innerHTML.split(/<br\s*\/?>/i);
  el.innerHTML = parts.map((p) => `<span class="line-mask"><span class="line-inner">${p.trim()}</span></span>`).join('');
  return $$('.line-inner', el);
}

/* =========================================================
   Smooth scroll
   ========================================================= */
let lenis = null;
if (!reduced && Lenis) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

function scrollTo(target) {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: el.id === 'top' ? 0 : -40, duration: 1.6 });
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}

$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    e.preventDefault();
    closeMenu();
    scrollTo(id);
  });
});

/* =========================================================
   Preloader → intro
   ========================================================= */
const heroNameLines = $$('.hero__word');
const contactChars = $$('.contact__line[data-split]').map(splitChars);
const sectionLines = $$('[data-split-lines]').map((el) => ({ el, lines: splitLines(el) }));

function runPreloader() {
  return new Promise((resolve) => {
    const pre = $('#preloader');
    if (reduced) { pre.remove(); resolve(); return; }
    const count = $('#loaderCount'), bar = $('#loaderBar'), log = $('#loaderLog');
    const logs = ['loading tensors…', 'compiling shaders…', 'warming up GNN…', 'sampling particles…', 'ready.'];
    const state = { v: 0 };
    const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 2500))]);
    gsap.to(state, {
      v: 100, duration: 2.0, ease: 'power2.inOut',
      onUpdate() {
        const v = Math.round(state.v);
        count.textContent = String(v).padStart(3, '0');
        bar.style.width = `${v}%`;
        log.textContent = logs[Math.min(logs.length - 1, Math.floor(v / 22))];
      },
      onComplete() {
        fontsReady.then(() => {
          gsap.timeline({ onComplete: () => { pre.remove(); } })
            .to('.preloader__inner', { y: -40, opacity: 0, duration: 0.5, ease: 'power3.in' })
            .to(pre, { clipPath: 'inset(0 0 100% 0)', duration: 1.0, ease: 'expo.inOut' }, '-=0.1')
            .add(resolve, '-=0.65');
        });
      },
    });
  });
}

function intro() {
  document.body.classList.remove('is-loading');
  lenis && lenis.start();

  if (reduced) {
    gsap.set('.reveal-up', { opacity: 1, y: 0 });
    gsap.set(heroNameLines, { opacity: 1, y: 0, filter: 'none' });
    return;
  }

  const tl = gsap.timeline({
    defaults: { ease: 'expo.out' }
  });

  // Subtle two-line name reveal
  tl.fromTo(
    heroNameLines,
    {
      autoAlpha: 0,
      y: 26,
      filter: 'blur(6px)'
    },
    {
      autoAlpha: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: 1.2,
      stagger: 0.16,
      ease: 'power3.out',
      clearProps: 'filter,transform,opacity,visibility'
    },
    0.05
  );

  tl.to('.hero .reveal-up', {
    opacity: 1,
    y: 0,
    duration: 1.2,
    stagger: 0.1
  }, 0.35)
    .from('.hero__role', {
      opacity: 0,
      y: 20,
      duration: 1
    }, 0.6)
    .from('.hero__meta-item', {
      opacity: 0,
      y: 16,
      duration: 1,
      stagger: 0.08
    }, 0.8)
    .from('.nav > *', {
      y: -30,
      opacity: 0,
      duration: 1.1,
      stagger: 0.06,
      clearProps: 'transform,opacity'
    }, 0.4)
    .from('.hero__scroll', {
      opacity: 0,
      duration: 1
    }, 1);
}

/* =========================================================
   Hero: WebGL + role rotator + scroll
   ========================================================= */
const morphLabel = $('#morphLabel');
const hero = initHero($('#heroCanvas'), { onMorph: (name) => scramble(morphLabel, name, { duration: 0.8 }) });

// The hero now rotates through only these three professional categories.
const roles = ['Data Science', 'Machine Learning', 'Generative AI'];
const roleEl = $('#roleText');
let roleIdx = 0;
setInterval(() => {
  roleIdx = (roleIdx + 1) % roles.length;
  scramble(roleEl, roles[roleIdx], { duration: 1 });
}, 3200);

if (!reduced) {
  ScrollTrigger.create({
    trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true,
    onUpdate: (self) => hero.setScroll(self.progress),
  });
  gsap.to('.hero__content', {
    yPercent: -18, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom 20%', scrub: true },
  });
}

/* =========================================================
   Local time
   ========================================================= */
const timeEl = $('#localTime');
const fmt = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
const updateTime = () => { timeEl.textContent = fmt.format(new Date()); };
updateTime(); setInterval(updateTime, 15000);
$('#year').textContent = new Date().getFullYear();

/* =========================================================
   Cursor
   ========================================================= */
if (finePointer && !reduced) {
  document.body.classList.add('has-cursor');
  const ring = $('#cursor'), dot = $('#cursorDot'), label = $('#cursorLabel');
  const pos = { x: innerWidth / 2, y: innerHeight / 2 }, ringPos = { ...pos };
  window.addEventListener('pointermove', (e) => {
    pos.x = e.clientX; pos.y = e.clientY;
    dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
  });
  gsap.ticker.add(() => {
    ringPos.x += (pos.x - ringPos.x) * 0.18;
    ringPos.y += (pos.y - ringPos.y) * 0.18;
    ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
  });
  document.addEventListener('pointerover', (e) => {
    const withLabel = e.target.closest('[data-cursor]');
    const interactive = e.target.closest('a, button, .filter');
    ring.classList.toggle('is-label', !!withLabel);
    ring.classList.toggle('is-hover', !withLabel && !!interactive);
    if (withLabel) label.textContent = withLabel.dataset.cursor;
  });
  window.addEventListener('pointerdown', () => ring.classList.add('is-down'));
  window.addEventListener('pointerup', () => ring.classList.remove('is-down'));
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) { ring.style.opacity = 0; dot.style.opacity = 0; } });
  document.addEventListener('mouseover', () => { ring.style.opacity = 1; dot.style.opacity = 1; });
}

/* =========================================================
   Magnetic + tilt
   ========================================================= */
if (finePointer && !reduced) {
  $$('[data-magnetic]').forEach((el) => {
    const strength = el.classList.contains('email-btn') ? 0.25 : 0.35;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      gsap.to(el, { x: x * strength, y: y * strength, duration: 0.6, ease: 'power3.out' });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' }));
  });

  $$('[data-tilt]').forEach((el) => {
    const max = el.classList.contains('tl-card') ? 3 : 5;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
      gsap.to(el, { rotateY: (px - 0.5) * max * 2, rotateX: -(py - 0.5) * max * 2, transformPerspective: 1100, duration: 0.6, ease: 'power3.out' });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { rotateY: 0, rotateX: 0, duration: 1, ease: 'expo.out' }));
  });
}

/* =========================================================
   Nav
   ========================================================= */
const nav = $('#nav');
let lastY = 0;
const progress = $('#scrollProgress');
function onScroll(y, limit) {
  nav.classList.toggle('is-scrolled', y > 40);
  nav.classList.toggle('is-hidden', y > 400 && y > lastY + 2 && !$('#mobileMenu').classList.contains('is-open'));
  if (y < lastY - 2) nav.classList.remove('is-hidden');
  lastY = y;
  progress.style.transform = `scaleX(${limit > 0 ? y / limit : 0})`;
}
if (lenis) lenis.on('scroll', (e) => onScroll(e.scroll, e.limit));
else window.addEventListener('scroll', () => onScroll(scrollY, document.documentElement.scrollHeight - innerHeight), { passive: true });

$$('.nav__links a').forEach((a) => {
  const textNode = [...a.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
  if (!textNode) return;
  const span = document.createElement('span');
  span.textContent = textNode.textContent.trim();
  a.replaceChild(span, textNode);
  a.addEventListener('pointerenter', () => scramble(span, span.textContent, { duration: 0.5 }));
});

['about', 'experience', 'projects', 'skills', 'contact'].forEach((id) => {
  ScrollTrigger.create({
    trigger: `#${id}`, start: 'top 50%', end: 'bottom 50%',
    onToggle: (self) => {
      if (!self.isActive) return;
      $$('.nav__links a').forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${id}`));
    },
  });
});

const burger = $('#burger'), menu = $('#mobileMenu');
function closeMenu() { menu.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); lenis && lenis.start(); }
burger.addEventListener('click', () => {
  const open = !menu.classList.contains('is-open');
  menu.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
  if (lenis) open ? lenis.stop() : lenis.start();
  if (open && !reduced) gsap.fromTo('.mobile-menu a', { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.05, duration: 0.8, ease: 'expo.out', delay: 0.2 });
});

/* =========================================================
   Marquee (scroll-velocity reactive)
   ========================================================= */
const track = $('[data-marquee]');
track.innerHTML += track.innerHTML;
if (!reduced) {
  const loop = gsap.to(track, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 });
  ScrollTrigger.create({
    onUpdate(self) {
      const v = Math.abs(self.getVelocity());
      gsap.to(loop, { timeScale: 1 + Math.min(v / 250, 6), duration: 0.25, overwrite: true });
      gsap.to(loop, { timeScale: 1, duration: 1.2, delay: 0.25, overwrite: false });
    },
  });
  gsap.fromTo('.marquee', { rotate: -2 }, { rotate: 2, ease: 'none', scrollTrigger: { trigger: '.marquee', start: 'top bottom', end: 'bottom top', scrub: true } });
}

/* =========================================================
   Scroll reveals
   ========================================================= */
if (!reduced) {
  sectionLines.forEach(({ el, lines }) => {
    gsap.from(lines, { yPercent: 110, rotate: 2, duration: 1.3, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: el, start: 'top 85%' } });
  });
  contactChars.forEach((chars, i) => {
    gsap.from(chars, { yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: 0.025, delay: i * 0.1, scrollTrigger: { trigger: '.contact__title', start: 'top 85%' } });
  });
  ScrollTrigger.batch($$('.reveal-up').filter((el) => !el.closest('.hero')), {
    start: 'top 90%',
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09 }),
  });
  gsap.set('.card', { opacity: 0, y: 60, scale: 0.97 });
  ScrollTrigger.batch('.card', {
    start: 'top 92%',
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, scale: 1, duration: 1.2, ease: 'expo.out', stagger: 0.08 }),
  });
  $$('.section__index').forEach((el) => gsap.from(el, { opacity: 0, x: -20, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } }));
}

/* =========================================================
   Counters + gauge
   ========================================================= */
function formatNum(v, el) {
  const dec = +(el.dataset.decimals || 0);
  const s = dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US');
  return s + (el.dataset.suffix || '');
}
$$('[data-count]').forEach((el) => {
  const target = parseFloat(el.dataset.count);
  if (reduced) { el.textContent = formatNum(target, el); return; }
  const o = { v: 0 };
  ScrollTrigger.create({
    trigger: el, start: 'top 92%', once: true,
    onEnter: () => gsap.to(o, { v: target, duration: 2.2, ease: 'power3.out', onUpdate: () => { el.textContent = formatNum(o.v, el); } }),
  });
});
const arc = $('#gaugeArc');
if (arc) {
  const full = 2 * Math.PI * 52;
  const to = full * (1 - 9.61 / 10);
  if (reduced) arc.style.strokeDashoffset = to;
  else gsap.to(arc, { strokeDashoffset: to, duration: 2.4, ease: 'power3.out', scrollTrigger: { trigger: arc, start: 'top 90%' } });
}

/* =========================================================
   Timeline
   ========================================================= */
if (!reduced) {
  gsap.to('#timelineFill', { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '#timeline', start: 'top 65%', end: 'bottom 65%', scrub: 0.6 } });
  $$('.tl-item').forEach((item) => {
    ScrollTrigger.create({ trigger: item, start: 'top 65%', onEnter: () => item.classList.add('is-active'), onLeaveBack: () => item.classList.remove('is-active') });
    gsap.from(item.querySelector('.tl-card'), { x: 60, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: item, start: 'top 85%' } });
    gsap.from(item.querySelector('.tl-item__date'), { opacity: 0, y: 10, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: item, start: 'top 85%' } });
    const lis = item.querySelectorAll('.tl-card__list li');
    if (lis.length) gsap.from(lis, { opacity: 0, x: 20, duration: 0.9, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: item, start: 'top 75%' } });
  });
} else {
  $('#timelineFill').style.transform = 'scaleY(1)';
  $$('.tl-item').forEach((i) => i.classList.add('is-active'));
}

/* =========================================================
   Terminal typing
   ========================================================= */
const CODE = `# pranav.py
class Pranav(DataScientist):
    name     = "A Pranav Koundinya"
    based_in = "Bengaluru, IN"
    role     = "Associate Data Scientist"
    company  = "PlaySimple Games"
    stack    = ["Python", "SQL", "Pandas", "Pytorch", "LLMs"]
    cgpa     = 9.61

    def solve(self, problem):
        signal = self.explore(problem)
        return self.model(signal).ship()`;

function highlight(src) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const re = /(#.*$)|("[^"\n]*"?)|\b(class|def|return)\b|\b(self|Pranav|DataScientist)\b|\b(\d+\.?\d*)\b/gm;
  let out = '', last = 0;
  src.replace(re, (m, com, str, kw, ident, num, offset) => {
    const cls = com ? 'tk-c' : str ? 'tk-s' : kw ? 'tk-k' : ident ? 'tk-v' : 'tk-n';
    out += esc(src.slice(last, offset)) + `<span class="${cls}">${esc(m)}</span>`;
    last = offset + m.length;
    return m;
  });
  return out + esc(src.slice(last));
}
const term = $('#terminalCode');
if (reduced) term.innerHTML = highlight(CODE);
else {
  term.innerHTML = '<span class="term-caret"></span>';
  ScrollTrigger.create({
    trigger: term, start: 'top 85%', once: true,
    onEnter: () => {
      let i = 0;
      const typeNext = () => {
        i = Math.min(CODE.length, i + (CODE[i] === ' ' ? 4 : 1));
        term.innerHTML = highlight(CODE.slice(0, i)) + '<span class="term-caret"></span>';
        if (i < CODE.length) setTimeout(typeNext, CODE[i - 1] === '\n' ? 90 : 14 + Math.random() * 22);
      };
      typeNext();
    },
  });
}

/* =========================================================
   Project filters
   ========================================================= */
const cards = $$('.card');
$$('.filter').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.filter').forEach((b) => b.classList.toggle('is-active', b === btn));
    const f = btn.dataset.filter;
    const show = cards.filter((c) => f === 'all' || c.dataset.cat.split(' ').includes(f));
    const hide = cards.filter((c) => !show.includes(c));
    const tl = gsap.timeline({ onComplete: () => ScrollTrigger.refresh() });
    tl.to(cards.filter((c) => !c.classList.contains('is-dimmed')), { opacity: 0, y: 20, scale: 0.98, duration: reduced ? 0 : 0.3, ease: 'power2.in', stagger: 0.02 })
      .add(() => { hide.forEach((c) => c.classList.add('is-dimmed')); show.forEach((c) => c.classList.remove('is-dimmed')); })
      .fromTo(show, { opacity: 0, y: 30, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: reduced ? 0 : 0.8, ease: 'expo.out', stagger: 0.05 });
  });
});

/* =========================================================
   Skills
   ========================================================= */
const skills = initSkills($('#skillCanvas'), { onCount: (n) => { $('#skillCount').textContent = n; } });
$$('.skill-group').forEach((g) => {
  g.addEventListener('pointerenter', () => { skills.focus(+g.dataset.group); g.classList.add('is-active'); });
  g.addEventListener('pointerleave', () => { skills.focus(-1); g.classList.remove('is-active'); });
});

/* =========================================================
   Email copy
   ========================================================= */
const emailBtn = $('#emailBtn'), toast = $('#toast');
emailBtn.addEventListener('click', async () => {
  const email = emailBtn.dataset.email;
  try {
    await navigator.clipboard.writeText(email);
    toast.classList.add('is-show');
    setTimeout(() => toast.classList.remove('is-show'), 2200);
  } catch {
    window.location.href = `mailto:${email}`;
  }
});

/* =========================================================
   Background dot grid (cursor-reactive)
   ========================================================= */
(function bgGrid() {
  const c = $('#bgGrid');
  const ctx = c.getContext('2d');
  const GAP = 34;
  let w, h, dpr;
  const m = { x: -999, y: -999 }, s = { x: -999, y: -999 };
  let dirty = true;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    c.width = w * dpr; c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true;
  };
  resize();
  window.addEventListener('resize', resize);
  if (finePointer) window.addEventListener('pointermove', (e) => { m.x = e.clientX; m.y = e.clientY; });
  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    const R = 180;
    for (let y = GAP / 2; y < h; y += GAP) {
      for (let x = GAP / 2; x < w; x += GAP) {
        const dx = x - s.x, dy = y - s.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const k = d < R ? 1 - d / R : 0;
        const size = 1 + k * 1.8;
        const px = x + (k ? (dx / (d || 1)) * k * 6 : 0), py = y + (k ? (dy / (d || 1)) * k * 6 : 0);
        ctx.fillStyle = k ? `rgba(94,242,255,${0.08 + k * 0.5})` : 'rgba(255,255,255,0.05)';
        ctx.fillRect(px - size / 2, py - size / 2, size, size);
      }
    }
  };
  gsap.ticker.add(() => {
    const nx = s.x + (m.x - s.x) * 0.12, ny = s.y + (m.y - s.y) * 0.12;
    if (Math.abs(nx - s.x) > 0.3 || Math.abs(ny - s.y) > 0.3 || dirty) {
      s.x = nx; s.y = ny; dirty = false;
      draw();
    }
  });
})();

/* =========================================================
   Boot
   ========================================================= */
initViz();
runPreloader().then(intro);
window.addEventListener('load', () => ScrollTrigger.refresh());