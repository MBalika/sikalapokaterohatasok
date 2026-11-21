"""Widgetenkénti képkockaidő (rAF) – a lassú, fő szálat foglaló widgetek kiszűrésére.
Használat: python3 perf.py <url> [szélesség=1440]"""
import sys
from playwright.sync_api import sync_playwright
url = sys.argv[1]; W = int(sys.argv[2]) if len(sys.argv) > 2 else 1440
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS); pg = b.new_page(viewport={'width': W, 'height': 1000})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200])); pg.on('console', lambda m: errs.append('C ' + m.text[:200]) if m.type == 'error' else None)
    pg.goto(url, wait_until='load'); pg.wait_for_timeout(2500)
    ws = pg.evaluate("[...document.querySelectorAll('[data-w]')].map(e=>[e.dataset.w, Math.round(e.getBoundingClientRect().top+scrollY)])")
    for name, _ in ws:
        pg.evaluate("n=>document.querySelector(`[data-w=\"${n}\"]`).scrollIntoView({block:'center'})", name); pg.wait_for_timeout(1200)
        r = pg.evaluate("()=>new Promise(res=>{let n=0,mx=0,t0=performance.now(),last=t0;function f(t){n++;mx=Math.max(mx,t-last);last=t;if(t-t0<1500)requestAnimationFrame(f);else res([n,Math.round(mx),Math.round(document.documentElement.scrollTop)]);}requestAnimationFrame(f);})")
        print(f'{name:16s} y={r[2]:6d} képkocka/1,5 s: {r[0]:3d}  leghosszabb: {r[1]} ms')
    print('hibák:', errs[:8]); b.close()
