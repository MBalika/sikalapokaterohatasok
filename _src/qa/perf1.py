"""Egy-egy widget képkockaideje elszigetelve (friss oldalbetöltés, csak az a widget indul el). python3 perf1.py <url> név…"""
import sys
from playwright.sync_api import sync_playwright
url = sys.argv[1]; names = sys.argv[2:]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    for name in names:
        pg = b.new_page(viewport={'width': 1440, 'height': 1000}); pg.goto(url, wait_until='load'); pg.wait_for_timeout(800)
        pg.evaluate("n=>document.querySelector(`[data-w=\"${n}\"]`).scrollIntoView({block:'center'})", name); pg.wait_for_timeout(1500)
        pg.evaluate("n=>document.querySelector(`[data-w=\"${n}\"]`).scrollIntoView({block:'center'})", name); pg.wait_for_timeout(800)
        r = pg.evaluate("""()=>new Promise(res=>{let n=0,mx=0,t0=performance.now(),last=t0,mut=0;const mo=new MutationObserver(rs=>mut+=rs.length);mo.observe(document.querySelector('main'),{childList:true,subtree:true,characterData:true,attributes:true});function f(t){n++;mx=Math.max(mx,t-last);last=t;if(t-t0<1500)requestAnimationFrame(f);else{mo.disconnect();res([n,Math.round(mx),mut]);}}requestAnimationFrame(f);})""")
        print(f'{name:16s} képkocka/1,5 s: {r[0]:3d}  leghosszabb: {r[1]} ms  DOM-mutáció: {r[2]}')
        pg.close()
    b.close()
