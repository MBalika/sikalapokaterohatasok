// CH3 – Földalatti üregnyitás: teknő az üreg fölött, mélység–szilárdság–idő, pincekataszter, alagút a ház alatt, kvíz
import { register, shell, slider, seg, toggle, stat, verdict, h, svg, figure, clear, fmt, clamp, lerp, smooth, loop, cssVar, onTheme, $, $$ } from './core.js';
import { chart, pd, samp } from './plot.js';
import { defineQuiz } from './ui.js';

const rad = (d) => (d * Math.PI) / 180;

/* ---------------------------------------------------------------- 1. teknő az üreg fölött */
register('cav-trough', (root) => {
  const { ctrls, viz, out } = shell(root);
  const z = slider(ctrls, { label: 'Az üreg tetejének mélysége', sym: 'z', min: 2, max: 20, step: 0.5, value: 5, unit: 'm', d: 1 });
  const a = slider(ctrls, { label: 'Az üreg szélessége', sym: 'b', min: 2, max: 8, step: 0.5, value: 4, unit: 'm', d: 1 });
  const hh = slider(ctrls, { label: 'Az üreg magassága', sym: 'm', min: 1.5, max: 5, step: 0.5, value: 3, unit: 'm', d: 1 });
  const phi = slider(ctrls, { label: 'Belső súrlódási szög', sym: 'φ', min: 20, max: 40, step: 1, value: 30, unit: '°' });
  const eta = slider(ctrls, { label: 'Benyomódott hányad', sym: 'η', min: 0, max: 60, step: 1, value: 4, unit: '%', hint: 'Az üreg keresztmetszetének mekkora része telt meg beomló talajjal.' });
  const xh = slider(ctrls, { label: 'A ház közepének helye', sym: 'x', min: -18, max: 18, step: 0.5, value: 5, unit: 'm', d: 1 });
  const fig = figure(viz, 720, 380);
  const sS = stat(out, { label: 'Legnagyobb süllyedés Δ<i>s</i>' }), sW = stat(out, { label: 'Teknőszélesség a felszínen' }), sB = stat(out, { label: 'A ház dőlése' });
  const vd = verdict(out);
  const draw = () => {
    clear(fig);
    const sc = 15, x0 = 360, y0 = 70; // px/m, üreg tengelye, terepszint
    const zb = z.v + hh.v; // az üreg alja
    const ang = rad(45 + phi.v / 2); const half = a.v / 2 + zb / Math.tan(ang); // a szakadólapok metszése a felszínnel
    const i = Math.max(0.6, half / 2.5);
    const A = a.v * hh.v * (Math.PI / 4 + 0.25) * 0.85; // boltíves keresztmetszet közelítő területe
    const V = (eta.v / 100) * A; const Smax = V / (Math.sqrt(2 * Math.PI) * i);
    const S = (x) => Smax * Math.exp(-(x * x) / (2 * i * i));
    const EXd = Smax > 0 ? Math.max(1, Math.min(40, 70 / (Smax * sc))) : 40; // a süllyedés torzítása a rajzon (a legnagyobb rajzolt mélység ≈ 70 px)
    // talaj
    svg('rect', { x: 0, y: 0, width: 720, height: y0, fill: 'var(--sky)' }, fig);
    const surf = samp((x) => S(x), -24, 24, 240).map(([x, s]) => [x0 + x * sc, y0 + s * sc * EXd]);
    svg('path', { d: pd([[0, 380], [0, y0], ...surf, [720, y0], [720, 380]]) + 'Z', class: 'f-soilA' }, fig);
    svg('line', { x1: 0, y1: y0, x2: 720, y2: y0, stroke: 'var(--muted)', 'stroke-dasharray': '4 4' }, fig);
    // mozgó földtömeg (szakadólapok közt)
    const yb = y0 + zb * sc;
    svg('path', { d: pd([[x0 - a.v / 2 * sc, yb], [x0 - half * sc, y0], [x0 + half * sc, y0], [x0 + a.v / 2 * sc, yb]]) + 'Z', fill: 'color-mix(in srgb, var(--c3) 16%, transparent)' }, fig);
    for (const s of [-1, 1]) svg('line', { x1: x0 + s * a.v / 2 * sc, y1: yb, x2: x0 + s * half * sc, y2: y0, stroke: 'var(--c3)', 'stroke-width': 2, 'stroke-dasharray': '7 5' }, fig);
    // ív a szöghöz
    const ax = x0 + a.v / 2 * sc; svg('path', { d: `M${ax + 34} ${yb} A34 34 0 0 0 ${ax + 34 * Math.cos(ang)} ${yb - 34 * Math.sin(ang)}`, fill: 'none', stroke: 'var(--c3)' }, fig);
    svg('text', { x: ax + 40, y: yb - 10, class: 't-s halo', html: `45° + φ/2 = ${fmt(45 + phi.v / 2, 0)}°` }, fig);
    svg('text', { x: x0 - half * sc - 6, y: y0 + 34, 'text-anchor': 'end', class: 't-s halo', text: 'szakadólap', style: 'fill:var(--c3)' }, fig);
    // üreg (boltozott pince) + benyomódott talaj
    const pw = a.v * sc, ph = hh.v * sc, cx = x0, top = y0 + z.v * sc;
    const vault = `M${cx - pw / 2} ${top + ph} L${cx - pw / 2} ${top + ph * 0.45} Q${cx - pw / 2} ${top} ${cx} ${top} Q${cx + pw / 2} ${top} ${cx + pw / 2} ${top + ph * 0.45} L${cx + pw / 2} ${top + ph} Z`;
    svg('path', { d: vault, fill: 'var(--ink)', stroke: 'var(--brick)', 'stroke-width': 5 }, fig);
    const fillH = ph * Math.min(1, eta.v / 100 * 1.2);
    if (fillH > 1) svg('path', { d: `M${cx - pw / 2} ${top + ph} L${cx - pw / 2} ${top + ph - fillH * 0.6} Q${cx} ${top + ph - fillH * 1.4} ${cx + pw / 2} ${top + ph - fillH * 0.6} L${cx + pw / 2} ${top + ph} Z`, fill: 'var(--soilD)' }, fig);
    // ház a felszínen – merev testként billen a két sarka közötti süllyedés szerint
    const L = 10, xl = xh.v - L / 2, xr = xh.v + L / 2;
    const sl = S(xl), sr = S(xr); const yl = y0 + sl * sc * EXd, yr = y0 + sr * sc * EXd;
    const hx0 = x0 + xl * sc, hx1 = x0 + xr * sc; const H = 70;
    const angD = Math.atan2(yr - yl, hx1 - hx0) * 180 / Math.PI;
    const hg = svg('g', { transform: `rotate(${angD.toFixed(2)} ${hx0} ${yl})` }, fig);
    const Wp = Math.hypot(hx1 - hx0, yr - yl);
    svg('rect', { x: hx0, y: yl - H, width: Wp, height: H, fill: 'var(--building)', stroke: 'var(--ink2)', 'stroke-width': 1.5 }, hg);
    svg('path', { d: `M${hx0 - 6} ${yl - H} L${hx0 + Wp / 2} ${yl - H - 34} L${hx0 + Wp + 6} ${yl - H} Z`, fill: 'var(--brick)' }, hg);
    for (const k of [0.2, 0.5, 0.8]) svg('rect', { x: hx0 + Wp * k - 9, y: yl - H + 16, width: 18, height: 20, fill: 'var(--sky)', stroke: 'var(--ink2)' }, hg);
    const tilt = (sr - sl) / L; // rad
    if (Math.abs(tilt) > 1 / 500) svg('path', { d: tilt > 0 ? `M${hx0 + Wp * 0.62} ${yl - H + 40} l7 -9 l-3 -8 l8 -9` : `M${hx0 + Wp * 0.38} ${yl - H + 40} l-7 -9 l3 -8 l-8 -9`, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.8 }, hg);
    // méretek
    svg('line', { x1: x0 + 30, y1: y0, x2: x0 + 30, y2: y0 + S(0) * sc * EXd, stroke: 'var(--c3)', 'stroke-width': 2 }, fig);
    svg('text', { x: x0 + 36, y: y0 + S(0) * sc * EXd / 2 + 4, class: 't-num t-b halo', text: `Δs = ${fmt(Smax * 1000, 0)} mm` }, fig);
    svg('text', { x: 712, y: 18, 'text-anchor': 'end', class: 't-s', text: `a süllyedés ${fmt(EXd, 0)}× torzítva` }, fig);
    svg('text', { x: 10, y: yb + 4, class: 't-num t-s halo', text: `${fmt(zb, 1)} m` }, fig);
    sS.set(`${fmt(Smax * 1000, 0)} mm`, Smax > 0.05 ? 'bad' : Smax > 0.02 ? 'warn' : 'ok', `${fmt(Smax * 1000, 0)}<small>mm</small>`);
    sW.set(`${fmt(2 * half, 1)} m`, null, `${fmt(2 * half, 1)}<small>m</small>`);
    const tt = Math.abs(tilt); sB.set(tt < 1e-5 ? '0' : `1/${fmt(1 / tt, 0)}`, tt > 1 / 150 ? 'bad' : tt > 1 / 500 ? 'warn' : 'ok');
    vd.set(tt > 1 / 150 ? 'bad' : tt > 1 / 500 ? 'warn' : 'ok', tt > 1 / 150 ? 'Súlyos kár várható' : tt > 1 / 500 ? 'Repedések várhatók' : 'A ház dőlése kicsi',
      Math.abs(xh.v) > half + 5 ? 'A ház a teknőn kívül áll.' : 'A teknő szélén, az inflexiós pont közelében a legmeredekebb a felszín – itt dől meg a legjobban a ház; a teknő közepén nagy, de egyenletesebb a süllyedés.');
  };
  [z, a, hh, phi, eta, xh].forEach((x) => x.on(draw)); draw(); onTheme(draw);
  root.append(h('div', { class: 'w-foot', html: 'Közelítés: a felszíni teknő térfogata egyenlő az üregbe benyomódott talaj térfogatával; a teknő Gauss-görbe, amelynek szélét (≈ ±2,5·i) a szakadólapok felszíni metszéspontja adja. Szemléltető számítás.' }));
});

/* ---------------------------------------------------------------- 2. mélység, szilárdság, idő */
register('cav-time', (root) => {
  const { ctrls, viz, out } = shell(root);
  const tS = slider(ctrls, { label: 'Eltelt idő', sym: 't', min: 0, max: 100, step: 1, value: 0, unit: '%' });
  const play = h('button', { class: 'btn', type: 'button' }, '▶ Lejátszás'); ctrls.append(play);
  ctrls.append(h('p', { class: 'ctl-hint', html: 'Mindkét pince keresztmetszete 4 × 3 m, és ugyanannyi talaj nyomódik be – a különbség csak a mélység és a talaj.' }));
  const fig = figure(viz, 720, 300);
  const sA = stat(out, { label: 'Sekély, laza: Δs' }), sB = stat(out, { label: 'Mély, szilárd: Δs' });
  const cases = [{ x: 180, z: 3, n: 'sekély pince, laza talaj', col: 'var(--soilA)', K: 0.45, t0: 5, t1: 30 }, { x: 540, z: 12, n: 'mély pince, szilárd talaj', col: 'var(--soilE)', K: 0.35, t0: 45, t1: 95 }];
  const V = 4 * 3 * 0.2;
  const draw = () => {
    clear(fig); const t = tS.v;
    cases.forEach((c, k) => {
      const sc = 9, y0 = 60, i = Math.max(0.8, c.K * (c.z + 1.5)); const Smax = V / (Math.sqrt(2 * Math.PI) * i);
      const p = smooth((t - c.t0) / (c.t1 - c.t0)); const S = (x) => p * Smax * Math.exp(-(x * x) / (2 * i * i));
      const gx = c.x;
      svg('rect', { x: gx - 170, y: 0, width: 340, height: y0, fill: 'var(--sky)' }, fig);
      svg('path', { d: pd([[gx - 170, 300], [gx - 170, y0], ...samp(S, -18, 18, 120).map(([x, s]) => [gx + x * sc, y0 + s * sc * 30]), [gx + 170, y0], [gx + 170, 300]]) + 'Z', fill: c.col }, fig);
      svg('rect', { x: gx - 18, y: y0 + c.z * sc, width: 36, height: 27, rx: 12, fill: 'var(--ink)', stroke: 'var(--brick)', 'stroke-width': 4 }, fig);
      svg('text', { x: gx, y: 290, 'text-anchor': 'middle', class: 't-s t-b halo', text: c.n }, fig);
      svg('text', { x: gx, y: 24, 'text-anchor': 'middle', class: 't-num t-b halo', text: p > 0.01 ? `Δs = ${fmt(p * Smax * 1000, 0)} mm` : 'még nincs mozgás' }, fig);
      (k ? sB : sA).set(`${fmt(p * Smax * 1000, 0)} mm`, null, `${fmt(p * Smax * 1000, 0)}<small>mm</small>`);
    });
    svg('line', { x1: 360, y1: 0, x2: 360, y2: 300, stroke: 'var(--line2)' }, fig);
  };
  let playing = false;
  play.addEventListener('click', () => { playing = true; tS.set(0); });
  loop(fig, (tt, dt) => { if (playing) { const v = tS.v + dt * 14; if (v >= 100) { playing = false; tS.set(100); } else tS.set(Math.round(v)); } });
  tS.on(draw); draw(); onTheme(draw);
  root.append(h('div', { class: 'w-foot', html: 'Szemléltető modell: a teknő térfogata mindkét esetben azonos, a mélyebb üreg fölött szélesebb, laposabb a teknő, és a szilárd talaj boltozódása miatt később alakul ki.' }));
});

/* ---------------------------------------------------------------- 3. pincekataszter */
const CELLARS = [
  { n: 'Eger', a: 130, b: 150, t: 'Riodácittufába vájt borospincék, több szinten; a város alatt 130–150 km feltárt pince. 1957-ben 10 000 m³ szakadt be.' },
  { n: 'Pécs (belváros)', a: 50, b: 65, t: 'Mintegy 1300 pince a belváros alatt; a beszakadások a hatvanas évek végétől váltak rendszeressé.' },
  { n: 'Kőbánya', a: 32, b: 33, t: 'Felhagyott mészkőfejtők a X. kerület alatt, kb. 180–195 ezer m² üregalapterület.' },
  { n: 'Ostoros', a: 15, b: 15, t: 'Tufába vájt pincék a falu alatt, Eger szomszédságában.' },
  { n: 'Budafok', a: 14, b: 14, t: 'Pezsgő- és borospincék a budafoki dombok mészkövében.' },
  { n: 'Szekszárd', a: 14, b: 14, t: 'Löszbe vájt borospincék – a lösz átázva roskad.' },
  { n: 'Budai Vár', a: 10, b: 10, t: 'A Várhegy barlang- és pincerendszere.' },
  { n: 'Nagymaros', a: 8, b: 8, t: 'Borospincék a település alatt.' },
  { n: 'Szentendre', a: 6, b: 6, t: 'Pincék a belváros alatt.' },
];
register('cav-cities', (root) => {
  const { viz, out } = shell(root, { layout: 'wide' });
  const fig = figure(viz, 720, 320);
  const vd = verdict(out);
  let sel = 0, narrow = null;
  const draw = () => {
    clear(fig);
    narrow = viz.clientWidth > 0 && viz.clientWidth < 520;
    const W = narrow ? 400 : 720, Hh = narrow ? 340 : 320;
    fig.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
    const c = chart(fig, { w: W, h: Hh, m: { l: narrow ? 104 : 130, r: narrow ? 74 : 30, t: 8, b: 36 }, x: [0, 160], y: [0, 1], xt: narrow ? [0, 40, 80, 120, 160] : [0, 20, 40, 60, 80, 100, 120, 140, 160], yt: [], xl: 'feltárt pincehossz, km' });
    CELLARS.forEach((p, i) => {
      const y = c.T + 6 + i * ((c.B - c.T - 8) / CELLARS.length); const bh = (c.B - c.T) / CELLARS.length - 8;
      const g = svg('g', { 'data-i': i, style: 'cursor:pointer' }, fig);
      svg('rect', { x: c.X(0), y, width: c.X(p.b) - c.X(0), height: bh, rx: 4, fill: i === sel ? 'var(--c3)' : 'color-mix(in srgb, var(--c3) 35%, transparent)' }, g);
      if (p.a !== p.b) svg('rect', { x: c.X(p.a), y, width: c.X(p.b) - c.X(p.a), height: bh, fill: 'var(--surface)', opacity: 0.35 }, g);
      svg('text', { x: c.L - 8, y: y + bh / 2 + 4, 'text-anchor': 'end', class: 't-s' + (i === sel ? ' t-b' : ''), text: p.n, style: 'font-size:13px' }, g);
      svg('text', { x: c.X(p.b) + 6, y: y + bh / 2 + 4, class: 't-num t-s', text: p.a === p.b ? `${p.a} km` : `${p.a}–${p.b} km` }, g);
    });
    vd.set('', CELLARS[sel].n, CELLARS[sel].t);
  };
  fig.addEventListener('click', (e) => { const g = e.target.closest('[data-i]'); if (g) { sel = +g.dataset.i; draw(); } });
  draw(); onTheme(draw);
  new ResizeObserver(() => { const n = viz.clientWidth > 0 && viz.clientWidth < 520; if (n !== narrow) draw(); }).observe(viz);
});

/* ---------------------------------------------------------------- 4. alagút a ház alatt (Peck + Burland) */
const BURL = [[0.05, 0, 'elhanyagolható', '< 0,1 mm-es hajszálrepedés'], [0.075, 1, 'nagyon enyhe', '< 1 mm, festéssel javítható'], [0.15, 2, 'enyhe', '< 5 mm, vakolással javítható'], [0.3, 3, 'közepes', '5–15 mm, falazatjavítás'], [Infinity, 4, 'súlyos – nagyon súlyos', '> 15 mm, szerkezeti beavatkozás']];
register('cav-tunnel', (root) => {
  const { ctrls, viz, out } = shell(root);
  const z0 = slider(ctrls, { label: 'Az alagút tengelyének mélysége', sym: 'z<sub>0</sub>', min: 8, max: 35, step: 0.5, value: 16, unit: 'm', d: 1 });
  const D = slider(ctrls, { label: 'Átmérő', sym: 'D', min: 3, max: 11, step: 0.1, value: 6.4, unit: 'm', d: 1 });
  const VL = slider(ctrls, { label: 'Térfogatveszteség', sym: 'V<sub>L</sub>', min: 0.1, max: 3, step: 0.05, value: 0.5, unit: '%', d: 2 });
  const K = seg(ctrls, { label: 'Talaj', options: [{ v: 0.5, t: 'agyag · K = 0,5' }, { v: 0.35, t: 'homok · K = 0,35' }], value: 0.5 });
  const xb = slider(ctrls, { label: 'A ház közepe a tengelytől', sym: 'x', min: -30, max: 30, step: 0.5, value: 9, unit: 'm', d: 1 });
  const Lb = slider(ctrls, { label: 'A ház hossza', sym: 'L', min: 10, max: 40, step: 1, value: 20, unit: 'm' });
  const fig = figure(viz, 720, 400);
  const sS = stat(out, { label: 'Teknőmélység <i>S</i><sub>max</sub>' }), sI = stat(out, { label: 'Inflexiós pont <i>i</i>' }), sE = stat(out, { label: 'Megnyúlás a ház alatt' });
  const vd = verdict(out);
  const draw = () => {
    clear(fig);
    const i = K.v * z0.v; const Vs = (VL.v / 100) * Math.PI * D.v * D.v / 4; const Smax = Vs / (Math.sqrt(2 * Math.PI) * i);
    const S = (x) => Smax * Math.exp(-(x * x) / (2 * i * i));
    const u = (x) => (x / z0.v) * S(x); // vízszintes elmozdulás a tengely felé
    const eps = (x) => { const d = 0.05; return (u(x + d) - u(x - d)) / (2 * d); };
    // a ház alatti szakasz
    const xa = xb.v - Lb.v / 2, xe = xb.v + Lb.v / 2;
    let emax = 0, slope = 0;
    for (let k = 0; k <= 60; k++) { const x = lerp(xa, xe, k / 60); emax = Math.max(emax, eps(x)); slope = Math.max(slope, Math.abs((S(x + 0.05) - S(x - 0.05)) / 0.1)); }
    // relatív lehajlás (hogging/sagging): a ház végpontjait összekötő húrtól mért legnagyobb eltérés / L
    let dmax = 0; for (let k = 0; k <= 60; k++) { const x = lerp(xa, xe, k / 60); const ch = lerp(S(xa), S(xe), k / 60); dmax = Math.max(dmax, Math.abs(S(x) - ch)); }
    const epsTot = Math.max(0, emax) * 100 + (dmax / Lb.v) * 100 * 1.5; // %, egyszerűsített összegzés
    const cat = BURL.find((b) => epsTot < b[0]);
    // rajz – keresztmetszet
    const sc = 7.2, cx = 360, y0 = 120, EXd = Math.max(1, Math.min(2000, 60 / Math.max(1e-6, Smax * sc)));
    svg('rect', { x: 0, y: 0, width: 720, height: y0, fill: 'var(--sky)' }, fig);
    const surf = samp(S, -50, 50, 300).map(([x, s]) => [cx + x * sc, y0 + s * EXd * sc]);
    svg('path', { d: pd([[0, 400], [0, y0], ...surf, [720, y0], [720, 400]]) + 'Z', fill: K.v === 0.5 ? 'var(--soilB)' : 'var(--soilA)' }, fig);
    svg('line', { x1: 0, y1: y0, x2: 720, y2: y0, stroke: 'var(--muted)', 'stroke-dasharray': '4 4' }, fig);
    svg('path', { d: pd(surf), fill: 'none', stroke: 'var(--c3)', 'stroke-width': 2.4 }, fig);
    // inflexiós pontok
    for (const s of [-1, 1]) { const x = cx + s * i * sc; svg('line', { x1: x, y1: y0 - 30, x2: x, y2: y0 + 40, stroke: 'var(--c3)', 'stroke-dasharray': '3 3' }, fig); }
    svg('text', { x: cx + i * sc + 4, y: y0 - 34, class: 't-s halo', text: 'i', style: 'font-style:italic' }, fig);
    // alagút
    const ty = y0 + z0.v * sc; svg('circle', { cx, cy: ty, r: D.v / 2 * sc, fill: 'var(--ink)', stroke: 'var(--concrete)', 'stroke-width': 5 }, fig);
    for (let k = 0; k < 8; k++) { const an = (k / 8) * Math.PI * 2; svg('line', { x1: cx + Math.cos(an) * (D.v / 2 * sc - 3), y1: ty + Math.sin(an) * (D.v / 2 * sc - 3), x2: cx + Math.cos(an) * (D.v / 2 * sc + 3), y2: ty + Math.sin(an) * (D.v / 2 * sc + 3), stroke: 'var(--ink2)' }, fig); }
    svg('line', { x1: cx, y1: y0, x2: cx, y2: ty, stroke: 'var(--ink2)', 'stroke-dasharray': '4 4' }, fig);
    svg('text', { x: cx + 6, y: (y0 + ty) / 2, class: 't-num t-s halo', html: `z<tspan dy="4" font-size="75%">0</tspan><tspan dy="-4"> = ${fmt(z0.v, 1)} m</tspan>` }, fig);
    // ház
    const hx0 = cx + xa * sc, hx1 = cx + xe * sc, yl = y0 + S(xa) * EXd * sc, yr = y0 + S(xe) * EXd * sc;
    const angD = Math.atan2(yr - yl, hx1 - hx0) * 180 / Math.PI, Wp = Math.hypot(hx1 - hx0, yr - yl);
    const hg = svg('g', { transform: `rotate(${angD.toFixed(2)} ${hx0} ${yl})` }, fig);
    svg('rect', { x: hx0, y: yl - 70, width: Wp, height: 70, fill: 'var(--building)', stroke: 'var(--ink2)', 'stroke-width': 1.5 }, hg);
    for (let k = 1; k < 6; k++) svg('rect', { x: hx0 + Wp * k / 6 - 7, y: yl - 52, width: 14, height: 18, fill: 'var(--sky)', stroke: 'var(--ink2)' }, hg);
    svg('path', { d: pd(samp((x) => S(x), xa, xe, 30).map(([x, s]) => [cx + x * sc, y0 + s * EXd * sc])), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }, fig);
    svg('text', { x: 712, y: 18, 'text-anchor': 'end', class: 't-s', text: `a süllyedés ${fmt(EXd, 0)}× torzítva` }, fig);
    sS.set(`${fmt(Smax * 1000, 1)} mm`, null, `${fmt(Smax * 1000, 1)}<small>mm</small>`);
    sI.set(`${fmt(i, 1)} m`, null, `${fmt(i, 1)}<small>m</small>`);
    sE.set(`${fmt(epsTot, 3)} %`, cat[1] >= 3 ? 'bad' : cat[1] >= 2 ? 'warn' : 'ok', `${fmt(epsTot, 3)}<small>%</small>`);
    vd.set(cat[1] >= 3 ? 'bad' : cat[1] >= 2 ? 'warn' : 'ok', `${cat[1]}. kárkategória – ${cat[2]}`, `Várható repedéstágasság: ${cat[3]}. ` + (Math.abs(xb.v) > i && Math.abs(xb.v) < 2.5 * i ? 'A ház a teknő szélén, a meredek részen áll – itt a legnagyobb a megnyúlás.' : ''));
  };
  [z0, D, VL, K, xb, Lb].forEach((x) => x.on(draw)); draw(); onTheme(draw);
  root.append(h('div', { class: 'w-foot', html: 'Peck-féle Gauss-teknő; a vízszintes elmozdulás az alagút tengelye felé mutat (u = x·S/z<sub>0</sub>). A kárkategória a ház alatti legnagyobb megnyúlásból és a relatív lehajlásból becsült határ-alakváltozás alapján. A kategóriahatárok: 0,05; 0,075; 0,15 és 0,3 %. Szemléltető, egyszerűsített számítás.' }));
});

/* ---------------------------------------------------------------- kvíz */
defineQuiz('cav', 'Kvíz – földalatti üregek', [
  { q: 'Miért okoz süllyedést egy mesterséges üreg megnyitása?', a: ['Megváltozik az eredeti feszültségállapot, a felette és mellette lévő föld az üreg felé mozdul', 'Mert a talaj felmelegszik', 'Mert a talajvízszint megemelkedik', 'Mert az üreg levegője összenyomja a talajt'], c: 0, e: 'Az üregnyitás megváltoztatja a feszültségállapotot; a föld az üreg felé mozdul, a felszínen süllyedési teknő alakul ki.' },
  { q: 'A vízszinteshez képest mekkora szögben fut fel a szakadólap az üreg alsó sarkából?', a: ['45° + φ/2', '45° − φ/2', 'φ', '90°'], c: 0, e: 'A szakadólapok a vízszinteshez képest kb. 45° + φ/2 szögben futnak a felszínig, és kijelölik a teknő szélességét.' },
  { q: 'Mitől függ közelítőleg a süllyedés nagysága?', a: ['Az üregbe benyomódott talajtömeg térfogatától', 'Az épület színétől', 'Csak a talajvízszinttől', 'Az üreg korától'], c: 0, e: 'A felszíni teknő térfogata közelítőleg egyenlő az üregbe benyomódott talaj térfogatával.' },
  { q: 'Hogyan hat a mélység és a talajszilárdság az elmozdulásra?', a: ['Mélyebb üreg és szilárdabb talaj esetén kisebb és később jelentkező az elmozdulás', 'Mélyebb üregnél mindig nagyobb a süllyedés', 'A szilárdság nem számít', 'Szilárdabb talajban azonnal beszakad'], c: 0, e: 'Minél mélyebben van az üreg és minél szilárdabb a talaj, annál kisebb lesz és később következik be az elmozdulás.' },
  { q: 'Mi a teendő, ha üreget találunk egy épület alatt?', a: ['Mielőbb megtámasztani vagy tömedékelni, és víztelenítéssel szárazon tartani', 'Megvárni, amíg magától beomlik', 'Vízzel feltölteni', 'Az épület tetejét megerősíteni'], c: 0, e: 'Az üreg megtámasztása (vagy tömedékelése) és víztelenítése mielőbb meg kell történjen.' },
  { q: 'Mit jelent az alagútépítésnél a térfogatveszteség?', a: ['A felszíni teknő térfogatát az alagút keresztmetszetének százalékában', 'Az elszállított föld tömegét', 'A beton zsugorodását', 'A talajvíz elpárolgását'], c: 0, e: 'V<sub>L</sub> = V<sub>s</sub> / (πD²/4); modern, homlokzattámasztásos pajzsoknál jellemzően 0,3–0,5 %.' },
  { q: 'Hol dől meg a legjobban egy ház a süllyedési teknőben?', a: ['A teknő szélén, az inflexiós pont közelében', 'Pontosan a teknő közepén', 'A teknőn kívül', 'Mindenhol ugyanannyira'], c: 0, e: 'Az inflexiós pontnál (x = i) a legmeredekebb a teknő; itt a legnagyobb a dőlés és a megnyúlás.' },
  { q: 'Miért veszélyes, ha egy tufába vájt pince átázik?', a: ['A tufa szilárdsága vízzel telítve töredékére csökken, a boltozat beszakadhat', 'Mert a víz megfagy benne nyáron', 'Mert a tufa vízben oldódik, mint a só', 'Nem veszélyes'], c: 0, e: 'Egerben a riodácittufa szilárdsága átázva harmadára-ötödére csökken – ezért kell a csapadék- és közműveket elvezetni.' },
]);
