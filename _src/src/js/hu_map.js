// Magyarország vázlatos térképe (határ, Balaton, Duna, Tisza, Dráva) és a talajgyorsulási zónák – képpont-koordinátákban
import M from './hu_map.json';
import { svg } from './core.js';
import { pd } from './plot.js';

export const MAP = M;
const ax = M.affine.x, ay = M.affine.y;
/** földrajzi (szélesség, hosszúság) → térkép-képpont */
export const P = (lat, lon) => [ax[0] * lon + ax[1] * lat + ax[2], ay[0] * lon + ay[1] * lat + ay[2]];
/** távolság km-ben (gömbi közelítés) */
export function km(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dla = (b[0] - a[0]) * r, dlo = (b[1] - a[1]) * r, m = ((a[0] + b[0]) / 2) * r;
  return R * Math.hypot(dla, dlo * Math.cos(m));
}
export const PX_PER_KM = 1.8;
export const CITIES = [
  { n: 'Budapest', ll: [47.498, 19.04] }, { n: 'Győr', ll: [47.687, 17.635] }, { n: 'Pécs', ll: [46.073, 18.233] },
  { n: 'Szeged', ll: [46.253, 20.141] }, { n: 'Debrecen', ll: [47.531, 21.627] }, { n: 'Eger', ll: [47.903, 20.377] },
  { n: 'Kecskemét', ll: [46.906, 19.69] }, { n: 'Nagykanizsa', ll: [46.453, 16.991] },
];
export const borderD = () => pd(M.border) + 'Z';
/** alaptérkép: ország, Balaton, folyók; visszaadja a csoportot */
export function baseMap(parent, o = {}) {
  const g = svg('g', {}, parent);
  svg('path', { d: borderD(), fill: o.fill || 'var(--surface2)', stroke: 'none' }, g);
  return g;
}
export function overlays(parent, o = {}) {
  const g = svg('g', { 'pointer-events': 'none' }, parent);
  for (const [n, r] of Object.entries(M.rivers)) svg('path', { d: pd(r), fill: 'none', stroke: 'var(--water)', 'stroke-width': n === 'Dráva' ? 1.6 : 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.85 }, g);
  svg('path', { d: pd(M.balaton) + 'Z', fill: 'var(--water)', opacity: 0.85 }, g);
  svg('ellipse', { cx: M.velence[0], cy: M.velence[1], rx: 7, ry: 3, fill: 'var(--water)', opacity: 0.85, transform: `rotate(-20 ${M.velence[0]} ${M.velence[1]})` }, g);
  svg('path', { d: borderD(), fill: 'none', stroke: 'var(--ink2)', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g);
  if (o.cities !== false) for (const c of CITIES) {
    const [x, y] = P(...c.ll);
    svg('circle', { cx: x, cy: y, r: 4, fill: 'var(--ink)' }, g);
    svg('text', { x: x + 7, y: y - 6, class: 't-s halo', text: c.n, style: 'font-size:15px;fill:var(--ink2)' }, g);
  }
  return g;
}
