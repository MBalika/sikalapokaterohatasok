import asyncio, sys, os
from playwright.async_api import async_playwright
# usage: scan.py url outdir width [height] [theme] [scale]
url, out, W = sys.argv[1], sys.argv[2], int(sys.argv[3])
H = int(sys.argv[4]) if len(sys.argv) > 4 else 1000
theme = sys.argv[5] if len(sys.argv) > 5 else ''
os.makedirs(out, exist_ok=True)
ARGS = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        pg = await b.new_page(viewport={'width': W, 'height': H})
        errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)[:300]))
        pg.on('console', lambda m: errs.append('CONSOLE ' + m.text[:300]) if m.type == 'error' else None)
        await pg.goto(url, wait_until='networkidle'); await pg.wait_for_timeout(1500)
        if theme: await pg.evaluate(f"document.documentElement.setAttribute('data-theme','{theme}')")
        total = await pg.evaluate('document.documentElement.scrollHeight')
        sw = await pg.evaluate('document.documentElement.scrollWidth')
        print('height', total, 'scrollWidth', sw)
        y = 0; i = 0
        while y < total:
            await pg.evaluate(f'window.scrollTo(0,{y})'); await pg.wait_for_timeout(700)
            await pg.screenshot(path=f'{out}/{i:03d}.jpg', type='jpeg', quality=70, animations='disabled', timeout=120000)
            y += H - 60; i += 1
            total = await pg.evaluate('document.documentElement.scrollHeight')   # a lusta widgetek felépülésével nő
        print('shots', i); print('\n'.join(errs[:20]))
        await b.close()
asyncio.run(main())
