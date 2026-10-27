// CH1 – Dinamikus hatások: forráskatalógus, rázópad, rezonancialabor, hatászóna, kráterbecslő, gépalap-tervező, kvíz
import { register, shell, slider, seg, toggle, stat, verdict, h, svg, figure, clear, fmt, clamp, lerp, smooth, loop, fitCanvas, cssVar, onTheme, $ } from './core.js';
import { chart, pd, samp } from './plot.js';
import { defineQuiz } from './ui.js';

const SB = (t) => `<tspan dy="4" font-size="75%">${t}</tspan><tspan dy="-4"> </tspan>`;

/* ---------------------------------------------------------------- 1. rezgésforrás-katalógus */
const SRC = [
  { k: 'blast', n: 'Robbantás', f: [1, 300], kind: 'tranziens', dur: 'egy-egy lökés < 1 s, késleltetett sorozatban', ppv: 'a forrás közelében akár 100 mm/s', txt: 'Rövid, éles lökés, széles frekvenciasávval. Kőbányákban és bontásnál; a hatását a töltet tömege és a távolság szabja meg.' },
  { k: 'impact', n: 'Cölöpverés (ütve)', f: [4, 30], kind: 'ismétlődő impulzus', dur: 'kb. 0,2 s-os ütések, másodpercenként', ppv: 'tipikusan ≈ 16 mm/s 7,6 m-en', txt: 'Minden ütés egy rövid impulzus. A laza homokot a cölöp körül tömöríti; a szomszéd épületre a sok ezer ismétlődés a veszélyes.' },
  { k: 'vibro', n: 'Vibrációs verés', f: [20, 40], kind: 'folyamatos', dur: 'perceken át egyenletes', ppv: 'tipikusan ≈ 4 mm/s 7,6 m-en (felső ≈ 19)', txt: 'Szádlemezek és cölöpök vibrátoros verése. Indításkor és leálláskor a rendszer áthalad a saját frekvenciáján – ilyenkor a legerősebb a rezgés.' },
  { k: 'traffic', n: 'Közlekedés', f: [5, 25], kind: 'véletlenszerű, ismétlődő', dur: 'egy-egy jármű néhány másodperc', ppv: 'épületben ritkán > 2 mm/s', txt: 'Nehéz járművek, villamos, vasút. Kis amplitúdójú, de évtizedeken át ismétlődő rezgés; egyenetlen burkolaton és laza talajon erősebb.' },
  { k: 'quake', n: 'Földrengés', f: [0.1, 10], kind: 'tranziens, hosszú', dur: 'tíz-hatvan másodperc erős rázás', ppv: 'erős rengésnél több száz mm/s', txt: 'Alacsony frekvenciájú, nagy kitérésű mozgás – éppen az épületek és a talajrétegek saját frekvenciáján. Ezért a legveszélyesebb dinamikus hatás.' },
  { k: 'wind', n: 'Széllökés', f: null, kind: 'lassú, ciklikus', dur: 'lökésenként néhány másodperc', ppv: '–', txt: 'Nagyon alacsony frekvenciájú, lassú lökések. A magas, karcsú építményeket, például tornyokat és szélerőműveket mozgatja, és az alapra ciklikusan váltakozó billentő nyomatékot ad.' },
];
function srcSignal(k, t) {
  const n = Math.sin(t * 91.7) * 0.5 + Math.sin(t * 57.3 + 1) * 0.5;
  switch (k) {
    case 'blast': { let y = 0; for (const t0 of [0.4, 1.05, 1.7]) { const a = t - t0; if (a > 0) y += Math.exp(-a * 9) * Math.sin(a * 2 * Math.PI * 38) * (t0 === 1.05 ? 1 : 0.7); } return y + 0.03 * n; }
    case 'impact': { const ph = t % 1.0; return Math.exp(-ph * 16) * Math.sin(ph * 2 * Math.PI * 15) * 0.9 + 0.03 * n; }
    case 'vibro': return 0.55 * Math.sin(t * 2 * Math.PI * 28) * Math.min(1, t / 0.5) + 0.04 * n;
    case 'traffic': { const e = Math.exp(-((t - 1.2) ** 2) * 2.2) + 0.5 * Math.exp(-((t - 2.9) ** 2) * 3); return e * 0.42 * (Math.sin(t * 2 * Math.PI * 12) * 0.6 + Math.sin(t * 2 * Math.PI * 19) * 0.4) + 0.04 * n; }
    case 'quake': { const a = t - 0.3; if (a < 0) return 0.03 * n; return (0.25 * Math.exp(-a * 3) * Math.sin(a * 2 * Math.PI * 6) + 0.9 * Math.min(1, Math.max(0, a - 0.8) * 2) * Math.exp(-Math.max(0, a - 1.6) * 0.6) * Math.sin(a * 2 * Math.PI * 1.4)) + 0.03 * n; }
    case 'wind': return 0.6 * Math.sin(t * 2 * Math.PI * 0.35) * (0.7 + 0.3 * Math.sin(t * 1.3)) + 0.05 * Math.sin(t * 2 * Math.PI * 1.1);
  }
  return 0;
}
register('dyn-sources', (root) => {
  const { ctrls, viz, out } = shell(root);
  const pick = seg(ctrls, { label: 'Forrás', vert: true, options: SRC.map((s) => ({ v: s.k, t: s.n })), value: 'vibro' });
  const desc = h('p', { class: 'ctl-hint', style: 'font-size:14px;color:var(--ink2)' });
  ctrls.append(desc);
  const cv = h('canvas', { style: 'width:100%;display:block;border-radius:10px;border:1px solid var(--line);background:var(--surface2)' });
  const fig = figure(viz, 720, 250);
  viz.prepend(cv);
  let st = null; st = fitCanvas(cv, 0.26, () => { if (st) drawSig(); });
  const sF = stat(out, { label: 'Frekvencia' }), sK = stat(out, { label: 'Jelleg' }), sD = stat(out, { label: 'Időtartam' }), sP = stat(out, { label: 'Jellemző rezgéssebesség' });
  let t = 0;
  const drawSig = () => {
    const { ctx: g, w, h: hh } = st; g.clearRect(0, 0, w, hh);
    g.strokeStyle = cssVar('--line'); g.setLineDash([3, 5]); g.beginPath(); g.moveTo(0, hh / 2); g.lineTo(w, hh / 2); g.stroke(); g.setLineDash([]);
    g.strokeStyle = cssVar('--c1'); g.lineWidth = 1.7; g.beginPath();
    const win = 3.6; const k = pick.v;
    for (let x = 0; x <= w; x += 1) { const tt = (t % 6) - win + (x / w) * win; const y = hh / 2 - srcSignal(k, tt < 0 ? tt + 6 : tt) * hh * 0.42; x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.fillStyle = cssVar('--muted'); g.font = '11px "DM Mono", monospace'; g.fillText('rezgéssebesség – idő (szemléltető)', 10, 15);
  };
  const drawBands = () => {
    clear(fig);
    const c = chart(fig, { w: 720, h: 250, m: { l: 150, r: 14, t: 12, b: 40 }, x: [0.1, 300], y: [0, 8], xlog: true, xt: [0.1, 0.3, 1, 3, 10, 30, 100, 300], yt: [], xl: 'frekvencia, Hz (logaritmikus lépték)' });
    const rows = [...SRC.filter((s) => s.f), { n: 'épületek saját frekvenciája', f: [0.5, 10], ref: 1 }, { n: 'talajrétegek (f = v/4H)', f: [0.3, 10], ref: 1 }];
    rows.forEach((r, i) => {
      const y = 22 + i * 26; const on = r.k === pick.v;
      svg('text', { x: 142, y: y + 13, 'text-anchor': 'end', class: 't-s' + (on ? ' t-b' : ''), text: r.n, style: on ? 'fill:var(--ink)' : '' }, fig);
      svg('rect', { x: c.X(r.f[0]), y: y + 2, width: c.X(r.f[1]) - c.X(r.f[0]), height: 16, rx: 8, fill: r.ref ? 'none' : on ? 'var(--c1)' : 'color-mix(in srgb, var(--c1) 22%, transparent)', stroke: r.ref ? 'var(--c2)' : on ? 'var(--c1)' : 'none', 'stroke-dasharray': r.ref ? '4 3' : null, 'stroke-width': 1.5 }, fig);
    });
  };
  const upd = () => {
    const s = SRC.find((x) => x.k === pick.v);
    desc.textContent = s.txt;
    sF.set(s.f ? `${fmt(s.f[0], s.f[0] < 1 ? 1 : 0)}–${fmt(s.f[1], 0)} Hz` : 'nagyon alacsony'); sK.set(s.kind); sD.set(s.dur); sP.set(s.ppv);
    [sK, sD, sP].forEach((x) => x.el.classList.add('txt')); sD.el.style.flexBasis = '220px'; sP.el.style.flexBasis = '240px';
    drawBands(); drawSig();
  };
  pick.on(upd); upd(); onTheme(() => { drawBands(); drawSig(); });
  loop(cv, (tt, dt) => { t += dt; drawSig(); });
  root.append(h('div', { class: 'w-foot', html: 'A szélrezgésre nem adunk számszerű sávot. A frekvenciatartományok jellemző értékek; a földrengés éppen az épületek és a talajrétegek saját frekvenciájának sávjába esik.' }));
});

/* ---------------------------------------------------------------- 2. rázópad */
const SOILS = [
  { k: 'fs', n: 'Egyenletes finom homok', d: [0.08, 0.1, 0.13, 0.17, 0.22, 0.3], U: 1.8, base: 1.0, r: 5.5, col: '--soilA' },
  { k: 'ss', n: 'Iszapos homok', d: [0.01, 0.03, 0.07, 0.15, 0.3, 0.6], U: 6, base: 0.7, r: 4.6, col: '--soilC' },
  { k: 'gr', n: 'Homokos kavics', d: [0.2, 0.6, 2, 6, 14, 30], U: 25, base: 0.35, r: 7, col: '--soilD' },
  { k: 'cl', n: 'Közepes agyag', d: [0.0005, 0.001, 0.002, 0.005, 0.01, 0.04], U: 12, base: 0.12, r: 2.4, col: '--soilB' },
];
const PCT = [5, 10, 30, 60, 85, 98]; // a d-értékekhez tartozó áthullási %
register('dyn-soil', (root) => {
  const { ctrls, viz, out } = shell(root);
  const soil = seg(ctrls, { label: 'Talaj', vert: true, options: SOILS.map((s) => ({ v: s.k, t: s.n })), value: 'fs' });
  const dens = seg(ctrls, { label: 'Tömörség', options: [{ v: 1, t: 'laza' }, { v: 0.6, t: 'közepes' }, { v: 0.25, t: 'tömör' }], value: 1 });
  const sat = toggle(ctrls, { label: 'vízzel telített', value: true });
  const shake = h('button', { class: 'btn', type: 'button' }, '▶ Rázás');
  ctrls.append(shake);
  const wrap = h('div', { class: 'grid2' });
  const cv = h('canvas', { style: 'width:100%;display:block;border-radius:10px;border:1px solid var(--line)' });
  const left = h('div', {}, cv); const right = h('div', {});
  wrap.append(left, right); viz.append(wrap);
  const fig = figure(right, 380, 260);
  let st = null; st = fitCanvas(cv, 0.68, () => { if (st) draw(); });
  const sU = stat(out, { label: 'Egyenlőtlenségi mutató <i>U</i> = <i>d</i><sub>60</sub>/<i>d</i><sub>10</sub>' }), sS = stat(out, { label: 'Rezgésérzékenység' }), sDs = stat(out, { label: 'Felszínsüllyedés a dobozban' });
  const vd = verdict(out);
  // szemcsék: laza és tömör elrendezés
  let grains = [], prog = 0, playing = false, tt = 0;
  const build = () => {
    const S = SOILS.find((s) => s.k === soil.v); const R = S.r * 1.6; const W = 300, H = 210;
    grains = []; let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const nx = Math.floor(W / (2 * R)), loose = 1.0 + 0.32 * dens.v;
    const rows = Math.floor(H / (2 * R * loose * 0.9));
    for (let j = 0; j < rows; j++) for (let i = 0; i < nx; i++) {
      const rr = R * (S.k === 'gr' ? 0.55 + rnd() * 0.9 : S.k === 'ss' ? 0.6 + rnd() * 0.6 : S.k === 'cl' ? 0.8 + rnd() * 0.3 : 0.9 + rnd() * 0.15);
      const x0 = 12 + R + i * 2 * R * loose + (rnd() - 0.5) * R * 0.5, y0 = H - R - j * 2 * R * loose * 0.92 + (rnd() - 0.5) * R * 0.4;
      const x1 = 12 + R + i * 2 * R + (j % 2) * R, y1 = H - R - j * 2 * R * 0.87;
      if (y0 < 8) continue;
      grains.push({ x0, y0, x1, y1, r: rr });
    }
  };
  const sens = () => { const S = SOILS.find((s) => s.k === soil.v); return clamp(S.base * dens.v * (sat.v ? 1 : 0.55), 0, 1); };
  const draw = () => {
    const { ctx: g, w, h: hh } = st; if (!w) return; g.clearRect(0, 0, w, hh);
    const S = SOILS.find((s) => s.k === soil.v); const sc = w / 324;
    g.save(); g.scale(sc, sc);
    g.fillStyle = cssVar('--surface2'); g.fillRect(0, 0, 324, 236);
    const p = smooth(prog) * sens();
    const jit = playing ? 1.6 * (1 - prog * 0.5) : 0;
    // víz
    if (sat.v) { g.fillStyle = cssVar('--water-fill'); g.fillRect(12, 6, 300, 214); }
    let topY = 999;
    g.fillStyle = cssVar(S.col); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.6;
    for (const q of grains) {
      const x = lerp(q.x0, q.x1, p) + Math.sin(tt * 40 + q.x0) * jit, y = lerp(q.y0, q.y1, p) + Math.cos(tt * 37 + q.y0) * jit;
      topY = Math.min(topY, y - q.r);
      g.beginPath(); if (S.k === 'cl') g.ellipse(x, y, q.r * 1.6, q.r * 0.55, 0.1, 0, 7); else g.arc(x, y, q.r, 0, 7); g.fill(); g.stroke();
    }
    // doboz
    g.strokeStyle = cssVar('--ink2'); g.lineWidth = 2; g.beginPath(); g.moveTo(10, 4); g.lineTo(10, 222); g.lineTo(314, 222); g.lineTo(314, 4); g.stroke();
    // kiinduló felszín
    const y0 = Math.min(...grains.map((q) => q.y0 - q.r));
    g.setLineDash([4, 4]); g.strokeStyle = cssVar('--muted'); g.lineWidth = 1; g.beginPath(); g.moveTo(12, y0); g.lineTo(312, y0); g.stroke(); g.setLineDash([]);
    if (p > 0.02) { g.fillStyle = cssVar('--c1'); g.font = '700 12px Manrope, sans-serif'; g.fillText('Δs', 290, (y0 + topY) / 2 + 4); g.strokeStyle = cssVar('--c1'); g.beginPath(); g.moveTo(284, y0); g.lineTo(284, topY); g.stroke(); }
    if (sat.v && playing && sens() > 0.4) { g.fillStyle = cssVar('--water'); for (let i = 0; i < 6; i++) { const x = 40 + i * 48, y = topY - 6 - ((tt * 30 + i * 13) % 20); g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x - 4, y); g.lineTo(x + 4, y); g.fill(); } }
    g.restore();
    const ds = Math.max(0, topY - y0);
    sDs.set(fmt((ds / 210) * 100, 1) + ' %', sens() > 0.6 ? 'bad' : sens() > 0.3 ? 'warn' : 'ok', fmt((ds / 210) * 100, 1) + ' %');
  };
  const drawCurve = () => {
    clear(fig);
    const c = chart(fig, { w: 380, h: 260, m: { l: 42, r: 10, t: 10, b: 40 }, x: [0.0002, 60], y: [0, 100], xlog: true, xt: [0.001, 0.01, 0.1, 1, 10], yt: [0, 20, 40, 60, 80, 100], xl: 'szemcseméret, mm', yl: 'áthullás, %', xf: (v) => (v < 0.01 ? fmt(v, 3) : v < 1 ? fmt(v, v < 0.1 ? 2 : 1) : fmt(v, 0)) });
    for (const S of SOILS) {
      const on = S.k === soil.v;
      svg('path', { d: pd(S.d.map((d, i) => [c.X(d), c.Y(PCT[i])])), fill: 'none', stroke: on ? 'var(--c1)' : 'var(--line2)', 'stroke-width': on ? 3 : 1.5 }, fig);
    }
    const S = SOILS.find((s) => s.k === soil.v);
    svg('text', { x: c.X(S.d[3]) + 6, y: c.Y(55), class: 't-s t-b', text: S.k === 'fs' ? 'meredek' : S.k === 'gr' ? 'lapos' : '', style: 'fill:var(--c1)' }, fig);
  };
  const upd = () => {
    const S = SOILS.find((s) => s.k === soil.v);
    sU.set(fmt(S.U, S.U < 10 ? 1 : 0)); const se = sens();
    sS.set(se > 0.6 ? 'nagy' : se > 0.3 ? 'közepes' : 'kicsi', se > 0.6 ? 'bad' : se > 0.3 ? 'warn' : 'ok');
    vd.set(se > 0.6 ? 'bad' : se > 0.3 ? 'warn' : 'ok', se > 0.6 ? 'Veszélyes: rezgésre roskad' : se > 0.3 ? 'Mérsékelten érzékeny' : 'Kevéssé érzékeny',
      S.k === 'cl' ? 'A kötött talajt a kohézió összetartja; a rezgés alig rendezi át.' : S.k === 'gr' ? 'A jól graduált szemcsék egymásba ékelődnek, a váz eleve tömör.' : sat.v ? 'Az egyforma szemcsék laza vázából a rezgés tömörebb helyzetbe rendezi a szemcséket; a telített pórusokban megnő a víznyomás.' : 'Száraz állapotban kisebb a veszély, de a laza, egyenletes homok így is tömörödik.');
    build(); prog = 0; draw(); drawCurve();
  };
  [soil, dens, sat].forEach((c) => c.on(upd)); upd();
  shake.addEventListener('click', () => { build(); prog = 0; playing = true; tt = 0; });
  loop(cv, (t, dt) => { tt += dt; if (playing) { prog = Math.min(1, prog + dt / 2.6); if (prog >= 1) playing = false; draw(); } });
  onTheme(() => { draw(); drawCurve(); });
});

/* ---------------------------------------------------------------- 3. rezonancialabor */
register('dyn-res', (root) => {
  const { ctrls, viz, out } = shell(root);
  const f = slider(ctrls, { label: 'Gerjesztő rezgésszám', sym: 'f', min: 1, max: 50, step: 0.5, value: 12, unit: 'Hz', d: 1 });
  const f0 = slider(ctrls, { label: 'Önrezgésszám', sym: 'f<sub>0</sub>', min: 8, max: 35, step: 0.5, value: 22, unit: 'Hz', d: 1 });
  const z = slider(ctrls, { label: 'Csillapítás', sym: 'ζ', min: 2, max: 30, step: 1, value: 8, unit: '%' });
  const sweep = h('button', { class: 'btn btn-line', type: 'button' }, '▶ Söprés 1 → 50 Hz');
  ctrls.append(sweep, h('p', { class: 'ctl-hint', html: 'A söprés úgy változtatja a gerjesztést, mint egy induló vibrátor vagy felpörgő gép.' }));
  const grid = h('div', { style: 'display:grid;grid-template-columns:minmax(0,0.75fr) minmax(0,1.25fr);gap:12px;align-items:start' });
  const cv = h('canvas', { style: 'width:100%;display:block;border-radius:10px;border:1px solid var(--line);background:var(--surface2)' });
  const rgt = h('div', {}); grid.append(h('div', {}, cv), rgt); viz.append(grid);
  const figA = figure(rgt, 460, 200), figB = figure(rgt, 460, 200);
  let st = null; st = fitCanvas(cv, 1.25, () => { if (st) drawMass(); });
  const sR = stat(out, { label: 'Frekvenciaarány <i>f</i>/<i>f</i><sub>0</sub>' }), sN = stat(out, { label: 'Nagyítás' });
  const vd = verdict(out);
  const N = (r, zz) => 1 / Math.sqrt((1 - r * r) ** 2 + (2 * zz * r) ** 2);
  let ph = 0, sweeping = false;
  const sCurve = (ff, F0) => { const D = Math.max(3, F0 * 0.22); return 0.12 * (ff / 50) + 0.78 / (1 + Math.exp(-(ff - F0) / (D / 3.2))); };
  const drawMass = () => {
    const { ctx: g, w, h: hh } = st; if (!w) return; g.clearRect(0, 0, w, hh);
    const r = f.v / f0.v, amp = Math.min(N(r, z.v / 100), 6) / 6;
    const y = Math.sin(ph) * amp * hh * 0.12;
    const base = hh * 0.86, top = hh * 0.36 + y;
    // talaj
    g.fillStyle = cssVar('--soilA'); g.fillRect(0, base, w, hh - base);
    // rugó + csillapító
    g.strokeStyle = cssVar('--ink2'); g.lineWidth = 2; g.beginPath();
    const xs = w * 0.36, n = 9; g.moveTo(xs, base); for (let i = 0; i <= n; i++) { const yy = base - (i / n) * (base - top - hh * 0.12); g.lineTo(xs + (i % 2 ? 12 : -12) * (i > 0 && i < n ? 1 : 0), yy); } g.stroke();
    const xd = w * 0.64; g.strokeRect(xd - 9, base - (base - top) * 0.55, 18, (base - top) * 0.3); g.beginPath(); g.moveTo(xd, base); g.lineTo(xd, base - (base - top) * 0.25); g.moveTo(xd, base - (base - top) * 0.45); g.lineTo(xd, top + hh * 0.12); g.stroke();
    // tömeg (alap + építmény)
    g.fillStyle = cssVar('--concrete'); g.fillRect(w * 0.2, top, w * 0.6, hh * 0.12);
    g.fillStyle = cssVar('--building'); g.fillRect(w * 0.3, top - hh * 0.2, w * 0.4, hh * 0.2);
    g.strokeStyle = cssVar('--line2'); g.strokeRect(w * 0.3, top - hh * 0.2, w * 0.4, hh * 0.2);
    g.fillStyle = cssVar('--c1'); g.font = '700 12px "DM Mono", monospace'; g.textAlign = 'center';
    g.fillText(`${fmt(f.v, 1)} Hz`, w / 2, hh * 0.08 + 6);
    // gerjesztő nyíl
    const fa = Math.sin(ph) * 14; g.strokeStyle = cssVar('--c1'); g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.5, top - hh * 0.2 - 8); g.lineTo(w * 0.5, top - hh * 0.2 - 22 - fa); g.stroke();
    g.textAlign = 'left';
  };
  const drawPlots = () => {
    clear(figA); clear(figB);
    const zz = z.v / 100;
    const A = chart(figA, { w: 460, h: 200, m: { l: 46, r: 12, t: 10, b: 34 }, x: [0, 50], y: [0, 7], xt: [0, 10, 20, 30, 40, 50], yt: [0, 2, 4, 6], xl: 'gerjesztő rezgésszám, Hz', yl: 'nagyítás' });
    svg('rect', { x: A.X(f0.v * 0.8), y: A.T, width: A.X(f0.v * 1.2) - A.X(f0.v * 0.8), height: A.B - A.T, fill: 'color-mix(in srgb, var(--c2) 12%, transparent)' }, figA);
    svg('path', { d: pd(samp((x) => Math.min(N(x / f0.v, zz), 7), 0.01, 50, 300).map(([x, y]) => [A.X(x), A.Y(y)])), fill: 'none', stroke: 'var(--c1)', 'stroke-width': 2.4 }, figA);
    svg('circle', { cx: A.X(f.v), cy: A.Y(Math.min(N(f.v / f0.v, zz), 7)), r: 6, fill: 'var(--c1)', stroke: 'var(--surface)', 'stroke-width': 2 }, figA);
    svg('text', { x: A.X(f0.v), y: A.T + 14, 'text-anchor': 'middle', class: 't-s', html: `f${SB(0)} ± 20 %` }, figA);
    const B = chart(figB, { w: 460, h: 200, m: { l: 46, r: 12, t: 10, b: 34 }, x: [0, 50], y: [1.05, -0.05], xt: [0, 10, 20, 30, 40, 50], yt: [], xl: 'rezgésszám, Hz', yl: 'süllyedés ↓' });
    const D = Math.max(3, f0.v * 0.22);
    svg('rect', { x: B.X(f0.v - D), y: B.T, width: B.X(f0.v + D) - B.X(f0.v - D), height: B.B - B.T, fill: 'color-mix(in srgb, var(--c2) 12%, transparent)' }, figB);
    for (const xx of [f0.v - D, f0.v + D]) svg('line', { x1: B.X(xx), y1: B.T, x2: B.X(xx), y2: B.B, stroke: 'var(--c2)', 'stroke-dasharray': '5 4' }, figB);
    svg('text', { x: B.X(f0.v + D) + 6, y: B.T + 16, class: 't-s', text: 'önrezgési környezet', style: 'fill:var(--c2)' }, figB);
    svg('path', { d: pd(samp((x) => sCurve(x, f0.v), 0, 50, 200).map(([x, y]) => [B.X(x), B.Y(y)])), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.2 }, figB);
    svg('circle', { cx: B.X(f.v), cy: B.Y(sCurve(Math.min(f.v, 50), f0.v)), r: 6, fill: 'var(--c1)', stroke: 'var(--surface)', 'stroke-width': 2 }, figB);
  };
  const upd = () => {
    const r = f.v / f0.v, n = N(r, z.v / 100);
    sR.set(fmt(r, 2)); sN.set(fmt(n, 1) + '×', r > 0.8 && r < 1.2 ? 'bad' : (r > 0.67 && r < 1.5) ? 'warn' : 'ok');
    if (r > 0.8 && r < 1.2) vd.set('bad', 'Rezonancia: az önrezgési környezetben', 'A kis gerjesztés is nagy kitérést okoz. Laza, telített talajon hirtelen, roskadásszerű süllyedés várható – a gerjesztést el kell hangolni.');
    else if (r > 0.67 && r < 1.5) vd.set('warn', 'Közel a rezonanciához', 'A vibrátorok indításakor és leállásakor a rendszer áthalad ezen a sávon – ilyenkor rövid ideig erősebb a rezgés.');
    else vd.set('ok', r < 1 ? 'Jóval az önrezgésszám alatt' : 'Jóval az önrezgésszám fölött', r < 1 ? 'A rendszer szinte merevtestként követi a gerjesztést, nincs felnagyítás.' : 'A tömeg „nem győzi követni” a gyors gerjesztést, a kitérés kisebb a statikusnál. A vibrációs verésnél ezért nagy (≥ 1,5 × f0) frekvenciát választanak.');
    drawPlots(); drawMass();
  };
  [f, f0, z].forEach((c) => c.on(upd)); upd();
  sweep.addEventListener('click', () => { sweeping = true; f.set(1); });
  loop(cv, (t, dt) => { ph += dt * Math.min(f.v, 6) * 2 * Math.PI * 0.5; if (sweeping) { const nv = f.v + dt * 9; if (nv >= 50) { sweeping = false; f.set(50); } else f.set(Math.round(nv * 2) / 2); } drawMass(); });
  onTheme(upd);
});

/* ---------------------------------------------------------------- 4. hatászóna (DIN 4150-3) */
const MACH = [
  { k: 'imp', n: 'Ütve verő, tipikus', ppv: 16.4, fr: 15 },
  { k: 'impH', n: 'Ütve verő, nagy energiájú', ppv: 38.6, fr: 15 },
  { k: 'vib', n: 'Vibrációs, tipikus', ppv: 4.3, fr: 30 },
  { k: 'vibH', n: 'Vibrációs, felső érték', ppv: 19.4, fr: 30 },
];
const DIN = { ind: [20, 20, 40, 50], res: [5, 5, 15, 20], sens: [3, 3, 8, 10] }; // <10 Hz, 10, 50, 100 Hz
const dinLimit = (cat, fr) => { const v = DIN[cat]; if (fr <= 10) return v[0]; if (fr <= 50) return lerp(v[1], v[2], (fr - 10) / 40); return lerp(v[2], v[3], Math.min(1, (fr - 50) / 50)); };
register('dyn-zone', (root) => {
  const { ctrls, viz, out } = shell(root);
  const mach = seg(ctrls, { label: 'Gép (rezgéssebesség 7,6 m-en)', vert: true, options: MACH.map((m) => ({ v: m.k, t: `${m.n} · ${fmt(m.ppv, 1)} mm/s` })), value: 'vib' });
  const soil = seg(ctrls, { label: 'Talaj (csillapodási kitevő)', options: [{ v: 1.4, t: 'puha' }, { v: 1.3, t: 'közepes' }, { v: 1.1, t: 'kemény' }], value: 1.3 });
  const cat = seg(ctrls, { label: 'Szomszéd épület', vert: true, options: [{ v: 'ind', t: 'ipari, kereskedelmi' }, { v: 'res', t: 'lakóépület' }, { v: 'sens', t: 'érzékeny, műemlék' }], value: 'res' });
  const dist = slider(ctrls, { label: 'Távolság', sym: 'r', min: 3, max: 60, step: 0.5, value: 12, unit: 'm', d: 1 });
  const fig = figure(viz, 720, 330);
  const sV = stat(out, { label: 'Rezgéssebesség az alapon' }), sL = stat(out, { label: 'Határérték' }), sDmin = stat(out, { label: 'Szükséges távolság' });
  const vd = verdict(out);
  const M = () => MACH.find((m) => m.k === mach.v);
  const ppv = (r) => M().ppv * (7.6 / r) ** soil.v;
  let drag = false;
  const draw = () => {
    clear(fig);
    // felülnézet (bal): a gép bal szélen, a ház jobbra, a vízszintes tengely mentén
    const cx = 34, cy = 165, sc = 4.6; // px/m
    if (!fig.querySelector('#dzclip')) { const d = svg('defs', {}, fig); const cp = svg('clipPath', { id: 'dzclip' }, d); svg('rect', { x: 8, y: 8, width: 324, height: 314, rx: 12 }, cp); }
    svg('rect', { x: 8, y: 8, width: 324, height: 314, rx: 12, fill: 'var(--surface2)', stroke: 'var(--line)' }, fig);
    const lim = dinLimit(cat.v, M().fr);
    const dmin = 7.6 * (M().ppv / lim) ** (1 / soil.v);
    const cg = svg('g', { 'clip-path': 'url(#dzclip)' }, fig);
    svg('circle', { cx, cy, r: dmin * sc, fill: 'color-mix(in srgb, var(--bad) 13%, transparent)', stroke: 'var(--bad)', 'stroke-dasharray': '5 4' }, cg);
    for (const R of [10, 20, 30, 40, 50, 60]) { svg('circle', { cx, cy, r: R * sc, fill: 'none', stroke: 'var(--c1)', opacity: R <= 30 ? 0.75 : 0.3 }, cg); svg('text', { x: cx + R * sc - 3, y: 26, 'text-anchor': 'end', class: 't-num t-s halo', text: R + ' m' }, cg); }
    svg('rect', { x: cx - 10, y: cy - 7, width: 20, height: 14, rx: 3, fill: 'var(--c1)' }, fig);
    svg('text', { x: cx - 4, y: cy - 16, class: 't-s halo', text: 'cölöpverés' }, fig);
    const hx = cx + dist.v * sc, hy = cy;
    svg('line', { x1: cx + 10, y1: cy + 30, x2: hx, y2: cy + 30, stroke: 'var(--ink2)' }, fig);
    svg('text', { x: (cx + hx) / 2, y: cy + 46, 'text-anchor': 'middle', class: 't-num halo', text: fmt(dist.v, 1) + ' m' }, fig);
    const hg = svg('g', { transform: `translate(${hx},${hy})`, style: 'cursor:grab', 'data-house': 1 }, fig);
    svg('rect', { x: -14, y: -11, width: 28, height: 22, fill: 'var(--building)', stroke: 'var(--ink2)', 'stroke-width': 1.5 }, hg);
    svg('path', { d: 'M-14 -11 L0 -21 L14 -11 Z', fill: 'var(--brick)' }, hg);
    svg('text', { x: 0, y: -26, 'text-anchor': 'middle', class: 't-s halo', text: '⟷ húzd' }, hg);
    // rezgéssebesség–távolság (jobb)
    const c = chart(fig, { w: 720, h: 330, m: { l: 400, r: 14, t: 14, b: 42 }, x: [3, 60], y: [0.3, 200], xlog: true, ylog: true, xt: [3, 5, 10, 20, 30, 60], yt: [0.5, 1, 2, 5, 10, 20, 50, 100, 200], xl: 'távolság, m', yl: '' });
    svg('text', { x: 400, y: 10, class: 't-s', text: 'rezgéssebesség, mm/s' }, fig);
    svg('rect', { x: c.L, y: c.T, width: c.R - c.L, height: c.Y(lim) - c.T, fill: 'color-mix(in srgb, var(--bad) 10%, transparent)' }, fig);
    svg('line', { x1: c.L, y1: c.Y(lim), x2: c.R, y2: c.Y(lim), stroke: 'var(--bad)', 'stroke-width': 2, 'stroke-dasharray': '6 4' }, fig);
    svg('text', { x: c.R - 4, y: c.Y(lim) - 6, 'text-anchor': 'end', class: 't-s t-b', text: `határérték ${fmt(lim, 1)} mm/s`, style: 'fill:var(--bad)' }, fig);
    svg('rect', { x: c.X(20), y: c.T, width: c.X(30) - c.X(20), height: c.B - c.T, fill: 'color-mix(in srgb, var(--c1) 12%, transparent)' }, fig);
    svg('path', { d: pd(samp(ppv, 3, 60, 120, true).map(([x, y]) => [c.X(x), c.Y(clamp(y, 0.3, 200))])), fill: 'none', stroke: 'var(--c1)', 'stroke-width': 2.6 }, fig);
    svg('circle', { cx: c.X(dist.v), cy: c.Y(clamp(ppv(dist.v), 0.3, 200)), r: 6, fill: 'var(--c1)', stroke: 'var(--surface)', 'stroke-width': 2 }, fig);
    const v = ppv(dist.v);
    sV.set(fmt(v, 1), v > lim ? 'bad' : v > 0.7 * lim ? 'warn' : 'ok', fmt(v, 1) + '<small>mm/s</small>');
    sL.set(fmt(lim, 1) + '<small>mm/s</small>', null, fmt(lim, 1) + '<small>mm/s</small>');
    sDmin.set(fmt(dmin, 1) + '<small>m</small>', null, fmt(dmin, 1) + '<small>m</small>');
    vd.set(v > lim ? 'bad' : v > 0.7 * lim ? 'warn' : 'ok', v > lim ? 'Túllépi a határértéket' : v > 0.7 * lim ? 'Közel a határértékhez' : 'Megfelel', v > lim ? 'Kisebb rezgést keltő technológia (pl. fúrt cölöp, sajtolás) vagy a gép távolabb állítása kell; a szomszédban rezgésmérés.' : 'A kivitelezés alatt a szomszéd épület alapján rezgésmérővel kell ellenőrizni – a számítás csak becslés.');
  };
  fig.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-house]')) { drag = true; fig.setPointerCapture(e.pointerId); e.preventDefault(); } });
  fig.addEventListener('pointermove', (e) => { if (!drag) return; const p = fig.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(fig.getScreenCTM().inverse()); dist.set(clamp(Math.round((q.x - 34) / 4.6 * 2) / 2, 3, 60)); });
  const up = () => { drag = false; }; fig.addEventListener('pointerup', up); fig.addEventListener('pointercancel', up);
  [mach, soil, cat, dist].forEach((c) => c.on(draw)); draw(); onTheme(draw);
  root.append(h('div', { class: 'w-foot', html: 'Becslés a rezgéssebesség távolsággal való csökkenésére: v = v<sub>7,6 m</sub> · (7,6 / r)<sup>n</sup>, ahol n a talajtól függő kitevő. A sárga sáv a jellemző 20–30 m-es hatászóna. A határérték a gép jellemző frekvenciáján (ütve verés ≈ 15 Hz, vibrációs verés ≈ 30 Hz) érvényes.' }));
});

/* ---------------------------------------------------------------- 5. kráterbecslő */
register('dyn-crater', (root) => {
  const { ctrls, viz, out } = shell(root);
  const D = slider(ctrls, { label: 'Cölöpátmérő', sym: 'D', min: 0.2, max: 0.8, step: 0.05, value: 0.3, unit: 'm', d: 2 });
  const L = slider(ctrls, { label: 'Cölöphossz', sym: 'L', min: 4, max: 20, step: 0.5, value: 10, unit: 'm', d: 1 });
  const x = slider(ctrls, { label: 'A szomszéd alap távolsága', sym: 'a', min: 1, max: 25, step: 0.5, value: 7, unit: 'm', d: 1 });
  const fig = figure(viz, 720, 320);
  const sR = stat(out, { label: 'Tömörödési zóna sugara ≈ 3·<i>D</i>' }), sK = stat(out, { label: 'Kráter sugara ≈ 3·<i>D</i> + <i>L</i>/2' });
  const vd = verdict(out);
  const draw = () => {
    clear(fig);
    const sc = 13, x0 = 120, y0 = 70; // px/m, cölöp tengelye, terepszint
    const rz = 3 * D.v, rk = 3 * D.v + L.v / 2;
    svg('rect', { x: 0, y: y0, width: 720, height: 250, class: 'f-soilA' }, fig);
    svg('rect', { x: 0, y: 0, width: 720, height: y0, fill: 'var(--sky)' }, fig);
    // kráter (torzított teknő)
    const smax = 1.2;
    const surf = samp((xx) => (Math.abs(xx) < rk ? smax * (1 - Math.abs(xx) / rk) ** 1.6 : 0), -8, 46, 240).map(([xx, s]) => [x0 + xx * sc, y0 + s * sc]);
    svg('path', { d: pd([[0, y0], ...surf, [720, y0], [720, 0], [0, 0]]) + 'Z', fill: 'var(--sky)' }, fig);
    svg('line', { x1: 0, y1: y0, x2: 720, y2: y0, stroke: 'var(--muted)', 'stroke-dasharray': '4 4' }, fig);
    svg('path', { d: pd(surf), fill: 'none', stroke: 'var(--c1)', 'stroke-width': 2.4 }, fig);
    // tömörödési zóna
    svg('rect', { x: x0 - rz * sc, y: y0, width: 2 * rz * sc, height: L.v * sc * 1.0, fill: 'color-mix(in srgb, var(--c1) 30%, transparent)', stroke: 'var(--c1)', 'stroke-dasharray': '4 3' }, fig);
    // cölöp + verőgép (sematikus)
    svg('rect', { x: x0 - D.v * sc / 2, y: y0 - 30, width: D.v * sc, height: L.v * sc + 30, fill: 'var(--concrete2)', stroke: 'var(--ink2)' }, fig);
    svg('rect', { x: x0 - 12, y: y0 - 58, width: 24, height: 28, rx: 3, fill: 'var(--c1)' }, fig);
    // szomszéd sávalap + fal
    const fx = x0 + x.v * sc; const sAt = Math.abs(x.v) < rk ? smax * (1 - x.v / rk) ** 1.6 : 0;
    svg('rect', { x: fx - 12, y: y0 + 8 + sAt * sc, width: 24, height: 10, class: 'f-conc', stroke: 'var(--ink2)' }, fig);
    svg('rect', { x: fx - 5, y: y0 - 60 + sAt * sc, width: 10, height: 68, fill: 'var(--brick)', stroke: 'var(--ink2)' }, fig);
    svg('rect', { x: fx + 5, y: y0 - 60 + sAt * sc, width: 120, height: 68, fill: 'var(--building)', opacity: 0.6 }, fig);
    // méretek
    const dimY = y0 + L.v * sc + 26;
    svg('line', { x1: x0, y1: dimY, x2: x0 + rk * sc, y2: dimY, stroke: 'var(--c1)', 'stroke-width': 1.5 }, fig);
    svg('text', { x: x0 + rk * sc / 2, y: dimY - 6, 'text-anchor': 'middle', class: 't-num halo', text: `kráter ${fmt(rk, 1)} m` }, fig);
    svg('line', { x1: x0, y1: y0 - 18, x2: fx, y2: y0 - 18, stroke: 'var(--ink2)' }, fig);
    svg('text', { x: (x0 + fx) / 2, y: y0 - 24, 'text-anchor': 'middle', class: 't-num halo', text: `a = ${fmt(x.v, 1)} m` }, fig);
    svg('text', { x: x0 + 8, y: y0 + L.v * sc - 6, class: 't-s halo', text: `L = ${fmt(L.v, 1)} m` }, fig);
    svg('text', { x: 700, y: 20, 'text-anchor': 'end', class: 't-s', text: 'a süllyedés torzítva' }, fig);
    sR.set(fmt(rz, 2) + '<small>m</small>', null, fmt(rz, 2) + '<small>m</small>'); sK.set(fmt(rk, 1) + '<small>m</small>', null, fmt(rk, 1) + '<small>m</small>');
    const inK = x.v < rk, inL = x.v < L.v;
    vd.set(inK ? 'bad' : inL ? 'warn' : 'ok', inK ? 'A szomszéd alap a kráteren belül áll' : inL ? 'A kráteren kívül, de egy cölöphosszon belül' : 'Egy cölöphossznál messzebb',
      inK ? 'Jelentős, egyenlőtlen süllyedés várható. Laza homokban ilyenkor nem vert, hanem fúrt vagy sajtolt cölöpöt kell választani.' : inL ? 'Mérsékelt kockázat: a verési sorrend, a rezgésmérés és a süllyedésmérés ajánlott.' : 'A tömörödés okozta süllyedés kockázata kicsi.');
  };
  [D, L, x].forEach((c) => c.on(draw)); draw(); onTheme(draw);
  root.append(h('div', { class: 'w-foot', html: 'Egy kidolgozott példában (D = 0,3 m, L = 10 m, közepesen tömör homok, ütve verés) a cölöp mellett 118 mm, a kráterben átlagosan 39 mm süllyedés adódott, a kráter sugara 5,9 m volt.' }));
});

/* ---------------------------------------------------------------- 6. gépalap-tervező */
register('dyn-machine', (root) => {
  const { ctrls, viz, out } = shell(root);
  const B = slider(ctrls, { label: 'Tömb szélessége', sym: 'B', min: 1.5, max: 6, step: 0.1, value: 3, unit: 'm', d: 1 });
  const L = slider(ctrls, { label: 'Tömb hossza', sym: 'L', min: 2, max: 10, step: 0.1, value: 4, unit: 'm', d: 1 });
  const H = slider(ctrls, { label: 'Tömb magassága', sym: 'H', min: 0.6, max: 3, step: 0.1, value: 1.2, unit: 'm', d: 1 });
  const mm = slider(ctrls, { label: 'Gép tömege', sym: 'm<sub>g</sub>', min: 1, max: 120, step: 1, value: 60, unit: 't' });
  const rpm = slider(ctrls, { label: 'Fordulatszám', sym: 'n', min: 300, max: 3000, step: 10, value: 1480, unit: '1/min' });
  const vs = slider(ctrls, { label: 'Nyíróhullám-sebesség a talajban', sym: 'v<sub>s</sub>', min: 100, max: 400, step: 5, value: 160, unit: 'm/s' });
  const fig = figure(viz, 720, 300);
  const sFn = stat(out, { label: 'Saját frekvencia <i>f</i><sub>n</sub>' }), sF = stat(out, { label: 'Üzemi frekvencia <i>f</i>' }), sR = stat(out, { label: '<i>f</i>/<i>f</i><sub>n</sub>' }), sM = stat(out, { label: 'Nagyítás' });
  const vd = verdict(out);
  const calc = () => {
    const rho = 1900, nu = 0.33, G = rho * vs.v ** 2;
    const r0 = Math.sqrt(B.v * L.v / Math.PI);
    const m = 2400 * B.v * L.v * H.v + mm.v * 1000;
    const k = 4 * G * r0 / (1 - nu);
    const Bz = (1 - nu) / 4 * m / (rho * r0 ** 3);
    const Dz = 0.425 / Math.sqrt(Bz);
    const fn = Math.sqrt(k / m) / (2 * Math.PI);
    const f = rpm.v / 60;
    return { G, r0, m, k, Dz, fn, f, r: f / fn };
  };
  const draw = () => {
    clear(fig);
    const c = calc();
    // metszet (bal)
    const sc = Math.min(38, 260 / Math.max(L.v, 1));
    const gx = 175, gy = 120;
    svg('rect', { x: 8, y: gy, width: 334, height: 170, class: 'f-soilA' }, fig);
    svg('rect', { x: gx - L.v * sc / 2, y: gy - 14, width: L.v * sc, height: H.v * sc, class: 'f-conc', stroke: 'var(--ink2)', 'stroke-width': 1.5 }, fig);
    svg('rect', { x: gx - L.v * sc * 0.3, y: gy - 14 - 46, width: L.v * sc * 0.6, height: 46, rx: 6, fill: 'var(--steelm2)' }, fig);
    svg('circle', { cx: gx, cy: gy - 14 - 23, r: 15, fill: 'none', stroke: 'var(--c1)', 'stroke-width': 3 }, fig);
    svg('path', { d: `M${gx} ${gy - 37} L${gx + 15} ${gy - 37}`, stroke: 'var(--c1)', 'stroke-width': 3 }, fig);
    // dilatáció a padlótól
    for (const s of [-1, 1]) { const xx = gx + s * (L.v * sc / 2 + 10); svg('line', { x1: xx, y1: gy - 18, x2: xx, y2: gy + 6, stroke: 'var(--ink2)', 'stroke-dasharray': '3 3' }, fig); svg('rect', { x: s < 0 ? 8 : xx + 2, y: gy - 18, width: s < 0 ? xx - 10 : 340 - xx, height: 10, fill: 'var(--concrete2)' }, fig); }
    svg('text', { x: gx, y: gy + H.v * sc + 12, 'text-anchor': 'middle', class: 't-s halo', text: `${fmt(B.v, 1)} × ${fmt(L.v, 1)} × ${fmt(H.v, 1)} m · ${fmt(c.m / 1000, 0)} t` }, fig);
    svg('text', { x: 16, y: gy - 24, class: 't-s', text: 'padló (dilatációval elválasztva)' }, fig);
    // nagyítási görbe (jobb)
    const A = chart(fig, { w: 720, h: 300, m: { l: 400, r: 14, t: 14, b: 40 }, x: [0, 3], y: [0, 8], xt: [0, 0.5, 1, 1.5, 2, 2.5, 3], yt: [0, 2, 4, 6, 8], xl: 'f / f<tspan class="sb">n</tspan>', yl: '' });
    svg('text', { x: 400, y: 10, class: 't-s', text: 'dinamikus nagyítás' }, fig);
    svg('rect', { x: A.X(0.8), y: A.T, width: A.X(1.2) - A.X(0.8), height: A.B - A.T, fill: 'color-mix(in srgb, var(--bad) 14%, transparent)' }, fig);
    const Nf = (r) => 1 / Math.sqrt((1 - r * r) ** 2 + (2 * c.Dz * r) ** 2);
    svg('path', { d: pd(samp((r) => Math.min(Nf(r), 8), 0, 3, 300).map(([x, y]) => [A.X(x), A.Y(y)])), fill: 'none', stroke: 'var(--c1)', 'stroke-width': 2.4 }, fig);
    const rr = Math.min(c.r, 3);
    svg('circle', { cx: A.X(rr), cy: A.Y(Math.min(Nf(rr), 8)), r: 6, fill: 'var(--c1)', stroke: 'var(--surface)', 'stroke-width': 2 }, fig);
    sFn.set(fmt(c.fn, 1) + '<small>Hz</small>', null, fmt(c.fn, 1) + '<small>Hz</small>');
    sF.set(fmt(c.f, 1) + '<small>Hz</small>', null, fmt(c.f, 1) + '<small>Hz</small>');
    const band = c.r > 0.8 && c.r < 1.2, M = Nf(c.r);
    const bad = band && M >= 1.5, warn = (!bad && band) || M >= 1.5 || (c.r > 0.7 && c.r < 1.3);
    sR.set(fmt(c.r, 2), band ? (bad ? 'bad' : 'warn') : warn ? 'warn' : 'ok');
    sM.set(fmt(M, 1) + '×', M >= 2 ? 'bad' : M >= 1.3 ? 'warn' : 'ok');
    vd.set(bad ? 'bad' : warn ? 'warn' : 'ok', bad ? 'Rezonancia veszélye' : band ? 'A saját frekvencia közelében – de erősen csillapítva' : warn ? 'Kevés a tartalék' : 'Megfelelő elhangolás',
      bad ? 'Az üzemi frekvencia a saját frekvencia ±20 %-os környezetébe esik, és a felnagyítás jelentős. Változtass a tömb tömegén vagy alapterületén – vagy javítsd a talajt.'
        : band ? `A függőleges rezgésnél a talajba sugárzott energia nagy csillapítást ad (most ${fmt(c.Dz * 100, 0)} %), ezért a felnagyítás kicsi. A billegő rezgésnél ez a csillapítás sokkal kisebb – ott a rezonancia valóban veszélyes, ezért a gyakorlat itt is legalább 20–30 % eltérést kér.`
        : warn ? 'A gyakorlati ökölszabály legalább 20–30 % eltérést kér a saját frekvenciától.'
        : (c.r > 1 ? 'A gép a saját frekvencia fölött jár (hangolt „puha” alap): indításkor és leálláskor rövid ideig áthalad a rezonancián.' : 'A gép a saját frekvencia alatt jár (merev alap).') + ` Csillapítási tényező: ${fmt(c.Dz * 100, 0)} %.`);
  };
  [B, L, H, mm, rpm, vs].forEach((x) => x.on(draw)); draw(); onTheme(draw);
  root.append(h('div', { class: 'w-foot', html: 'Egyszerűsített modell: kör alakúvá átszámított merev alap (r<sub>0</sub> = √(BL/π)) függőleges rezgése rugalmas féltéren; k = 4·G·r<sub>0</sub>/(1 − ν), G = ρ·v<sub>s</sub><sup>2</sup>, ρ = 1900 kg/m³, ν = 0,33. Tervezésre a gépgyártó adatai és a vonatkozó előírások szerint részletes dinamikai számítás kell.' }));
});

/* ---------------------------------------------------------------- kvíz */
defineQuiz('dyn', 'Kvíz – dinamikus hatások', [
  { q: 'Melyik talaj a legérzékenyebb a rezgésre?', a: ['Telített, laza, egyenletes szemeloszlású finom homok', 'Kemény, kövér agyag', 'Jól graduált, tömör homokos kavics', 'Száraz, tömör kavics'], c: 0, e: 'A meredek szemeloszlású, finom szemcsés talajok a legérzékenyebbek, főleg ha vízzel telítettek. A kötött és a durva szemcsés talajok kevésbé érzékenyek.' },
  { q: 'Mi történik, ha a gerjesztő rezgésszám az építmény alatti talajösszlet önrezgésszámának környezetébe esik?', a: ['Rezonancia: hirtelen, roskadásszerű süllyedés léphet fel', 'A rezgés kioltódik', 'A talaj megszilárdul, a süllyedés megáll', 'Csak a felszerkezet rezeg, az alap nem'], c: 0, e: 'Az önrezgésszám nem egyezhet meg a gerjesztő rezgésszámmal, mert az hirtelen, roskadásszerű süllyedéshez vezethet.' },
  { q: 'Jellemzően meddig terjednek a kivitelezés közbeni (cölöpözés, szádfalazás) rezgések?', a: ['A forrástól legfeljebb 20–30 m-ig', 'Legfeljebb 2–3 m-ig', 'Kb. 200–300 m-ig', 'Több kilométerre'], c: 0, e: 'Ezek a rezgések jellemzően legfeljebb 20–30 m-re terjednek, de a szomszédos építményekre is kihatnak – a hatászónát mindig vizsgálni kell.' },
  { q: 'Milyen kétféle kárt okozhat a rezgés?', a: ['Közvetlen kárt a felszerkezetben, és kárt az altalaj tömörödése miatt', 'Csak a vakolat repedését', 'Csak a talajvízszint emelkedését', 'Kizárólag a gépek meghibásodását'], c: 0, e: 'A rezgés közvetlenül is károsíthat, és az építmény alatti talaj tömörödése, alakváltozása miatt is felléphet kár.' },
  { q: 'A DIN 4150-3 szerint rövid idejű rezgésnél mekkora a lakóépület alaptestjén megengedett csúcs-rezgéssebesség 10 Hz alatt?', a: ['5 mm/s', '20 mm/s', '50 mm/s', '0,5 mm/s'], c: 0, e: 'Lakóépületre 10 Hz alatt 5 mm/s (ipari épületre 20, érzékeny épületre 3 mm/s); magasabb frekvencián a határérték nő.' },
  { q: 'Miért választanak a vibrációs verésnél nagy (≈ 30–40 Hz-es) üzemi frekvenciát?', a: ['Hogy jóval a talaj–gép rendszer önrezgésszáma fölött dolgozzanak, és kisebb legyen a környezet rezgése', 'Hogy gyorsabban felmelegedjen a talaj', 'Mert így nagyobb a rezonancia', 'Mert az alacsony frekvencia nem tömörít'], c: 0, e: 'Az önrezgésszám fölött a rezgés nem nagyítódik fel; ajánlás szerint az üzemi frekvencia legalább másfélszerese a rezonanciafrekvenciának.' },
  { q: 'Mekkora a süllyedési kráter sugara egy laza homokba vert cölöp körül, közelítőleg?', a: ['3·D + L/2', 'D/2', 'L', '10·L'], c: 0, e: 'A tömörödés kb. 3D sugarú zónában lép fel, a felszíni kráter sugara durván 3D + L/2 – ezért veszélyes, ha a szomszéd alap egy cölöphosszon belül van.' },
  { q: 'Mi a gépalapok tervezésének egyik alapszabálya?', a: ['Az üzemi frekvencia legalább 20–30 %-kal térjen el a rendszer saját frekvenciájától', 'Az üzemi frekvencia egyezzen meg a saját frekvenciával', 'A gépalapot mereven össze kell építeni a padlóval', 'A gépalap tömege ne számítson'], c: 0, e: 'A rezonanciát el kell kerülni; a gépalapot dilatációval elválasztják a padlótól és az épület szerkezeteitől.' },
]);
