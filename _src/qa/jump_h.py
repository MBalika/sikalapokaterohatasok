"""Menüugrások: minden fejezet-gomb pontosan a fejezet elejére visz? (1440: felső menü, 390: lenyíló lista)"""
import sys
from playwright.sync_api import sync_playwright
url = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    for w in (1440, 390):
        pg = b.new_page(viewport={'width': w, 'height': 900})
        pg.goto(url, wait_until='load'); pg.wait_for_timeout(2000)
        ids = pg.evaluate("[...document.querySelectorAll('section.ch')].map(s=>s.id)")
        res = []
        for cid in ids + list(reversed(ids[:-1])):
            if w > 1000:
                sel = f'#topnav [href="#{cid}"], #topnav [data-ch="{cid}"]'
                if not pg.query_selector(sel):
                    res.append((cid, 'nincs gomb')); continue
                pg.click(sel)
            else:
                pg.click('#menuBtn') if pg.query_selector('#menuBtn') else pg.click('.topbar button')
                pg.wait_for_timeout(350)
                sel = f'#navlist [href="#{cid}"], #navlist [data-ch="{cid}"]'
                if not pg.query_selector(sel):
                    pg.evaluate("document.getElementById('navsheet').hidden=true"); res.append((cid, 'nincs gomb')); continue
                pg.click(sel)
            pg.wait_for_timeout(2600)
            d = pg.evaluate(f"(()=>{{const s=document.getElementById('{cid}');const hd=document.querySelector('.topbar').getBoundingClientRect().bottom;return Math.round(s.getBoundingClientRect().top-hd);}})()")
            h2 = pg.evaluate(f"(()=>{{const e=document.querySelector('#{cid} h2');const r=e.getBoundingClientRect();return r.top>0&&r.bottom<innerHeight;}})()")
            res.append((cid, d, 'cím látszik' if h2 else 'CÍM NEM LÁTSZIK'))
        print(w, res)
        pg.close()
    b.close()
