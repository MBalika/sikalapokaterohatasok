"""Belső hivatkozások (menü, kártyák, gombok): a cél a ragadós fejléc alá érkezik-e. navjump.py <url> [szélességek]"""
import asyncio, sys
from playwright.async_api import async_playwright
url = sys.argv[1]; widths = [int(x) for x in (sys.argv[2] if len(sys.argv) > 2 else '1366,390').split(',')]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for W in widths:
            pg = await b.new_page(viewport={'width': W, 'height': 800}); await pg.goto(url, wait_until='networkidle'); await pg.wait_for_timeout(2000)
            n = await pg.evaluate("document.querySelectorAll('a[href^=\"#\"]').length"); bad = []
            for i in range(n):
                h = await pg.evaluate("(i) => { const a = document.querySelectorAll('a[href^=\"#\"]')[i]; const h = a.getAttribute('href'); if (h.length < 2 || !document.querySelector(h)) return null; a.click(); return h; }", i)
                if not h: continue
                await pg.wait_for_timeout(2300)
                d = await pg.evaluate("(h) => { const t = document.querySelector(h), bar = document.querySelector('.topbar'); const top = t.getBoundingClientRect().top - bar.offsetHeight; const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 2; return [Math.round(top), atEnd, scrollY]; }", h)
                if not (4 <= d[0] <= 16 or d[1] or (h == '#top' and d[2] == 0)): bad.append((i, h, d))
            print(W, 'px:', n, 'hivatkozás, hibás:', len(bad), bad[:6]); await pg.close()
        await b.close()
asyncio.run(main())
