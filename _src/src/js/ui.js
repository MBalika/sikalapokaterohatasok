// Oldalkeret: téma, csatorna-navigáció, szeizmogram-csík, fejezetfejek, videók, BME-kártya, galéria, fülek, kvíz,
// igaz/hamis, fogalomtár, megjelenés görgetéskor, formázás-őr
import { $, $$, h, fireTheme, GUARD, cssVar, clamp, onTheme } from './core.js';
import { CHAPTERS, VIDEOS, YT } from './data.js';

/* ---------------------------------------------------------------- téma */
function initTheme() {
  const root = document.documentElement;
  try { const t = localStorage.getItem('hz-theme'); if (t === 'dark' || t === 'light') root.dataset.theme = t; } catch (e) { /* */ }
  const btn = $('#themeBtn');
  if (!btn) return;
  const isD = () => root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const paint = () => {
    btn.innerHTML = isD()
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>';
    btn.setAttribute('aria-label', isD() ? 'Világos téma' : 'Sötét téma');
  };
  btn.addEventListener('click', () => {
    root.dataset.theme = isD() ? 'light' : 'dark';
    try { localStorage.setItem('hz-theme', root.dataset.theme); } catch (e) { /* */ }
    paint(); fireTheme();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', paint);
  paint();
}

/* ---------------------------------------------------------------- jelalakok (csatornánként) */
// y ∈ [−1, 1] a t idő (s) függvényében; determinisztikus „zaj”
const nz = (t, s = 1) => Math.sin(t * 13.1 * s + 1.3) * 0.5 + Math.sin(t * 29.7 * s + 0.4) * 0.3 + Math.sin(t * 71.3 * s + 2.1) * 0.2;
export const WAVES = {
  calm: (t) => 0.06 * nz(t),
  vib: (t) => { const ph = t % 6; const on = ph < 4.2 ? Math.min(1, ph / 0.4, (4.2 - ph) / 0.4) : 0; return on * (0.62 * Math.sin(t * 2 * Math.PI * 2.6) + 0.12 * Math.sin(t * 2 * Math.PI * 7.8)) + 0.05 * nz(t); },
  quake: (t) => { const ph = t % 11; let y = 0.05 * nz(t);
    if (ph > 1.5) { const a = ph - 1.5; y += 0.32 * Math.exp(-a * 1.4) * Math.sin(a * 2 * Math.PI * 4.5) * Math.min(1, a * 8); }
    if (ph > 3.2) { const a = ph - 3.2; y += 0.95 * Math.exp(-a * 0.55) * Math.sin(a * 2 * Math.PI * 1.6 + Math.sin(a * 3)) * Math.min(1, a * 4); }
    return y; },
  drop: (t) => { const ph = t % 9; let y = 0.05 * nz(t); if (ph > 3) y -= 0.75 * (1 - Math.exp(-(ph - 3) * 6)) + 0.06 * (ph - 3); return y + 0.35; },
  flow: (t) => { const ph = t % 10; return 0.25 + 0.08 * Math.sin(t * 1.3) + 0.05 * nz(t) - 0.06 * ph - (ph > 6 ? 0.22 : 0) * Math.min(1, (ph - 6) * 4); },
  heave: (t) => { const ph = t % 10; const up = ph < 7 ? ph / 7 : 1 - (ph - 7) / 3; return -0.55 + 1.05 * (up * up * (3 - 2 * up)) + 0.04 * nz(t); },
  swell: (t) => 0.62 * Math.sin((t / 4.75) * 2 * Math.PI) + 0.04 * nz(t), // évszakos duzzadás–zsugorodás
};
const READ = {
  calm: () => '—',
  vib: (y, t) => (t % 6 < 4.2 ? 'f ≈ 26 Hz' : 'szünet'),
  quake: (y, t) => { const ph = t % 11; return ph < 1.5 ? 'nyugalom' : ph < 3.2 ? 'P-hullám' : ph < 7 ? 'S-hullám' : 'lecsengés'; },
  drop: (y, t) => { const ph = t % 9; return ph < 3 ? 'Δs = 0' : 'beszakadás'; },
  flow: (y, t) => (t % 10 < 6 ? 'apad' : 'kimosás'),
  heave: (y, t) => (t % 10 < 7 ? 'fagy: emelkedik' : 'olvad'),
};
/** egy jelalak SVG-útvonala w × h dobozba */
export function tracePath(wave, w, h, t0 = 0, dur = 11, n = 600) {
  const f = WAVES[wave] || WAVES.calm; let d = '';
  for (let i = 0; i <= n; i++) { const t = t0 + (i / n) * dur; const y = h / 2 - f(t) * h * 0.44; d += (i ? 'L' : 'M') + (i / n * w).toFixed(1) + ' ' + y.toFixed(1); }
  return d;
}
function miniWave(wave) { return `<svg viewBox="0 0 52 26" aria-hidden="true"><path d="${tracePath(wave, 52, 26, wave === 'quake' ? 2.6 : 0.3, wave === 'quake' ? 5 : 6, 80)}" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`; }

/* ---------------------------------------------------------------- navigáció */
let CUR = null;
function initNav() {
  const chs = CHAPTERS.map((c) => ({ ...c, el: document.getElementById(c.id) })).filter((c) => c.el);
  const topnav = $('#topnav'), list = $('#navlist'), foot = $('#footnav'), chipBox = $('#heroChips');
  for (const c of chs) {
    const col = `var(--${c.c})`;
    topnav?.append(h('a', { href: '#' + c.id, 'data-ch': c.id, style: `--c:${col}` }, h('small', {}, c.no), c.nav));
    list?.append(h('a', { href: '#' + c.id, 'data-ch': c.id, style: `--c:${col};color:var(--ink)`, html: `<span style="color:${col}">${miniWave(c.wave)}</span><span><small>${c.no} · ${c.k}</small>${c.t}</span>` }));
    foot?.append(h('a', { href: '#' + c.id }, c.t));
    if (chipBox && /^CH[1-5]$/.test(c.no)) chipBox.append(h('a', { href: '#' + c.id, style: `--c:${col}` }, h('i'), c.nav));
    if (chipBox && c.no === 'CH5') chipBox.append(h('a', { class: 'ext', href: 'https://kedvezotlen-altalaj.vercel.app/#terfogatvaltozo', target: '_blank', rel: 'noopener', title: 'Részletesen az Alapozás kedvezőtlen altalajon oldalon', style: '--c:var(--c7)' }, h('i'), 'Duzzadó agyag ↗'));
    c.el.style.setProperty('--c', col);
  }
  const sheet = $('#navsheet');
  $('#menuBtn')?.addEventListener('click', () => { sheet.hidden = false; });
  sheet?.addEventListener('click', (e) => { if (e.target === sheet || e.target.closest('a')) sheet.hidden = true; });
  const upd = () => {
    const y = scrollY + innerHeight * 0.32;
    let i = -1;
    for (let k = 0; k < chs.length; k++) if (chs[k].el.offsetTop <= y) i = k;
    const c = i >= 0 ? chs[i] : null;
    if (CUR === c) return;
    CUR = c;
    $$('[data-ch]').forEach((el) => el.classList.toggle('on', !!c && el.dataset.ch === c.id));
    document.documentElement.style.setProperty('--ch', c ? `var(--${c.c})` : 'var(--pen)');
    const lbl = $('#stripLbl'); if (lbl) lbl.textContent = c ? `${c.no} · ${c.t}` : 'Mérőállomás · készenlét';
  };
  addEventListener('scroll', upd, { passive: true });
  addEventListener('resize', upd);
  upd();
  initJump();
}

/* ---------------------------------------------------------------- szeizmogram-csík a fejléc alatt */
function initStrip() {
  const cv = $('#stripCv'); if (!cv) return;
  const g = cv.getContext('2d');
  const val = $('#stripVal');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1;
  const rs = () => { dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
  addEventListener('resize', rs); rs();
  const speed = 70; // px/s
  let last = 0, lastRead = '';
  const draw = (now) => {
    const t = now / 1000;
    const wave = CUR ? CUR.wave : 'calm';
    const f = WAVES[wave];
    g.clearRect(0, 0, W, H);
    const col = cssVar('--ch') || '#c8321f';
    g.strokeStyle = cssVar('--line'); g.lineWidth = 1; g.setLineDash([2, 6]);
    g.beginPath(); g.moveTo(0, H / 2 + 0.5); g.lineTo(W, H / 2 + 0.5); g.stroke(); g.setLineDash([]);
    g.strokeStyle = col; g.lineWidth = 1.6; g.lineJoin = 'round'; g.beginPath();
    const head = W - 170 > 200 ? W - 170 : W - 20; // a toll helye (a kijelző előtt)
    for (let x = 0; x <= head; x += 2) { const tt = t - (head - x) / speed; const y = H / 2 - f(tt) * H * 0.42; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
    const yh = H / 2 - f(t) * H * 0.42;
    g.fillStyle = col; g.beginPath(); g.arc(head, yh, 3, 0, 7); g.fill();
    const r = READ[wave](f(t), t); if (r !== lastRead && val) { lastRead = r; const vg = val.getContext('2d'); const d2 = Math.min(2, devicePixelRatio || 1); if (val.width !== 96 * d2) { val.width = 96 * d2; val.height = 16 * d2; } vg.setTransform(d2, 0, 0, d2, 0, 0); vg.clearRect(0, 0, 96, 16); vg.font = '500 11px "DM Mono", monospace'; vg.fillStyle = col; vg.textBaseline = 'middle'; vg.fillText(r.toUpperCase(), 0, 8.5); }
  };
  onTheme(() => { lastRead = ''; });
  const loopf = (now) => { if (!document.hidden && now - last > 33) { draw(now); last = now; } if (!reduce) requestAnimationFrame(loopf); };
  if (reduce) draw(5000); else requestAnimationFrame(loopf);
  addEventListener('scroll', () => { if (reduce) draw(5000); }, { passive: true });
}

/* ---------------------------------------------------------------- fejezetfejek: jelalak-rajz */
function initHeads() {
  for (const c of CHAPTERS) {
    const s = document.getElementById(c.id); if (!s) continue;
    const box = $('.ch-trace', s); if (!box) continue;
    box.setAttribute('viewBox', '0 0 1200 70'); box.setAttribute('preserveAspectRatio', 'none');
    box.innerHTML = `<path class="base" d="M0 35H1200"/><path class="draw" d="${tracePath(c.wave, 1200, 70, c.wave === 'quake' ? 0.6 : 0.2, c.wave === 'vib' ? 5 : 10.4, 900)}"/>`;
    const p = $('.draw', box); try { box.style.setProperty('--len', Math.ceil(p.getTotalLength() + 10)); } catch (e) { /* */ }
  }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
  $$('.ch-head').forEach((el) => io.observe(el));
}

/* ---------------------------------------------------------------- pontos ugrás a belső linkekre */
let jumpTok = 0;
function jumpTo(el, push) {
  const tok = ++jumpTok;
  const off = () => ($('.topbar')?.offsetHeight || 90) + 10;
  const go = () => { const y = scrollY + el.getBoundingClientRect().top - off(); window.scrollTo({ top: Math.max(0, y), behavior: 'instant' }); };
  go();
  if (push && el.id) try { history.pushState(null, '', '#' + el.id); } catch (e) { /* */ }
  const t0 = performance.now(); let stable = 0;
  const cancel = () => { jumpTok++; };
  const opts = { once: true, passive: true };
  addEventListener('wheel', cancel, opts); addEventListener('touchstart', cancel, opts); addEventListener('keydown', cancel, opts);
  const tick = () => {
    if (tok !== jumpTok) return;
    const d = el.getBoundingClientRect().top - off();
    if (Math.abs(d) > 2) { go(); stable = 0; } else stable++;
    if (performance.now() - t0 < 3000 && stable < 45) requestAnimationFrame(tick);
    else { removeEventListener('wheel', cancel); removeEventListener('touchstart', cancel); removeEventListener('keydown', cancel); }
  };
  requestAnimationFrame(tick);
}
function initJump() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    const el = id && document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    jumpTo(el, true);
  });
  addEventListener('popstate', () => { const el = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el) jumpTo(el, false); });
  if (location.hash) {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el) addEventListener('load', () => jumpTo(el, false), { once: true });
  }
}

/* ---------------------------------------------------------------- saját videók */
const VMAP = Object.fromEntries(VIDEOS.map((v) => [v.n, v]));
const order = VIDEOS.map((v) => v.n); let curIdx = 0;
const thumb = (v) => h('div', { class: 'vthumb' }, h('img', { src: `img/thumb/${v.n}.jpg`, alt: '', loading: 'lazy', decoding: 'async', onerror: (e) => { e.target.style.visibility = 'hidden'; } }), h('span', { class: 'vplay' }), v.d ? h('span', { class: 'vdur' }, v.d) : null);
function openVideo(n) {
  const v = VMAP[n]; if (!v) return;
  curIdx = order.indexOf(n);
  const m = $('#vmodal');
  $('#vmTitle', m).textContent = v.t;
  $('#vmFrame', m).src = `video/${n}.html#autoplay`;
  $('#vmInfo', m).textContent = `${curIdx + 1} / ${order.length}` + (v.d ? ` · ${v.d}` : '') + ` · zene: ${v.g} · Esc: bezárás`;
  m.hidden = false; document.body.style.overflow = 'hidden';
  dispatchEvent(new Event('sims:pause'));
  setTimeout(() => $('#vmFrame', m).focus(), 300);
}
function closeVideo() {
  const m = $('#vmodal'); if (!m || m.hidden) return;
  $('#vmFrame', m).src = 'about:blank'; m.hidden = true; document.body.style.overflow = '';
  dispatchEvent(new Event('sims:resume'));
}
function initVideos() {
  $$('.vcard[data-video]').forEach((b) => {
    const v = VMAP[b.dataset.video]; if (!v) return;
    b.style.setProperty('--vc', `var(--${v.c})`);
    b.append(thumb(v), h('div', { class: 'vmeta' }, h('div', { class: 'vk' }, `Animációs videó · ${order.indexOf(v.n) + 1} / ${order.length}`), h('b', {}, v.t), h('span', {}, v.s)));
    b.addEventListener('click', () => openVideo(v.n));
    b.setAttribute('aria-label', `Videó lejátszása: ${v.t}`);
  });
  const lib = $('#vlib');
  if (lib) {
    const grid = h('div', { class: 'vgrid' });
    for (const v of VIDEOS) grid.append(h('button', { class: 'vtile', type: 'button', style: `--vc:var(--${v.c})`, onclick: () => openVideo(v.n), 'aria-label': 'Videó: ' + v.t }, thumb(v), h('span', { class: 'vk' }, `${order.indexOf(v.n) + 1} / ${order.length} · ${v.g}`), h('b', {}, v.t), h('span', {}, v.s)));
    lib.append(grid);
  }
  const m = $('#vmodal');
  m?.addEventListener('click', (e) => { if (e.target === m) closeVideo(); });
  $('#vmClose')?.addEventListener('click', closeVideo);
  $('#vmPrev')?.addEventListener('click', () => openVideo(order[(curIdx - 1 + order.length) % order.length]));
  $('#vmNext')?.addEventListener('click', () => openVideo(order[(curIdx + 1) % order.length]));
  addEventListener('message', (e) => { if (e.data === 'vclose' || (e.data && e.data.type === 'mt-video-close')) closeVideo(); });
}

/* ---------------------------------------------------------------- BME YouTube kis kártya */
const ytImg = (id, f) => `img/yt/${id}/${f}`;
function openYT(id) {
  const y = YT[id]; if (!y) return;
  const m = $('#ytmodal');
  $('#ytTitle', m).textContent = y.title;
  $('#ytFrame', m).src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
  $('#ytOpen', m).href = `https://www.youtube.com/watch?v=${id}`;
  $('#ytInfo', m).textContent = `BME Építőmérnöki Kar · ${y.dur}`;
  m.hidden = false; document.body.style.overflow = 'hidden';
  dispatchEvent(new Event('sims:pause'));
}
function closeYT() { const m = $('#ytmodal'); if (!m || m.hidden) return; $('#ytFrame', m).src = 'about:blank'; m.hidden = true; document.body.style.overflow = ''; dispatchEvent(new Event('sims:resume')); }
function initYT() {
  $$('[data-ytm]').forEach((el) => {
    const id = el.dataset.ytm, y = YT[id]; if (!y) return;
    el.classList.add('ytm'); el.type = 'button';
    el.append(h('div', { class: 'th' }, h('img', { src: ytImg(id, 't.jpg'), alt: '', loading: 'lazy' }), h('span', { class: 'ytc-yt' }), h('span', { class: 'd' }, y.dur)),
      h('div', { class: 'm' }, h('small', {}, 'BME Építőmérnöki Kar · YouTube'), h('b', {}, y.title)),
      h('div', { class: 'strip' }, ...[1, 2, 3, 4].map((k) => h('img', { src: ytImg(id, `p${k}.jpg`), alt: y.caps[k - 1] || '', loading: 'lazy' }))));
    el.addEventListener('click', () => openYT(id));
    el.setAttribute('aria-label', 'YouTube-videó: ' + y.title);
  });
  const m = $('#ytmodal');
  m?.addEventListener('click', (e) => { if (e.target === m) closeYT(); });
  $('#ytClose')?.addEventListener('click', closeYT);
}

/* ---------------------------------------------------------------- nagyítás */
function closeLightbox() { const lb = $('#lightbox'); if (lb && !lb.hidden) { lb.hidden = true; document.body.style.overflow = ''; } }
function initGallery() {
  const lb = $('#lightbox');
  document.addEventListener('click', (e) => {
    const f = e.target.closest('figure.zoom'); if (!f) return;
    const img = $('img', f); if (!img) return;
    $('img', lb).src = img.currentSrc || img.src; $('img', lb).alt = img.alt;
    $('p', lb).textContent = $('figcaption', f)?.textContent || img.alt || '';
    lb.hidden = false; document.body.style.overflow = 'hidden';
  });
  lb?.addEventListener('click', closeLightbox);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeVideo(); closeYT(); closeLightbox(); const s = $('#navsheet'); if (s) s.hidden = true; } });
}

/* ---------------------------------------------------------------- fülek */
function initTabs() {
  $$('[data-tabs]').forEach((box) => {
    const btns = $$(':scope > .tabs-b button', box);
    const panels = $$(':scope > [data-panel]', box);
    const show = (k) => { btns.forEach((b) => b.classList.toggle('on', b.dataset.tab === k)); panels.forEach((p) => { p.hidden = p.dataset.panel !== k; }); dispatchEvent(new Event('resize')); };
    btns.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
    show(btns[0]?.dataset.tab);
  });
}

/* ---------------------------------------------------------------- kvíz */
const QUIZ = new Map();
/** defineQuiz('dyn', 'Kvíz – …', [{q, a:['Helyes', 'Rossz', …], c:0, e:'Magyarázat'}]) → <div class="quiz" data-quiz="dyn"></div> */
export function defineQuiz(key, title, qs) { QUIZ.set(key, { title, qs }); }
function hashStr(s) { let x = 2166136261; for (const ch of s) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; }
function balance(key, qs) {
  let seed = hashStr(key), prev = -1;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  return qs.map((q) => {
    const n = q.a.length; let pos;
    do { pos = Math.floor(rnd() * n); } while (pos === prev && n > 1);
    prev = pos;
    const others = q.a.filter((_, i) => i !== q.c);
    for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
    const a = [...others]; a.splice(pos, 0, q.a[q.c]);
    return { ...q, a, c: pos };
  });
}
function initQuiz() {
  $$('.quiz[data-quiz]').forEach((box) => {
    const def = QUIZ.get(box.dataset.quiz); if (!def) { console.warn('Nincs kvíz:', box.dataset.quiz); return; }
    let qs, i, res;
    const head = h('div', { class: 'quiz-head' }, h('b', {}, def.title), h('span', {}));
    const body = h('div', { class: 'quiz-body' });
    box.append(head, body);
    const start = () => { qs = balance(box.dataset.quiz, def.qs); i = 0; res = qs.map(() => null); render(); };
    const render = () => {
      body.innerHTML = '';
      $('span', head).textContent = `${res.filter((r) => r === true).length}\u00a0/\u00a0${qs.length}`;
      if (i >= qs.length) {
        const ok = res.filter(Boolean).length;
        const msg = ok === qs.length ? 'Hibátlan! A mérőműszer nyugalmat jelez.' : ok >= qs.length * 0.7 ? 'Szép eredmény – a hibásakat érdemes még egyszer átnézni.' : 'Érdemes a fejezetet (és a videót) még egyszer átnézni.';
        body.append(h('div', { class: 'q-res' }, h('b', {}, `${ok}\u00a0/\u00a0${qs.length}`), h('p', { class: 'center' }, msg), h('button', { class: 'btn btn-line', type: 'button', onclick: start }, 'Újra')));
        return;
      }
      const q = qs[i];
      const exp = h('div', { class: 'q-exp', hidden: true });
      const next = h('button', { class: 'btn btn-line btn-sm', type: 'button', disabled: true, onclick: () => { i++; render(); } }, i === qs.length - 1 ? 'Eredmény' : 'Következő →');
      const opts = h('div', { class: 'q-opts' });
      const dotBox = h('div', { class: 'q-dots' });
      const dots = () => { dotBox.innerHTML = ''; res.forEach((r, k) => dotBox.append(h('i', { class: (r === true ? 'ok' : r === false ? 'bad' : '') + (k === i ? ' cur' : '') }))); };
      q.a.forEach((t, k) => {
        const b = h('button', { type: 'button' }, h('i', {}, 'ABCDE'[k]), h('span', { html: t }));
        b.addEventListener('click', () => {
          if (res[i] !== null) return;
          res[i] = k === q.c;
          $$('button', opts).forEach((x, kk) => { x.disabled = true; if (kk === q.c) x.classList.add('right'); });
          if (k !== q.c) b.classList.add('wrong');
          exp.hidden = false; exp.innerHTML = (res[i] ? '<b>Helyes.</b> ' : '<b>Nem egészen.</b> ') + (q.e || '');
          next.disabled = false;
          $('span', head).textContent = `${res.filter((r) => r === true).length}\u00a0/\u00a0${qs.length}`;
          dots();
        });
        opts.append(b);
      });
      dots();
      body.append(h('div', { class: 'q-n' }, `${i + 1}. kérdés / ${qs.length}`), h('div', { class: 'q-t', html: q.q }), opts, exp, h('div', { class: 'q-nav' }, dotBox, next));
    };
    start();
  });
}

/* ---------------------------------------------------------------- igaz/hamis */
let TF = [];
export function defineTF(list) { TF = list; }
function initTF() {
  const box = $('#tf'); if (!box || !TF.length) return;
  const items = h('div', { class: 'tf' });
  const score = h('div', { class: 'tf-score' });
  let ans = TF.map(() => null);
  const upd = () => {
    const done = ans.filter((a) => a !== null).length, ok = ans.filter((a) => a === true).length;
    score.innerHTML = `<span>Megválaszolva: <b>${done}\u00a0/\u00a0${TF.length}</b></span><span>Helyes: <b>${ok}</b></span>` + (done === TF.length ? `<span>${ok >= TF.length * 0.9 ? 'Kiváló!' : ok >= TF.length * 0.7 ? 'Jó eredmény!' : 'Érdemes ismételni.'}</span>` : '');
    score.append(h('button', { type: 'button', onclick: reset }, 'Újrakezdés'));
  };
  const reset = () => { ans = TF.map(() => null); build(); upd(); };
  const build = () => {
    items.innerHTML = '';
    TF.forEach((it, k) => {
      const e = h('div', { class: 'e', hidden: true });
      const row = h('div', { class: 'tf-item' });
      const bt = h('button', { type: 'button' }, 'Igaz'), bf = h('button', { type: 'button' }, 'Hamis');
      const pick = (val, b) => {
        if (ans[k] !== null) return;
        ans[k] = val === it.v;
        b.classList.add('sel', ans[k] ? 'right' : 'wrong');
        bt.disabled = bf.disabled = true;
        row.classList.add(ans[k] ? 'ok' : 'bad');
        e.hidden = false; e.innerHTML = `<b>${it.v ? 'Igaz.' : 'Hamis.'}</b> ` + (it.e || '');
        upd();
      };
      bt.addEventListener('click', () => pick(true, bt)); bf.addEventListener('click', () => pick(false, bf));
      row.append(h('span', { class: 'n' }, String(k + 1).padStart(2, '0')), h('span', { class: 's', html: it.s }), h('span', { class: 'tf-btns' }, bt, bf), e);
      items.append(row);
    });
  };
  build(); upd();
  box.append(items, score);
}

/* ---------------------------------------------------------------- fogalomtár */
let GL = [];
export function defineGlossary(list) { GL = list; }
function initGloss() {
  const box = $('#gloss'); if (!box || !GL.length) return;
  const inp = h('input', { class: 'gloss-search', type: 'search', placeholder: `Keresés a ${GL.length} fogalom között…`, 'aria-label': 'Keresés a fogalomtárban' });
  const dl = h('dl', { class: 'gloss' });
  const items = GL.slice().sort((a, b) => a.t.localeCompare(b.t, 'hu')).map((g) => { const d = h('div', {}, h('dt', { html: g.t + (g.ch ? `<small>${g.ch}</small>` : '') }), h('dd', { html: g.d })); dl.append(d); return [d, (g.t + ' ' + g.d).toLowerCase()]; });
  inp.addEventListener('input', () => { const q = inp.value.trim().toLowerCase(); items.forEach(([d, s]) => { d.hidden = !!q && !s.includes(q); }); });
  box.append(inp, dl);
}

/* ---------------------------------------------------------------- megjelenés görgetéskor */
function initReveal() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach((el) => io.observe(el));
}

export function initUI() {
  initTheme(); initNav(); initStrip(); initHeads(); initVideos(); initYT(); initGallery(); initTabs(); initQuiz(); initTF(); initGloss(); initReveal();
  const n = $$('[data-w]').length; const s = $('#statW'); if (s && n) s.textContent = n;
  const nc = $$('.case').length; const sc = $('#statC'); if (sc && nc) sc.textContent = nc;
}
export function startGuard() { try { GUARD.start(); } catch (e) { console.error('Formázás-őr hiba', e); } }
export { clamp };
