import asyncio, sys, json
from playwright.async_api import async_playwright
# usage: audit.py url lang(hu|en) [widths comma] [--json out] [--tabs '<fülgombok szelektora>']
url, lang = sys.argv[1], sys.argv[2]
widths = [int(x) for x in (sys.argv[3] if len(sys.argv) > 3 else '390,768,1440,1920').split(',')]
ARGS = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
JS = r"""
(lang) => {
  const out = { holes: [], ends: [], titles: [], zw: 0, overflowEls: [] };
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const HU_END = /(^|[\s(„])(a|az|s|e|és|egy|két|három|négy|öt|hat|hét|nyolc|kilenc|tíz|mindkét|néhány|pl\.|kb\.|ill\.|ún\.|max\.|min\.)$/i;
  const EN_END = /(^|[\s(“])(a|an|the|e\.g\.|i\.e\.|approx\.)$/i;
  const OP_END = /([=≤≥<>≈·×+−±→(\[„“]|\d)$/;
  const blocks = [...document.querySelectorAll('main p, main li, main dd, main figcaption, main .note, footer p')].filter(vis);
  for (const b of blocks) {
    const cs = getComputedStyle(b); const just = cs.textAlign === 'justify';
    const fs = parseFloat(cs.fontSize);
    const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    const words = []; let n;
    while ((n = tw.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      const pe = n.parentElement; if (!pe || !vis(pe)) continue;
      const re = /[^ \n\t]+/g; let m;
      while ((m = re.exec(n.nodeValue))) {
        const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const rects = r.getClientRects(); if (!rects.length) continue;
        // szó több sorban (lágy kötőjel): első és utolsó darab
        words.push({ t: m[0], l: rects[0].left, r: rects[0].right, top: rects[0].top, bot: rects[0].bottom, multi: rects.length > 1, r2: rects[rects.length - 1] });
      }
    }
    if (words.length < 2) continue;
    // sorok
    const lines = []; let cur = [words[0]];
    for (let i = 1; i < words.length; i++) {
      const w = words[i], p = cur[cur.length - 1];
      const ptop = p.multi ? p.r2.top : p.top, pr = p.multi ? p.r2.right : p.r;
      if (Math.abs(w.top - ptop) < fs * 0.6 && w.l >= pr - 2) cur.push(w); else { lines.push(cur); cur = [w]; }
    }
    lines.push(cur);
    for (let i = 0; i < lines.length - 1; i++) {
      const L = lines[i];
      if (just) { let mg = 0; for (let k = 1; k < L.length; k++) { const p = L[k - 1]; const pr = p.multi ? p.r2.right : p.r; mg = Math.max(mg, L[k].l - pr); }
        if (mg > fs * 1.25) out.holes.push({ gap: Math.round(mg), fs, line: L.map(w => w.t).join(' ').slice(0, 90) }); }
      const last = L[L.length - 1]; if (last.multi) continue;
      const txt = L.map(w => w.t).join(' ').replace(/­/g, '');
      const lastw = last.t.replace(/[­⁠]/g, '');
      if ((lang === 'hu' ? HU_END : EN_END).test(lastw) || (OP_END.test(lastw) && !/[\d][.,)%°]?$/.test(lastw) ) ) out.ends.push(txt.slice(-70));
      else if (/^[(\[„“]/.test(lastw) && lastw.length <= 2) out.ends.push(txt.slice(-70));
    }
  }
  // dobozcímek
  for (const h of document.querySelectorAll('main .card h3, main .card h4, main .card h5, main .callout > b:first-child, main .box h4, main .gloss dt')) {
    if (h.tagName === 'B' && !/^(block|flex)$/.test(getComputedStyle(h).display)) continue;   // a szövegbe futó félkövér felvezetés nem cím
    if (!vis(h)) continue; if (h.closest('header, table, summary, [data-bxt-skip]')) continue;
    const cs = getComputedStyle(h); if (cs.textAlign !== 'center' && !h.classList.contains('bxt')) { const r = h.getBoundingClientRect(), pr = h.parentElement.getBoundingClientRect(); const mid = (r.left + r.right) / 2, pm = (pr.left + pr.right) / 2; if (Math.abs(mid - pm) > 12 || r.width > pr.width * 0.9) out.titles.push(h.textContent.trim().slice(0, 50)); }
  }
  { const c = document.body.cloneNode(true); c.querySelectorAll('svg, script, style').forEach(e => e.remove()); out.zw = (c.textContent.match(/\u200b/g) || []).length; }  // SVG-ben az index utáni alapvonal-visszaállító jel megengedett
  const W = document.documentElement.clientWidth;
  for (const el of document.querySelectorAll('main *')) { if (!vis(el)) continue; const r = el.getBoundingClientRect(); if (r.right > W + 2 && r.left < W && !el.closest('.scrollx, table, .tablewrap, [style*="overflow"]')) { let p = el.parentElement, clipped = false; while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') { clipped = true; break; } p = p.parentElement; } if (!clipped) out.overflowEls.push(el.tagName + '.' + (el.className.baseVal ?? el.className) + ' ' + Math.round(r.right - W)); } }
  out.overflowEls = out.overflowEls.slice(0, 8);
  if (lang === 'en') {
    const t = document.body.innerText;
    out.hu = [...new Set((t.match(/[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]*[áéíóöőúüűÁÉÍÓÖŐÚÜŰ][A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]*/g) || []))].slice(0, 60);
    out.comma = [...new Set((t.match(/\d,\d(?!\d\d(\D|$))[^\n]{0,12}/g) || []))].slice(0, 30);
  }
  return out;
}
"""
async def main():
    res = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for W in widths:
            pg = await b.new_page(viewport={'width': W, 'height': 1000})
            errs = []
            pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)[:200]))
            pg.on('console', lambda m: errs.append('CONSOLE ' + m.text[:200]) if m.type == 'error' else None)
            await pg.goto(url, wait_until='networkidle'); await pg.wait_for_timeout(2500)
            # végiggörgetés (lusta elemek)
            H = await pg.evaluate('document.documentElement.scrollHeight')
            y = 0
            while y < H: await pg.evaluate(f'window.scrollTo(0,{y})'); await pg.wait_for_timeout(120); y += 900
            await pg.evaluate('window.scrollTo(0,0)'); await pg.wait_for_timeout(1500)
            sw = await pg.evaluate('document.documentElement.scrollWidth')
            mut = await pg.evaluate("""() => new Promise(r => { let n = 0; const o = new MutationObserver(m => n += m.length); o.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true}); setTimeout(() => { o.disconnect(); r(n); }, 3000); })""")
            r = await pg.evaluate(JS, lang)
            # --tabs '<szelektor>': fejezetfüles appnál minden fület végigkattint, és a találatokat összegzi
            if '--tabs' in sys.argv:
                sel = sys.argv[sys.argv.index('--tabs') + 1]
                n = await pg.locator(sel).count()
                for i in range(n):
                    try:
                        await pg.evaluate("(a) => document.querySelectorAll(a[0])[a[1]].click()", [sel, i]); await pg.wait_for_timeout(1200)
                        H = await pg.evaluate('document.documentElement.scrollHeight'); y = 0
                        while y < H: await pg.evaluate(f'window.scrollTo(0,{y})'); await pg.wait_for_timeout(80); y += 900
                        await pg.wait_for_timeout(600)
                        r2 = await pg.evaluate(JS, lang)
                        sw = max(sw, await pg.evaluate('document.documentElement.scrollWidth'))
                        for k in ('holes', 'ends', 'titles', 'overflowEls'): r[k] += [x for x in r2[k] if x not in r[k]]
                        r['zw'] += r2['zw']
                        for k in ('hu', 'comma'):
                            if k in r2: r[k] = list(dict.fromkeys(r.get(k, []) + r2[k]))
                    except Exception as e: errs.append('TAB ' + str(e)[:150])
                r['tabs'] = n
            r['scrollW'] = sw; r['errs'] = errs[:10]; r['mut'] = mut
            res[W] = r
            print(f"== {W}px: scrollW {sw} · holes {len(r['holes'])} · bad ends {len(r['ends'])} · titles {len(r['titles'])} · zw {r['zw']} · overflow {len(r['overflowEls'])} · idle mut {mut} · errors {len(errs)}")
            for h in r['holes'][:6]: print('   HOLE', h)
            for e in r['ends'][:8]: print('   END ', e)
            for t in r['titles'][:8]: print('   TITLE', t)
            for o in r['overflowEls']: print('   OVER', o)
            for e in errs[:5]: print('   ', e)
            if lang == 'en' and W == widths[-1]: print('   HU?', r.get('hu')); print('   COMMA?', r.get('comma'))
            await pg.close()
        await b.close()
    if '--json' in sys.argv: json.dump(res, open(sys.argv[sys.argv.index('--json') + 1], 'w'), ensure_ascii=False, indent=1)
asyncio.run(main())
