# A magyar forrás (_src/src) előkészítése az angol változathoz – a magyar oldal szövege és működése nem változik:
# EN jelző, nyelvfüggő számformátum, a formázás-őr angol szabályai, en-gb elválasztás, HU | EN nyelvváltó, angol videók útvonala.
# Idempotens. Használat: python3 _src/i18n/prep_hu.py
import os
SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src')
def load(f): return open(os.path.join(SRC, f), encoding='utf-8').read()
def save(f, t): open(os.path.join(SRC, f), 'w', encoding='utf-8').write(t)
def rep(t, a, b, n=1):
    c = t.count(a); assert c == n, (a[:90], c); return t.replace(a, b)

t = load('js/core.js')
if 'export const EN =' not in t:
    t = rep(t, "export const $ = (s, r = document) => r.querySelector(s);",
            "export const EN = (document.documentElement.lang || '').toLowerCase().startsWith('en');   // angol oldal (en.html)\nexport const $ = (s, r = document) => r.querySelector(s);")
    t = rep(t, "  return Number(x).toLocaleString('hu-HU', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/\u00a0/g, '\u202f');",
            "  if (EN) return Number(x).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/,/g, '\u202f');   // angolul: tizedespont, ezres tagolás keskeny szóközzel\n  return Number(x).toLocaleString('hu-HU', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/\u00a0/g, '\u202f');")
    t = rep(t, "  const TERMS = ['dinamikus hatás',", "  const TERMS = EN ? ['dynamic action', 'dynamic load', 'excitation frequency', 'natural frequency', 'resonance', 'peak particle velocity', 'vibration velocity', 'zone of influence', 'vibratory piling', 'ground acceleration', 'design ground acceleration', 'ground type', 'response spectrum', 'behaviour factor', 'importance class', 'liquefaction', 'seismic zone', 'underground cavity', 'mining cavity', 'internal erosion', 'hydraulic gradient', 'critical gradient', 'frost depth', 'frost heave', 'frost-susceptible soil', 'ice lens', 'according to'] : ['dinamikus hatás',")
    t = rep(t, "  const NUMW = /(^|[\\s(\\u00A0\\u2060„])((?:[Kk]ét|", "  const NUMW = EN ? /(^|[\\s(\\u00A0\\u2060“])((?:[Tt]wo|[Tt]hree|[Ff]our|[Ff]ive|[Ss]ix|[Ss]even|[Ee]ight|[Nn]ine|[Tt]en|[Ff]irst|[Ss]econd|[Tt]hird|[Ff]ourth|[Ff]ifth|[Bb]oth|[Aa]ll|[Ss]everal))(?=\\s\\S)\\s/g : /(^|[\\s(\\u00A0\\u2060„])((?:[Kk]ét|")
    t = rep(t, "(pl\\.|kb\\.|ill\\.|ún\\.|max\\.|min\\.|ld\\.|vö\\.|cca\\.|átl\\.|ill|ún|kb) (?=\\S)", "(pl\\.|kb\\.|ill\\.|ún\\.|max\\.|min\\.|ld\\.|vö\\.|cca\\.|átl\\.|ill|ún|kb|e\\.g\\.|i\\.e\\.|approx\\.|cf\\.|No\\.|Fig\\.) (?=\\S)")
    t = rep(t, "    for (let i = 0; i < 2; i++) s = s.replace(/(^|[\\s(\\u00A0\\u2060„])(a|az|A|Az|s|e|egy|Egy|és|És) (?=\\S)/g, '$1$2' + NB);",
            "    for (let i = 0; i < 2; i++) s = s.replace(EN ? /(^|[\\s(\\u00A0\\u2060“‘])(a|an|the|A|An|The|&) (?=\\S)/g : /(^|[\\s(\\u00A0\\u2060„])(a|az|A|Az|s|e|egy|Egy|és|És) (?=\\S)/g, '$1$2' + NB);")
    t = rep(t, "  const SHORTEND = new RegExp('(^|[\\\\s(\\u00A0\\u2060„])(a|az|A|Az|s|e|egy|Egy|és|És|pl\\\\.|kb\\\\.|ill\\\\.|ún\\\\.|max\\\\.|min\\\\.|",
            "  const SHORTEND = new RegExp(EN ? '(^|[\\\\s(\\u00A0\\u2060“‘])(a|an|the|A|An|The|e\\\\.g\\\\.|i\\\\.e\\\\.|approx\\\\.|\\\\d+(?:[,.]\\\\d+)?\\\\.?%?|' + NUMW.source.match(/\\(\\?:([^)]*)\\)/)[1] + ') $' : '(^|[\\\\s(\\u00A0\\u2060„])(a|az|A|Az|s|e|egy|Egy|és|És|pl\\\\.|kb\\\\.|ill\\\\.|ún\\\\.|max\\\\.|min\\\\.|")
    t = rep(t, "    if (H && H.hyphenators && H.hyphenators.hu) {\n      H.hyphenators.hu.then(", "    if (H && H.hyphenators && H.hyphenators[EN ? 'en-gb' : 'hu']) {\n      H.hyphenators[EN ? 'en-gb' : 'hu'].then(")
    save('js/core.js', t)

t = load('js/ui.js')
if 'function initLang' not in t:
    t = rep(t, "$('#vmFrame', m).src = `video/${n}.html#autoplay`;", "$('#vmFrame', m).src = `video/${EN ? 'en/' : ''}${n}.html#autoplay`;")
    t = rep(t, "a.t.localeCompare(b.t, 'hu')", "a.t.localeCompare(b.t, EN ? 'en' : 'hu')")
    t = rep(t, "  initTheme(); initNav();", "  initTheme(); initLang(); initNav();")
    t = rep(t, "import { $, $$, h, fireTheme, GUARD, cssVar, clamp, onTheme } from './core.js';", "import { $, $$, h, fireTheme, GUARD, cssVar, clamp, onTheme, EN } from './core.js';")
    t += """
// nyelvváltó: a választás megmarad (alap-lang), a másik nyelvű oldal ugyanott nyílik meg (alap-pos)
function initLang() {
  const sw = $('#langSw'), KEY = 'alap-pos'; const hh = () => { const tb = $('.topbar'); return tb ? tb.offsetHeight : 0; };
  if (sw) sw.addEventListener('click', () => {
    try { localStorage.setItem('alap-lang', EN ? 'hu' : 'en'); } catch (e) { }
    const H0 = hh(); let best = null; document.querySelectorAll('main [id]').forEach((n) => { if (n.closest('svg')) return; const r = n.getBoundingClientRect(); if (r.height && r.top <= H0 + 1 && r.bottom > H0) best = n; });
    try { sessionStorage.setItem(KEY, JSON.stringify({ id: best ? best.id : '', off: best ? H0 - best.getBoundingClientRect().top : 0, y: scrollY, t: Date.now() })); } catch (e) { }
    sw.setAttribute('href', (EN ? './' : 'en') + (best ? '#' + best.id : ''));
  });
  let p = null; try { p = JSON.parse(sessionStorage.getItem(KEY) || 'null'); sessionStorage.removeItem(KEY); } catch (e) { }
  if (p && Date.now() - p.t < 20000) { if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    const go = () => { const n = p.id && document.getElementById(p.id); const y = n ? n.getBoundingClientRect().top + scrollY - hh() + p.off : p.y; scrollTo({ top: Math.max(0, y), behavior: 'instant' }); };
    requestAnimationFrame(go); addEventListener('load', () => { go(); setTimeout(go, 600); }, { once: true }); }
}
"""
    save('js/ui.js', t)

t = load('index.src.html')
if 'id="langSw"' not in t:
    t = rep(t, '    <button class="iconbtn" id="themeBtn" type="button" aria-label="Téma"></button>\n',
            '    <a class="langbtn" id="langSw" href="en" hreflang="en" lang="en" aria-label="English version"><b>HU</b><span>EN</span></a>\n    <button class="iconbtn" id="themeBtn" type="button" aria-label="Téma"></button>\n')
    save('index.src.html', t)

t = load('style.css')
if '.langbtn' not in t:
    t += """
/* nyelvváltó (HU | EN): a kitöltött az aktuális nyelv; mobilon csak a másik nyelv kódja */
.langbtn { flex: none; display: inline-flex; align-items: center; gap: 2px; padding: 3px; border: 1px solid var(--line2); background: var(--surface); border-radius: 999px; text-decoration: none; font-family: var(--f-mono); font-size: 12.5px; font-weight: 500; letter-spacing: .04em; }
.langbtn b, .langbtn span { display: inline-grid; place-items: center; min-width: 30px; padding: 4px 8px; border-radius: 999px; }
.langbtn b { background: var(--ink); color: var(--surface); font-weight: 500; }
.langbtn span { color: var(--muted); }
.langbtn:hover span { background: var(--surface2); color: var(--ink); }
@media (max-width: 560px) { .langbtn b { display: none; } .langbtn span { min-width: 0; padding: 5px 9px; color: var(--ink); } }
"""
    save('style.css', t)

# --- ékezet nélküli magyar megjelenített szövegek, amelyek ugyanilyen kulcsként is szerepelnek: angolul külön ág (a magyar oldal változatlan) ---
t = load('js/ch_frost.js')
if "EN ? 'sand' : 'homok'" not in t:
    t = rep(t, "import { register, shell, slider, seg, toggle, stat, verdict, h, svg, figure, clear, fmt, clamp, lerp, smooth, loop, fitCanvas, cssVar, onTheme, $, $$ } from './core.js';",
            "import { register, shell, slider, seg, toggle, stat, verdict, h, svg, figure, clear, fmt, clamp, lerp, smooth, loop, fitCanvas, cssVar, onTheme, $, $$, EN } from './core.js';")
    t = rep(t, "homok: { n: 'homok',", "homok: { n: EN ? 'sand' : 'homok',")
    t = rep(t, "{ v: 'hom', t: 'homok' }", "{ v: 'hom', t: EN ? 'sand' : 'homok' }")
    t = rep(t, "{ v: 'isz', t: 'iszap' }", "{ v: 'isz', t: EN ? 'silt' : 'iszap' }")
    t = rep(t, "options: [{ v: 'iszap', t: 'iszap' }, { v: 'agyag', t: 'agyag' }, { v: 'homok', t: 'homok' }]",
            "options: [{ v: 'iszap', t: EN ? 'silt' : 'iszap' }, { v: 'agyag', t: EN ? 'clay' : 'agyag' }, { v: 'homok', t: EN ? 'sand' : 'homok' }]")
    save('js/ch_frost.js', t)
t = load('js/hero.js')
if "EN ? 'clay' : 'agyag'" not in t:
    t = rep(t, "import { $, h, cssVar, clamp, smooth, onTheme } from './core.js';", "import { $, h, cssVar, clamp, smooth, onTheme, EN } from './core.js';")
    t = rep(t, "name: 'agyag' }", "name: EN ? 'clay' : 'agyag' }")
    save('js/hero.js', t)
t = load('js/ch_eq.js')
if "'storeys'" not in t:
    t = rep(t, "import { register, shell, slider, seg, toggle, stat, verdict, select, h, svg, figure, clear, fmt, clamp, lerp, smooth, loop, fitCanvas, cssVar, onTheme, $, $$ } from './core.js';",
            "import { register, shell, slider, seg, toggle, stat, verdict, select, h, svg, figure, clear, fmt, clamp, lerp, smooth, loop, fitCanvas, cssVar, onTheme, $, $$, EN } from './core.js';")
    SZ = lambda v: "${EN ? (" + v + " === 1 ? 'storey' : 'storeys') : 'szint'}"
    t = rep(t, "text: `${N.v} szint` }", "text: `${N.v} " + SZ('N.v') + "` }")
    t = rep(t, "g.fillText(`${n} szint`, x, hh - 6)", "g.fillText(`${n} " + SZ('n') + "`, x, hh - 6)")
    t = rep(t, "sN.set(`≈ ${fmt(Nres, 0)} szint`, null,", "sN.set(`≈ ${fmt(Nres, 0)} ${EN ? 'storeys' : 'szint'}`, null,")
    save('js/ch_eq.js', t)
# --- formázási javítások (mindkét nyelven): a gondolatjel (–, —) nem kezdhet sort; a fogalomtár definícióira (dd) is vonatkozik a balra zárt tartalék
t = load('js/core.js')
if "/* gondolatjel */" not in t:
    t = rep(t, "    // rövidítések\n", "    // rövidítések\n    s = s.replace(/(\\S) ([–—]) /g, '$1' + NB + '$2 ');   /* gondolatjel */\n")
    t = rep(t, "      const ms = /^ ([=≤≥≈→←×±<>⇒+−/]) /.exec(b.nodeValue);", "      if (/^ [–—] /.test(b.nodeValue) && /\\S$/.test(a.nodeValue)) b.nodeValue = NB + b.nodeValue.slice(1);   /* gondolatjel a csomóponthatáron */\n      const ms = /^ ([=≤≥≈→←×±<>⇒+−/]) /.exec(b.nodeValue);")
    save('js/core.js', t)
t = load('js/layout.js')
if "main dd, main .note" not in t:
    t = rep(t, "const RAGSEL = 'main p, main li, main .note,", "const RAGSEL = 'main p, main li, main dd, main .note,"); save('js/layout.js', t)
t = load('style.css')
if '/* angol márkanév keskeny kijelzőn */' not in t:
    t += "/* angol márkanév keskeny kijelzőn: a hosszabb cím két sorba törhet */\n@media (max-width: 600px) { html[lang^=en] .brand b { white-space: normal; font-size: 16px; line-height: 1.05; } html[lang^=en] .brand { min-width: 0; flex: 1 1 auto; } }\n"
    save('style.css', t)
print('kész')
