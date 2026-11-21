import asyncio, sys, os
from playwright.async_api import async_playwright
# usage: chshots.py url outdir width theme id1 id2 ... -> full-height screenshots of sections (and 'hero', 'foot')
url, out, W, theme = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
ids = sys.argv[5:]
os.makedirs(out, exist_ok=True)
ARGS = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        pg = await b.new_page(viewport={'width': W, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)[:300]))
        pg.on('console', lambda m: errs.append('CONSOLE ' + m.text[:300]) if m.type == 'error' else None)
        await pg.goto(url, wait_until='networkidle'); await pg.wait_for_timeout(1500)
        if theme: await pg.evaluate(f"document.documentElement.setAttribute('data-theme','{theme}')")
        for i in ids:
            sel = {'hero': 'section.hero', 'foot': 'footer.foot', 'top': 'header.topbar'}.get(i, '#' + i)
            loc = pg.locator(sel).first
            await loc.scroll_into_view_if_needed(); await pg.wait_for_timeout(1500)
            bb = await loc.bounding_box()
            # slice in 1400px pieces
            y = 0; n = 0
            top = await pg.evaluate("s=>document.querySelector(s).getBoundingClientRect().top+scrollY", sel)
            while y < bb['height']:
                hh = min(1400, bb['height'] - y)
                await pg.evaluate(f"window.scrollTo(0,{top + y})"); await pg.wait_for_timeout(900)
                await pg.screenshot(path=f'{out}/{i}_{n}.jpg', type='jpeg', quality=72, clip={'x': 0, 'y': 0, 'width': W, 'height': min(1000, hh)})
                y += 1000; n += 1
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
