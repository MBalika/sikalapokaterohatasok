// Közös segédek minden widgethez.
// Használat egy fejezetmodulban:
//   import { register, slider, seg, stat, svg, h, fmt, onTheme } from './core.js';
//   register('m0calc', (root) => { ... });   // a <div class="w" data-w="m0calc"> elemre fut, lustán (görgetéskor)

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;

/** Magyar számformátum: fmt(1.234, 2) → "1,23" */
export function fmt(x, d = 1) {
  if (x === null || x === undefined || !isFinite(x)) return '–';
  return Number(x).toLocaleString('hu-HU', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/ /g, ' ');
}

/** DOM-építő: h('div', {class:'x', onclick: fn}, 'szöveg', child) */
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

const SVGNS = 'http://www.w3.org/2000/svg';
/** SVG-építő: svg('rect', {x:0, y:0, width:10, height:5, class:'f-steel'}, parent) */
export function svg(tag, attrs = {}, parent = null) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  if (parent) parent.appendChild(el);
  return el;
}
/** Új <svg class="fig" viewBox> létrehozása egy szülőben */
export function figure(parent, w, h_, cls = 'fig') {
  const s = svg('svg', { viewBox: `0 0 ${w} ${h_}`, class: cls, role: 'img' });
  parent.appendChild(s);
  return s;
}
/** Elem tartalmának ürítése */
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

/** Pontlista → SVG path "d" */
export const pathD = (pts, close = false) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + (close ? ' Z' : '');

/** Lineáris skála */
export function scale(d0, d1, r0, r1) {
  const f = (x) => r0 + ((x - d0) / (d1 - d0)) * (r1 - r0);
  f.inv = (y) => d0 + ((y - r0) / (r1 - r0)) * (d1 - d0);
  return f;
}

/* ---------------------------------------------------------------- vezérlők */
function setP(input) {
  const p = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty('--p', p + '%');
}

/**
 * Csúszka. slider(parent, {label:'Kohézió', sym:'c', min, max, step, value, unit:'kPa', d:1, hint, fmt:(v)=>string})
 * Visszaad: {el, input, get v(), set(v), on(fn)}; fn(v) minden változáskor.
 */
export function slider(parent, o) {
  const fns = [];
  const d = o.d ?? (String(o.step ?? 1).split('.')[1] || '').length;
  const show = o.fmt || ((v) => fmt(v, d));
  const val = h('span', { class: 'ctl-val' });
  const input = h('input', { type: 'range', min: o.min, max: o.max, step: o.step ?? 1, value: o.value, 'aria-label': o.label });
  const el = h('label', { class: 'ctl' },
    h('span', { class: 'ctl-top' }, h('span', { class: 'ctl-lab', html: o.label + (o.sym ? ` <i>${o.sym}</i>` : '') }), val),
    input,
    o.hint ? h('span', { class: 'ctl-hint', html: o.hint }) : null);
  const upd = () => { val.innerHTML = show(+input.value) + (o.unit ? `<small>${o.unit}</small>` : ''); setP(input); };
  input.addEventListener('input', () => { upd(); fns.forEach((f) => f(+input.value)); });
  upd();
  if (parent) parent.appendChild(el);
  return {
    el, input,
    get v() { return +input.value; },
    set(v, fire = true) { input.value = v; upd(); if (fire) fns.forEach((f) => f(+input.value)); },
    on(f) { fns.push(f); return this; },
  };
}

/**
 * Szegmentált választó. seg(parent, {label, options:[{v:'a', t:'Első'}], value:'a', vert:false})
 */
export function seg(parent, o) {
  const fns = [];
  let cur = o.value ?? o.options[0].v;
  const box = h('div', { class: 'seg' + (o.vert ? ' vert' : ''), role: 'radiogroup', 'aria-label': o.label || '' });
  const btns = o.options.map((op) => {
    const b = h('button', { type: 'button', role: 'radio', html: op.t, title: op.title || null });
    b.addEventListener('click', () => { api.set(op.v); });
    box.appendChild(b);
    return [op.v, b];
  });
  const el = o.label ? h('div', { class: 'ctl' }, h('span', { class: 'ctl-lab', html: o.label }), box) : box;
  const paint = () => btns.forEach(([v, b]) => { b.classList.toggle('on', v === cur); b.setAttribute('aria-checked', v === cur); });
  paint();
  if (parent) parent.appendChild(el);
  const api = {
    el,
    get v() { return cur; },
    set(v, fire = true) { cur = v; paint(); if (fire) fns.forEach((f) => f(cur)); },
    on(f) { fns.push(f); return api; },
  };
  return api;
}

/** Kapcsoló. toggle(parent, {label, value:false}) */
export function toggle(parent, o) {
  const fns = [];
  const input = h('input', { type: 'checkbox' });
  input.checked = !!o.value;
  const el = h('label', { class: 'tog' }, input, h('span', { html: o.label }));
  input.addEventListener('change', () => fns.forEach((f) => f(input.checked)));
  if (parent) parent.appendChild(el);
  return { el, input, get v() { return input.checked; }, set(v, fire = true) { input.checked = !!v; if (fire) fns.forEach((f) => f(input.checked)); }, on(f) { fns.push(f); return this; } };
}

/** Legördülő. select(parent, {label, options:[{v,t}], value}) */
export function select(parent, o) {
  const fns = [];
  const s = h('select', {}, ...o.options.map((op) => h('option', { value: op.v }, op.t)));
  s.value = o.value ?? o.options[0].v;
  const el = h('label', { class: 'selrow' }, h('span', { class: 'ctl-lab', html: o.label }), s);
  s.addEventListener('change', () => fns.forEach((f) => f(s.value)));
  if (parent) parent.appendChild(el);
  return { el, get v() { return s.value; }, set(v, fire = true) { s.value = v; if (fire) fns.forEach((f) => f(s.value)); }, on(f) { fns.push(f); return this; } };
}

/** Kijelző csempe. stat(parent, {label, unit}) → .set(value, state?, text?) ; state: 'ok'|'warn'|'bad'|null */
export function stat(parent, o) {
  const v = h('div', { class: 'stat-v' });
  const el = h('div', { class: 'stat' }, h('div', { class: 'stat-l', html: o.label }), v);
  if (parent) parent.appendChild(el);
  let last = null;
  return {
    el,
    set(val, state = null, text = null) {
      const raw = (text ?? (typeof val === 'number' ? fmt(val, o.d ?? 1) : val)) + (o.unit ? `<small>${o.unit}</small>` : '');
      if (raw !== last) { last = raw; v.innerHTML = raw; }
      if (state) { if (el.dataset.s !== state) el.dataset.s = state; } else if ('s' in el.dataset) delete el.dataset.s;
    },
  };
}

/** Szöveges ítélet doboz. verdict(parent) → .set(state, title, html) */
export function verdict(parent) {
  const el = h('div', { class: 'verdict' });
  if (parent) parent.appendChild(el);
  let last = null;
  return { el, set(state, title, html = '') { if (el.dataset.s !== (state || '')) el.dataset.s = state || ''; const raw = `<b>${title}</b>${html}`; if (raw !== last) { last = raw; el.innerHTML = raw; } } };
}

/**
 * Widget-váz. A <div class="w" data-w="..." data-title="..." data-sub="..." data-layout="wide|ctl-right">
 * elemhez fejlécet + vezérlő- és ábraoszlopot épít. Visszaad: {ctrls, viz, out, foot}
 * Ha a HTML-ben már van .w-head, nem ír újat.
 */
export function shell(root, o = {}) {
  const title = o.title ?? root.dataset.title ?? '';
  const sub = o.sub ?? root.dataset.sub ?? '';
  const tag = o.tag ?? root.dataset.tag ?? 'Interaktív';
  if (!root.querySelector(':scope > .w-head')) {
    root.prepend(h('div', { class: 'w-head' }, h('span', { class: 'w-tag' }, tag), h('span', { class: 'w-title', html: title }), sub ? h('span', { class: 'w-sub', html: sub }) : null));
  }
  const layout = o.layout ?? root.dataset.layout ?? '';
  const body = h('div', { class: 'w-body ' + layout });
  const ctrls = layout === 'wide' ? null : h('div', { class: 'w-ctrls' });
  const viz = h('div', { class: 'w-viz' });
  if (ctrls) body.append(ctrls);
  body.append(viz);
  root.append(body);
  const out = o.out === false ? null : h('div', { class: 'w-out' });
  if (out) root.append(out);
  const foot = o.foot ? h('div', { class: 'w-foot', html: o.foot }) : null;
  if (foot) root.append(foot);
  return { ctrls, viz, out, foot, body };
}

/* ---------------------------------------------------------------- téma */
const themeFns = [];
/** Aktuális CSS-változó érték (pl. canvas rajzhoz): cssVar('--water') */
export function cssVar(name, el = document.documentElement) { return getComputedStyle(el).getPropertyValue(name).trim(); }
/** Témaváltáskor (világos/sötét) újrarajzolás: onTheme(() => draw()) */
export function onTheme(fn) { themeFns.push(fn); }
export function fireTheme() { themeFns.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }
if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', fireTheme);
export const isDark = () => {
  const t = document.documentElement.dataset.theme;
  if (t) return t === 'dark';
  return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
};

/* ---------------------------------------------------------------- canvas */
/** HiDPI canvas, a szélességhez igazítva. fitCanvas(canvas, aspect=0.56, draw) → {ctx, w, h}; átméretezéskor draw() */
export function fitCanvas(canvas, aspect, draw) {
  const st = { ctx: canvas.getContext('2d'), w: 0, h: 0 };
  const rs = () => {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const hh = Math.round(w * aspect);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr);
    canvas.style.height = hh + 'px';
    st.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    st.w = w; st.h = hh;
    draw && draw(st);
  };
  new ResizeObserver(rs).observe(canvas.parentElement);
  rs();
  return st;
}

/** requestAnimationFrame ciklus, ami csak akkor fut, ha az elem látszik. loop(el, (t, dt) => {...}) → {stop()} */
export function loop(el, fn) {
  let vis = false, raf = 0, last = 0, stopped = false;
  const tick = (t) => {
    if (stopped || !vis) { raf = 0; return; }
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
    fn(t / 1000, dt);
    raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver((es) => {
    vis = es[0].isIntersecting;
    if (vis && !raf) { last = 0; raf = requestAnimationFrame(tick); }
  }, { rootMargin: '100px' }).observe(el);
  return { stop() { stopped = true; } };
}

/* ---------------------------------------------------------------- regisztráció, lusta indítás */
const REG = new Map();
/** register('nev', (root) => {...}) – a data-w="nev" elemekre fut, amikor a képernyő közelébe kerülnek */
export function register(name, fn) { REG.set(name, fn); }
export function bootWidgets() {
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      const el = e.target; io.unobserve(el);
      const fn = REG.get(el.dataset.w);
      if (!fn) { console.warn('Nincs ilyen widget:', el.dataset.w); continue; }
      try { fn(el); el.dataset.ready = '1'; } catch (err) { console.error('Widget hiba:', el.dataset.w, err); }
    }
  }, { rootMargin: '600px 0px' });
  $$('[data-w]').forEach((el) => io.observe(el));
}
/** Minden widget azonnali indítása (teszteléshez: ?all) */
export function bootAll() { $$('[data-w]').forEach((el) => { if (el.dataset.ready) return; const fn = REG.get(el.dataset.w); if (fn) { try { fn(el); el.dataset.ready = '1'; } catch (e) { console.error(el.dataset.w, e); } } }); }

/* ---------------------------------------------------------------- talaj-rajz segédek (SVG) */
/**
 * Rétegzett talajmetszet SVG-be. soilSection(g, {x0, x1, y0, layers:[{to: y, cls:'f-soilB', name}], hatch:true})
 * y0 a terepszint (px), minden réteg a felette lévő aljától a megadott y-ig tart.
 */
export function soilSection(parent, o) {
  const g = svg('g', {}, parent);
  let top = o.y0;
  for (const L of o.layers) {
    svg('rect', { x: o.x0, y: top, width: o.x1 - o.x0, height: L.to - top, class: L.cls }, g);
    if (o.hatch !== false) svg('rect', { x: o.x0, y: top, width: o.x1 - o.x0, height: L.to - top, fill: `url(#${L.pat || 'pat-soil'})`, opacity: 0.55 }, g);
    top = L.to;
  }
  return g;
}

/** Nyíl SVG-ben: arrow(parent, x1,y1,x2,y2, {cls:'s-bad', w:2, head:7, color:'var(--bad)'})
 *  A szín a cls-ből (s-bad, s-ok, s-ink, s-water, s-acc, s-steel, s-grp, s-muted, s-warn) vagy a color-ból jön – a fej is. */
const ARROWC = { 's-bad': 'var(--bad)', 's-ok': 'var(--ok)', 's-ink': 'var(--ink)', 's-water': 'var(--water)', 's-acc': 'var(--accent)', 's-steel': 'var(--steelm2)', 's-grp': 'var(--grp)', 's-muted': 'var(--muted)', 's-warn': 'var(--warn)', 's-line': 'var(--line2)' };
export function arrow(parent, x1, y1, x2, y2, o = {}) {
  const g = svg('g', {}, parent);
  g.style.color = o.color || ARROWC[o.cls] || 'var(--ink)';
  const w = o.w ?? 2, hd = o.head ?? 7;
  const a = Math.atan2(y2 - y1, x2 - x1);
  svg('line', { x1, y1, x2: x2 - Math.cos(a) * hd * 0.7, y2: y2 - Math.sin(a) * hd * 0.7, 'stroke-width': w, 'stroke-linecap': 'round', stroke: 'currentColor' }, g);
  const p = [[x2, y2], [x2 - Math.cos(a - 0.42) * hd, y2 - Math.sin(a - 0.42) * hd], [x2 - Math.cos(a + 0.42) * hd, y2 - Math.sin(a + 0.42) * hd]];
  svg('path', { d: pathD(p, true), fill: 'currentColor' }, g);
  return g;
}

/** Méretvonal: dim(parent, x1,y1,x2,y2, 'szöveg', {off: 0, side: 1}) */
export function dim(parent, x1, y1, x2, y2, text, o = {}) {
  const g = svg('g', { class: 'dim' }, parent);
  svg('line', { x1, y1, x2, y2, class: 's-muted', 'stroke-width': 1 }, g);
  const tk = 4;
  const a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
  for (const [x, y] of [[x1, y1], [x2, y2]]) svg('line', { x1: x - Math.cos(a) * tk, y1: y - Math.sin(a) * tk, x2: x + Math.cos(a) * tk, y2: y + Math.sin(a) * tk, class: 's-muted', 'stroke-width': 1 }, g);
  const mx = (x1 + x2) / 2 + (o.dx || 0), my = (y1 + y2) / 2 + (o.dy || 0);
  svg('text', { x: mx, y: my, class: 't-num halo', 'text-anchor': o.anchor || 'middle', 'dominant-baseline': 'middle', text }, g);
  return g;
}

/* ---------- Formázás: nem törő egységek + magyar elválasztás ---------- */
export const GUARD = (() => {
  const NB = '\u00A0', WJ = '\u2060', NNB = '\u202F', NBH = '\u2011', SHY = '\u00AD';
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'svg', 'SVG', 'CANVAS', 'SELECT', 'OPTION']);
  const BLOCK = 'main p, main li, main dd, main dt, main figcaption, main .note, main h2, main h3, main h4, main h5, main .fb, main td, main th, main .q-t, main .q-exp, main .q-opts span, main .s, main .e, main label, main .callout > b, main .verdict, main .steptext, main .w-sub, main .w-foot, main .ctl-hint, main .vmeta span, main .lead, main .ch-lead, footer p, footer li, .hero-lead, .hero-verdict, .ytc-bar small, main .vgroup, main .stat-l, main .stat-v, main .seg button, main .btn, main .yr, main .quiz-head span, main .tf-score, main .ctl-lab, main .eq .w > div, .sim-cap';
  const HYPH = 'main p, main li, main dd, main figcaption, main .note, main .q-exp, main .s, main .e, main .verdict, main .steptext, main .w-foot, main .lead, main .ch-lead, footer p, .hero-lead, .hero-verdict';
  const NOHY = 'sub, sup, code, button, label, output, td, th, .nw, .formula, h1, h2, h3, h4, h5, .stat, .chips, .chip, .seg, .mono, .tag, .ctl-val, .fact b';
  const TERMS = ['dinamikus hatás', 'dinamikus teher', 'gerjesztő rezgésszám', 'önrezgésszám', 'önrezgési környezet', 'saját frekvencia', 'rezgéssebesség', 'csúcs-rezgéssebesség', 'hatászóna', 'vibrátoros cölöpverés', 'gépalap', 'telített homok', 'finom szemcsés', 'meredek szemeloszlás', 'egyenletes szemeloszlás', 'magnitúdó', 'intenzitás', 'hipocentrum', 'epicentrum', 'fészekmélység', 'talajgyorsulás', 'vízszintes talajgyorsulás', 'altalajosztály', 'nyíróhullám-sebesség', 'válaszspektrum', 'visszatérési idő', 'folyósodás', 'süllyedési teknő', 'szakadólap', 'térfogatveszteség', 'üregnyitás', 'tömedékelés', 'pincerendszer', 'alábányászott terület', 'kimosó hatás', 'gyors apadás', 'hidraulikus gradiens', 'kritikus gradiens', 'folyós homok', 'zsompos víztelenítés', 'szűrőszabály', 'kimélyülés', 'fagyhatár', 'fagyemelés', 'jéglencse', 'jéglencse-képződés', 'tömbfagyás', 'nullizoterma', 'fagyérzékeny talaj', 'hőszigetelő réteg', 'padlófűtés', 'egyenlőtlen süllyedés', 'használhatósági határállapot', 'teherbírási határállapot', 'drénezetlen nyírószilárdság', 'hatékony feszültség', 'belső súrlódási szög', 'talajvízszint'];
  const termRx = new RegExp('(' + TERMS.sort((a, b) => b.length - a.length).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[ \\u00A0]')).join('|') + ')', 'giu');
  const MULT_SYM = /^(tg|ctg|sin|cos|tan|exp|ln|log)\b/;
  const NUMW = /(^|[\s(\u00A0\u2060„])((?:[Kk]ét|[Hh]árom|[Nn]égy|[Öö]t|[Hh]at|[Hh]ét|[Nn]yolc|[Kk]ilenc|[Tt]íz|[Hh]úsz|[Ss]záz|[Ee]zer|[Ee]lső|[Mm]ásodik|[Hh]armadik|[Nn]egyedik|[Öö]tödik|[Hh]atodik|[Hh]etedik|[Nn]yolcadik|[Kk]ilencedik|[Tt]izedik|[Mm]indkét|[Mm]indhárom|[Nn]éhány|[Ee]gyik|[Kk]ettő|[Hh]armincnyolc|[Nn]egyven|[Hh]etven))(?=\s\S)\s/g;
  function textPass(s) {
    if (!/[ \-–·]/.test(s)) return s;
    // ezres tagolás
    s = s.replace(/(^|[^\d,.])(\d{1,3}) (\d{3})(?!\d)/g, '$1$2' + NNB + '$3');
    // operátorok
    s = s.replace(/ ([=≤≥≈→←×±<>⇒]) /g, NB + '$1' + NB);
    s = s.replace(/([\p{N}\p{L})\]′″°²³]) ([+−]) (?=[\p{N}\p{L}(])/gu, '$1' + NB + '$2' + NB);
    s = s.replace(/ \/ /g, NB + '/' + NB);
    // nyitó zárójel / sor eleje után álló operátor a mögötte álló értékhez kötve: (≈ 6,3·10¹³ J)
    s = s.replace(/(^|[(\[„])([=≤≥≈<>±~]) (?=\S)/g, '$1$2' + NB);
    // a · kettős szerepe
    s = s.replace(/ · (?=(\S+))/g, (m, nxt) => {
      const w = nxt.replace(/^[(„"]/, '');
      if (/^\p{L}{3,}/u.test(w) && !MULT_SYM.test(w)) return m;
      return NB + '·' + NB;
    });
    // azonosítók
    s = s.replace(/(\d)-(\d)/g, '$1' + NBH + '$2');
    s = s.replace(/\b([A-Z]{2,5})-(\d)/g, '$1' + NBH + '$2');
    s = s.replace(/(^|[\s(\u00A0„])(MSZ|EN|ISO|DIN|ASCE|IRC|FprEN|prEN) (?=[A-Z\d])/g, '$1$2' + NB);
    s = s.replace(/([^\s\u2060])–([^\s\u2060])/g, '$1' + WJ + '–' + WJ + '$2');
    // függvénynév + argumentum
    s = s.replace(/(^|[\s(\u00A0\u2060·×=+−/])(tg|ctg|sin|cos|tan|ln|lg|log|exp) (?=\S)/g, '$1$2' + NB);
    // rövidítések
    s = s.replace(/(^|[\s(\u00A0])(pl\.|kb\.|ill\.|ún\.|max\.|min\.|ld\.|vö\.|cca\.|átl\.|ill|ún|kb) (?=\S)/g, '$1$2' + NB);
    // szám + mértékegység / szó; magában álló szám
    s = s.replace(/(^|[\s(\u00A0\u2060~≈≤≥=<>−+])(\d+(?:[,.]\d+)?\.?%?) (?=\S)/g, '$1$2' + NB);
    s = s.replace(/(^|[\s(\u00A0\u2060~≈≤≥=<>−+])(\d+(?:[,.]\d+)?\.?%?) (?=\S)/g, '$1$2' + NB);
    // névelők, rövid kötőszavak
    for (let i = 0; i < 2; i++) s = s.replace(/(^|[\s(\u00A0\u2060„])(a|az|A|Az|s|e|egy|Egy|és|És) (?=\S)/g, '$1$2' + NB);
    // betűvel írt számnév + amit számlál
    s = s.replace(NUMW, '$1$2' + NB);
    // utótagos kötőjel (30°-nál, RFA-n, 1173-ban)
    s = s.replace(/([\d°′″%)\]\p{Lu}\u2080-\u2089])-(\p{Ll}{1,6})(?=$|[\s.,;:!?)”\u00A0\u2060])/gu, '$1' + NBH + '$2');
    // mértékegység + toldalék (3 m-rel, 100 m-nél, 10 kPa-nál, 3,5 bar-nál)
    s = s.replace(/(\d[\u00A0 ](?:mm|cm|dm|km|m|m²|m³|kPa|MPa|GPa|Pa|kN|MN|kNm|bar|kg|t|°C|mm\/s|m\/s))-(\p{Ll}{1,7})(?=$|[\s.,;:!?)”\u00A0\u2060])/gu, '$1' + NBH + '$2');
    return s;
  }
  // szövegcsomópont-határon átnyúló kötés: névelő/rövidítés/szám a csomópont végén, operátor a határon
  const SHORTEND = new RegExp('(^|[\\s(\u00A0\u2060„])(a|az|A|Az|s|e|egy|Egy|és|És|pl\\.|kb\\.|ill\\.|ún\\.|max\\.|min\\.|\\d+(?:[,.]\\d+)?\\.?%?|' + NUMW.source.match(/\(\?:([^)]*)\)/)[1] + ') $');
  function crossPass(nodes) {
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1];
      const av = a.nodeValue, bv = b.nodeValue;
      if (!av || !bv) continue;
      if (av.endsWith(' ') && /^\S/.test(bv) && SHORTEND.test(av)) a.nodeValue = av.slice(0, -1) + NB;
      const ms = /^ ([=≤≥≈→←×±<>⇒+−/]) /.exec(b.nodeValue);
      if (ms && /\S$/.test(a.nodeValue)) b.nodeValue = NB + ms[1] + NB + b.nodeValue.slice(3);
      const me = / ([=≤≥≈→←×±<>⇒+−/]) $/.exec(a.nodeValue);
      if (me && /^\S/.test(b.nodeValue)) a.nodeValue = a.nodeValue.slice(0, -3) + NB + me[1] + NB;
    }
  }
  function bindPositions(full, cpl = 70) {
    const bind = new Set();
    const segMax = Math.max(14, Math.min(38, 0.42 * cpl)), parMax = Math.max(10, Math.min(24, 0.30 * cpl));
    const mark = (a, b) => { for (let i = a; i < b; i++) if (full[i] === ' ') bind.add(i); };
    // tagolás · ; – mentén
    const sepRx = / · |; | – /g;
    let last = 0, m, lastSep = '';
    const segs = [];
    while ((m = sepRx.exec(full))) { segs.push([last, m.index, lastSep, m[0]]); last = m.index + m[0].length; lastSep = m[0]; }
    segs.push([last, full.length, lastSep, '']);
    if (segs.length > 1) {
      for (const [a, b, before, after] of segs) {
        const t = full.slice(a, b).replace(/[\u2060\u00AD]/g, '').trim();
        // felsorolás-tag (· ;) ~38 karakterig; gondolatjel mellett csak rövid címke vagy verdikt
        const dashOnly = (before === ' – ' || before === '') && (after === ' – ' || after === '') && (before || after);
        const lim = dashOnly ? Math.min(22, segMax) : segMax;
        if (t.length > 0 && t.length < lim) mark(a, b);
      }
    }
    // rövid zárójeles rész
    const pr = /\(([^()]{1,30})\)/g;
    while ((m = pr.exec(full))) { if (m[0].replace(/[\u2060\u00AD]/g, '').length <= parMax) mark(m.index, m.index + m[0].length); }
    // szakkifejezések
    termRx.lastIndex = 0;
    while ((m = termRx.exec(full))) mark(m.index, m.index + m[0].length);
    // címke: érték
    const lv = /(\p{L}[\p{L}\p{N}′_]{1,22}): ([\d−+±≤≥=<>~≈α-ωΑ-Ω]\S{0,9}(?:[ \u00A0][^\s;·]{1,7})?)(?=$|[;,.·)\s])/gu;
    while ((m = lv.exec(full))) { if (m[0].length <= 34) mark(m.index, m.index + m[0].length); }
    return bind;
  }
  function textNodes(root) {
    const out = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        let p = n.parentNode;
        while (p && p !== root) { if (SKIP.has(p.nodeName) || (p.dataset && p.dataset.noguard !== undefined)) return NodeFilter.FILTER_REJECT; p = p.parentNode; }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n; while ((n = w.nextNode())) out.push(n);
    return out;
  }
  let hyph = null;
  const done = new WeakMap();
  function processBlock(el) {
    if (!el.isConnected) return;
    if (el.closest('[data-noguard]')) return;
    const cur = el.textContent;
    if (done.get(el) === cur) return;
    const nodes = textNodes(el);
    for (const n of nodes) { const v = textPass(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
    // záró szóköz törlése: a text-wrap: pretty mellett (Chrome) a záró szóköz-csomópont miatt az utolsó sor is sorkizárt lenne
    for (let i = nodes.length - 1; i >= 0; i--) { const v = nodes[i].nodeValue; if (/^[ \t\n\r]*$/.test(v)) { if (v) nodes[i].nodeValue = ''; continue; } if (/[ \t\n\r]$/.test(v)) nodes[i].nodeValue = v.replace(/[ \t\n\r]+$/, ''); break; }
    crossPass(nodes);
    // blokk-szintű kötés
    const full = nodes.map(n => n.nodeValue).join('');
    // sorhossz karakterben: a doboz szélességéhez igazodó „rövid” határ
    const fs = parseFloat(getComputedStyle(el).fontSize) || 16;
    const cpl = el.clientWidth > 40 ? el.clientWidth / (fs * 0.52) : 70;
    const bind = bindPositions(full, cpl);
    if (bind.size) {
      let off = 0;
      for (const n of nodes) {
        const v = n.nodeValue; let o = '', ch = false;
        for (let i = 0; i < v.length; i++) {
          if (v[i] === ' ' && bind.has(off + i)) { o += NB + WJ; ch = true; } else o += v[i];
        }
        off += v.length;
        if (ch) n.nodeValue = o;
      }
    }
    if (hyph && el.matches(HYPH)) {
      for (const n of textNodes(el)) {
        if (n.parentElement && n.parentElement.closest(NOHY) && n.parentElement.closest(NOHY) !== el) continue;
        const parts = n.nodeValue.split(/( )/);
        let ch = false;
        for (let i = 0; i < parts.length; i += 2) {
          const t = parts[i];
          if (!t || !/\p{L}{6,}/u.test(t)) continue;
          const clean = t.replace(/[\u00AD\u200B]/g, '');
          let h;
          if (t.includes(WJ)) {
            // 16 karakternél hosszabb kötött csoport: csak az utolsó szava választható el
            const vis = clean.replace(/[\u2060]/g, '');
            if (vis.length <= 16 || /^\(.*\)[.,;:!?]*$/.test(vis)) continue;
            const k = Math.max(clean.lastIndexOf('\u00A0'), clean.lastIndexOf(WJ));
            const tail = clean.slice(k + 1);
            if (!/\p{L}{6,}/u.test(tail)) continue;
            h = clean.slice(0, k + 1) + hyph(tail);
          } else h = hyph(clean);
          h = h.replace(/\u200B/g, '');
          if (h !== t) { parts[i] = h; ch = true; }
        }
        if (ch) n.nodeValue = parts.join('');
      }
    }
    done.set(el, el.textContent);
  }
  let obs = null, pend = new Set(), sched = false;
  function run(root = document.body) {
    const set = new Set();
    if (root.matches && root.matches(BLOCK)) set.add(root);
    $$(BLOCK, root).forEach(e => set.add(e));
    if (obs) obs.disconnect();
    set.forEach(processBlock);
    if (obs) { obs.takeRecords(); observe(); }
  }
  function observe() { obs.observe(document.body, { childList: true, subtree: true, characterData: true }); }
  function flush() {
    sched = false;
    const roots = Array.from(pend); pend.clear();
    if (obs) obs.disconnect();
    for (const r of roots) {
      if (!r.isConnected) continue;
      const blk = r.closest ? r.closest(BLOCK) : null;
      if (blk) processBlock(blk);
      if (r.querySelectorAll) $$(BLOCK, r).forEach(processBlock);
    }
    if (obs) { obs.takeRecords(); observe(); }
  }
  function start() {
    run();
    obs = new MutationObserver(recs => {
      for (const r of recs) {
        const t = r.type === 'characterData' ? r.target.parentElement : r.target;
        if (t) pend.add(t);
      }
      if (!sched) { sched = true; requestAnimationFrame(flush); }
    });
    observe();
    // Hyphenopoly
    const H = window.Hyphenopoly;
    if (H && H.hyphenators && H.hyphenators.hu) {
      H.hyphenators.hu.then(fn => { hyph = s => fn(s); const all = $$(HYPH); all.forEach(e => done.delete(e)); run(); window.__fmtHyphReady = true; }).catch(() => {});
    }
  }
  // vászonra szánt szöveg őrzése
  function text(s, cpl = 60) {
    let v = textPass(s);
    const bind = bindPositions(v, cpl);
    if (bind.size) v = Array.from(v).map((c, i) => (c === ' ' && bind.has(i)) ? NB + WJ : c).join('');
    return v;
  }
  return { start, run, text, textPass };
})();

/* vászon-tördelő: csak sima szóközön tör */
export function wrapText(ctx, str, maxW) {
  const s = GUARD.text(str);
  const words = s.split(' ');
  const lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t.replace(/\u2060/g, '')).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.map(l => l.replace(/\u2060/g, ''));
}

