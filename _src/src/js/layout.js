/* ================= ELRENDEZÉS (formázás skill 5. pont) =================
 * 1) Kétoszlopos blokkok kiegyenlítése: ha egy szöveg + ábra/doboz pár egyik oldala jóval magasabb,
 *    az oszlopok arányát (36–64 %) úgy állítja, hogy a két oszlop közel azonos magas legyen.
 * 2) Teli kártyasorok: ha egy kártyarács utolsó sora hiányos, olyan oszlopszámot választ, amellyel
 *    minden sor tele van (a kártyák legfeljebb kicsit keskenyebbek lehetnek); kétoszlopos rácsban
 *    páratlan elemszámnál az utolsó elem kitölti a sort.
 * 3) Lyukas sorkizárás: ha egy sorkizárt bekezdésben a szóközök túl szélesek (keskeny doboz),
 *    a bekezdés balra zárt lesz (.rag).
 * Csak stílus-attribútumot és osztályt ír, szöveget nem – az elválasztó őrt nem indítja újra.
 */
export const LAYOUT = (() => {
  const EXCL = '.vcard, .ytc, .ytm, .w, .w-body, .w-ctrls, .seg, .seg-btns, .lab, .game, svg, table, [data-nobal], header, nav, footer, .topbar, .menu, .vmodal, .modal, .lightbox, .quiz, .q-opts, .tf-btns, .chips, .sim, .rail, .strip, .stats, .hero-stats, .facts-mini';
  const RAGSEL = 'main p, main li, main .note, main .verdict, footer p, .hero-lead, main .lead, main .ch-lead';
  const vis = (e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed';
  const tracks = (cs) => cs.gridTemplateColumns.split(' ').filter((x) => parseFloat(x) > 0);
  const kidsOf = (g) => [...g.children].filter((k) => vis(k) && !['absolute', 'fixed'].includes(getComputedStyle(k).position));
  const wide = () => innerWidth >= 1000;
  const last = new WeakMap();
  /* ---- 1) kétoszlopos kiegyenlítés ---- */
  function pairs() {
    const out = [];
    document.querySelectorAll('body *').forEach((g) => {
      if (!vis(g) || g.closest(EXCL)) return; const cs = getComputedStyle(g); if (cs.display !== 'grid' && !g.classList.contains('bal-float')) return;
      if (!g.dataset.balanced && !g.classList.contains('bal-float') && tracks(cs).length !== 2) return; const ks = kidsOf(g); if (ks.length !== 2) return;
      if (g.getBoundingClientRect().width < 700) return; if (ks.some((k) => getComputedStyle(k).position === 'sticky')) return;
      // két egyforma kártya (azonos elem és osztály) egyforma magas kártyasor marad – nem kiegyenlítjük
      const c0 = (ks[0].className || '').split(' ')[0], c1 = (ks[1].className || '').split(' ')[0]; if (ks[0].tagName === ks[1].tagName && c0 && c0 === c1) return;
      out.push([g, ks]); });
    return out;
  }
  function measure(g, ks, f) { g.style.gridTemplateColumns = `minmax(0, ${f.toFixed(3)}fr) minmax(0, ${(1 - f).toFixed(3)}fr)`; return ks.map((k) => k.getBoundingClientRect().height); }
  const textLen = (k) => [...k.querySelectorAll('p, li, figcaption, .caption')].reduce((a, q) => a + q.textContent.length, 0);
  function unfloat(g) {
    if (!g.classList.contains('bal-float')) return; const fl = g.querySelector(':scope > .bal-fl');
    if (fl) { fl.classList.remove('bal-fl', 'bal-fl-r', 'bal-fl-l'); fl.style.width = ''; if (fl.__balNext !== undefined) { g.insertBefore(fl, fl.__balNext && fl.__balNext.parentNode === g ? fl.__balNext : null); } }
    g.classList.remove('bal-float');
  }
  function balanceOne(g, ks) {
    unfloat(g); ks = kidsOf(g); if (ks.length !== 2) return;
    if (!wide()) { if (g.dataset.balanced) { g.style.gridTemplateColumns = ''; delete g.dataset.balanced; } return; }
    const prevAlign = g.style.alignItems; g.style.alignItems = 'start';
    g.style.gridTemplateColumns = ''; const cs = getComputedStyle(g); const tw = tracks(cs).map(parseFloat);
    if (tw.length !== 2) { g.style.alignItems = prevAlign; return; }
    const f0 = tw[0] / (tw[0] + tw[1]); const h0 = ks.map((k) => k.getBoundingClientRect().height); const d0 = Math.abs(h0[0] - h0[1]);
    const done = () => last.set(g, kidsOf(g).map((k) => Math.round(k.getBoundingClientRect().height)).join('/') + '@' + Math.round(g.getBoundingClientRect().width));
    if (Math.min(...h0) < 40 || d0 < Math.max(40, 0.1 * Math.max(...h0))) { g.style.alignItems = prevAlign; delete g.dataset.balanced; done(); return; }
    const tl = ks.map(textLen); const media = ks.map((k, i) => tl[i] < 40 && !!k.querySelector('img, svg, canvas, video, iframe, picture'));
    // a csak képet/videót tartalmazó oszlop keskenyebb is lehet (28 %), a szöveges legalább 34 %
    const lo = Math.max(media[0] ? 0.28 : 0.34, f0 - 0.26), hi = Math.min(media[1] ? 0.72 : 0.66, f0 + 0.26);
    // cél: kicsi magasságkülönbség (üres folt) és kompakt blokk
    const score = (h) => Math.abs(h[0] - h[1]) + 0.35 * Math.max(h[0], h[1]);
    const s0 = score(h0); let best = [f0, s0];
    for (let f = lo; f <= hi + 1e-9; f += 0.04) { const h = measure(g, ks, f); const sc = score(h); if (sc < best[1] - 1) best = [f, sc]; }
    for (const f of [best[0] - 0.02, best[0] + 0.02]) { if (f < lo - 1e-9 || f > hi + 1e-9) continue; const h = measure(g, ks, f); const sc = score(h); if (sc < best[1] - 1) best = [f, sc]; }
    g.style.alignItems = prevAlign;
    if (best[1] < s0 - Math.max(12, 0.08 * s0) && Math.abs(best[0] - f0) > 0.015) { measure(g, ks, best[0]); g.dataset.balanced = '1'; } else { g.style.gridTemplateColumns = ''; delete g.dataset.balanced; }
    // ha a szöveges oldal így is jóval hosszabb: a másik elem úszik, a szöveg körbefolyja, alatta teljes szélességben folytatódik
    const h1 = ks.map((k) => k.getBoundingClientRect().height); const ti = tl[0] >= tl[1] ? 0 : 1, bi = 1 - ti;
    const tk = ks[ti], bk = ks[bi], tcs = getComputedStyle(tk);
    if (h1[ti] - h1[bi] > Math.max(80, 0.18 * h1[ti]) && tl[ti] > 400 && tcs.display === 'block' && !bk.querySelector('canvas') && !g.hasAttribute('data-nofloat')) {
      const bw = bk.getBoundingClientRect().width; g.style.gridTemplateColumns = ''; delete g.dataset.balanced;
      bk.__balNext = bk.nextElementSibling; g.classList.add('bal-float'); bk.classList.add('bal-fl', bi === 1 ? 'bal-fl-r' : 'bal-fl-l');
      bk.style.width = Math.round(Math.min(bw, g.getBoundingClientRect().width * 0.46)) + 'px';
      if (bi === 1) g.insertBefore(bk, tk);
    }
    done();
  }
  /* ---- 2) teli kártyasorok ---- */
  function fill() {
    document.querySelectorAll('body *').forEach((g) => {
      if (!vis(g) || g.closest(EXCL)) return; const cs = getComputedStyle(g); if (cs.display !== 'grid') return;
      if (g.dataset.filled) { g.style.gridTemplateColumns = ''; delete g.dataset.filled; }
      const ks = kidsOf(g); const n = ks.length; ks.forEach((k) => { if (k.dataset.spanfill) { k.style.gridColumn = ''; delete k.dataset.spanfill; } });
      const tw = tracks(getComputedStyle(g)).map(parseFloat); const c = tw.length; if (c < 2 || n < 3 || n % c === 0) return;
      if (ks.some((k) => { const q = getComputedStyle(k); return k.style.gridColumn || q.gridColumnStart !== 'auto' || q.gridColumnEnd !== 'auto' || q.gridRowStart !== 'auto' || q.gridRowEnd !== 'auto'; })) return;
      const gap = parseFloat(cs.columnGap) || 0, W = g.getBoundingClientRect().width, cw = tw[0];
      let pick = 0;
      for (let d = 1; d <= 3 && !pick; d++) for (const c2 of [c + d, c - d]) { if (pick || c2 < 2 || n % c2) continue; const w2 = (W - gap * (c2 - 1)) / c2; if (w2 >= cw * 0.72 && w2 <= cw * 2.2) pick = c2; }
      if (pick) { g.style.gridTemplateColumns = `repeat(${pick}, minmax(0, 1fr))`; g.dataset.filled = '1'; }
      else if (c === 2) { const k = ks[n - 1]; k.style.gridColumn = '1 / -1'; k.dataset.spanfill = '1'; }
    });
  }
  /* ---- 3) lyukas sorkizárás → balra zárás ---- */
  function ragOne(el) {
    el.classList.remove('rag'); const cs = getComputedStyle(el); if (cs.textAlign !== 'justify' || cs.display === 'none') return;
    const fs = parseFloat(cs.fontSize); const all = document.createRange(); all.selectNodeContents(el); const rs = all.getClientRects(); if (rs.length < 2) return;
    const lastTop = Math.max(...Array.from(rs).map((r) => r.top)); let big = 0, mid = 0;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const t = n.nodeValue; for (let i = 0; i < t.length; i++) { if (t[i] !== ' ') continue; const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const b = r.getBoundingClientRect(); if (!b.width || b.top >= lastTop - 2) continue; if (b.width > fs * 1.15) big++; else if (b.width > fs * 0.9) mid++; } }
    if (big || mid >= 2) el.classList.add('rag');
  }
  const rag = () => document.querySelectorAll(RAGSEL).forEach((e) => { if (vis(e)) ragOne(e); });
  /* ---- futtatás ---- */
  let busy = false;
  async function runAll() {
    if (busy) return; busy = true;
    try { fill(); const ps = pairs(); for (const [g, ks] of ps) { balanceOne(g, ks); await new Promise((r) => setTimeout(r, 0)); } fill(); rag(); } catch (e) { console.error('Elrendezés', e); }
    busy = false;
  }
  // tartalom-változás (lusta widget, kép, elválasztás) után újra
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver((es) => {
    const gs = new Set(); es.forEach((e) => { const g = e.target.parentElement; if (g && g.dataset.balwatch && !g.classList.contains('bal-float')) gs.add(g); });
    gs.forEach((g) => { const ks = kidsOf(g); if (ks.length !== 2) return; const sig = ks.map((k) => Math.round(k.getBoundingClientRect().height)).join('/') + '@' + Math.round(g.getBoundingClientRect().width); const prev = last.get(g); if (prev === sig) return;
      if (prev) { const [a, b] = [prev.split('@')[0].split('/').map(Number), sig.split('@')[0].split('/').map(Number)]; if (prev.split('@')[1] === sig.split('@')[1] && Math.abs(a[0] - b[0]) < 24 && Math.abs(a[1] - b[1]) < 24) return; }
      requestAnimationFrame(() => { balanceOne(g, ks); ks.forEach((k) => k.querySelectorAll(RAGSEL).forEach(ragOne)); }); });
  }) : null;
  function watch() { if (!ro) return; pairs().forEach(([g, ks]) => { if (g.dataset.balwatch) return; g.dataset.balwatch = '1'; ks.forEach((k) => ro.observe(k)); }); }
  function start() {
    const go = () => { runAll().then(watch); };
    if (document.readyState === 'complete') setTimeout(go, 300); else addEventListener('load', () => setTimeout(go, 300));
    let iv = setInterval(() => { if (window.__fmtHyphReady) { clearInterval(iv); requestAnimationFrame(go); } }, 150); setTimeout(() => clearInterval(iv), 9000);
    setTimeout(go, 2500);
    let tm = 0; addEventListener('resize', () => { clearTimeout(tm); tm = setTimeout(go, 300); });
    document.addEventListener('click', () => { clearTimeout(tm); tm = setTimeout(rag, 150); });
  }
  return { start, runAll, rag };
})();
