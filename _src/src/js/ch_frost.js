// CH5 – Fagyhatás: jéglencse-labor, fagyveszélyességi besorolás, fagybehatolás-számító, családi ház, hűtőház-szimulátor, kvíz
import { register, shell, slider, seg, toggle, stat, verdict, h, svg, figure, clear, fmt, clamp, lerp, smooth, loop, fitCanvas, cssVar, onTheme, $, $$ } from './core.js';
import { chart, pd, samp } from './plot.js';
import { defineQuiz } from './ui.js';

const SOIL = {
  kavics: { n: 'homokos kavics', k: 2.0, w: 0.08, rd: 1900, near: 0.004, far: 0.002, col: '--soilD' },
  homok: { n: 'homok', k: 1.8, w: 0.14, rd: 1700, near: 0.012, far: 0.006, col: '--soilA' },
  iszap: { n: 'iszap, iszapos finom homok', k: 1.5, w: 0.24, rd: 1600, near: 0.16, far: 0.05, col: '--soilC' },
  agyag: { n: 'kövér agyag', k: 1.3, w: 0.3, rd: 1500, near: 0.06, far: 0.02, col: '--soilB' },
};
const Lh = (s) => 334e3 * s.w * s.rd; // J/m³
const stefan = (s, F) => Math.sqrt((2 * s.k * F * 86400) / Lh(s)); // m

/* ---------------------------------------------------------------- 1. jéglencse-labor */
register('frost-lens', (root) => {
  const { ctrls, viz, out } = shell(root);
  const soil = seg(ctrls, { label: 'Talaj', vert: true, options: Object.entries(SOIL).map(([k, s]) => ({ v: k, t: s.n })), value: 'iszap' });
  const gw = slider(ctrls, { label: 'Talajvíz mélysége', sym: 'z<sub>w</sub>', min: 0.5, max: 4, step: 0.1, value: 1.2, unit: 'm', d: 1 });
  const T = slider(ctrls, { label: 'A fagyos időszak átlaghőmérséklete', sym: 'T', min: -15, max: -1, step: 1, value: -6, unit: '°C' });
  const D = slider(ctrls, { label: 'Tartama', sym: 'n', min: 5, max: 90, step: 1, value: 60, unit: 'nap' });
  const go = h('button', { class: 'btn', type: 'button' }, '▶ Tél indítása'); ctrls.append(go);
  const cv = h('canvas', { style: 'width:100%;display:block;border-radius:10px;border:1px solid var(--line)' });
  viz.append(cv);
  const sZ = stat(out, { label: 'Fagybehatolás' }), sH = stat(out, { label: 'Fagyemelés Δ<i>f</i>' }), sR = stat(out, { label: 'Ebből jéglencse' });
  const vd = verdict(out);
  let day = 0, run = false;
  const model = (d) => {
    const s = SOIL[soil.v]; const F = Math.abs(T.v) * d; const z = 0.75 * stefan(s, F);
    const supply = z + 0.3 >= gw.v ? 1 : clamp(1.5 - (gw.v - z) / 1.2, 0, 1); // vízutánpótlás: közeli talajvízből
    const block = 0.09 * s.w * s.rd / 1000 * z * 0.35; // tömbfagyás (a víz egy része kiszorul)
    const lens = z * lerp(s.far, s.near, supply);
    return { z, block, lens, supply };
  };
  let st = null; st = fitCanvas(cv, 0.55, () => { if (st) draw(); });
  function draw() {
    const { ctx: g, w, h: H } = st; if (!w) return; g.clearRect(0, 0, w, H);
    const s = SOIL[soil.v]; const m = model(day);
    const top = H * 0.2, sc = (H * 0.75) / 4; // 4 m mély oszlop
    const heave = (m.block + m.lens) * sc * 4; // a rajzon 4× torzítva
    g.fillStyle = cssVar('--sky'); g.fillRect(0, 0, w, H);
    // talaj és talajvíz
    g.fillStyle = cssVar(s.col); g.fillRect(w * 0.08, top - heave, w * 0.46, H - top + heave);
    g.fillStyle = cssVar('--water-fill'); g.fillRect(w * 0.08, top + gw.v * sc, w * 0.46, H);
    g.strokeStyle = cssVar('--water'); g.setLineDash([5, 4]); g.beginPath(); g.moveTo(w * 0.06, top + gw.v * sc); g.lineTo(w * 0.56, top + gw.v * sc); g.stroke(); g.setLineDash([]);
    // fagyott zóna
    g.fillStyle = cssVar('--frost'); g.globalAlpha = 0.55; g.fillRect(w * 0.08, top - heave, w * 0.46, m.z * sc + heave); g.globalAlpha = 1;
    // jéglencsék
    const nL = Math.round(clamp(m.lens / 0.004, 0, 22));
    g.fillStyle = '#ffffff'; g.strokeStyle = cssVar('--ice');
    for (let k = 0; k < nL; k++) { const y = top - heave + (k + 0.5) / Math.max(nL, 1) * (m.z * sc + heave * 0.8); const th = clamp((m.lens * sc * 4) / Math.max(nL, 1), 1.2, 7); g.fillRect(w * 0.09, y, w * 0.44, th); g.strokeRect(w * 0.09, y, w * 0.44, th); }
    // vízfelszívás nyilai
    if (m.supply > 0.3 && s.near > 0.03 && run) { g.strokeStyle = cssVar('--water'); g.lineWidth = 2; for (const xx of [0.18, 0.31, 0.44]) { const y0 = top + gw.v * sc - 4, y1 = top + m.z * sc + 8; if (y0 > y1 + 6) { g.beginPath(); g.moveTo(w * xx, y0); g.lineTo(w * xx, y1); g.stroke(); g.beginPath(); g.moveTo(w * xx - 5, y1 + 7); g.lineTo(w * xx, y1); g.lineTo(w * xx + 5, y1 + 7); g.stroke(); } } g.lineWidth = 1; }
    // fagyfront, felirat
    g.strokeStyle = cssVar('--c5'); g.lineWidth = 2.5; g.beginPath(); g.moveTo(w * 0.06, top + m.z * sc); g.lineTo(w * 0.56, top + m.z * sc); g.stroke(); g.lineWidth = 1;
    g.fillStyle = cssVar('--ink'); g.font = '600 12px Manrope, sans-serif';
    g.fillText('fagyfront', w * 0.57, top + m.z * sc + 4); g.fillText('talajvíz', w * 0.57, top + gw.v * sc + 4);
    g.textAlign = 'right'; g.fillText(`${Math.round(day)}. nap`, w - 10, 18); g.textAlign = 'left';
    // hőmérő
    const tx = w * 0.8; g.fillStyle = cssVar('--surface'); g.strokeStyle = cssVar('--ink2'); g.lineWidth = 2;
    g.beginPath(); g.roundRect(tx - 9, H * 0.12, 18, H * 0.62, 9); g.fill(); g.stroke();
    g.beginPath(); g.arc(tx, H * 0.8, 16, 0, 7); g.fillStyle = cssVar('--c5'); g.fill(); g.stroke();
    const lvl = H * 0.12 + H * 0.62 * (0.25 - T.v / 40); g.fillStyle = cssVar('--c5'); g.fillRect(tx - 5, lvl, 10, H * 0.8 - lvl);
    g.fillStyle = cssVar('--ink'); g.fillText(`${T.v} °C`, tx + 22, lvl + 4);
    g.fillText(`Δf = ${fmt((m.block + m.lens) * 100, 1)} cm (4× torzítva)`, w * 0.08, Math.max(16, top - heave - 8));
    sZ.set(`${fmt(m.z, 2)} m`, null, `${fmt(m.z, 2)}<small>m</small>`);
    sH.set(`${fmt((m.block + m.lens) * 100, 1)} cm`, (m.block + m.lens) > 0.05 ? 'bad' : (m.block + m.lens) > 0.015 ? 'warn' : 'ok', `${fmt((m.block + m.lens) * 100, 1)}<small>cm</small>`);
    sR.set(`${fmt(m.lens / Math.max(1e-6, m.block + m.lens) * 100, 0)} %`);
    vd.set(s.near > 0.1 && m.supply > 0.5 ? 'bad' : s.near > 0.03 ? 'warn' : 'ok', s.near > 0.1 && m.supply > 0.5 ? 'Erős fagyemelés: mindhárom feltétel teljesül' : s.near > 0.03 ? 'Mérsékelt fagyemelés' : 'Nem fagyérzékeny', s.near > 0.1 && m.supply > 0.5 ? 'Fagyérzékeny talaj, fagy és közeli talajvíz: a jéglencsék gyorsan nőnek. Olvadáskor a talaj átázik és visszaroskad.' : soil.v === 'kavics' ? 'A durva szemcsék között nincs kapilláris vízemelés, jéglencse nem képződik.' : gw.v > m.z + 1 ? 'A talajvíz messze van a fagyfronttól, a jéglencséknek nincs vízutánpótlása.' : 'A talaj kevésbé fagyérzékeny, a jéglencsék lassan nőnek.');
  }
  [soil, gw, T, D].forEach((x) => x.on(() => { day = D.v; run = false; draw(); }));
  go.addEventListener('click', () => { day = 0; run = true; });
  loop(cv, (t, dt) => { if (run) { day += dt * 12; if (day >= D.v) { day = D.v; run = false; } draw(); } });
  day = D.v; draw(); onTheme(draw);
  root.append(h('div', { class: 'w-foot', html: 'A fagybehatolás a módosított Berggren-képlettel (λ ≈ 0,75 · Stefan-mélység); a fagyemelés nagysága szemléltető, a talajfajtára és a vízutánpótlásra jellemző arányokkal.' }));
});

/* ---------------------------------------------------------------- 2. fagyveszélyességi besorolás */
const FCLS = { NFS: ['nem fagyérzékeny', 'ok'], PFS: ['átmeneti, lehetséges fagyveszély', 'warn'], F1: ['F1 · enyhén fagyérzékeny', 'warn'], F2: ['F2 · közepesen fagyérzékeny', 'warn'], F3: ['F3 · erősen fagyérzékeny', 'bad'], F4: ['F4 · a legveszélyesebb', 'bad'] };
register('frost-class', (root) => {
  const { ctrls, viz, out } = shell(root);
  const g = seg(ctrls, { label: 'Talajcsoport', vert: true, options: [{ v: 'kav', t: 'kavicsos talaj' }, { v: 'hom', t: 'homok' }, { v: 'fhom', t: 'nagyon finom, iszapos homok' }, { v: 'isz', t: 'iszap' }, { v: 'agyN', t: 'agyag, I<sub>p</sub> > 12' }, { v: 'agyK', t: 'agyag, I<sub>p</sub> < 12' }, { v: 'var', t: 'réteges (varvás) agyag' }], value: 'hom' });
  const f = slider(ctrls, { label: 'A 0,02 mm-nél finomabb rész', sym: '', min: 0, max: 40, step: 0.5, value: 8, unit: '%', d: 1 });
  const fig = figure(viz, 640, 210);
  const sC = stat(out, { label: 'Fagyveszélyességi osztály' });
  const vd = verdict(out);
  const cls = () => {
    const p = f.v;
    switch (g.v) {
      case 'kav': return p <= 1.5 ? 'NFS' : p < 6 ? 'PFS' : p <= 10 ? 'F1' : p <= 20 ? 'F2' : 'F3';
      case 'hom': return p <= 3 ? 'NFS' : p < 6 ? 'PFS' : p <= 15 ? 'F2' : 'F3';
      case 'fhom': return p > 15 ? 'F4' : p <= 3 ? 'NFS' : p < 6 ? 'PFS' : 'F2';
      case 'isz': return 'F4'; case 'agyN': return 'F3'; case 'agyK': return 'F4'; case 'var': return 'F4';
    }
    return 'NFS';
  };
  const draw = () => {
    clear(fig); const c = cls();
    const order = ['NFS', 'PFS', 'F1', 'F2', 'F3', 'F4'];
    order.forEach((k, i) => {
      const x = 14 + i * 103, on = k === c;
      svg('rect', { x, y: 40, width: 96, height: 110, rx: 10, fill: on ? `color-mix(in srgb, var(--c5) ${18 + i * 12}%, var(--surface))` : 'var(--surface2)', stroke: on ? 'var(--c5)' : 'var(--line)', 'stroke-width': on ? 3 : 1 }, fig);
      svg('text', { x: x + 48, y: 82, 'text-anchor': 'middle', class: 't-b', text: k, style: 'font-size:22px' }, fig);
      // jégkristály-ikonok
      for (let j = 0; j < i; j++) svg('path', { d: `M${x + 18 + j * 14} 112 l0 14 M${x + 12 + j * 14} 115 l12 8 M${x + 12 + j * 14} 123 l12 -8`, stroke: 'var(--c5)', 'stroke-width': 1.6 }, fig);
    });
    svg('text', { x: 14, y: 24, class: 't-s', text: 'kevésbé veszélyes →  → → → →  legveszélyesebb' }, fig);
    svg('text', { x: 14, y: 182, class: 't-s', text: 'NFS: nem fagyérzékeny · F1–F4: egyre erősebben fagyérzékeny' }, fig);
    sC.set(c, FCLS[c][1], `${c} <small>${FCLS[c][0]}</small>`);
    vd.set(FCLS[c][1], FCLS[c][0], c === 'F4' ? 'Az iszapok, a nagyon finom iszapos homokok, a kis plaszticitású és a réteges agyagok a legveszélyesebbek: finomak a kapilláris emeléshez, de elég áteresztők a gyors vízutánpótláshoz.' : c === 'NFS' ? 'Kevés finom szemcse: nincs kapilláris vízemelés, nem képződik jéglencse – fagyvédő réteg anyagának alkalmas.' : 'A finomrész-tartalom növekedésével gyorsan nő a fagyveszély.');
  };
  [g, f].forEach((x) => x.on(draw)); draw(); onTheme(draw);
});

/* ---------------------------------------------------------------- 3. fagybehatolás-számító */
register('frost-depth', (root) => {
  const { ctrls, viz, out } = shell(root);
  const F = slider(ctrls, { label: 'Fagyindex', sym: 'F', min: 50, max: 700, step: 10, value: 250, unit: '°C·nap' });
  const soil = seg(ctrls, { label: 'Talaj', vert: true, options: Object.entries(SOIL).map(([k, s]) => ({ v: k, t: s.n })), value: 'iszap' });
  const gwDeep = toggle(ctrls, { label: 'a talajvíz 2 m-nél mélyebben van', value: false });
  const hi = toggle(ctrls, { label: 'a terepszint 300 mBf felett van', value: false });
  const df = slider(ctrls, { label: 'Az alapsík mélysége', sym: 'D', min: 0.3, max: 1.5, step: 0.05, value: 0.6, unit: 'm', d: 2 });
  const fig = figure(viz, 640, 330);
  const sS = stat(out, { label: 'Stefan-mélység' }), sB = stat(out, { label: 'Módosított Berggren (λ = 0,75)' }), sR = stat(out, { label: 'Előírt fagyhatár' });
  const vd = verdict(out);
  const rule = () => { const coarse = soil.v === 'kavics' || soil.v === 'homok'; if (hi.v) return coarse ? 0.8 : 1.0; return coarse && gwDeep.v ? 0.5 : 0.8; };
  const draw = () => {
    clear(fig);
    const s = SOIL[soil.v]; const zS = stefan(s, F.v), zB = 0.75 * zS, zr = rule();
    const sc = 140, top = 50, x0 = 60;
    svg('rect', { x: x0, y: top, width: 520, height: 260, fill: `var(${s.col})` }, fig);
    svg('rect', { x: x0, y: 0, width: 520, height: top, fill: 'var(--sky)' }, fig);
    svg('rect', { x: x0, y: top, width: 520, height: Math.min(260, zB * sc), fill: 'var(--frost)', opacity: 0.55 }, fig);
    svg('line', { x1: x0, y1: top + zS * sc, x2: x0 + 520, y2: top + zS * sc, stroke: 'var(--c5)', 'stroke-dasharray': '6 4', 'stroke-width': 1.6 }, fig);
    svg('text', { x: x0 + 516, y: top + zS * sc - 6, 'text-anchor': 'end', class: 't-s halo', text: `Stefan: ${fmt(zS, 2)} m` }, fig);
    svg('line', { x1: x0, y1: top + zB * sc, x2: x0 + 520, y2: top + zB * sc, stroke: 'var(--c5)', 'stroke-width': 2.6 }, fig);
    svg('text', { x: x0 + 516, y: top + zB * sc + 16, 'text-anchor': 'end', class: 't-s t-b halo', text: `fagyfront ≈ ${fmt(zB, 2)} m` }, fig);
    svg('line', { x1: x0, y1: top + zr * sc, x2: x0 + 520, y2: top + zr * sc, stroke: 'var(--bad)', 'stroke-width': 2, 'stroke-dasharray': '2 4' }, fig);
    svg('text', { x: x0 + 6, y: top + zr * sc - 6, class: 't-s t-b halo', text: `előírt fagyhatár ${fmt(zr, 1)} m`, style: 'fill:var(--bad)' }, fig);
    // alaptest + fal
    const fx = 300; svg('rect', { x: fx - 40, y: top + df.v * sc - 34, width: 80, height: 34, class: 'f-conc', stroke: 'var(--ink2)' }, fig);
    svg('rect', { x: fx - 18, y: 0, width: 36, height: top + df.v * sc - 34, fill: 'var(--brick)', stroke: 'var(--ink2)' }, fig);
    svg('line', { x1: x0 - 10, y1: top, x2: x0 - 10, y2: top + df.v * sc, stroke: 'var(--ink2)' }, fig);
    svg('text', { x: x0 - 14, y: top + df.v * sc / 2 + 4, 'text-anchor': 'end', class: 't-num t-s', text: `D = ${fmt(df.v, 2)}` }, fig);
    for (const d of [0.5, 1, 1.5]) svg('text', { x: x0 + 524, y: top + d * sc + 4, class: 't-num t-s', text: `${fmt(d, 1)} m` }, fig);
    sS.set(`${fmt(zS, 2)} m`, null, `${fmt(zS, 2)}<small>m</small>`); sB.set(`${fmt(zB, 2)} m`, null, `${fmt(zB, 2)}<small>m</small>`); sR.set(`${fmt(zr, 1)} m`, null, `${fmt(zr, 1)}<small>m</small>`);
    const ok = df.v >= zr;
    vd.set(ok ? 'ok' : 'bad', ok ? 'Az alapsík a fagyhatár alatt van' : 'Az alapsík a fagyhatár fölött van', ok ? (zB > df.v ? 'A számított fagyfront ennél a télnél mélyebbre ér – kemény télen, nedves, fagyérzékeny talajban a hazai érték is kevés lehet.' : 'Az előírásnak megfelel, és a számított fagyfront sem éri el.') : 'Az alaptestet mélyebbre kell vinni, vagy a talajt fagyvédő (nem fagyérzékeny) anyagra kell cserélni, illetve hőszigeteléssel kell védeni.');
  };
  [F, soil, gwDeep, hi, df].forEach((x) => x.on(draw)); draw(); onTheme(draw);
  root.append(h('div', { class: 'w-foot', html: 'Stefan-képlet: z = √(2·k·F/L), ahol F a fagyindex (°C·s), k a fagyott talaj hővezető képessége, L = 334 kJ/kg · w · ρ<sub>d</sub> a megfagyó víz rejtett hője. A Stefan-képlet csak a rejtett hőt veszi figyelembe, ezért túlbecsül; a módosított Berggren-képlet egy λ ≈ 0,75 körüli tényezővel csökkenti.' }));
});

/* ---------------------------------------------------------------- 4. fagyveszély egy családi háznál */
register('frost-house', (root) => {
  const { ctrls, viz, out } = shell(root);
  const win = toggle(ctrls, { label: 'a pince ablaka nyitva maradt', value: true });
  const snow = toggle(ctrls, { label: 'hó halmozódik a fal mellett (olvad, visszafagy)', value: true });
  const unh = toggle(ctrls, { label: 'fűtetlen épület (téli építés)', value: false });
  const D = slider(ctrls, { label: 'A jobb oldali külső fal alapjának mélysége', sym: 'D', min: 0.4, max: 1.2, step: 0.05, value: 0.5, unit: 'm', d: 2 });
  const fig = figure(viz, 720, 360);
  const vd = verdict(out);
  const draw = () => {
    clear(fig);
    const y0 = 150, sc = 100, xL = 120, xM = 380, xR = 620, fz = 0.8 + (snow.v ? 0.15 : 0); // a fagyfront mélysége kint
    // ég, talaj
    svg('rect', { x: 0, y: 0, width: 720, height: y0, fill: 'var(--sky)' }, fig);
    svg('rect', { x: 0, y: y0, width: 720, height: 210, fill: 'var(--soilC)' }, fig);
    // fagyott zónák
    const fr = [];
    fr.push(`M0 ${y0} H${xL} V${y0 + fz * sc} H0 Z`);
    fr.push(`M${xR} ${y0} H720 V${y0 + fz * sc} H${xR} Z`);
    svg('path', { d: fr.join(' '), fill: 'var(--frost)', opacity: 0.75 }, fig);
    // pince (bal oldal): padló 2,0 m mélyen
    const pf = y0 + 2.0 * sc;
    svg('rect', { x: xL, y: y0 - 5, width: xM - xL, height: pf - y0 + 5, fill: 'var(--surface2)' }, fig);
    if (win.v || unh.v) svg('rect', { x: xL + 12, y: pf, width: xM - xL - 24, height: 0.55 * sc, fill: 'var(--frost)', opacity: 0.85 }, fig);
    // földszint (jobb oldal) – padló a terepen
    if (unh.v) svg('rect', { x: xM, y: y0, width: xR - xM, height: 0.7 * sc, fill: 'var(--frost)', opacity: 0.75 }, fig);
    else svg('path', { d: `M${xR} ${y0} L${xR - 40} ${y0} L${xR} ${y0 + 0.8 * sc} Z`, fill: 'var(--frost)', opacity: 0.6 }, fig);
    // fal alapok
    const heaveR = D.v < fz && !(!unh.v && false); const dfR = heaveR ? 10 : 0;
    const pH = (win.v || unh.v) ? 10 : 0;
    svg('rect', { x: xL - 20, y: pf - 10, width: 40, height: 30, class: 'f-conc', stroke: 'var(--ink2)' }, fig); // pincefal alapja (mély)
    svg('rect', { x: xM - 16, y: pf - 10, width: 32, height: 30, class: 'f-conc', stroke: 'var(--ink2)' }, fig);
    svg('rect', { x: xR - 18, y: y0 + D.v * sc - 26 - dfR, width: 36, height: 26, class: 'f-conc', stroke: 'var(--ink2)' }, fig);
    // falak
    svg('rect', { x: xL - 12, y: 30, width: 24, height: pf - 40, fill: 'var(--brick)', stroke: 'var(--ink2)' }, fig);
    svg('rect', { x: xM - 10, y: 30 - dfR * 0.4, width: 20, height: pf - 40, fill: 'var(--brick)', stroke: 'var(--ink2)', opacity: 0.9 }, fig);
    svg('rect', { x: xR - 12, y: 30 - dfR, width: 24, height: y0 + D.v * sc - 26 - 30, fill: 'var(--brick)', stroke: 'var(--ink2)' }, fig);
    svg('line', { x1: xL, y1: 30, x2: xR, y2: 30 - dfR, stroke: 'var(--ink2)', 'stroke-width': 8 }, fig);
    // pincepadló
    svg('path', { d: `M${xL + 12} ${pf} Q${(xL + xM) / 2} ${pf - pH * 2.2} ${xM - 16} ${pf}`, fill: 'none', stroke: 'var(--concrete2)', 'stroke-width': 8 }, fig);
    // földszinti padló
    svg('line', { x1: xM + 10, y1: y0 - 4 - (unh.v ? 8 : 0), x2: xR - 12, y2: y0 - 4 - dfR - (unh.v ? 8 : 0), stroke: 'var(--concrete2)', 'stroke-width': 8 }, fig);
    // pinceablak
    svg('rect', { x: xL - 14, y: y0 - 38, width: 28, height: 26, fill: win.v ? 'var(--sky)' : 'var(--ink2)', stroke: 'var(--ink)' }, fig);
    if (win.v) svg('path', { d: `M${xL - 60} ${y0 - 60} q30 6 54 30`, fill: 'none', stroke: 'var(--c5)', 'stroke-width': 3 }, fig);
    if (win.v) svg('text', { x: xL - 112, y: y0 - 66, class: 't-s t-b', text: 'hideg levegő', style: 'fill:var(--c5)' }, fig);
    // hó
    if (snow.v) svg('path', { d: `M${xR + 12} ${y0} q40 -26 90 -10 q30 8 70 10 Z`, fill: '#ffffff', stroke: 'var(--line2)' }, fig);
    // emelő nyilak, repedés
    if (dfR) { for (const dx of [-8, 8]) svg('path', { d: `M${xR + dx} ${y0 + D.v * sc + 22} v-16 m-5 6 l5 -6 l5 6`, fill: 'none', stroke: 'var(--c5)', 'stroke-width': 2.4 }, fig); svg('text', { x: xR + 22, y: y0 + D.v * sc + 18, class: 't-b halo', text: 'F', style: 'fill:var(--c5)' }, fig); svg('path', { d: `M${xR - 70} 60 l8 14 l-6 10 l10 16 l-4 12`, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.8 }, fig); svg('text', { x: xR - 30, y: 22, class: 't-num t-b halo', text: '↑ Δf' }, fig); }
    if (pH) { for (const dx of [-30, 0, 30]) svg('path', { d: `M${(xL + xM) / 2 + dx} ${pf + 40} v-16 m-5 6 l5 -6 l5 6`, fill: 'none', stroke: 'var(--c5)', 'stroke-width': 2.4 }, fig); svg('path', { d: `M${(xL + xM) / 2 - 50} ${pf - 30} l10 -14 l-6 -12 l12 -16`, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.8 }, fig); }
    // feliratok
    svg('line', { x1: 700, y1: y0, x2: 700, y2: y0 + fz * sc, stroke: 'var(--c5)', 'stroke-width': 2 }, fig);
    svg('text', { x: 696, y: y0 + fz * sc + 16, 'text-anchor': 'end', class: 't-num t-s halo', text: `fagyhatár ≈ ${fmt(fz, 2)} m` }, fig);
    svg('text', { x: (xL + xM) / 2, y: y0 + 60, 'text-anchor': 'middle', class: 't-s', text: 'pince' }, fig);
    svg('text', { x: (xM + xR) / 2, y: y0 - 30, 'text-anchor': 'middle', class: 't-s', text: unh.v ? 'fűtetlen' : 'fűtött' }, fig);
    const bad = dfR || pH;
    vd.set(bad ? 'bad' : 'ok', bad ? 'Fagyemelés és repedések' : 'Nincs fagykár', [dfR ? 'A jobb oldali alap a fagyhatár fölött van: a fagy alá hatol és megemeli a falat.' : '', pH ? (unh.v ? 'A fűtetlen épület alatt is átfagy a talaj, a padlók megemelkednek.' : 'A nyitott pinceablakon beáramló hideg a pincepadló alatt is átfagyasztja a talajt.') : '', snow.v && !dfR ? 'Az olvadó-visszafagyó hó nedvesen tartja a talajt – a fagyhatár alatti alapot ez nem veszélyezteti.' : ''].filter(Boolean).join(' ') || 'A külső falak alapja a fagyhatár alatt, a pince zárva, az épület fűtött.');
  };
  [win, snow, unh, D].forEach((x) => x.on(draw)); draw(); onTheme(draw);
});

/* ---------------------------------------------------------------- 5. hűtőház-szimulátor (2D hővezetés, entalpia-módszer) */
register('frost-cold', (root) => {
  const { ctrls, viz, out } = shell(root);
  const Tr = slider(ctrls, { label: 'Hűtőtér hőmérséklete', sym: 'T<sub>h</sub>', min: -30, max: -2, step: 1, value: -25, unit: '°C' });
  const B = slider(ctrls, { label: 'Az épület szélessége', sym: 'B', min: 10, max: 60, step: 2, value: 30, unit: 'm' });
  const ins = slider(ctrls, { label: 'Hőszigetelés (XPS) vastagsága', sym: 't', min: 0, max: 20, step: 1, value: 2, unit: 'cm' });
  const heat = toggle(ctrls, { label: 'padlófűtés a szigetelés alatt (+4 °C)', value: false });
  const soil = seg(ctrls, { label: 'Talaj', options: [{ v: 'iszap', t: 'iszap' }, { v: 'agyag', t: 'agyag' }, { v: 'homok', t: 'homok' }], value: 'iszap' });
  const go = h('button', { class: 'btn', type: 'button' }, '▶ 30 év futtatása'); ctrls.append(go);
  const cv = h('canvas', { style: 'width:100%;display:block;border-radius:10px;border:1px solid var(--line)' });
  viz.append(cv);
  const fig = figure(viz, 720, 200);
  const sY = stat(out, { label: 'Eltelt idő' }), sZ = stat(out, { label: 'A 0 °C-os vonal a padló közepe alatt' }), sH = stat(out, { label: 'Padlóemelkedés (becslés)' });
  const vd = verdict(out);
  const NX = 80, NZ = 60, dx = 0.5, dt = 43200; // fél szélesség 40 m, mélység 30 m; fél nap
  let Hh, Tt, year = 0, hist = [], run = false;
  const par = () => { const s = SOIL[soil.v]; return { k: s.k, C: 2.3e6, L: Lh(s) * 0.9, sus: s.near }; };
  const T0 = (z) => 11 + 0.05 * z;
  const init = () => { const p = par(); Hh = new Float64Array(NX * NZ); Tt = new Float64Array(NX * NZ); for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const T = T0((j + 0.5) * dx); Tt[j * NX + i] = T; Hh[j * NX + i] = p.C * T + p.L; } year = 0; hist = [[0, 0]]; };
  const Tof = (H, p) => (H < 0 ? H / p.C : H <= p.L ? 0 : (H - p.L) / p.C);
  const stepN = (n) => {
    const p = par(); const k = p.k, half = B.v / 2; const Rin = 0.1 + (ins.v / 100) / 0.035, rs = dx / (2 * k);
    const nb = Math.round(half / dx);
    for (let s = 0; s < n; s++) {
      const nH = Hh.slice();
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
        const id = j * NX + i, T = Tt[id]; let q = 0;
        // vízszintes szomszédok (x = 0 szimmetria, x = 40 m adiabatikus)
        if (i > 0) q += k * (Tt[id - 1] - T); if (i < NX - 1) q += k * (Tt[id + 1] - T);
        if (j < NZ - 1) q += k * (Tt[id + NX] - T); else q += k * (T0(30) - T) * 2;
        if (j > 0) q += k * (Tt[id - NX] - T);
        else { // felszín
          let qs;
          if (i < nb) qs = heat.v ? (4 - T) / (rs + 0.05) : (Tr.v - T) / (rs + Rin);
          else qs = (11 - T) / (rs + 0.04);
          q += qs * dx;
        }
        nH[id] = Hh[id] + (q / (dx * dx)) * dt;
      }
      Hh = nH; for (let m = 0; m < Hh.length; m++) Tt[m] = Tof(Hh[m], p);
    }
    year += (n * dt) / (365 * 86400);
  };
  const frostDepth = () => { let z = 0; for (let j = 0; j < NZ; j++) { if (Tt[j * NX] < 0) z = (j + 1) * dx; else break; } return z; };
  // a fagyemelés becslése: a fagyott réteg vastagsága, a mélységgel (a takarás növekedésével) csökkenő emelési hajlammal
  const heaveEst = () => { const p = par(); let hv = 0; for (let j = 0; j < NZ; j++) if (Tt[j * NX] < 0) hv += dx * Math.exp(-((j + 0.5) * dx) / 3); return hv * p.sus * 0.6; };
  init();
  let st = null; st = fitCanvas(cv, 0.44, () => { if (st) draw(); });
  function color(T) { // fagyott: kék árnyalatok, fagyatlan: meleg árnyalatok
    if (T < 0) { const a = clamp(-T / 25, 0, 1); return `rgb(${Math.round(lerp(170, 40, a))},${Math.round(lerp(210, 90, a))},${Math.round(lerp(245, 200, a))})`; }
    const a = clamp(T / 13, 0, 1); return `rgb(${Math.round(lerp(236, 196, a))},${Math.round(lerp(226, 150, a))},${Math.round(lerp(196, 92, a))})`;
  }
  function draw() {
    const { ctx: g, w, h: H } = st; if (!w) return; g.clearRect(0, 0, w, H);
    const top = H * 0.16, cw = w / (2 * NX), ch = (H - top) / NZ;
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { g.fillStyle = color(Tt[j * NX + i]); g.fillRect(w / 2 + i * cw, top + j * ch, cw + 0.6, ch + 0.6); g.fillRect(w / 2 - (i + 1) * cw, top + j * ch, cw + 0.6, ch + 0.6); }
    // 0 °C-os vonal
    g.strokeStyle = cssVar('--c5'); g.lineWidth = 2.4; g.beginPath(); let started = false;
    for (let i = NX - 1; i >= -NX; i--) { const ii = i < 0 ? -i - 1 : i; let z = 0; for (let j = 0; j < NZ; j++) { if (Tt[j * NX + ii] < 0) z = j + 1; else break; } const x = w / 2 + (i + 0.5) * cw * (i < 0 ? 1 : 1); const y = top + z * ch; if (z > 0) { started ? g.lineTo(x, y) : g.moveTo(x, y); started = true; } }
    if (started) g.stroke();
    // épület
    const half = B.v / 2, bw = (half / 40) * (w / 2);
    g.fillStyle = cssVar('--building'); g.strokeStyle = cssVar('--ink2'); g.lineWidth = 1.5; g.fillRect(w / 2 - bw, top * 0.18, 2 * bw, top * 0.82); g.strokeRect(w / 2 - bw, top * 0.18, 2 * bw, top * 0.82);
    g.fillStyle = heat.v ? cssVar('--c2') : ins.v > 0 ? cssVar('--soilD') : cssVar('--concrete'); g.fillRect(w / 2 - bw, top - 4, 2 * bw, 4);
    g.fillStyle = cssVar('--c5'); g.font = '700 12px "DM Mono", monospace'; g.textAlign = 'center'; g.fillText(`${Tr.v} °C`, w / 2, top * 0.62); g.textAlign = 'left';
    g.fillStyle = cssVar('--ink'); g.font = '600 12px Manrope, sans-serif'; g.fillText(`${fmt(year, 1)} év`, 8, 16);
    g.fillStyle = cssVar('--muted'); g.font = '11px "DM Mono", monospace'; for (const d of [10, 20, 30]) g.fillText(`${d} m`, 6, top + (d / 30) * (H - top) - 3);
  }
  const drawChart = () => {
    clear(fig);
    const c = chart(fig, { w: 720, h: 200, m: { l: 50, r: 14, t: 10, b: 36 }, x: [0, 30], y: [16, 0], xt: [0, 5, 10, 15, 20, 25, 30], yt: [0, 4, 8, 12, 16], xl: 'idő, év', yl: 'fagymélység, m' });
    svg('rect', { x: c.L, y: c.Y(6), width: c.R - c.L, height: c.Y(12) - c.Y(6), fill: 'color-mix(in srgb, var(--c5) 12%, transparent)' }, fig);
    svg('text', { x: c.R - 6, y: c.Y(6) + 14, 'text-anchor': 'end', class: 't-s', text: '6–12 m' }, fig);
    if (hist.length > 1) svg('path', { d: pd(hist.map(([t, z]) => [c.X(t), c.Y(Math.min(z, 16))])), fill: 'none', stroke: 'var(--c5)', 'stroke-width': 2.6 }, fig);
    const z = frostDepth(), hv = heaveEst();
    sY.set(`${fmt(year, 1)} év`, null, `${fmt(year, 1)}<small>év</small>`);
    sZ.set(`${fmt(z, 1)} m`, z > 4 ? 'bad' : z > 0.5 ? 'warn' : 'ok', `${fmt(z, 1)}<small>m</small>`);
    sH.set(`${fmt(hv * 100, 0)} cm`, hv > 0.05 ? 'bad' : hv > 0.01 ? 'warn' : 'ok', `${fmt(hv * 100, 0)}<small>cm</small>`);
    vd.set(z > 4 ? 'bad' : z > 0.5 ? 'warn' : 'ok', heat.v ? 'A padlófűtés fagypont fölött tartja a talajt' : z > 4 ? 'A fagy évről évre mélyebbre hatol' : z > 0.5 ? 'Lassan, de halad lefelé a fagy' : 'Egyelőre nincs fagy a padló alatt', heat.v ? 'A szigetelés alatti fűtés a padló alatti talajt néhány fokkal fagypont fölött tartja; a szigetelés a fűtési igényt csökkenti.' : ins.v >= 10 ? 'A vastag szigetelés lassítja, de önmagában nem állítja meg a fagy behatolását: évtizedek alatt a jól szigetelt hűtőház alatt is lehűl a talaj. Ezért kell padlófűtés is.' : 'Gyenge szigetelésnél a nullizoterma gyorsan lefelé halad, a fagyérzékeny rétegben jéglencsék nőnek – a padló és az épület megemelkedik.');
  };
  const reset = () => { init(); run = false; draw(); drawChart(); };
  [Tr, B, ins, heat, soil].forEach((x) => x.on(reset));
  go.addEventListener('click', () => { init(); run = true; });
  let acc = 0;
  loop(cv, (t, dt) => { if (!run) return; stepN(40); hist.push([year, frostDepth()]); acc += dt; draw(); if (acc > 0.25) { drawChart(); acc = 0; } if (year >= 30) { run = false; drawChart(); } });
  reset(); onTheme(() => { draw(); drawChart(); });
  root.append(h('div', { class: 'w-foot', html: 'Fél keresztmetszet (a ház közepétől 40 m-ig, 30 m mélyig), 0,5 m-es rácsosztás, a megfagyó víz rejtett hőjével; kint 11 °C-os évi középhőmérséklet, a mélyben a Föld belseje felől érkező hő. A padlóemelkedés becslése szemléltető (a fagyott fagyérzékeny réteg vastagságából).' }));
});

/* ---------------------------------------------------------------- kvíz */
defineQuiz('frost', 'Kvíz – fagyhatás', [
  { q: 'Mi okozza a nagy fagyemelést?', a: ['A jéglencsék: a fagyfront alá áramló víz rétegesen ráfagy', 'A talajszemcsék hőtágulása', 'A levegő megfagyása a pórusokban', 'A hó súlya'], c: 0, e: 'A tömbfagyás csak kb. 9 %-os vízduzzadást ad; a nagy emelést a kapilláris vízutánpótlásból növő jéglencsék okozzák.' },
  { q: 'Melyik a fagyemelés három feltétele?', a: ['Fagyérzékeny talaj, a talajba hatoló fagy és vízutánpótlás', 'Homok, napsütés és szél', 'Kavics, száraz talaj és hó', 'Csak a nagy hideg'], c: 0, e: 'Ha bármelyik hiányzik – például kavics, vagy mélyen fekvő talajvíz –, jelentős fagyemelés nem alakul ki.' },
  { q: 'Melyik talaj a legfagyérzékenyebb?', a: ['Iszap, nagyon finom iszapos homok', 'Tiszta homokos kavics', 'Durva kavics', 'Szikla'], c: 0, e: 'Az iszapok (F4) elég finomak a kapilláris vízemeléshez, és elég áteresztők a gyors vízutánpótláshoz.' },
  { q: 'Mekkora a hazai fagyhatár általában?', a: ['0,8 m', '0,2 m', '2,0 m', '5 m'], c: 0, e: 'A hazai gyakorlatban 0,8 m; homok és kavics esetén, ha a talajvíz 2 m-nél mélyebben van, 0,5 m; 300 mBf felett 0,8/1,0 m.' },
  { q: 'Miért veszélyes télen nyitva hagyni a pinceablakot?', a: ['A pince lehűl, a pincepadló alatt átfagy a talaj, és a padló megemelkedik', 'Mert beesik a hó', 'Mert nő a páratartalom', 'Nem veszélyes'], c: 0, e: 'A pincepadló alatti talaj normálisan fagymentes; a hideg levegő azonban alatta is átfagyaszthatja.' },
  { q: 'Mi történik egy hűtőház alatt rossz szigetelés esetén?', a: ['A nullizoterma évről évre mélyebbre hatol, akár 6–12 m-ig, a padló és az épület megemelkedik', 'A talaj kiszárad és összezsugorodik', 'Semmi, a talaj elnyeli a hideget', 'A talajvíz felmelegszik'], c: 0, e: 'A fagy addig halad lefelé, amíg a talaj hőveszteségét a Föld belseje felől áramló hő nem pótolja.' },
  { q: 'Mi véd a hűtőház alatti fagy ellen?', a: ['Hőszigetelő réteg és a szigetelés alatti padlófűtés', 'Vastagabb vasbeton padló önmagában', 'A talaj tömörítése', 'Vízzáró szigetelés'], c: 0, e: 'A szigetelés lassítja a hőveszteséget, a padlófűtés pedig fagypont fölött tartja a talajt – a kettő együtt a biztos megoldás.' },
]);
