import asyncio, sys, os, json
from playwright.async_api import async_playwright
# usage: els.py url outdir width theme sel1 sel2 ...   (theme '' = default; sel may be "css@@n" for nth match)
url, out, W, theme = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
sels = sys.argv[5:]
os.makedirs(out, exist_ok=True)
ARGS = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        pg = await b.new_page(viewport={'width': W, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)[:300]))
        await pg.goto(url, wait_until='networkidle'); await pg.wait_for_timeout(1200)
        if theme: await pg.evaluate(f"document.documentElement.setAttribute('data-theme','{theme}')")
        for i, s in enumerate(sels):
            n = 0
            if '@@' in s: s, n = s.split('@@'); n = int(n)
            loc = pg.locator(s).nth(n)
            try:
                await loc.scroll_into_view_if_needed(timeout=4000); await pg.wait_for_timeout(900)
                await loc.screenshot(path=f'{out}/{i:02d}.png')
            except Exception as e: print('FAIL', s, str(e)[:120])
        print('\n'.join(errs[:10])); await b.close()
asyncio.run(main())
