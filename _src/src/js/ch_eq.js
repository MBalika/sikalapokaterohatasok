// CH2 – Földrengések: kéregmetszet, epicentrum-kereső, magnitúdó-mérleg, intenzitás-szoba, izoszeiszták, hazai rengések,
// talajgyorsulási térkép, altalajosztály, válaszspektrum, Mexikóváros, folyósodás, kvíz
import { register, shell, slider, seg, toggle, stat, verdict, select, h, svg, figure, clear, fmt, clamp, lerp, smooth, loop, fitCanvas, cssVar, onTheme, $, $$ } from './core.js';
import { chart, pd, samp } from './plot.js';
import { defineQuiz } from './ui.js';
import { MAP, P, km, PX_PER_KM, borderD, baseMap, overlays } from './hu_map.js';

const SB = (t) => `<tspan dy="4" font-size="75%">${t}</tspan><tspan dy="-4"> </tspan>`;
const VP = 6.0, VS = 3.5, KSP = 1 / (1 / VS - 1 / VP); // S–P idő → távolság: d ≈ 8,4 · Δt

/* ---------------------------------------------------------------- hazai rengések (adatok) */
export const QUAKES = [
  { y: 456, n: 'Savaria (Szombathely)', ll: [47.23, 16.62], M: 6.1, Ms: '≈ 6,1', h: null, I0: null, t: 'Az első ismert hazai rengés (szeptember 7.). A leírásokból rekonstruált magnitúdó kb. 6,1 – a mai ország területének két ismert, 6-nál nagyobb rengésének egyike.' },
  { y: 1763, n: 'Komárom', ll: [47.76, 18.12], M: 6.25, Ms: '6,2–6,3', h: null, I0: 'IX', t: 'Június 28-án hajnalban. Az 1169 házból 279 teljesen, 353 részben összedőlt, hét templom omlott össze, Komáromban 63-an haltak meg.' },
  { y: 1810, n: 'Mór', ll: [47.38, 18.2], M: 5.4, Ms: '≈ 5,4', h: 18, I0: null, t: 'Január 14-én. Több mint ezer utórengés; Velegen 113 m hosszú, 40–50 cm széles talajrepedés nyílt. A rengésről készült a világ talán első izoszeizta-térképe.' },
  { y: 1834, n: 'Érmellék', ll: [47.52, 22.15], M: 6.3, Ms: '6,2–6,6', h: 25, I0: 'IX', t: 'Október 15-én, a mai magyar–román határ közelében. Fészekmélysége 23–28 km volt; a károk nyomai a máriapócsi templomban ma is láthatók.' },
  { y: 1911, n: 'Kecskemét', ll: [46.91, 19.69], M: 5.6, Ms: '5,6', h: null, I0: null, t: 'Július 8-án hajnalban. Halálos áldozat nem volt, de a belváros 4569 házából 1269 megsérült, mintegy 3000 tanyaépület súlyosan károsodott; 23 vármegyében érezték.' },
  { y: 1925, n: 'Eger', ll: [47.9, 20.38], M: 5.0, Ms: '5,0', h: null, I0: null, t: 'Több mint 200 épület sérült meg.' },
  { y: 1956, n: 'Dunaharaszti', ll: [47.35, 19.08], M: 5.6, Ms: '5,6', h: null, I0: 'VIII', t: 'Január 12-én reggel. Dunaharasztin 3500 épületből 3144 megsérült, két ember meghalt, mintegy 500-an hajléktalanná váltak.' },
  { y: 1985, n: 'Berhida', ll: [47.11, 18.13], M: 4.9, Ms: '4,9', h: null, I0: 'VII', t: 'Augusztus 15-én reggel. Berhidán 72 házat kellett lebontani.' },
  { y: 2011, n: 'Oroszlány', ll: [47.49, 18.31], M: 4.5, Ms: '4,5–4,7', h: 9, I0: null, t: 'Január 29-én este, kb. 9 km mélyen. Több mint 280 utórengés, hajszálrepedések és kéménykárok; sérült nem volt.' },
  { y: 2013, n: 'Heves–Tenk', ll: [47.66, 20.35], M: 4.7, Ms: '≈ 4,7', h: null, I0: null, t: 'Április 23-án éjjel. 4557 biztosítási kárbejelentés, mintegy 600 millió forint kár – a műszeres korszak legnagyobb hazai rengése.' },
  { y: 2023, n: 'Gyomaendrőd–Túrkeve', ll: [46.94, 20.83], M: 4.0, Ms: '2 × 4,0', h: null, I0: null, t: 'Augusztus 19-én két 4,0-s rengés három perc különbséggel; kárbejelentés nem érkezett.' },
];

/* ---------------------------------------------------------------- 1. kéregmetszet */
register('eq-section', (root) => {
  const { ctrls, viz, out } = shell(root);
  const hd = slider(ctrls, { label: 'Fészekmélység', sym: 'h', min: 3, max: 35, step: 1, value: 10, unit: 'km' });
  const go = h('button', { class: 'btn', type: 'button' }, '▶ Rengés indítása');
  ctrls.append(go, h('p', { class: 'ctl-hint', html: `P-hullám ≈ ${fmt(VP, 1)} km/s, S-hullám ≈ ${fmt(VS, 1)} km/s. Ebből a távolság: <b>d ≈ ${fmt(KSP, 1)} · Δt</b> (km, ha Δt másodpercben).` }));
  const cv = h('canvas', { style: 'width:100%;display:block;border-radius:10px;border:1px solid var(--line)' });
  viz.append(cv);
  const ST = [{ n: 'A', x: 32 }, { n: 'B', x: 58 }, { n: 'C', x: 92 }];
  const HX = 18; // a fészek vízszintes helye, km
  const sts = ST.map((s) => stat(out, { label: `${s.n} állomás: S–P idő → távolság` }));
  let t = 0, run = false;
  let st = null; st = fitCanvas(cv, 0.62, () => { if (st) draw(); });
  function draw() {
    const { ctx: g, w, h: H } = st; if (!w) return; g.clearRect(0, 0, w, H);
    const top = Math.max(H * 0.08, 34), secH = H * 0.5, kx = w / 100, kz = secH / 40;
    const X = (x) => x * kx, Z = (z) => top + z * kz;
    // kéreg
    const grd = g.createLinearGradient(0, top, 0, top + secH); grd.addColorStop(0, cssVar('--soilD')); grd.addColorStop(0.15, cssVar('--rock')); grd.addColorStop(1, cssVar('--soilE'));
    g.fillStyle = grd; g.fillRect(0, top, w, secH);
    g.fillStyle = cssVar('--sky'); g.fillRect(0, 0, w, top);
    // vető
    g.strokeStyle = cssVar('--ink2'); g.setLineDash([6, 4]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(HX - 9), Z(40)); g.lineTo(X(HX + 9), Z(0)); g.stroke(); g.setLineDash([]);
    // fészek, epicentrum
    const hz = hd.v; const fx = X(HX), fz = Z(hz);
    g.fillStyle = cssVar('--c2'); g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 4 : 10; g.lineTo(fx + Math.cos(a) * r, fz + Math.sin(a) * r); } g.closePath(); g.fill();
    g.beginPath(); g.moveTo(fx, top); g.lineTo(fx - 7, top - 11); g.lineTo(fx + 7, top - 11); g.closePath(); g.fill();
    g.font = '600 12px Manrope, sans-serif'; g.fillStyle = cssVar('--ink');
    g.fillText('epicentrum', fx + 10, top - 16); g.fillText('hipocentrum (fészek)', fx + 13, fz + 4);
    g.strokeStyle = cssVar('--c2'); g.setLineDash([3, 3]); g.beginPath(); g.moveTo(fx, top); g.lineTo(fx, fz); g.stroke(); g.setLineDash([]);
    if (fz - top > 26) { if (fx - 66 >= 44) g.fillText(`h = ${hz} km`, fx - 66, (top + fz) / 2 + 4); else g.fillText(`h = ${hz} km`, fx + 7, (top + fz) / 2 + 4); }
    // hullámfrontok
    g.save(); g.beginPath(); g.rect(0, top, w, secH); g.clip();
    for (const [v, col, lw] of [[VP, cssVar('--c1'), 2], [VS, cssVar('--c2'), 3]]) {
      const R = v * t; if (R <= 0) continue;
      g.strokeStyle = col; g.lineWidth = lw; g.globalAlpha = clamp(1 - R / 140, 0.15, 1);
      g.beginPath(); g.ellipse(fx, fz, R * kx, R * kz, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
    }
    g.restore();
    // állomások
    for (const s of ST) { const x = X(s.x); g.fillStyle = cssVar('--ink'); g.fillRect(x - 6, top - 9, 12, 9); g.fillText(s.n, x + 9, top - 1); }
    // mélységi lépték
    g.fillStyle = cssVar('--muted'); g.font = '11px "DM Mono", monospace'; for (const z of [10, 20, 30]) g.fillText(`${z} km`, 4, Z(z) + 4);
    // szeizmogramok
    const y0 = top + secH + 14, rh = (H - y0 - 8) / 3; const tmax = 30;
    ST.forEach((s, i) => {
      const d = Math.hypot(s.x - HX, hz), tp = d / VP, ts = d / VS; const yy = y0 + rh * (i + 0.5);
      g.strokeStyle = cssVar('--line'); g.beginPath(); g.moveTo(40, yy); g.lineTo(w - 6, yy); g.stroke();
      g.fillStyle = cssVar('--ink2'); g.font = '600 12px Manrope, sans-serif'; g.fillText(s.n, 12, yy + 4);
      g.strokeStyle = cssVar('--ink'); g.lineWidth = 1.2; g.beginPath();
      for (let px = 40; px <= w - 6; px++) {
        const tt = ((px - 40) / (w - 46)) * tmax; if (tt > t) break;
        let a = 0.02 * Math.sin(tt * 53);
        if (tt > tp) { const q = tt - tp; a += 0.28 * Math.exp(-q * 1.1) * Math.sin(q * 2 * Math.PI * 5); }
        if (tt > ts) { const q = tt - ts; a += 0.95 * Math.exp(-q * 0.45) * Math.sin(q * 2 * Math.PI * 1.8) * Math.min(1, q * 3); }
        const y = yy - a * rh * 0.42; px === 40 ? g.moveTo(px, y) : g.lineTo(px, y);
      }
      g.stroke();
      if (t > tp) { const x = 40 + (tp / tmax) * (w - 46); g.strokeStyle = cssVar('--c1'); g.beginPath(); g.moveTo(x, yy - rh * 0.45); g.lineTo(x, yy + rh * 0.45); g.stroke(); g.fillStyle = cssVar('--c1'); g.fillText('P', x - 12, yy - rh * 0.25); }
      if (t > ts) { const x = 40 + (ts / tmax) * (w - 46); g.strokeStyle = cssVar('--c2'); g.beginPath(); g.moveTo(x, yy - rh * 0.45); g.lineTo(x, yy + rh * 0.45); g.stroke(); g.fillStyle = cssVar('--c2'); g.fillText('S', x + 4, yy - rh * 0.25); }
      if (t > ts) sts[i].set(`${fmt(ts - tp, 1)} s → ${fmt((ts - tp) * KSP, 0)} km`, null, `${fmt(ts - tp, 1)} s → ${fmt((ts - tp) * KSP, 0)} km`); else sts[i].set('–');
    });
    g.fillStyle = cssVar('--muted'); g.font = '11px "DM Mono", monospace'; g.fillText('idő →  0 … 30 s', w - 120, H - 4);
  }
  hd.on(() => { t = 0; run = false; draw(); });
  go.addEventListener('click', () => { t = 0; run = true; });
  loop(cv, (tt, dt) => { if (run) { t += dt * 3.2; if (t > 30) { t = 30; run = false; } draw(); } });
  t = 30; draw(); onTheme(draw);
});

/* ---------------------------------------------------------------- 2. epicentrum-kereső */
const STATIONS = [{ n: 'Sopron', ll: [47.68, 16.58] }, { n: 'Piszkéstető', ll: [47.92, 19.89] }, { n: 'Szeged', ll: [46.25, 20.15] }];
register('eq-locate', (root) => {
  const { viz, out } = shell(root, { layout: 'wide' });
  const bar = h('div', { class: 'btnrow', style: 'margin-bottom:8px' });
  viz.append(bar);
  const fig = figure(viz, 973, 630);
  const sE = stat(out, { label: 'A tipped hibája' }), sQ = stat(out, { label: 'A rengés' });
  const vd = verdict(out);
  let qi = 1, guess = null, shown = false;
  const pool = QUAKES.filter((q) => q.y >= 1763);
  const nextB = h('button', { class: 'btn btn-line btn-sm', type: 'button' }, 'Új rengés →');
  const showB = h('button', { class: 'btn btn-sm', type: 'button' }, 'Távolságkörök');
  bar.append(showB, nextB);
  const draw = () => {
    clear(fig);
    baseMap(fig); overlays(fig, { cities: false });
    const q = pool[qi]; const E = P(...q.ll);
    STATIONS.forEach((s) => {
      const [x, y] = P(...s.ll); const d = km(s.ll, q.ll); const hz = q.h || 10; const dh = Math.hypot(d, hz); const dt = dh / KSP;
      svg('path', { d: `M${x} ${y - 13} L${x - 10} ${y + 6} L${x + 10} ${y + 6} Z`, fill: 'var(--c2)' }, fig);
      svg('text', { x: x + 12, y: y + 20, class: 't-s halo t-b', text: `${s.n}: S–P = ${fmt(dt, 1)} s`, style: 'font-size:16px' }, fig);
      if (shown) svg('circle', { cx: x, cy: y, r: d * PX_PER_KM, fill: 'none', stroke: 'var(--c2)', 'stroke-width': 2.4, 'stroke-dasharray': '8 6', opacity: 0.85 }, fig);
    });
    if (guess) { svg('circle', { cx: guess[0], cy: guess[1], r: 9, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 3 }, fig); svg('path', { d: `M${guess[0] - 14} ${guess[1]}h28M${guess[0]} ${guess[1] - 14}v28`, stroke: 'var(--ink)', 'stroke-width': 2 }, fig); }
    if (shown) {
      svg('circle', { cx: E[0], cy: E[1], r: 10, fill: 'var(--c2)', stroke: 'var(--surface)', 'stroke-width': 3 }, fig);
      svg('text', { x: E[0] + 14, y: E[1] - 12, class: 't-b halo', text: `${q.n}, ${q.y}`, style: 'font-size:18px' }, fig);
      if (guess) { const ekm = Math.hypot(guess[0] - E[0], guess[1] - E[1]) / PX_PER_KM; sE.set(`${fmt(ekm, 0)} km`, ekm < 25 ? 'ok' : ekm < 60 ? 'warn' : 'bad', `${fmt(ekm, 0)}<small>km</small>`); }
      sQ.set(`${q.n} · ${q.y}`, null, `${q.n} · ${q.y}`); sQ.el.classList.add('txt');
      vd.set('ok', 'Három kör, egy metszéspont', 'Egyetlen állomás csak a távolságot adja meg (kör). Három állomás köreinek közös pontja az epicentrum – így dolgozik a szeizmológiai hálózat is.');
    } else { sE.set('–'); sQ.set('?'); vd.set('', 'Hol volt a rengés?', 'Az S–P időből: d ≈ 8,4 · Δt km. Becsüld meg a három távolságot, és kattints a térképre!'); }
  };
  fig.addEventListener('click', (e) => { const p = fig.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(fig.getScreenCTM().inverse()); guess = [q.x, q.y]; shown = true; draw(); });
  showB.addEventListener('click', () => { shown = true; draw(); });
  nextB.addEventListener('click', () => { qi = (qi + 1) % pool.length; guess = null; shown = false; draw(); });
  draw(); onTheme(draw);
});

/* ---------------------------------------------------------------- 3. magnitúdó-mérleg */
const Ej = (M) => 10 ** (1.5 * M + 4.8);
function eFmt(E) { const u = [['EJ', 1e18], ['PJ', 1e15], ['TJ', 1e12], ['GJ', 1e9], ['MJ', 1e6], ['kJ', 1e3]]; for (const [n, v] of u) if (E >= v) return fmt(E / v, E / v < 10 ? 1 : 0) + ' ' + n; return fmt(E, 0) + ' J'; }
const FREQ = [{ r: '8 felett', a: 8, b: 10, n: 1 }, { r: '7–7,9', a: 7, b: 8, n: 18 }, { r: '6–6,9', a: 6, b: 7, n: 120 }, { r: '5–5,9', a: 5, b: 6, n: 800 }, { r: '4–4,9', a: 4, b: 5, n: 6200 }, { r: '3–3,9', a: 3, b: 4, n: 49000 }];
register('eq-energy', (root) => {
  const { ctrls, viz, out } = shell(root);
  const M = slider(ctrls, { label: 'Magnitúdó', sym: 'M', min: 2, max: 9.5, step: 0.1, value: 5.6, d: 1 });
  const cmp = seg(ctrls, { label: 'Összevetés', vert: true, options: [{ v: 6.25, t: 'Komárom 1763 (6,2–6,3)' }, { v: 5.6, t: 'Dunaharaszti 1956 (5,6)' }, { v: 4.7, t: 'Heves 2013 (≈ 4,7)' }, { v: 7.5, t: 'Niigata 1964 (7,5)' }, { v: 8.0, t: 'Mexikóváros 1985 (8,0)' }], value: 6.25 });
  const fig = figure(viz, 720, 330);
  const sE = stat(out, { label: 'Felszabaduló energia' }), sH = stat(out, { label: 'Hirosima-bomba (≈ 6,3·10¹³ J)' }), sR = stat(out, { label: 'Az összevetett rengéshez képest' });
  const draw = () => {
    clear(fig);
    const E = Ej(M.v), Ec = Ej(cmp.v);
    // energiaoszlopok (log)
    const c = chart(fig, { w: 720, h: 330, m: { l: 70, r: 380, t: 18, b: 40 }, x: [0, 2], y: [1e6, 1e19], ylog: true, xt: [], yt: [1e6, 1e9, 1e12, 1e15, 1e18], yf: (v) => '10' + String(Math.round(Math.log10(v))).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]) + ' J', grid: true });
    const bw = 70;
    const bars = [[0.5, E, 'var(--c2)', `M ${fmt(M.v, 1)}`], [1.5, Ec, 'var(--line2)', `M ${fmt(cmp.v, 1)}`]];
    for (const [x, v, col, lab] of bars) { const X = c.X(x), Y = c.Y(clamp(v, 1e6, 1e19)); svg('rect', { x: X - bw / 2, y: Y, width: bw, height: c.B - Y, fill: col, rx: 4 }, fig); svg('text', { x: X, y: c.B + 18, 'text-anchor': 'middle', class: 't-num', text: lab }, fig); }
    svg('line', { x1: c.L, y1: c.Y(6.3e13), x2: c.R, y2: c.Y(6.3e13), stroke: 'var(--ink2)', 'stroke-dasharray': '5 4' }, fig);
    svg('text', { x: c.R - 4, y: c.Y(6.3e13) - 6, 'text-anchor': 'end', class: 't-s halo', text: 'Hirosima' }, fig);
    // éves gyakoriság
    const f = chart(fig, { w: 720, h: 330, m: { l: 470, r: 14, t: 18, b: 40 }, x: [0.5, 1e5], y: [0, 6], xlog: true, xt: [1, 10, 100, 1000, 10000, 100000], yt: [], xf: (v) => (v >= 1000 ? fmt(v / 1000, 0) + 'e' : fmt(v, 0)) });
    svg('text', { x: 470, y: 12, class: 't-s', text: 'rengés évente a Földön (átlag)' }, fig);
    FREQ.forEach((q, i) => {
      const y = f.T + 6 + i * ((f.B - f.T - 12) / 6); const on = M.v >= q.a && M.v < q.b;
      svg('rect', { x: f.X(0.5), y, width: f.X(q.n) - f.X(0.5), height: 26, rx: 4, fill: on ? 'var(--c2)' : 'color-mix(in srgb, var(--c2) 25%, transparent)' }, fig);
      svg('text', { x: 462, y: y + 18, 'text-anchor': 'end', class: 't-num t-s' + (on ? ' t-b' : ''), text: q.r }, fig);
      svg('text', { x: f.X(q.n) + 6, y: y + 18, class: 't-num t-s', text: q.n >= 1000 ? `≈ ${fmt(q.n, 0)}` : String(q.n) }, fig);
    });
    sE.set(eFmt(E), null, eFmt(E));
    sH.set(fmt(E / 6.3e13, E / 6.3e13 < 1 ? 3 : 1) + '×', null, (E / 6.3e13 < 0.01 ? '< 0,01' : fmt(E / 6.3e13, E / 6.3e13 < 10 ? 2 : 0)) + '×');
    const r = E / Ec; sR.set(r >= 1 ? `${fmt(r, r < 10 ? 1 : 0)}-szor több` : `${fmt(1 / r, 1 / r < 10 ? 1 : 0)}-ad része`, null, r >= 1 ? `${fmt(r, r < 10 ? 1 : 0)}×` : `1/${fmt(1 / r, 1 / r < 10 ? 1 : 0)}`);
  };
  [M, cmp].forEach((x) => x.on(draw)); draw(); onTheme(draw);
  root.append(h('div', { class: 'w-foot', html: 'log<sub>10</sub>E = 1,5·M + 4,8 (E joule-ban) – egy egységnyi magnitúdó 10<sup>1,5</sup> ≈ 32-szeres energia. A gyakorisági adatok 1900 óta számított éves átlagok; a kis rengések száma a jobb műszerezettséggel nő.' }));
});

/* ---------------------------------------------------------------- 4. intenzitás-szoba (EMS-98) */
const EMS = [
  ['I', 'nem érezhető', 'Csak műszer érzékeli.', '–', '–'],
  ['II', 'alig érezhető', 'Csak néhány nyugalomban lévő ember érzi, főleg magas épületek felső szintjén.', '–', '–'],
  ['III', 'gyenge', 'Épületben kevesen érzik, enyhe remegést.', 'A függő tárgyak kissé lengenek.', '–'],
  ['IV', 'széles körben érezhető', 'Épületben sokan, szabadban kevesen érzik.', 'Ablakok, ajtók, edények zörögnek.', '–'],
  ['V', 'erősen érezhető', 'Épületben a legtöbben érzik, az alvók felébrednek.', 'A függő tárgyak erősen lengenek, a kis tárgyak elmozdulnak.', 'Néhány épületben hajszálrepedés.'],
  ['VI', 'enyhén károsító', 'Sokan megijednek, kimenekülnek.', 'Kisebb tárgyak leesnek a polcokról.', 'Sok épületben kis, nem szerkezeti kár: hajszálrepedések, lehulló vakolat.'],
  ['VII', 'károsító', 'A legtöbben megijednek, nehéz megállni.', 'A bútorok elmozdulnak, a polcokról tömegesen esnek le tárgyak.', 'Sok épületben közepes kár: falrepedések, ledőlő kémények.'],
  ['VIII', 'erősen károsító', 'Nehéz megállni, sokan elesnek.', 'A bútorok felborulnak.', 'Sok régi épület súlyosan megrongálódik, egyesek részben összedőlnek.'],
  ['IX', 'pusztító', 'Általános pánik.', 'A műemlékek, szobrok ledőlnek.', 'Sok gyenge épület összedől, a jobbak is súlyosan károsodnak.'],
  ['X', 'nagyon pusztító', '–', '–', 'A legtöbb gyenge épület összedől, sok jól épített is súlyosan károsodik.'],
  ['XI', 'letaroló', '–', '–', 'A jól megtervezett épületek nagy része is összedől.'],
  ['XII', 'teljesen megsemmisítő', '–', 'A felszín és a domborzat megváltozik.', 'Gyakorlatilag minden épület elpusztul.'],
];
const MSK = [['1.', '0,002', 'csak műszerrel mérhető'], ['5.', '0,025–0,05', 'ébreszt, az ablaküveg megreped'], ['6.', '0,05–0,1', 'ijedtség – a maximális szélerővel azonos'], ['7.', '0,1–0,25', 'kémény ledőlése'], ['8.', '0,25–0,5', 'a házak 25 %-ánál súlyos kár'], ['10.', '1–2,5', 'épületek általános pusztulása'], ['11.', '2,5–5', 'katasztrófa, minden tönkremegy'], ['12.', '5–10', 'tárgyak felrepülnek, a domborzat megváltozik']];
register('eq-ems', (root) => {
  const { ctrls, viz, out } = shell(root);
  const I = slider(ctrls, { label: 'Intenzitás (EMS-98)', min: 1, max: 12, step: 1, value: 6, fmt: (v) => EMS[v - 1][0] });
  const tbl = h('div', { class: 'tbl-wrap', style: 'margin-top:4px' });
  tbl.innerHTML = '<table class="tbl" style="font-size:13px"><thead><tr><th>MSK</th><th class="num">a [m/s²]</th><th>hatás</th></tr></thead><tbody>' + MSK.map((r) => `<tr data-msk="${parseInt(r[0], 10)}"><td>${r[0]}</td><td class="num">${r[1]}</td><td>${r[2]}</td></tr>`).join('') + '</tbody></table>';
  const fig = figure(viz, 640, 360);
  const txt = h('div', { class: 'grid3', style: 'margin-top:10px' });
  viz.append(txt, h('h4', { class: 'mh', style: 'font-size:17px;margin:16px 0 8px' }, 'A régi MSK-táblázat gyorsulássávjai'), tbl, h('p', { class: 'note', style: 'margin-top:6px', html: 'A 6–8. fokozat jelenti a szerkezeti károk kezdetét (a 2–4. és a 9. fokozat a táblázatban nem szerepel). A gyorsulássávok régi, empirikus értékek; a mai mérések a kárt okozó fokozatokhoz jóval nagyobb gyorsulásokat rendelnek (VII. fok ≈ 1 m/s², VIII. fok ≈ 2 m/s²).' }));
  ctrls.append(h('p', { class: 'ctl-hint', html: 'Az EMS-98 az intenzitást három tényező alapján határozza meg: hatás az emberre, a tárgyakra és a természetre, valamint az épületek károsodása.' }));
  let ph = 0, shakeG = null, lampG = null, objs = [];
  const cards = ['Ember', 'Tárgyak, természet', 'Épületek'].map((k) => { const c = h('div', { class: 'card', style: 'padding:12px 14px' }, h('span', { class: 'k' }, k), h('p', { style: 'margin:0;font-size:14.5px' })); txt.append(c); return c; });
  const vd = verdict(out);
  const draw = () => {
    clear(fig); const n = I.v;
    shakeG = svg('g', {}, fig); const g = shakeG;
    svg('rect', { x: 40, y: 30, width: 560, height: 290, fill: 'var(--surface2)', stroke: 'var(--ink2)', 'stroke-width': 3 }, g);
    svg('rect', { x: 40, y: 320, width: 560, height: 16, fill: 'var(--concrete)' }, g);
    svg('rect', { x: 400, y: 80, width: 140, height: 110, fill: 'var(--sky)', stroke: 'var(--ink2)', 'stroke-width': 3 }, g);
    svg('line', { x1: 470, y1: 80, x2: 470, y2: 190, stroke: 'var(--ink2)', 'stroke-width': 2 }, g);
    if (n >= 5) svg('path', { d: 'M420 92 L438 120 L430 136 L452 170', fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.5 }, g);
    lampG = svg('g', {}, g);
    svg('line', { x1: 220, y1: 30, x2: 220, y2: 120, stroke: 'var(--ink2)', 'stroke-width': 2 }, lampG);
    svg('path', { d: 'M194 142 L208 120 L232 120 L246 142 Z', fill: 'var(--c1)' }, lampG);
    svg('rect', { x: 70, y: 180, width: 140, height: 8, fill: 'var(--timber)' }, g);
    objs = [];
    [[86, 'var(--c3)', 26], [116, 'var(--c4)', 34], [150, 'var(--c5)', 22], [180, 'var(--c2)', 30]].forEach(([x, col, hh], i) => {
      const fallen = n >= 6 + (i % 2);
      const yy = fallen ? 302 : 180 - hh, xx = fallen ? x + 20 + i * 14 : x;
      const r = svg('rect', { x: xx, y: yy, width: 18, height: fallen ? 10 : hh, rx: 2, fill: col, transform: fallen ? `rotate(${(i - 1.5) * 20} ${xx + 9} ${yy + 5})` : null }, g);
      if (!fallen) objs.push([r, i]);
    });
    if (n >= 6) svg('path', { d: 'M330 40 L318 80 L334 110 L322 160', fill: 'none', stroke: 'var(--ink)', 'stroke-width': n >= 7 ? 3 : 1.4 }, g);
    if (n >= 7) svg('path', { d: 'M560 320 L548 280 L566 250 L552 210 L560 190', fill: 'none', stroke: 'var(--ink)', 'stroke-width': 3 }, g);
    if (n >= 8) { svg('path', { d: 'M40 30 L120 30 L60 110 Z', fill: 'var(--paper)' }, g); svg('path', { d: 'M40 30 L120 30 L60 110', fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2 }, g); }
    if (n >= 9) { svg('path', { d: 'M40 320 L40 210 L110 150 L200 30 L40 30 Z', fill: 'var(--paper)' }, g); svg('path', { d: 'M70 318 l30 -8 l24 6 l30 -10 l26 12', fill: 'none', stroke: 'var(--rock)', 'stroke-width': 10, 'stroke-linecap': 'round' }, g); }
    svg('text', { x: 320, y: 352, 'text-anchor': 'middle', class: 't-b', text: `${EMS[n - 1][0]}. fokozat – ${EMS[n - 1][1]}`, style: 'font-size:17px' }, fig);
    const e = EMS[n - 1]; [2, 3, 4].forEach((k, i) => { $('p', cards[i]).textContent = e[k]; });
    $$('tr[data-msk]', tbl).forEach((tr) => tr.classList.toggle('on', +tr.dataset.msk === n));
    vd.set(n <= 4 ? 'ok' : n <= 7 ? 'warn' : 'bad', n <= 4 ? 'Kár nincs' : n <= 7 ? 'Károk kezdete' : 'Súlyos kár', n <= 4 ? 'Érezhető lehet, de épületkár nem keletkezik.' : n <= 7 ? 'A VI–VII. fokozattól nem szerkezeti, majd szerkezeti károk jelentkeznek – a régi, gyenge falazatú házak az érzékenyek.' : 'Az épületek részben vagy teljesen összedőlnek.');
  };
  // mozgás csak attribútum-változással (nem épít új elemeket)
  const anim = () => {
    const n = I.v; if (!shakeG) return;
    const amp = n < 3 ? 0 : (n - 2) * 0.9;
    shakeG.setAttribute('transform', `translate(${(Math.sin(ph * 9) * Math.min(6, amp * 0.6) * (n >= 4 ? 1 : 0.3)).toFixed(2)},0)`);
    lampG.setAttribute('transform', `rotate(${(Math.sin(ph * 4) * Math.min(16, (n - 2) * 2.4) * (n >= 3 ? 1 : 0)).toFixed(2)} 220 30)`);
    for (const [r, i] of objs) r.setAttribute('transform', `translate(${(Math.sin(ph * 7 + i) * (n >= 5 ? 2 : 0)).toFixed(2)},0)`);
  };
  I.on(draw); draw(); onTheme(draw);
  loop(fig, (t, dt) => { ph += dt; anim(); });
});

/* ---------------------------------------------------------------- 5. izoszeiszták (Kövesligethy) */
register('eq-atten', (root) => {
  const { ctrls, viz, out } = shell(root);
  const I0 = slider(ctrls, { label: 'Epicentrális intenzitás', sym: 'I<sub>0</sub>', min: 5, max: 10, step: 1, value: 8, fmt: (v) => ['', '', '', '', '', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][v] });
  const hz = slider(ctrls, { label: 'Fészekmélység', sym: 'h', min: 2, max: 40, step: 1, value: 10, unit: 'km' });
  const al = slider(ctrls, { label: 'Elnyelési tényező', sym: 'α', min: 0.001, max: 0.01, step: 0.0005, value: 0.003, unit: '1/km', d: 4 });
  const fig = figure(viz, 720, 330);
  const sF = stat(out, { label: 'Kár (≥ VI) sugara' }), sE = stat(out, { label: 'Érezhető (≥ III) sugara' });
  const I = (R) => { const r = Math.hypot(R, hz.v); return I0.v - 3 * Math.log10(r / hz.v) - 1.3 * al.v * (r - hz.v); };
  const radius = (lev) => { if (I(0) < lev) return 0; let a = 0, b = 2000; for (let k = 0; k < 60; k++) { const m = (a + b) / 2; if (I(m) >= lev) a = m; else b = m; } return a; };
  const draw = () => {
    clear(fig);
    // izoszeiszták (bal) – közös lépték
    const rMax = radius(3), sc = 150 / Math.max(rMax, 40);
    const cx = 170, cy = 165;
    svg('rect', { x: 8, y: 8, width: 324, height: 314, rx: 12, fill: 'var(--surface2)', stroke: 'var(--line)' }, fig);
    for (let lev = Math.floor(I0.v); lev >= 3; lev--) { const r = radius(lev); if (r <= 0) continue; svg('circle', { cx, cy, r: Math.max(2, r * sc), fill: `color-mix(in srgb, var(--c2) ${Math.max(6, (lev - 2) * 9)}%, transparent)`, stroke: 'var(--c2)', 'stroke-width': lev === 6 ? 2.5 : 1 }, fig); }
    svg('circle', { cx, cy, r: 4, fill: 'var(--ink)' }, fig);
    svg('line', { x1: 20, y1: 300, x2: 20 + 100 * sc, y2: 300, stroke: 'var(--ink)', 'stroke-width': 3 }, fig);
    svg('text', { x: 20, y: 292, class: 't-num t-s', text: '100 km' }, fig);
    // I(R) görbe (jobb)
    const c = chart(fig, { w: 720, h: 330, m: { l: 400, r: 14, t: 14, b: 40 }, x: [0, 300], y: [2, 11], xt: [0, 50, 100, 150, 200, 250, 300], yt: [3, 4, 5, 6, 7, 8, 9, 10], yf: (v) => ['', '', '', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][v], xl: 'távolság az epicentrumtól, km' });
    svg('rect', { x: c.L, y: c.T, width: c.R - c.L, height: c.Y(6) - c.T, fill: 'color-mix(in srgb, var(--bad) 8%, transparent)' }, fig);
    svg('path', { d: pd(samp((R) => clamp(I(R), 2, 11), 0, 300, 200).map(([x, y]) => [c.X(x), c.Y(y)])), fill: 'none', stroke: 'var(--c2)', 'stroke-width': 2.6 }, fig);
    svg('text', { x: c.R - 4, y: c.Y(6) - 6, 'text-anchor': 'end', class: 't-s', text: 'károk (≥ VI)', style: 'fill:var(--bad)' }, fig);
    const rf = radius(6), re = radius(3);
    sF.set(`${fmt(rf, 0)} km`, rf > 30 ? 'bad' : rf > 0 ? 'warn' : 'ok', `${fmt(rf, 0)}<small>km</small>`); sE.set(`${fmt(re, 0)} km`, null, `${fmt(re, 0)}<small>km</small>`);
  };
  [I0, hz, al].forEach((x) => x.on(draw)); draw(); onTheme(draw);
  root.append(h('div', { class: 'w-foot', html: 'A Kövesligethy-összefüggés: <span class="nw fline">I<sub>0</sub> − I = 3·lg(r/h) + 1,3·α·(r − h)</span>Itt <span class="nw">r = √(R² + h²)</span> a fészektávolság. Ugyanakkora epicentrális intenzitásnál a mélyebb fészkű rengés sokkal nagyobb területen érezhető.' }));
});

/* ---------------------------------------------------------------- 6. történelmi rengések térképe */
register('eq-hist', (root) => {
  const { viz, out } = shell(root, { layout: 'wide' });
  const yr = slider(null, { label: 'Év', min: 400, max: 2026, step: 1, value: 2026, d: 0, fmt: (v) => String(v) });
  viz.append(yr.el);
  const fig = figure(viz, 973, 630);
  const info = h('div', { class: 'card', style: 'margin-top:10px' }, h('span', { class: 'k' }, 'Kattints egy rengésre'), h('h4', {}, '–'), h('p', { style: 'margin:0' }, ''));
  viz.append(info);
  let sel = 6;
  const draw = () => {
    clear(fig); baseMap(fig); overlays(fig, { cities: true });
    QUAKES.forEach((q, i) => {
      if (q.y > yr.v) return;
      const [x, y] = P(...q.ll); const r = 4 + (q.M - 3.8) * 9;
      const g = svg('g', { style: 'cursor:pointer', 'data-i': i }, fig);
      svg('circle', { cx: x, cy: y, r, fill: `color-mix(in srgb, var(--c2) ${i === sel ? 75 : 40}%, transparent)`, stroke: 'var(--c2)', 'stroke-width': i === sel ? 3 : 1.5 }, g);
      svg('text', { x: x + r + 4, y: y + 5, class: 't-s halo' + (i === sel ? ' t-b' : ''), text: `${q.y}`, style: 'font-size:15px' }, g);
    });
    const q = QUAKES[sel];
    $('.k', info).innerHTML = `${q.y} · M ${q.Ms}` + (q.I0 ? ` · I<sub>0</sub> = ${q.I0}` : '') + (q.h ? ` · h ≈ ${q.h} km` : '');
    $('h4', info).textContent = q.n; $('p', info).textContent = q.t;
  };
  fig.addEventListener('click', (e) => { const g = e.target.closest('[data-i]'); if (g) { sel = +g.dataset.i; draw(); } });
  yr.on(draw); draw(); onTheme(draw);
  out.append(h('div', { class: 'verdict' }, h('b', {}, 'Mit mutat a térkép?'), 'A nagy hazai rengések a Komárom–Mór–Berhida vonalon (a Balaton északi vége felé), a Duna mentén és az ország keleti határvidékén csoportosulnak.'));
});

/* ---------------------------------------------------------------- 7. talajgyorsulási térkép */
const ZONES = { 1: 0.08, 2: 0.10, 3: 0.12, 4: 0.14, 5: 0.15 };
register('eq-agr', (root) => {
  const { ctrls, viz, out } = shell(root, { layout: 'ctl-right' });
  const tl = slider(ctrls, { label: 'Tervezési élettartam', sym: 't<sub>L</sub>', min: 10, max: 100, step: 5, value: 50, unit: 'év' });
  const pr = slider(ctrls, { label: 'Meghaladási valószínűség', sym: 'P', min: 1, max: 50, step: 1, value: 10, unit: '%' });
  const gi = seg(ctrls, { label: 'Fontossági osztály (γ<sub>I</sub>)', vert: true, options: [{ v: 0.8, t: 'I. csekély · 0,8' }, { v: 1.0, t: 'II. átlagos · 1,0' }, { v: 1.2, t: 'III. nagy befogadóképességű · 1,2' }, { v: 1.4, t: 'IV. létfontosságú · 1,4' }], value: 1.0 });
  const fig = figure(viz, 973, 630);
  const sZ = stat(out, { label: 'Zóna, <i>a</i><sub>gR</sub>' }), sAg = stat(out, { label: 'Tervezési <i>a</i><sub>g</sub> = γ<sub>I</sub>·<i>a</i><sub>gR</sub>' }), sT = stat(out, { label: 'Visszatérési idő <i>T</i><sub>R</sub>' });
  let zone = 3;
  const zp = {};
  const draw = () => {
    clear(fig);
    const defs = svg('defs', {}, fig); const cp = svg('clipPath', { id: 'huclip' }, defs); svg('path', { d: borderD() }, cp);
    const zg = svg('g', { 'clip-path': 'url(#huclip)' }, fig);
    for (const [k, paths] of Object.entries(MAP.zones)) {
      const d = paths.map((p) => pd(p) + 'Z').join(' ');
      zp[k] = svg('path', { d, fill: `var(--z${k})`, 'fill-rule': 'evenodd', stroke: 'var(--surface)', 'stroke-width': 1.2, opacity: +k === zone ? 1 : 0.88 }, zg);
    }
    overlays(fig, { cities: true });
    // jelmagyarázat
    const lg = svg('g', { transform: 'translate(800,330)' }, fig);
    svg('text', { x: 0, y: -14, class: 't-b', text: 'a', style: 'font-size:18px' }, lg); svg('text', { x: 11, y: -10, class: 't-b', text: 'gR', style: 'font-size:12px' }, lg);
    [5, 4, 3, 2, 1].forEach((k, i) => { svg('rect', { x: 0, y: i * 46, width: 60, height: 40, fill: `var(--z${k})`, stroke: +k === zone ? 'var(--ink)' : 'var(--surface)', 'stroke-width': +k === zone ? 3 : 1 }, lg); svg('text', { x: 30, y: i * 46 + 26, 'text-anchor': 'middle', class: 't-num t-b', text: fmt(ZONES[k], 2) + ' g', style: 'font-size:14px' }, lg); svg('text', { x: 70, y: i * 46 + 26, class: 't-s', text: `${k}. zóna`, style: 'font-size:14px' }, lg); });
    const T = -tl.v / Math.log(1 - pr.v / 100);
    sZ.set(`${zone}. zóna · ${fmt(ZONES[zone], 2)} g`, null, `${zone}. · ${fmt(ZONES[zone], 2)} g`);
    const ag = gi.v * ZONES[zone]; sAg.set(`${fmt(ag, 3)} g`, null, `${fmt(ag, 3)} g <small>= ${fmt(ag * 9.81, 2)} m/s²</small>`);
    sT.set(`${fmt(T, 0)} év`, null, `${fmt(T, 0)}<small>év</small>`);
  };
  const pick = (e) => {
    const p = fig.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(fig.getScreenCTM().inverse());
    const dp = new DOMPoint(q.x, q.y);
    for (const k of [5, 4, 3, 2, 1]) { try { if (zp[k] && zp[k].isPointInFill(dp)) { if (zone !== k) { zone = k; draw(); } return; } } catch (er) { /* */ } }
  };
  fig.addEventListener('pointermove', pick); fig.addEventListener('click', pick);
  [tl, pr, gi].forEach((x) => x.on(draw)); draw(); onTheme(draw);
  root.append(h('div', { class: 'w-foot', html: 'T<sub>R</sub> = −t<sub>L</sub> / ln(1 − P): 50 év és 10 % → 475 év. A zónahatárok vázlatosak; egy adott település értékét a szabvány nemzeti mellékletének térképéről kell leolvasni. Az a<sub>g</sub>·S ≤ 0,10 g érték kis szeizmicitásnak számít, ilyenkor egyszerűsített eljárás is elfogadható.' }));
});

/* ---------------------------------------------------------------- 8. altalajosztály (v_s,30) */
const PRESETS = [
  { n: 'Pesti oldal: homok, homokos kavics', L: [[3, 150], [7, 260], [20, 420]] },
  { n: 'Alföldi kötött talaj', L: [[4, 140], [12, 190], [14, 260]] },
  { n: 'Ártéri laza homok, iszap', L: [[6, 110], [10, 150], [14, 240]] },
  { n: 'Vékony feltöltés márgán', L: [[2.5, 160], [27.5, 520]] },
  { n: 'Puha üledék sziklán (E)', L: [[12, 170], [18, 900]] },
];
register('eq-class', (root) => {
  const { ctrls, viz, out } = shell(root);
  const pre = select(ctrls, { label: 'Mintaszelvény', options: PRESETS.map((p, i) => ({ v: String(i), t: p.n })), value: '0' });
  const rowsBox = h('div', { style: 'display:flex;flex-direction:column;gap:10px' }); ctrls.append(rowsBox);
  const fig = figure(viz, 640, 320);
  const sV = stat(out, { label: '<i>v</i><sub>s,30</sub>' }), sC = stat(out, { label: 'Altalajosztály' }), sA = stat(out, { label: 'Számtani átlag (hibás!)' });
  const vd = verdict(out);
  let L = [];
  const build = () => {
    clear(rowsBox);
    L = PRESETS[+pre.v].L.map((x) => x.slice());
    L.forEach((ly, i) => {
      const box = h('div', { style: 'padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface)' }, h('div', { class: 'ctl-lab' }, `${i + 1}. réteg`));
      const t = slider(box, { label: 'vastagság', min: 0.5, max: 30, step: 0.5, value: ly[0], unit: 'm', d: 1 });
      const v = slider(box, { label: 'v<sub>s</sub>', min: 60, max: 1200, step: 10, value: ly[1], unit: 'm/s' });
      t.on((x) => { ly[0] = x; draw(); }); v.on((x) => { ly[1] = x; draw(); });
      rowsBox.append(box);
    });
    draw();
  };
  const cls = (v) => (v > 800 ? 'A' : v > 360 ? 'B' : v >= 180 ? 'C' : 'D');
  const draw = () => {
    clear(fig);
    // a felső 30 m
    let z = 0, sum = 0; const seg30 = [];
    for (const [t, v] of L) { if (z >= 30) break; const tt = Math.min(t, 30 - z); seg30.push([z, tt, v]); sum += tt / v; z += tt; }
    if (z < 30) { const v = L[L.length - 1][1]; seg30.push([z, 30 - z, v]); sum += (30 - z) / v; }
    const vs30 = 30 / sum; const arith = seg30.reduce((a, [, t, v]) => a + t * v, 0) / 30;
    let C = cls(vs30);
    // E: 5–20 m C/D réteg merev (> 800 m/s) anyagon
    const rigidAt = seg30.find(([zz, , v]) => v > 800);
    if (rigidAt && rigidAt[0] >= 5 && rigidAt[0] <= 20) { const above = seg30.filter(([zz]) => zz < rigidAt[0]); const vt = rigidAt[0] / above.reduce((a, [, t, v]) => a + t / v, 0); if (vt < 360) C = 'E'; }
    const soft = seg30.filter(([, t, v]) => v < 100).reduce((a, [, t]) => a + t, 0);
    // rajz
    const x0 = 60, w = 160, sc = 9;
    seg30.forEach(([zz, t, v]) => { const col = v > 800 ? 'var(--rock)' : v > 360 ? 'var(--soilE)' : v >= 180 ? 'var(--soilD)' : v >= 100 ? 'var(--soilA)' : 'var(--soilC)'; svg('rect', { x: x0, y: 20 + zz * sc, width: w, height: t * sc, fill: col, stroke: 'var(--surface)' }, fig); svg('text', { x: x0 + w / 2, y: 20 + (zz + t / 2) * sc + 4, 'text-anchor': 'middle', class: 't-num halo', text: `${fmt(v, 0)} m/s` }, fig); });
    for (const d of [0, 10, 20, 30]) svg('text', { x: x0 - 8, y: 24 + d * sc, 'text-anchor': 'end', class: 't-num t-s', text: `${d} m` }, fig);
    // sebesség–mélység lépcső
    const vx = (v) => 300 + Math.log10(v / 50) / Math.log10(1500 / 50) * 320;
    svg('rect', { x: 300, y: 20, width: 320, height: 270, fill: 'var(--surface2)', stroke: 'var(--line)' }, fig);
    for (const [v, lab] of [[100, '100'], [180, '180'], [360, '360'], [800, '800']]) { svg('line', { x1: vx(v), y1: 20, x2: vx(v), y2: 290, stroke: 'var(--line2)', 'stroke-dasharray': '3 3' }, fig); svg('text', { x: vx(v), y: 306, 'text-anchor': 'middle', class: 't-num t-s', text: lab }, fig); }
    svg('text', { x: 460, y: 320, 'text-anchor': 'middle', class: 't-s', text: 'nyíróhullám-sebesség, m/s (log)' }, fig);
    let pts = []; seg30.forEach(([zz, t, v]) => { pts.push([vx(v), 20 + zz * sc], [vx(v), 20 + (zz + t) * sc]); });
    svg('path', { d: pd(pts), fill: 'none', stroke: 'var(--c2)', 'stroke-width': 2.5 }, fig);
    svg('line', { x1: vx(vs30), y1: 20, x2: vx(vs30), y2: 290, stroke: 'var(--ink)', 'stroke-width': 2 }, fig);
    svg('text', { x: vx(vs30) + 5, y: 34, class: 't-num t-b halo', html: `v<tspan dy="4" font-size="75%">s,30</tspan><tspan dy="-4"> = ${fmt(vs30, 0)}</tspan>` }, fig);
    sV.set(`${fmt(vs30, 0)} m/s`, null, `${fmt(vs30, 0)}<small>m/s</small>`);
    sC.set(C, C === 'A' || C === 'B' ? 'ok' : C === 'C' ? 'warn' : 'bad');
    sA.set(`${fmt(arith, 0)} m/s`, null, `${fmt(arith, 0)}<small>m/s</small>`);
    $$('#eqClassTbl tr[data-cls]').forEach((tr) => tr.classList.toggle('on', tr.dataset.cls === C));
    vd.set(C === 'A' || C === 'B' ? 'ok' : C === 'C' ? 'warn' : 'bad', `${C} osztály`, (soft >= 10 ? 'Legalább 10 m nagyon puha (v < 100 m/s) réteg: vizsgálni kell az S<sub>1</sub> besorolást is. ' : '') + (C === 'E' ? 'Vékony puha üledék merev aljzaton: a hullám a rétegben ide-oda verődik, erős helyi felerősítés.' : C === 'D' ? 'Laza, puha talaj: nagy felerősítés (S = 1,35).' : C === 'C' ? 'Közepesen tömör talaj – Magyarországon ez a leggyakoribb.' : 'Merev talaj vagy kőzet: kis felerősítés.'));
  };
  pre.on(build); build(); onTheme(draw);
  root.append(h('div', { class: 'w-foot', html: 'v<sub>s,30</sub> = 30 / Σ(h<sub>i</sub>/v<sub>i</sub>): a hullám terjedési idejéből számolt átlag, ezért a lassú rétegek dominálnak. A táblázat sora a besorolás szerint kiemelődik.' }));
});

/* ---------------------------------------------------------------- 9. rugalmas válaszspektrum */
const SPEC = { 1: { A: [1.0, 0.15, 0.4, 2.0], B: [1.2, 0.15, 0.5, 2.0], C: [1.15, 0.2, 0.6, 2.0], D: [1.35, 0.2, 0.8, 2.0], E: [1.4, 0.15, 0.5, 2.0] }, 2: { A: [1.0, 0.05, 0.25, 1.2], B: [1.35, 0.05, 0.25, 1.2], C: [1.5, 0.1, 0.25, 1.2], D: [1.8, 0.1, 0.3, 1.2], E: [1.6, 0.05, 0.25, 1.2] } };
const Se = (T, ag, [S, TB, TC, TD]) => (T <= TB ? ag * S * (1 + (T / TB) * 1.5) : T <= TC ? ag * S * 2.5 : T <= TD ? ag * S * 2.5 * TC / T : ag * S * 2.5 * TC * TD / (T * T));
register('eq-spec', (root) => {
  const { ctrls, viz, out } = shell(root);
  const cl = seg(ctrls, { label: 'Altalajosztály', options: ['A', 'B', 'C', 'D', 'E'].map((x) => ({ v: x, t: x })), value: 'C' });
  const ty = seg(ctrls, { label: 'Spektrum típusa', options: [{ v: 1, t: '1. típus' }, { v: 2, t: '2. típus' }], value: 1 });
  const agR = slider(ctrls, { label: 'Referencia-gyorsulás', sym: 'a<sub>gR</sub>', min: 0.08, max: 0.15, step: 0.01, value: 0.12, unit: 'g', d: 2 });
  const gi = seg(ctrls, { label: 'γ<sub>I</sub>', options: [{ v: 0.8, t: '0,8' }, { v: 1.0, t: '1,0' }, { v: 1.2, t: '1,2' }, { v: 1.4, t: '1,4' }], value: 1.0 });
  const N = slider(ctrls, { label: 'Szintszám (vasbeton keret)', sym: 'N', min: 1, max: 25, step: 1, value: 5 });
  ctrls.append(h('p', { class: 'ctl-hint', html: 'A hazai nemzeti melléklet az 1. típusú spektrumot írja elő; egyes vizsgálatok szerint a 2. típus jobban illeszkedik a hazai helyi spektrumokhoz.' }));
  const fig = figure(viz, 720, 330);
  const sT = stat(out, { label: '<i>T</i><sub>1</sub> ≈ 0,075·<i>H</i><sup>0,75</sup>' }), sS = stat(out, { label: 'Gyorsulás <i>S</i><sub>e</sub>(<i>T</i><sub>1</sub>)' }), sR = stat(out, { label: 'A sziklához (A) képest' });
  const draw = () => {
    clear(fig);
    const ag = agR.v * gi.v, P = SPEC[ty.v];
    const T1 = 0.075 * (3 * N.v) ** 0.75;
    const ymax = Math.ceil(ag * 1.8 * 2.5 * 20) / 20 + 0.05;
    const c = chart(fig, { w: 720, h: 330, m: { l: 56, r: 14, t: 14, b: 42 }, x: [0, 4], y: [0, ymax], xt: [0, 0.5, 1, 1.5, 2, 3, 4], yt: samp((x) => x, 0, ymax, Math.round(ymax / 0.1)).map((p) => +p[0].toFixed(2)), xl: 'periódusidő T, s', yl: 'S<tspan dy="4" font-size="75%">e</tspan><tspan dy="-4"> [g]</tspan>' });
    for (const k of ['A', 'B', 'C', 'D', 'E']) svg('path', { d: pd(samp((T) => Se(T, ag, P[k]), 0, 4, 400).map(([x, y]) => [c.X(x), c.Y(y)])), fill: 'none', stroke: k === cl.v ? 'var(--c2)' : 'var(--line2)', 'stroke-width': k === cl.v ? 3 : 1.4 }, fig);
    const v = Se(T1, ag, P[cl.v]), vA = Se(T1, ag, P.A);
    svg('line', { x1: c.X(T1), y1: c.B, x2: c.X(T1), y2: c.Y(v), stroke: 'var(--ink)', 'stroke-dasharray': '4 3' }, fig);
    svg('circle', { cx: c.X(T1), cy: c.Y(v), r: 6, fill: 'var(--c2)', stroke: 'var(--surface)', 'stroke-width': 2 }, fig);
    svg('text', { x: c.X(T1) + 8, y: c.Y(v) - 8, class: 't-num t-b halo', text: `${N.v} szint` }, fig);
    svg('text', { x: c.X(P[cl.v][2]) + 6, y: c.Y(ag * P[cl.v][0] * 2.5) - 8, class: 't-s halo', text: `${cl.v}: plató 2,5·S·a`, style: 'fill:var(--c2)' }, fig);
    sT.set(`${fmt(T1, 2)} s`, null, `${fmt(T1, 2)}<small>s</small>`);
    sS.set(`${fmt(v, 3)} g`, null, `${fmt(v, 3)} g <small>= ${fmt(v * 9.81, 2)} m/s²</small>`);
    sR.set(`${fmt(v / vA, 2)}×`, v / vA > 1.3 ? 'bad' : v / vA > 1.05 ? 'warn' : 'ok');
  };
  [cl, ty, agR, gi, N].forEach((x) => x.on(draw)); draw(); onTheme(draw);
  root.append(h('div', { class: 'w-foot', html: '5 %-os csillapítás (η = 1). Az épület alapperiódusát a szabvány közelítő képletével becsüljük (T<sub>1</sub> = C<sub>t</sub>·H<sup>3/4</sup>, C<sub>t</sub> = 0,075 vasbeton keretre, H = 3 m/szint).' }));
});

/* ---------------------------------------------------------------- 10. Mexikóváros: a talaj saját periódusa */
register('eq-site', (root) => {
  const { ctrls, viz, out } = shell(root);
  const H = slider(ctrls, { label: 'Puha réteg vastagsága', sym: 'H', min: 5, max: 60, step: 1, value: 40, unit: 'm' });
  const vs = slider(ctrls, { label: 'Nyíróhullám-sebesség', sym: 'v<sub>s</sub>', min: 50, max: 400, step: 5, value: 80, unit: 'm/s' });
  const pre = seg(ctrls, { label: 'Előbeállítás', vert: true, options: [{ v: 'mx', t: 'Mexikóváros, tómeder' }, { v: 'hu', t: 'Alföldi üledék' }, { v: 'rk', t: 'Vékony réteg sziklán' }], value: 'mx' });
  const cv = h('canvas', { style: 'width:100%;display:block;border-radius:10px;border:1px solid var(--line)' });
  viz.append(cv);
  const fig = figure(viz, 720, 200);
  const sT = stat(out, { label: '<i>T</i><sub>0</sub> = 4·<i>H</i>/<i>v</i><sub>s</sub>' }), sN = stat(out, { label: 'Rezonáló szintszám (<i>T</i> ≈ 0,1·<i>N</i>)' });
  const vd = verdict(out);
  const BLD = [2, 4, 6, 10, 15, 20, 30];
  const amp = (T, T0) => { const r = T / T0; const z = 0.12; return 1 / Math.sqrt((1 - r * r) ** 2 + (2 * z * r) ** 2); };
  let t = 0;
  let st = null; st = fitCanvas(cv, 0.42, () => { if (st) drawB(); });
  function drawB() {
    const { ctx: g, w, h: hh } = st; if (!w) return; g.clearRect(0, 0, w, hh);
    const T0 = 4 * H.v / vs.v; const gy = hh * 0.84;
    g.fillStyle = cssVar('--soilB'); g.fillRect(0, gy, w, hh - gy);
    const gs = Math.sin(t * 2 * Math.PI / T0) * 3;
    BLD.forEach((n, i) => {
      const T = 0.1 * n, a = Math.min(amp(T, T0), 5.5);
      const x = (i + 0.5) * w / BLD.length + gs, bw = Math.min(46, w / BLD.length * 0.6), bh = 12 + (gy - 30) * n / 30;
      const sway = Math.sin(t * 2 * Math.PI / T0 - 0.6) * a * 2.2;
      g.fillStyle = a > 3 ? cssVar('--bad') : a > 1.8 ? cssVar('--warn') : cssVar('--building2');
      g.beginPath(); g.moveTo(x - bw / 2, gy); g.lineTo(x + bw / 2, gy); g.lineTo(x + bw / 2 + sway, gy - bh); g.lineTo(x - bw / 2 + sway, gy - bh); g.closePath(); g.fill();
      g.fillStyle = cssVar('--ink2'); g.font = '600 11px Manrope, sans-serif'; g.textAlign = 'center'; g.fillText(`${n} szint`, x, hh - 6); g.textAlign = 'left';
    });
  }
  const draw = () => {
    clear(fig); const T0 = 4 * H.v / vs.v;
    const c = chart(fig, { w: 720, h: 200, m: { l: 56, r: 14, t: 10, b: 38 }, x: [0, 4], y: [0, 5], xt: [0, 0.5, 1, 1.5, 2, 2.5, 3, 4], yt: [0, 1, 2, 3, 4, 5], xl: 'épület periódusideje T ≈ 0,1·N, s', yl: 'felerősítés' });
    svg('path', { d: pd(samp((T) => Math.min(amp(T, T0), 5), 0.02, 4, 300).map(([x, y]) => [c.X(x), c.Y(y)])), fill: 'none', stroke: 'var(--c2)', 'stroke-width': 2.4 }, fig);
    for (const n of BLD) { const T = 0.1 * n; if (T > 4) continue; svg('circle', { cx: c.X(T), cy: c.Y(Math.min(amp(T, T0), 5)), r: 4.5, fill: 'var(--ink)' }, fig); }
    const Nres = T0 / 0.1;
    sT.set(`${fmt(T0, 2)} s`, null, `${fmt(T0, 2)}<small>s</small>`); sN.set(`≈ ${fmt(Nres, 0)} szint`, null, `≈ ${fmt(Nres, 0)}`);
    vd.set(T0 > 1 ? 'bad' : T0 > 0.4 ? 'warn' : 'ok', T0 > 1 ? 'Hosszú periódusú talaj' : T0 > 0.4 ? 'Közepes periódus' : 'Rövid periódus', T0 > 1 ? 'A magasabb, karcsú épületek kerülnek rezonanciába. Mexikóvárosban a sérülő épületek periódusa a rázás közben megnyúlt, így a 6–15 szintes házak a 2 s körüli mozgás közelébe kerültek.' : T0 > 0.4 ? 'A közepes (3–8 szintes) épületek a veszélyeztetettek.' : 'Az alacsony, merev épületek a veszélyeztetettek; a magas épületeket kevésbé rázza.');
    drawB();
  };
  pre.on((v) => { if (v === 'mx') { H.set(40, false); vs.set(80, false); } else if (v === 'hu') { H.set(30, false); vs.set(220, false); } else { H.set(8, false); vs.set(180, false); } draw(); });
  [H, vs].forEach((x) => x.on(draw)); draw(); onTheme(draw);
  loop(cv, (tt, dt) => { t += dt; drawB(); });
});

/* ---------------------------------------------------------------- 11. folyósodás */
register('eq-liq', (root) => {
  const { ctrls, viz, out } = shell(root);
  const csr = slider(ctrls, { label: 'A rázás erőssége (ciklikus nyírófeszültség-arány)', sym: 'CSR', min: 0.05, max: 0.4, step: 0.01, value: 0.12, d: 2 });
  const dr = seg(ctrls, { label: 'Homok tömörsége', options: [{ v: 0.1, t: 'laza' }, { v: 0.17, t: 'közepes' }, { v: 0.35, t: 'tömör' }], value: 0.1 });
  const sat = toggle(ctrls, { label: 'telített (magas talajvíz)', value: true });
  const go = h('button', { class: 'btn', type: 'button' }, '▶ Rázás indítása'); ctrls.append(go);
  const grid = h('div', { class: 'grid2' });
  const cv = h('canvas', { style: 'width:100%;display:block;border-radius:10px;border:1px solid var(--line)' });
  const right = h('div', {}); grid.append(h('div', {}, cv), right); viz.append(grid);
  const fig = figure(right, 380, 260);
  const sN = stat(out, { label: 'Ciklusszám a folyósodásig' }), sU = stat(out, { label: 'Pórusvíznyomás-arány <i>r</i><sub>u</sub>' });
  const vd = verdict(out);
  let n = 0, run = false, t = 0;
  const NL = () => (sat.v ? 15 * (dr.v / csr.v) ** (1 / 0.34) : Infinity);
  const ru = (N) => { const nl = NL(); if (!isFinite(nl)) return 0; const x = Math.min(1, N / nl); return (2 / Math.PI) * Math.asin(x ** (1 / 1.4)); };
  let st = null; st = fitCanvas(cv, 0.72, () => { if (st) drawS(); });
  function drawS() {
    const { ctx: g, w, h: hh } = st; if (!w) return; g.clearRect(0, 0, w, hh);
    const u = ru(n), liq = u >= 0.999;
    const gy = hh * 0.32; const shake = run ? Math.sin(t * 25) * 3 : 0;
    g.fillStyle = cssVar('--sky'); g.fillRect(0, 0, w, gy);
    g.fillStyle = cssVar('--soilA'); g.fillRect(0, gy, w, hh - gy);
    if (sat.v) { g.fillStyle = cssVar('--water-fill'); g.fillRect(0, gy + 14, w, hh - gy - 14); g.strokeStyle = cssVar('--water'); g.setLineDash([5, 4]); g.beginPath(); g.moveTo(0, gy + 14); g.lineTo(w, gy + 14); g.stroke(); g.setLineDash([]); }
    // pórusvíznyomás színezés
    if (u > 0) { g.fillStyle = `rgba(80,140,255,${0.35 * u})`; g.fillRect(0, gy + 20, w, hh * 0.45); }
    // ház
    const sink = liq ? Math.min(1, (n - NL()) / 6) : 0; const tilt = sink * 0.12;
    g.save(); g.translate(w / 2 + shake, gy + sink * hh * 0.12); g.rotate(tilt);
    g.fillStyle = cssVar('--concrete'); g.fillRect(-w * 0.17, -4, w * 0.34, 10);
    g.fillStyle = cssVar('--building'); g.fillRect(-w * 0.14, -hh * 0.22, w * 0.28, hh * 0.22 - 4);
    g.strokeStyle = cssVar('--ink2'); g.strokeRect(-w * 0.14, -hh * 0.22, w * 0.28, hh * 0.22 - 4);
    g.fillStyle = cssVar('--brick'); g.beginPath(); g.moveTo(-w * 0.16, -hh * 0.22); g.lineTo(0, -hh * 0.31); g.lineTo(w * 0.16, -hh * 0.22); g.fill();
    g.restore();
    // homokbuzgárok
    if (liq) { g.fillStyle = cssVar('--soilD'); for (const x of [0.12, 0.85, 0.72]) { g.beginPath(); g.moveTo(w * x - 14, gy); g.quadraticCurveTo(w * x, gy - 10 * sink - 4, w * x + 14, gy); g.fill(); } }
  }
  const drawP = () => {
    clear(fig);
    const nl = NL(); const nmax = isFinite(nl) ? Math.max(20, Math.ceil(nl * 1.3 / 10) * 10) : 30;
    const c = chart(fig, { w: 380, h: 260, m: { l: 44, r: 10, t: 12, b: 38 }, x: [0, nmax], y: [0, 1.05], xt: samp((x) => x, 0, nmax, 5).map((p) => Math.round(p[0])), yt: [0, 0.25, 0.5, 0.75, 1], xl: 'ciklusszám', yl: 'r<tspan dy="4" font-size="75%">u</tspan>' });
    svg('line', { x1: c.L, y1: c.Y(1), x2: c.R, y2: c.Y(1), stroke: 'var(--bad)', 'stroke-dasharray': '5 4' }, fig);
    svg('path', { d: pd(samp(ru, 0, nmax, 200).map(([x, y]) => [c.X(x), c.Y(y)])), fill: 'none', stroke: 'var(--c2)', 'stroke-width': 2.4 }, fig);
    svg('circle', { cx: c.X(Math.min(n, nmax)), cy: c.Y(ru(n)), r: 6, fill: 'var(--c2)', stroke: 'var(--surface)', 'stroke-width': 2 }, fig);
    sN.set(isFinite(nl) ? `${fmt(nl, 0)}` : 'nem folyósodik', isFinite(nl) ? (nl < 15 ? 'bad' : nl < 40 ? 'warn' : 'ok') : 'ok');
    sU.set(fmt(ru(n), 2), ru(n) >= 0.999 ? 'bad' : ru(n) > 0.6 ? 'warn' : null);
    const u = ru(n);
    vd.set(!sat.v ? 'ok' : u >= 0.999 ? 'bad' : isFinite(nl) && nl < 15 ? 'warn' : 'ok', !sat.v ? 'Száraz homok nem folyósodik' : u >= 0.999 ? 'Folyósodás!' : isFinite(nl) && nl < 15 ? 'Egy erős rengés néhány tucat ciklusa elég lehet' : 'Kis veszély', !sat.v ? 'A folyósodáshoz telített talaj kell: a víz nem tud elszökni, ezért nő meg a nyomása.' : u >= 0.999 ? 'A pórusvíznyomás elérte a hatékony feszültséget: a talaj elveszítette a nyírószilárdságát, a ház megsüllyed és megdől, a felszínen homokbuzgárok törnek fel.' : 'A tömörebb homok vagy a gyengébb rázás több ciklust igényel – egy rengés ennyit nem biztos, hogy kiad.');
  };
  [csr, dr, sat].forEach((x) => x.on(() => { n = 0; run = false; drawP(); drawS(); }));
  go.addEventListener('click', () => { n = 0; run = true; });
  loop(cv, (tt, dt) => { t += dt; if (run) { n += dt * 6; if (n > (isFinite(NL()) ? NL() + 8 : 40)) run = false; drawP(); } drawS(); });
  drawP(); onTheme(() => { drawP(); drawS(); });
  root.append(h('div', { class: 'w-foot', html: 'Szemléltető modell: a pórusvíznyomás a ciklusszámmal a laboratóriumi kísérletekből ismert alakban nő; a folyósodáshoz szükséges ciklusszám a homok tömörségétől és a rázás erősségétől függ.' }));
});

/* ---------------------------------------------------------------- kvíz */
defineQuiz('eq', 'Kvíz – földrengések', [
  { q: 'Mi a hipocentrum?', a: ['A Föld mélyében az a pont, ahol a kőzet törése megindul', 'A fészek fölötti felszíni pont', 'A legnagyobb kár helye', 'A legközelebbi mérőállomás'], c: 0, e: 'A hipocentrum (fészek) a törés kiindulópontja; az epicentrum a fölötte lévő felszíni pont, a kettő távolsága a fészekmélység.' },
  { q: 'Milyen mély a földrengések döntő többsége?', a: ['Legfeljebb 30 km', '100–200 km', 'Mindig 600–700 km', 'Néhány méter'], c: 0, e: 'A fészekmélység néhány km-től 600–700 km-ig terjedhet, de a rengések döntő többsége legfeljebb 30 km mély.' },
  { q: 'Mi a különbség a magnitúdó és az intenzitás között?', a: ['A magnitúdó a felszabadult energia, az intenzitás a hatás erőssége egy adott helyen', 'Ugyanazt jelentik', 'Az intenzitás a fészekmélység mértéke', 'A magnitúdó a kár nagysága forintban'], c: 0, e: 'Egy rengésnek egy magnitúdója, de helyenként más-más intenzitása van; az intenzitás a fészektől távolodva csökken.' },
  { q: 'Hányszor több energia szabadul fel egy 6-os, mint egy 5-ös magnitúdójú rengésben?', a: ['Kb. 32-szer', 'Kétszer', 'Tízszer', 'Ugyanannyi'], c: 0, e: 'Egy egységnyi magnitúdó tízszeres kitérést és 10^1,5 ≈ 32-szeres energiát jelent.' },
  { q: 'Milyen rengésre kell tervezni az EC8 szerint?', a: ['Amely 50 év alatt 10 % valószínűséggel bekövetkezik (≈ 475 év visszatérési idő)', 'A valaha volt legnagyobbra', 'Amely évente bekövetkezik', 'Csak 7-es magnitúdó felett kell tervezni'], c: 0, e: 'A tervezési rengés 50 év alatt 10 % valószínűséggel lép fel – ez kb. 475 éves visszatérési idő –, és rendkívüli hatásnak számít.' },
  { q: 'Milyen tartományban van Magyarországon a referencia-talajgyorsulás (<i>a</i><sub>gR</sub>)?', a: ['0,08–0,15 g', '0,5–1,0 g', '0,001–0,005 g', '1,5–3,0 g'], c: 0, e: 'A hazai talajgyorsulási térkép öt zónája 0,08; 0,10; 0,12; 0,14 és 0,15 g.' },
  { q: 'Mi alapján soroljuk az altalajt az EC8 osztályaiba?', a: ['A felső 30 m nyíróhullám-sebessége (<i>v</i><sub>s,30</sub>), az <i>N</i><sub>SPT</sub> és a <i>c</i><sub>u</sub> alapján', 'A talajvízszint mélysége alapján', 'Az épület magassága alapján', 'Csak a felszíni réteg színe alapján'], c: 0, e: 'A besorolás az építmény alatti 30 m-es zóna alapján történik; Magyarországon a talajok nagyrészt C és D osztályúak.' },
  { q: 'Miért dőltek össze 1985-ben Mexikóvárosban főleg a közepes magasságú házak?', a: ['A puha tómeder-agyag saját periódusa (≈ 2 s) közel esett az épületekéhez – rezonancia', 'Mert a fészek közvetlenül a város alatt volt', 'Mert ott földcsuszamlás volt', 'Mert ezek fából épültek'], c: 0, e: 'A tómeder 4–5-ször felerősítette a rázást, és a 2 s körüli periódusú mozgás a 6–15 szintes épületeket hozta rezonanciába.' },
  { q: 'Mi a folyósodás feltétele?', a: ['Laza, telített homok és ciklikus nyírás, amely megemeli a pórusvíznyomást', 'Kemény agyag és száraz időjárás', 'Sziklás altalaj', 'Fagyott talaj'], c: 0, e: 'A telített laza homokban a pórusvíz nem tud elszökni; a nyomása eléri a hatékony feszültséget, a talaj elveszíti a szilárdságát (S<sub>2</sub> osztály).' },
]);
