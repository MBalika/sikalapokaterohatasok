// Kis SVG-diagram segéd: tengelyek (lineáris/log), rácsvonalak, feliratok
import { svg, fmt } from './core.js';

/**
 * chart(parent, {w, h, m:{l,r,t,b}, x:[a,b], y:[a,b], xlog, ylog, xt:[…], yt:[…], xl, yl, xf, yf, grid:true})
 * → {g, X, Y, L, R, T, B}  (X, Y: adat → px)
 */
export function chart(parent, o) {
  const m = Object.assign({ l: 52, r: 14, t: 14, b: 40 }, o.m || {});
  const L = m.l, R = o.w - m.r, T = m.t, B = o.h - m.b;
  const lx = (v) => (o.xlog ? Math.log10(v) : v), ly = (v) => (o.ylog ? Math.log10(v) : v);
  const X = (v) => L + ((lx(v) - lx(o.x[0])) / (lx(o.x[1]) - lx(o.x[0]))) * (R - L);
  const Y = (v) => B - ((ly(v) - ly(o.y[0])) / (ly(o.y[1]) - ly(o.y[0]))) * (B - T);
  const g = svg('g', {}, parent);
  svg('rect', { x: L, y: T, width: R - L, height: B - T, fill: 'var(--surface2)', stroke: 'var(--line)' }, g);
  const nf = (v) => (v === 0 ? '0' : fmt(v, Math.abs(v) < 1 ? (Math.abs(v) < 0.1 ? 2 : 1) : (Number.isInteger(v) ? 0 : 1)));
  const xf = o.xf || nf;
  const yf = o.yf || nf;
  for (const v of o.xt || []) {
    const x = X(v); if (o.grid !== false) svg('line', { x1: x, y1: T, x2: x, y2: B, stroke: 'var(--line)', 'stroke-width': 1 }, g);
    svg('text', { x, y: B + 16, 'text-anchor': 'middle', class: 't-num t-s', text: xf(v) }, g);
  }
  for (const v of o.yt || []) {
    const y = Y(v); if (o.grid !== false) svg('line', { x1: L, y1: y, x2: R, y2: y, stroke: 'var(--line)', 'stroke-width': 1 }, g);
    svg('text', { x: L - 7, y: y + 4, 'text-anchor': 'end', class: 't-num t-s', text: yf(v) }, g);
  }
  if (o.xl) svg('text', { x: (L + R) / 2, y: o.h - 6, 'text-anchor': 'middle', class: 't-s', html: o.xl }, g);
  if (o.yl) svg('text', { x: 13, y: (T + B) / 2, 'text-anchor': 'middle', transform: `rotate(-90 13 ${(T + B) / 2})`, class: 't-s', html: o.yl }, g);
  return { g, X, Y, L, R, T, B };
}
/** pontsor → path d */
export const pd = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
/** függvény mintavételezése: samp(f, a, b, n, log) → [[x, f(x)]] */
export function samp(f, a, b, n = 200, log = false) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = i / n; const x = log ? 10 ** (Math.log10(a) + t * (Math.log10(b) - Math.log10(a))) : a + t * (b - a); out.push([x, f(x)]); }
  return out;
}
