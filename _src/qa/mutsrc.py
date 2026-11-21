"""Tétlen oldalon a DOM-módosítások forrása: 3 s alatt a mutációk csoportosítva (legközelebbi [data-w]/[data-g3ph]/id-s ős + típus + attribútum).
usage: python3 _src/qa/mutsrc.py <url> [szélesség] [görgetés: top|all]"""
import asyncio, sys, json
from playwright.async_api import async_playwright
url = sys.argv[1]; W = int(sys.argv[2]) if len(sys.argv) > 2 else 1440; mode = sys.argv[3] if len(sys.argv) > 3 else 'top'
JS = """() => new Promise(r => { const c = {}; const key = (n) => { let e = n.nodeType === 1 ? n : n.parentElement; const tag = e ? e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '') : '?';
  let w = e; while (w && !(w.dataset && (w.dataset.w || w.dataset.g3ph)) && !w.id) w = w.parentElement; return (w ? (w.dataset.w || w.dataset.g3ph || '#' + w.id) : '-') + ' › ' + tag; };
  const o = new MutationObserver(ms => { for (const m of ms) { const k = key(m.target) + ' [' + m.type + (m.attributeName ? ':' + m.attributeName : '') + ']'; c[k] = (c[k] || 0) + 1; } });
  o.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true}); setTimeout(() => { o.disconnect(); r(Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 25)); }, 3000); })"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': W, 'height': 900})
        await pg.goto(url, wait_until='networkidle'); await pg.wait_for_timeout(2500)
        if mode == 'all':   # mint az audit: végiggörgetés (a lusta elemek elindulnak), vissza a tetejére
            H = await pg.evaluate('document.documentElement.scrollHeight'); y = 0
            while y < H: await pg.evaluate(f'window.scrollTo(0,{y})'); await pg.wait_for_timeout(120); y += 900
            await pg.evaluate('window.scrollTo(0,0)'); await pg.wait_for_timeout(1500)
        for k, n in await pg.evaluate(JS): print(f'{n:6d}  {k}')
        await b.close()
asyncio.run(main())
