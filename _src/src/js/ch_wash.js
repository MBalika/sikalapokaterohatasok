// CH4 – A talajvíz kimosó hatása: apadás a rakparton, buzgárlabor, szűrőpróba, kimélyülés-becslő, zsompos víztelenítés, kvíz
import { register, shell, slider, seg, toggle, stat, verdict, h, svg, figure, clear, fmt, clamp, lerp, smooth, loop, fitCanvas, cssVar, onTheme, $, $$ } from './core.js';
import { chart, pd, samp } from './plot.js';
import { defineQuiz } from './ui.js';

/* ---------------------------------------------------------------- 1. apadás a rakparton */
const BANK = [
  { k: 'kavics', n: 'homokos kavics', K: 2e-3, i0: 0.6, fines: 0.3, col: '--soilD' },
  { k: 'durva', n: 'közepes-durva homok', K: 5e-4, i0: 0.35, fines: 0.6, col: '--soilA' },
  { k: 'finom', n: 'egyenletes finom homok', K: 1e-4, i0: 0.18, fines: 1.0, col: '--soilA' },
];
register('wash-drawdown', (root) => {
  const { ctrls, viz, out } = shell(root);
  const days = slider(ctrls, { label: 'Az apadás időtartama', sym: 'T', min: 1, max: 20, step: 1, value: 3, unit: 'nap' });
  const drop = slider(ctrls, { label: 'A vízszint csökkenése', sym: 'Δh', min: 1, max: 6, step: 0.5, value: 4, unit: 'm', d: 1 });
  const soil = seg(ctrls, { label: 'A part talaja', vert: true, options: BANK.map((b) => ({ v: b.k, t: b.n })), value: 'finom' });
  const play = h('button', { class: 'btn', type: 'button' }, '▶ Árhullám levonulása'); ctrls.append(play);
  const cv = h('canvas', { style: 'width:100%;display:block;border-radius:10px;border:1px solid var(--line)' });
  viz.append(cv);
  const sI = stat(out, { label: 'Kilépési gradiens a parton' }), sT = stat(out, { label: 'Eltelt idő' }), sV = stat(out, { label: 'Kimosott anyag az alap alól' });
  const vd = verdict(out);
  // 1D talajvíz-modell (Boussinesq, linearizált): h_t = D h_xx, x = 0 (hátország, nincs áramlás) … L (folyópart, h = folyó)
  const L = 60, N = 61, dx = L / (N - 1);
  let hgw, t = 0, run = false, washed = 0, parts = [];
  const H0 = 0, hR = (tt) => -drop.v * smooth(Math.min(1, tt / days.v));
  const reset = () => { hgw = new Float64Array(N).fill(H0); t = 0; washed = 0; parts = []; };
  const step = (dtDays) => {
    const B = BANK.find((b) => b.k === soil.v);
    const D = (B.K * 8 / 0.2) * 86400; // m²/nap (vastagság 8 m, fajlagos hozam 0,2)
    let sub = Math.ceil(dtDays * D / (0.4 * dx * dx)); sub = Math.max(1, Math.min(sub, 4000));
    const dd = dtDays / sub;
    for (let s = 0; s < sub; s++) {
      t += dd; const nh = hgw.slice();
      for (let j = 1; j < N - 1; j++) nh[j] = hgw[j] + D * dd / (dx * dx) * (hgw[j + 1] - 2 * hgw[j] + hgw[j - 1]);
      nh[0] = nh[1]; nh[N - 1] = hR(t); hgw = nh;
    }
    const ie = (hgw[N - 2] - hgw[N - 1]) / dx;
    const ex = Math.max(0, ie - B.i0) * B.fines;
    washed += ex * dtDays * 0.35; // szemléltető anyagmérleg, m³/fm
    return ie;
  };
  reset();
  let st = null; st = fitCanvas(cv, 0.5, () => { if (st) draw(); });
  function draw() {
    const { ctx: g, w, h: H } = st; if (!w) return; g.clearRect(0, 0, w, H);
    const B = BANK.find((b) => b.k === soil.v);
    const X = (x) => 12 + (x / (L + 12)) * (w - 24), Y = (y) => H * 0.3 - y * (H * 0.075);
    const bankX = L; // a part éle
    // ég, talaj
    g.fillStyle = cssVar('--sky'); g.fillRect(0, 0, w, H);
    g.fillStyle = cssVar(B.col);
    g.beginPath(); g.moveTo(X(0), Y(1)); g.lineTo(X(bankX - 4), Y(1)); g.lineTo(X(bankX + 2), Y(-7)); g.lineTo(X(L + 12), Y(-8)); g.lineTo(X(L + 12), H); g.lineTo(X(0), H); g.closePath(); g.fill();
    // telített zóna
    g.fillStyle = cssVar('--water-fill'); g.beginPath(); g.moveTo(X(0), Y(hgw[0]));
    for (let j = 0; j < N; j++) g.lineTo(X(j * dx), Y(hgw[j]));
    const hr = hR(t); g.lineTo(X(L + 12), Y(hr)); g.lineTo(X(L + 12), H); g.lineTo(X(0), H); g.closePath(); g.fill();
    // folyó
    g.fillStyle = cssVar('--water'); g.globalAlpha = 0.55; g.beginPath(); const xr = bankX - 4 + (1 - hr) / 8 * 6;
    g.moveTo(X(Math.min(bankX + 2, bankX - 4 + (1 - hr) * 0.75)), Y(hr)); g.lineTo(X(L + 12), Y(hr)); g.lineTo(X(L + 12), Y(-8)); g.lineTo(X(bankX + 2), Y(-7)); g.closePath(); g.fill(); g.globalAlpha = 1;
    // talajvízszint
    g.strokeStyle = cssVar('--water'); g.lineWidth = 2; g.setLineDash([6, 4]); g.beginPath(); for (let j = 0; j < N; j++) { const x = X(j * dx), y = Y(hgw[j]); j ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.setLineDash([]);
    // épület (régi rakparti épület) – az alap a part éléhez közel
    const bx0 = X(bankX - 22), bx1 = X(bankX - 8), cavR = clamp(washed * 2.2, 0, 1);
    const sink = cavR * H * 0.04;
    g.fillStyle = cssVar('--building'); g.strokeStyle = cssVar('--ink2'); g.lineWidth = 1.2;
    g.save(); g.translate(bx1, Y(1)); g.rotate(sink / (bx1 - bx0) * 0.9); g.translate(-bx1, -Y(1));
    g.fillRect(bx0, Y(1) - H * 0.22, bx1 - bx0, H * 0.22); g.strokeRect(bx0, Y(1) - H * 0.22, bx1 - bx0, H * 0.22);
    g.fillStyle = cssVar('--surface2'); for (let k = 0; k < 4; k++) g.fillRect(bx0 + (k + 0.3) * (bx1 - bx0) / 4, Y(1) - H * 0.17, (bx1 - bx0) / 7, H * 0.06);
    g.fillStyle = cssVar('--concrete'); g.fillRect(bx0, Y(1), 8, Y(-1.4) - Y(1)); g.fillRect(bx1 - 8, Y(1), 8, Y(-1.4) - Y(1));
    g.fillRect(bx0 - 5, Y(-1.4), 18, Y(-2) - Y(-1.4)); g.fillRect(bx1 - 13, Y(-1.4), 18, Y(-2) - Y(-1.4));
    g.restore();
    // üreg az alap jobb sarka alatt
    if (cavR > 0.01) { g.fillStyle = '#1a1612'; g.beginPath(); g.ellipse(bx1 - 6, Y(-2.6), 6 + 26 * cavR, 3 + 9 * cavR, 0, 0, Math.PI * 2); g.fill(); }
    // szemcsék
    g.fillStyle = cssVar('--c4');
    for (const p of parts) { g.beginPath(); g.arc(X(p.x), Y(p.y), 2.2, 0, 7); g.fill(); }
    // áramlási nyilak
    const ie = (hgw[N - 2] - hgw[N - 1]) / dx;
    if (ie > 0.02) { g.strokeStyle = cssVar('--water'); g.lineWidth = 2; for (const xx of [bankX - 30, bankX - 18, bankX - 8]) { const j = Math.round(xx / dx); const y = Y((hgw[j] - 3) / 1); g.beginPath(); g.moveTo(X(xx), y); g.lineTo(X(xx + 6), y + 2); g.stroke(); g.beginPath(); g.moveTo(X(xx + 6), y + 2); g.lineTo(X(xx + 4.5), y - 3); g.lineTo(X(xx + 4.2), y + 6); g.closePath(); g.fillStyle = cssVar('--water'); g.fill(); } }
    g.fillStyle = cssVar('--ink2'); g.font = '600 12px Manrope, sans-serif'; g.fillText('talajvízszint', X(4), Y(hgw[2]) - 6); g.fillText('folyó', X(L + 4), Y(hR(t)) - 6);
    sI.set(fmt(Math.max(0, ie), 2), ie > B.i0 ? 'bad' : ie > B.i0 * 0.6 ? 'warn' : 'ok');
    sT.set(`${fmt(t, 1)} nap`, null, `${fmt(t, 1)}<small>nap</small>`);
    sV.set(`${fmt(washed, 2)} m³/fm`, washed > 0.2 ? 'bad' : washed > 0.02 ? 'warn' : 'ok', `${fmt(washed, 2)}<small>m³/fm</small>`);
    vd.set(ie > B.i0 ? 'bad' : ie > 0.6 * B.i0 ? 'warn' : 'ok', ie > B.i0 ? 'Kimosás: a szemcsék elindulnak' : ie > 0.6 * B.i0 ? 'Erős áramlás a part felé' : 'Lassú áramlás', ie > B.i0 ? 'A part felé áramló víz elég erős ahhoz, hogy a finom szemcséket kiragadja; az alap alatt üreg nő.' : soil.v === 'kavics' ? 'A kavicsos talaj jól áteresztő: a talajvíz gyorsan követi a folyót, kicsi a szintkülönbség.' : 'Lassabb apadásnál a talajvíz követni tudja a folyót – a gradiens kisebb marad.');
  }
  const tick = (dt) => {
    if (!run) return;
    const ie = step(dt * 1.6);
    const B = BANK.find((b) => b.k === soil.v);
    if (ie > B.i0) for (let k = 0; k < 2; k++) parts.push({ x: L - 24 + Math.random() * 14, y: -1.8 - Math.random() * 1.5 });
    for (const p of parts) { p.x += dt * 9 * (0.6 + Math.random() * 0.6); p.y -= dt * 0.8; }
    parts = parts.filter((p) => p.x < L + 6).slice(-160);
    if (t > days.v * 2.2 + 4) run = false;
    draw();
  };
  [days, drop, soil].forEach((x) => x.on(() => { reset(); run = false; draw(); }));
  play.addEventListener('click', () => { reset(); run = true; });
  loop(cv, (tt, dt) => tick(dt));
  onTheme(draw);
  root.append(h('div', { class: 'w-foot', html: 'Egydimenziós talajvízmodell a part felé (a talaj áteresztőképessége szerint), a kimosás kezdetének küszöbe és az anyagmérleg szemléltető. A tanulság: minél gyorsabb az apadás és minél kevésbé áteresztő a talaj, annál nagyobb a part felé mutató gradiens.' }));
});

/* ---------------------------------------------------------------- 2. buzgárlabor */
register('wash-grad', (root) => {
  const { ctrls, viz, out } = shell(root);
  const dh = slider(ctrls, { label: 'Vízszintkülönbség', sym: 'Δh', min: 0, max: 60, step: 1, value: 20, unit: 'cm' });
  const Ls = slider(ctrls, { label: 'A minta hossza', sym: 'L', min: 20, max: 60, step: 5, value: 40, unit: 'cm' });
  const gs = slider(ctrls, { label: 'Víz alatti térfogatsúly', sym: 'γ′', min: 8, max: 11, step: 0.1, value: 9.8, unit: 'kN/m³', d: 1 });
  const fig = figure(viz, 640, 380);
  const sI = stat(out, { label: '<i>i</i> = Δ<i>h</i>/<i>L</i>' }), sK = stat(out, { label: '<i>i</i><sub>kr</sub> = γ′/γ<sub>w</sub>' }), sS = stat(out, { label: 'Hatékony feszültség a minta alján' });
  const vd = verdict(out);
  let ph = 0, boil = 0, grains = [];
  const draw = () => {
    clear(fig);
    const i = dh.v / Ls.v, icr = gs.v / 9.81; boil = clamp((i - icr) / 0.15 + 1, 0, 2) - 1;
    const sig = Math.max(0, (gs.v - i * 9.81) * Ls.v / 100);
    // tartály
    const cx = 260, top = 90, sampleH = Ls.v * 3.6, by = top + 80 + sampleH;
    svg('rect', { x: cx - 90, y: top, width: 180, height: by - top + 30, fill: 'var(--water-fill)', stroke: 'var(--ink2)', 'stroke-width': 3 }, fig);
    svg('rect', { x: cx - 88, y: by, width: 176, height: 28, fill: 'var(--soilD)' }, fig);
    svg('text', { x: cx, y: by + 19, 'text-anchor': 'middle', class: 't-s halo', text: 'szűrőkő' }, fig);
    // homokminta
    const g = svg('g', {}, fig);
    svg('rect', { x: cx - 88, y: by - sampleH, width: 176, height: sampleH, fill: 'var(--soilA)' }, g);
    grains.forEach((p) => { const lift = boil > 0 ? boil * (Math.sin(ph * 6 + p[2]) * 6 + 8) : 0; p.el = svg('circle', { cx: cx - 84 + p[0] * 168, cy: by - p[1] * sampleH - lift * (p[1] > 0.7 ? 1.4 : 0.6), r: 3.1, fill: 'var(--soil-line)', opacity: 0.55 }, g); });
    // állócső (felvíz)
    const wl = top + 40, up = wl - dh.v * 3.6;
    svg('path', { d: `M${cx + 90} ${by + 14} H${cx + 160} V${up - 30}`, fill: 'none', stroke: 'var(--ink2)', 'stroke-width': 10 }, fig);
    svg('path', { d: `M${cx + 90} ${by + 14} H${cx + 160} V${up}`, fill: 'none', stroke: 'var(--water)', 'stroke-width': 6 }, fig);
    svg('line', { x1: cx - 90, y1: wl, x2: cx + 175, y2: wl, stroke: 'var(--water)', 'stroke-dasharray': '5 4' }, fig);
    svg('line', { x1: cx + 140, y1: up, x2: cx + 180, y2: up, stroke: 'var(--water)', 'stroke-width': 2 }, fig);
    svg('line', { x1: cx + 190, y1: up, x2: cx + 190, y2: wl, stroke: 'var(--c4)', 'stroke-width': 2 }, fig);
    svg('text', { x: cx + 196, y: (up + wl) / 2 + 4, class: 't-num t-b halo', text: `Δh = ${dh.v} cm` }, fig);
    svg('line', { x1: cx - 110, y1: by - sampleH, x2: cx - 110, y2: by, stroke: 'var(--ink2)' }, fig);
    svg('text', { x: cx - 116, y: by - sampleH / 2 + 4, 'text-anchor': 'end', class: 't-num halo', text: `L = ${Ls.v} cm` }, fig);
    // áramlás nyilai
    for (const xx of [-50, 0, 50]) { const y = by - sampleH * 0.5 - ((ph * 40 * Math.min(1, i)) % 30); svg('path', { d: `M${cx + xx} ${y + 12} V${y - 6} M${cx + xx - 5} ${y} L${cx + xx} ${y - 8} L${cx + xx + 5} ${y}`, fill: 'none', stroke: 'var(--water)', 'stroke-width': 2, opacity: i > 0.02 ? 0.9 : 0 }, fig); }
    if (boil > 0) for (const xx of [-40, 10, 55]) svg('path', { d: `M${cx + xx - 16} ${by - sampleH} Q${cx + xx} ${by - sampleH - 16 * boil - 4} ${cx + xx + 16} ${by - sampleH}`, fill: 'var(--soilA)', stroke: 'var(--soil-line)' }, fig);
    sI.set(fmt(i, 2), i >= icr ? 'bad' : i > 0.6 * icr ? 'warn' : 'ok'); sK.set(fmt(icr, 2));
    sS.set(`${fmt(sig, 2)} kPa`, sig <= 0.001 ? 'bad' : null, `${fmt(sig, 2)}<small>kPa</small>`);
    vd.set(i >= icr ? 'bad' : i > 0.6 * icr ? 'warn' : 'ok', i >= icr ? 'Buzgár: a homok „forr”' : i > 0.6 * icr ? 'Közel a kritikushoz' : 'A minta stabil', i >= icr ? 'A felfelé áramló víz ereje eléri a szemcsék víz alatti súlyát: a hatékony feszültség nulla, a homok elveszíti a teherbírását.' : 'σ′ = (γ′ − i·γ<sub>w</sub>)·L – a gradiens növelésével a hatékony feszültség egyre kisebb.');
  };
  const regrains = () => { grains = []; let s = 3; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; for (let k = 0; k < 70; k++) grains.push([r(), r(), r() * 6]); };
  regrains();
  [dh, Ls, gs].forEach((x) => x.on(draw)); draw(); onTheme(draw);
  loop(fig, (t, dt) => { ph += dt; if (boil > 0) draw(); });
});

/* ---------------------------------------------------------------- 3. szűrőpróba (Terzaghi) */
const BASE = [
  { k: 'fs', n: 'egyenletes finom homok', d15: 0.09, d85: 0.2, d: [0.06, 0.09, 0.12, 0.16, 0.2, 0.3] },
  { k: 'ss', n: 'iszapos homok', d15: 0.02, d85: 0.25, d: [0.004, 0.02, 0.06, 0.15, 0.25, 0.5] },
  { k: 'ms', n: 'közepes homok', d15: 0.25, d85: 0.7, d: [0.15, 0.25, 0.35, 0.5, 0.7, 1.2] },
];
const FILT = [
  { k: 'f04', n: 'homokos kavics 0/4', d15: 0.3, d: [0.15, 0.3, 0.8, 1.6, 3, 4] },
  { k: 'f48', n: 'kavics 4/8', d15: 4.5, d: [4, 4.5, 5.3, 6.3, 7.5, 8] },
  { k: 'f1632', n: 'durva kavics 16/32', d15: 18, d: [16, 18, 21, 25, 30, 32] },
  { k: 'f12', n: 'durva homok 1/2', d15: 1.1, d: [0.9, 1.1, 1.3, 1.6, 1.9, 2.1] },
];
const PCT = [5, 15, 35, 60, 85, 98];
register('wash-filter', (root) => {
  const { ctrls, viz, out } = shell(root);
  const b = seg(ctrls, { label: 'Védett talaj', vert: true, options: BASE.map((x) => ({ v: x.k, t: x.n })), value: 'fs' });
  const f = seg(ctrls, { label: 'Szűrőanyag', vert: true, options: FILT.map((x) => ({ v: x.k, t: x.n })), value: 'f48' });
  const fig = figure(viz, 640, 300);
  const sR = stat(out, { label: 'Visszatartás: <i>D</i><sub>15F</sub>/<i>d</i><sub>85B</sub> ≤ 4–5' }), sP = stat(out, { label: 'Áteresztés: <i>D</i><sub>15F</sub>/<i>d</i><sub>15B</sub> ≥ 4–5' });
  const vd = verdict(out);
  const draw = () => {
    clear(fig);
    const B = BASE.find((x) => x.k === b.v), F = FILT.find((x) => x.k === f.v);
    const c = chart(fig, { w: 640, h: 300, m: { l: 44, r: 12, t: 12, b: 40 }, x: [0.002, 50], y: [0, 100], xlog: true, xt: [0.01, 0.1, 1, 10], yt: [0, 20, 40, 60, 80, 100], xl: 'szemcseméret, mm', yl: 'áthullás, %' });
    svg('path', { d: pd(B.d.map((d, i) => [c.X(d), c.Y(PCT[i])])), fill: 'none', stroke: 'var(--soil-line)', 'stroke-width': 3 }, fig);
    svg('path', { d: pd(F.d.map((d, i) => [c.X(d), c.Y(PCT[i])])), fill: 'none', stroke: 'var(--c4)', 'stroke-width': 3 }, fig);
    svg('text', { x: c.X(B.d[2]) - 8, y: c.Y(40), 'text-anchor': 'end', class: 't-s t-b halo', text: 'talaj' }, fig);
    svg('text', { x: c.X(F.d[2]) + 8, y: c.Y(40), class: 't-s t-b halo', text: 'szűrő', style: 'fill:var(--c4)' }, fig);
    for (const [d, lab] of [[B.d85, 'd85'], [B.d15, 'd15'], [F.d15, 'D15']]) { svg('line', { x1: c.X(d), y1: c.B, x2: c.X(d), y2: c.T, stroke: 'var(--ink2)', 'stroke-dasharray': '3 3', opacity: 0.6 }, fig); }
    const r1 = F.d15 / B.d85, r2 = F.d15 / B.d15;
    const ok1 = r1 <= 5, ok2 = r2 >= 4;
    sR.set(fmt(r1, 1), ok1 ? 'ok' : 'bad'); sP.set(fmt(r2, 1), ok2 ? 'ok' : 'bad');
    vd.set(ok1 && ok2 ? 'ok' : 'bad', ok1 && ok2 ? 'Jó szűrő' : !ok1 ? 'A szűrő átengedi a talajt' : 'A szűrő túl finom', ok1 && ok2 ? 'A szűrő hézagai visszatartják a talaj szemcséit, a víz akadálytalanul átfolyik.' : !ok1 ? 'A szűrő pórusai túl nagyok: a finom szemcsék átjutnak rajta – a kimosás folytatódik. Közbenső, fokozatos szűrőréteg kell.' : 'A szűrő maga is eltömődne, és nem vezeti el elég gyorsan a vizet – nyomás épülne fel mögötte.');
  };
  [b, f].forEach((x) => x.on(draw)); draw(); onTheme(draw);
  root.append(h('div', { class: 'w-foot', html: 'A Terzaghi-féle szűrőszabály két feltétele: D<sub>15</sub> (szűrő) ≤ 4–5 · d<sub>85</sub> (talaj) – visszatartás; D<sub>15</sub> (szűrő) ≥ 4–5 · d<sub>15</sub> (talaj) – áteresztés. A görbék szemléltető szemeloszlások.' }));
});

/* ---------------------------------------------------------------- 4. kimélyülés-becslő (CSU-képlet) */
register('wash-scour', (root) => {
  const { ctrls, viz, out } = shell(root);
  const V = slider(ctrls, { label: 'Árvízi sebesség', sym: 'v', min: 0.5, max: 4, step: 0.1, value: 2.2, unit: 'm/s', d: 1 });
  const y1 = slider(ctrls, { label: 'Vízmélység a pillér előtt', sym: 'y<sub>1</sub>', min: 1, max: 12, step: 0.5, value: 6, unit: 'm', d: 1 });
  const a = slider(ctrls, { label: 'Pillérszélesség', sym: 'a', min: 1, max: 6, step: 0.1, value: 2.5, unit: 'm', d: 1 });
  const K1 = seg(ctrls, { label: 'A pillér orra', options: [{ v: 1.1, t: 'szögletes' }, { v: 1.0, t: 'lekerekített' }, { v: 0.9, t: 'hegyes' }], value: 1.0 });
  const fd = slider(ctrls, { label: 'Az alap mélysége a meder alatt', sym: 't', min: 1, max: 15, step: 0.5, value: 4, unit: 'm', d: 1 });
  const fig = figure(viz, 640, 380);
  const sF = stat(out, { label: 'Froude-szám' }), sY = stat(out, { label: 'Becsült kimélyülés <i>y</i><sub>s</sub>' });
  const vd = verdict(out);
  const draw = () => {
    clear(fig);
    const Fr = V.v / Math.sqrt(9.81 * y1.v);
    const ys = a.v * 2.0 * K1.v * 1.0 * 1.1 * (y1.v / a.v) ** 0.35 * Fr ** 0.43;
    const sc = 13, bed = 150, cx = 320;
    svg('rect', { x: 0, y: 0, width: 640, height: bed - y1.v * sc, fill: 'var(--sky)' }, fig);
    svg('rect', { x: 0, y: bed - y1.v * sc, width: 640, height: y1.v * sc, fill: 'var(--water-fill)' }, fig);
    // meder kimélyüléssel (tölcsér)
    const w2 = a.v / 2 * sc + ys * sc * 2.0;
    svg('path', { d: `M0 ${bed} H${cx - w2} L${cx - a.v / 2 * sc - 4} ${bed + ys * sc} H${cx + a.v / 2 * sc + 4} L${cx + w2} ${bed} H640 V380 H0 Z`, fill: 'var(--soilA)' }, fig);
    svg('path', { d: `M${cx - w2} ${bed} L${cx - a.v / 2 * sc - 4} ${bed + ys * sc} H${cx + a.v / 2 * sc + 4} L${cx + w2} ${bed}`, fill: 'color-mix(in srgb, var(--c4) 20%, transparent)', stroke: 'var(--c4)', 'stroke-width': 2, 'stroke-dasharray': '6 4' }, fig);
    svg('line', { x1: 0, y1: bed, x2: 640, y2: bed, stroke: 'var(--soil-line)', 'stroke-dasharray': '4 4' }, fig);
    // pillér + alap
    const fb = bed + fd.v * sc;
    svg('rect', { x: cx - a.v / 2 * sc - 18, y: fb - 22, width: a.v * sc + 36, height: 22, class: 'f-conc', stroke: 'var(--ink2)' }, fig);
    svg('rect', { x: cx - a.v / 2 * sc, y: 20, width: a.v * sc, height: fb - 42, class: 'f-conc', stroke: 'var(--ink2)' }, fig);
    svg('rect', { x: cx - a.v / 2 * sc - 60, y: 12, width: a.v * sc + 120, height: 14, fill: 'var(--concrete2)' }, fig);
    // örvény
    svg('path', { d: `M${cx - a.v / 2 * sc - 70} ${bed - y1.v * sc * 0.6} q40 0 60 ${y1.v * sc * 0.55}`, fill: 'none', stroke: 'var(--water)', 'stroke-width': 2.5 }, fig);
    svg('text', { x: 20, y: bed - y1.v * sc + 18, class: 't-s halo', text: `v = ${fmt(V.v, 1)} m/s →` }, fig);
    svg('line', { x1: cx + w2 + 20, y1: bed, x2: cx + w2 + 20, y2: bed + ys * sc, stroke: 'var(--c4)', 'stroke-width': 2 }, fig);
    svg('text', { x: cx + w2 + 26, y: bed + ys * sc / 2 + 4, class: 't-num t-b halo', html: `y<tspan dy="4" font-size="75%">s</tspan><tspan dy="-4"> = ${fmt(ys, 1)} m</tspan>` }, fig);
    svg('line', { x1: cx - a.v / 2 * sc - 30, y1: bed, x2: cx - a.v / 2 * sc - 30, y2: fb, stroke: 'var(--ink2)' }, fig);
    svg('text', { x: cx - a.v / 2 * sc - 36, y: (bed + fb) / 2, 'text-anchor': 'end', class: 't-num halo', text: `t = ${fmt(fd.v, 1)} m` }, fig);
    sF.set(fmt(Fr, 2)); sY.set(`${fmt(ys, 1)} m`, ys > fd.v ? 'bad' : ys > 0.7 * fd.v ? 'warn' : 'ok', `${fmt(ys, 1)}<small>m</small>`);
    vd.set(ys > fd.v ? 'bad' : ys > 0.7 * fd.v ? 'warn' : 'ok', ys > fd.v ? 'Alámosás: a kimélyülés eléri az alapot' : ys > 0.7 * fd.v ? 'Kevés a tartalék' : 'Az alap a kimélyülés alatt van', ys > fd.v ? 'A pillér alól kimosódik a talaj – így dőlt össze a Schoharie Creek és a Hintze Ribeiro híd is. Mélyebb alapozás (cölöp, kút) és kőszórás kell.' : 'A kimélyülés a vízsebességgel és a pillér szélességével nő; árvíz után a pillér környékét meg kell vizsgálni.');
  };
  [V, y1, a, K1, fd].forEach((x) => x.on(draw)); draw(); onTheme(draw);
  root.append(h('div', { class: 'w-foot', html: 'Becslés a pillér körüli helyi kimélyülésre (CSU-képlet, a pillér a sodorvonallal párhuzamos, sík meder): y<sub>s</sub>/a = 2,0 · K<sub>1</sub> · K<sub>2</sub> · K<sub>3</sub> · (y<sub>1</sub>/a)<sup>0,35</sup> · Fr<sup>0,43</sup>, K<sub>2</sub> = 1,0; K<sub>3</sub> = 1,1. A teljes kimélyüléshez a meder általános mélyülése is hozzáadódik.' }));
});

/* ---------------------------------------------------------------- 5. zsompos víztelenítés */
register('wash-sump', (root) => {
  const { ctrls, viz, out } = shell(root);
  const Q = slider(ctrls, { label: 'Szivattyúzott vízhozam', sym: 'Q', min: 2, max: 30, step: 1, value: 12, unit: 'm³/h' });
  const filt = toggle(ctrls, { label: 'szűrő a zsomp körül (szűrőkavics + szűrőszövet)', value: false });
  const go = h('button', { class: 'btn', type: 'button' }, '▶ Szivattyú indítása (30 nap)'); ctrls.append(go);
  const cv = h('canvas', { style: 'width:100%;display:block;border-radius:10px;border:1px solid var(--line)' });
  viz.append(cv);
  const sC = stat(out, { label: 'Homoktartalom a kiszivattyúzott vízben' }), sV = stat(out, { label: 'Kiszivattyúzott homok' }), sS = stat(out, { label: 'A szomszéd alap süllyedése' });
  const vd = verdict(out);
  let day = 0, run = false, vol = 0, ph = 0;
  const conc = () => (filt.v ? 0.00002 : 0.0006 * (0.6 + Q.v / 25)); // térfogatarány – szemléltető
  let st = null; st = fitCanvas(cv, 0.52, () => { if (st) draw(); });
  function draw() {
    const { ctx: g, w, h: H } = st; if (!w) return; g.clearRect(0, 0, w, H);
    const gy = H * 0.24, pitL = w * 0.42, pitR = w * 0.94, pitB = H * 0.62;
    g.fillStyle = cssVar('--sky'); g.fillRect(0, 0, w, gy);
    g.fillStyle = cssVar('--soilA'); g.fillRect(0, gy, w, H - gy);
    g.fillStyle = cssVar('--water-fill'); g.fillRect(0, gy + H * 0.12, w, H);
    // munkagödör
    g.fillStyle = cssVar('--sky'); g.fillRect(pitL, gy, pitR - pitL, pitB - gy);
    g.strokeStyle = cssVar('--steelm2'); g.lineWidth = 4; g.beginPath(); g.moveTo(pitL, gy - 6); g.lineTo(pitL, H * 0.86); g.stroke();
    // zsomp + szivattyú, tömlő a csatornáig
    const zx = pitL + (pitR - pitL) * 0.3; g.fillStyle = cssVar('--water'); g.globalAlpha = 0.6; g.fillRect(zx - 16, pitB - 4, 32, 24); g.globalAlpha = 1;
    if (filt.v) { g.strokeStyle = cssVar('--soilD'); g.lineWidth = 6; g.strokeRect(zx - 19, pitB - 6, 38, 29); }
    g.fillStyle = cssVar('--steelm2'); g.fillRect(zx - 7, pitB - 2, 14, 18);
    g.strokeStyle = cssVar('--ink2'); g.lineWidth = 3; g.beginPath(); g.moveTo(zx, pitB - 2); g.lineTo(zx, gy - 14); g.lineTo(pitR - 10, gy - 14); g.lineTo(pitR - 10, gy - 2); g.stroke();
    // kifolyó víz
    const c = conc(); const turb = clamp(c / 0.0008, 0, 1);
    g.fillStyle = `rgba(${Math.round(lerp(80, 170, turb))},${Math.round(lerp(150, 140, turb))},${Math.round(lerp(220, 90, turb))},0.85)`;
    if (run) for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(pitR - 10, gy + ((ph * 60 + k * 9) % 30), 3, 0, 7); g.fill(); }
    // szomszéd ház sávalapja
    const hx = w * 0.06, hw = w * 0.3, s = Math.min(1, vol / 4) * H * 0.06;
    g.save(); g.translate(hx + hw, gy); g.rotate(s / hw); g.translate(-(hx + hw), -gy);
    g.fillStyle = cssVar('--building'); g.fillRect(hx, gy - H * 0.2, hw, H * 0.2); g.strokeStyle = cssVar('--ink2'); g.lineWidth = 1.2; g.strokeRect(hx, gy - H * 0.2, hw, H * 0.2);
    g.fillStyle = cssVar('--concrete'); g.fillRect(hx + hw - 26, gy, 30, H * 0.09);
    g.restore();
    // fellazult zóna, üreg
    if (vol > 0.05) { g.fillStyle = 'rgba(40,30,20,0.28)'; g.beginPath(); g.ellipse(pitL - w * 0.04, H * 0.62, w * 0.06 + vol * 6, H * 0.06 + vol * 2, 0, 0, 7); g.fill(); g.fillStyle = '#1a1612'; g.beginPath(); g.ellipse(pitL - w * 0.05, H * 0.6, Math.min(w * 0.09, vol * 7), Math.min(H * 0.05, vol * 3), 0, 0, 7); g.fill(); }
    // szemcsék a zsomp felé
    if (run && !filt.v) { g.fillStyle = cssVar('--soil-line'); for (let k = 0; k < 14; k++) { const tt = (ph * 0.6 + k / 14) % 1; const x = lerp(pitL - w * 0.12, zx, tt), y = lerp(H * 0.7, pitB + 8, tt) + Math.sin(k * 3 + ph * 4) * 3; g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); } }
    g.fillStyle = cssVar('--ink2'); g.font = '600 12px Manrope, sans-serif'; g.fillText('szomszéd ház', hx + 6, gy - H * 0.2 - 6); g.fillText('munkagödör', pitL + 8, gy + 16); g.fillText('zsomp', zx + 20, pitB + 14); g.fillText(`${Math.round(day)}. nap`, w - 70, 18);
    sC.set(filt.v ? 'tiszta víz' : `${fmt(c * 1000, 2)} ‰`, filt.v ? 'ok' : 'bad', filt.v ? 'tiszta víz' : `${fmt(c * 1000, 2)}<small>‰</small>`);
    sV.set(`${fmt(vol, 2)} m³`, vol > 1 ? 'bad' : vol > 0.2 ? 'warn' : 'ok', `${fmt(vol, 2)}<small>m³</small>`);
    const sm = Math.min(60, vol * 12); sS.set(`${fmt(sm, 0)} mm`, sm > 20 ? 'bad' : sm > 5 ? 'warn' : 'ok', `${fmt(sm, 0)}<small>mm</small>`);
    vd.set(filt.v ? 'ok' : vol > 1 ? 'bad' : 'warn', filt.v ? 'Szűrővel: a víz tiszta' : vol > 1 ? 'A szomszéd alapja alól elfogy a talaj' : 'Zavaros, homokos víz – figyelmeztető jel', filt.v ? 'A szűrő visszatartja a szemcséket, csak a víz távozik. A homoktartalmat ülepítő edénnyel így is rendszeresen ellenőrizni kell.' : 'Napi néhány tized köbméter homok is hetek alatt jelentős üreget hagy a szomszéd ház alapja alatt.');
  }
  [Q, filt].forEach((x) => x.on(() => { day = 0; vol = 0; run = false; draw(); }));
  go.addEventListener('click', () => { day = 0; vol = 0; run = true; });
  loop(cv, (t, dt) => { ph += dt; if (run) { const dd = dt * 6; day += dd; vol += Q.v * 24 * conc() * dd; if (day >= 30) { day = 30; run = false; } draw(); } });
  draw();
  onTheme(draw);
  root.append(h('div', { class: 'w-foot', html: 'Szemléltető anyagmérleg: a kiszivattyúzott homok mennyisége a vízhozam, a homoktartalom és az idő szorzata. Már 0,5 ‰ homoktartalom is 12 m³/h mellett naponta kb. 0,15 m³ homokot jelent.' }));
});

/* ---------------------------------------------------------------- kvíz */
defineQuiz('wash', 'Kvíz – a talajvíz kimosó hatása', [
  { q: 'Mikor a legveszélyesebb a kimosás egy folyóparti épületnél?', a: ['Gyors apadáskor, amikor a talajvíz magasabban marad, mint a folyó', 'Lassú, egyenletes áradáskor', 'Télen, befagyott folyónál', 'Ha a folyó vízszintje állandó'], c: 0, e: 'Gyors apadáskor a part alatti talajvíz nem tudja követni a folyót; az erős, folyó felé tartó áramlás elragadja a szemcséket.' },
  { q: 'Mi a kritikus hidraulikus gradiens (felfelé áramlásnál)?', a: ['<i>i</i><sub>kr</sub> = γ′/γ<sub>w</sub> ≈ 1', '<i>i</i><sub>kr</sub> ≈ 0,01', '<i>i</i><sub>kr</sub> ≈ 10', 'Nincs ilyen érték'], c: 0, e: 'Ekkor a felfelé áramló víz ereje a szemcsék víz alatti súlyával egyenlő, a hatékony feszültség nulla – buzgár, folyós homok.' },
  { q: 'Mit jelez, ha egy munkagödörből szivattyúzott víz zavaros, homokos?', a: ['Hogy a vízzel együtt a talajt is kiszívják – fellazul a talaj, üregek keletkeznek', 'Hogy jól működik a szivattyú', 'Hogy hamarosan elfogy a talajvíz', 'Semmit, ez természetes'], c: 0, e: 'Folyós homokban a zsompos víztelenítés a homokot is kiszívja; szűrőzött kutakkal, szűrőréteggel kell víztelenteni.' },
  { q: 'Mi a jó szűrőréteg két feltétele?', a: ['Visszatartja a védett talaj szemcséit, és jól átengedi a vizet', 'Minél finomabb, annál jobb', 'Minél durvább, annál jobb', 'Vízzáró legyen'], c: 0, e: 'Terzaghi szűrőszabálya szerint a visszatartáshoz <span class="nw">D<sub>15</sub> ≤ 4–5 · d<sub>85</sub></span>, az áteresztéshez <span class="nw">D<sub>15</sub> ≥ 4–5 · d<sub>15</sub></span> kell (D a szűrő, d a védett talaj szemcsemérete).' },
  { q: 'Mi okozza a hídpillérek körüli kimélyülést?', a: ['A pillér előtt lefelé forduló, örvénylő víz kimossa a medret', 'A pillér súlya', 'A híd forgalma', 'A fagy'], c: 0, e: 'A pillér körüli örvény tölcsért váj a mederbe; ha eléri az alapot, a pillér megsüllyed vagy megbillen – a hídleomlások leggyakoribb oka.' },
  { q: 'Miért veszélyes egy lyukas vízvezeték az épület mellett?', a: ['A kiáramló víz elhordja a talajt, az alap vagy a burkolat alatt üreg nő', 'Mert növeli a talaj szilárdságát', 'Mert lehűti az alapot', 'Nem veszélyes'], c: 0, e: 'A szivárgó víz láthatatlanul mossa ki a talajt; a burkolat egy ideig áthidalja az üreget, majd hirtelen beszakad.' },
  { q: 'Melyik talaj a leginkább hajlamos a kimosásra?', a: ['Egyenletes finom homok, iszapos homok', 'Kemény agyag', 'Tömör kavics', 'Szikla'], c: 0, e: 'A finom, kohézió nélküli szemcséket az áramló víz könnyen kiragadja; a kötött talajt a kohézió, a kavicsot a szemcsék súlya védi.' },
]);
