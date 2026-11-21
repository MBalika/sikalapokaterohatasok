# Dobozpéldák fényképe (2026-11-20): a megadott szelektorok első (vagy n-edik) látható példányát lefényképezi,
# és egy áttekintő lapra rakja – a boxcenter.py találatainak gyors szemrevételezéséhez, javítás előtt és után.
# Használat: python3 boxshots.py <url> <kimenet.png> [szélesség=1440] 'szelektor' ['szelektor@2' …] [--tabs 'fülgombok']
import asyncio, sys, io
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw

async def scroll_all(pg):
    """Végiggörget az oldalon, hogy a csak láthatóvá váláskor felépülő (lusta) eszközök is megjelenjenek."""
    y = 0
    while True:
        h = await pg.evaluate("document.documentElement.scrollHeight")
        if y > h: break
        await pg.evaluate(f"window.scrollTo(0, {y})"); await pg.wait_for_timeout(140); y += 700
    await pg.wait_for_timeout(600)

async def main():
    url, out = sys.argv[1], sys.argv[2]
    rest = sys.argv[3:]
    w = 1440
    if rest and rest[0].isdigit(): w = int(rest[0]); rest = rest[1:]
    tabs = None
    if '--tabs' in rest: i = rest.index('--tabs'); tabs = rest[i + 1]; rest = rest[:i] + rest[i + 2:]
    shots = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': w, 'height': 1000})
        await pg.goto(url); await pg.wait_for_timeout(2500)
        await scroll_all(pg)
        ntab = await pg.locator(tabs).count() if tabs else 1
        for sel in rest:
            s, n = (sel.rsplit('@', 1) + ['1'])[:2] if '@' in sel else (sel, '1')
            n = int(n); got = None
            for k in range(ntab):
                if tabs:
                    try: await pg.locator(tabs).nth(k).click(timeout=3000); await pg.wait_for_timeout(700)
                    except Exception: continue
                loc = pg.locator(s); cnt = await loc.count(); seen = 0
                for j in range(cnt):
                    el = loc.nth(j)
                    if not await el.is_visible(): continue
                    seen += 1
                    if seen < n: continue
                    try:
                        await el.scroll_into_view_if_needed(timeout=3000); await pg.wait_for_timeout(250)
                        got = await el.screenshot(timeout=5000)
                    except Exception: got = None
                    break
                if got: break
            if got: shots.append((sel, Image.open(io.BytesIO(got)).convert('RGB')))
            else: print('nincs látható példány:', sel)
        await b.close()
    if not shots: return
    W = max(min(im.width, 1100) for _, im in shots) + 20
    rows = []
    for sel, im in shots:
        if im.width > 1100: im = im.resize((1100, int(im.height * 1100 / im.width)))
        if im.height > 700: im = im.crop((0, 0, im.width, 700))
        rows.append((sel, im))
    H = sum(im.height + 34 for _, im in rows) + 10
    sheet = Image.new('RGB', (W, H), 'white'); d = ImageDraw.Draw(sheet); y = 6
    for sel, im in rows:
        d.text((10, y), sel, fill=(200, 0, 0)); y += 16
        sheet.paste(im, (10, y)); d.rectangle((9, y - 1, 10 + im.width, y + im.height), outline=(255, 0, 0)); y += im.height + 18
    sheet.save(out); print(out, sheet.size)

asyncio.run(main())
