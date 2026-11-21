"""Sortörés- és lyuk-audit a Síkalapokat érő hatások oldalra (/formazas).
Használat: python3 audit_h.py <url> <kimenet.json> [390,768,1440] [--quick]
Állapotok: alapállapot, minden widget minden gombsoros (seg) állása, kvízek kérdésenként válasz után, igaz/hamis magyarázatok."""
import sys, json, re, pathlib, collections
from playwright.sync_api import sync_playwright
HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
from rules import check

SCAN_JS = (HERE / 'scan.js').read_text(encoding='utf-8')
URL = sys.argv[1]
out_path = pathlib.Path(sys.argv[2])
widths = [int(w) for w in (sys.argv[3] if len(sys.argv) > 3 and not sys.argv[3].startswith('--') else '390,768,1440').split(',')]
QUICK = '--quick' in sys.argv
results, holes, errors = [], [], []


def ctx(b):
    t = b['text']
    a = t[max(0, b['p'] - 45):b['p'] + 1].replace('\n', ' ')
    c = t[b['c']:b['c'] + 35].replace('\n', ' ')
    return (a + ' ⏎ ' + c).replace(' ', '·').replace(' ', '·').replace('⁠', '').replace('­', '')


def scan(page, w, state, sel):
    if not page.evaluate('!!window.__scan'):
        page.add_script_tag(content=SCAN_JS)
    r = page.evaluate('s=>window.__scan(s)', sel)
    for b in r['breaks']:
        if b['type'] == 'hard':
            continue
        v = check(b['text'], b['p'], b['c'], b['type'], b.get('lc', 80))
        if v:
            results.append({'w': w, 'state': state, 'blk': b['blk'], 'ctx': ctx(b), 'viol': v})
    for hh in r.get('holes', []):
        holes.append({'w': w, 'state': state, **hh})
    for o in r['overflows']:
        if o['kind'] != 'scroll':
            results.append({'w': w, 'state': state, 'blk': o['blk'], 'ctx': o['text'], 'viol': [f"kilóg ({o['kind']}, {o['by']} px)"]})
    return len(r['breaks'])


with sync_playwright() as p:
    br = p.chromium.launch()
    for w in widths:
        cx = br.new_context(viewport={'width': w, 'height': 900}, device_scale_factor=1)
        page = cx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(URL, wait_until='load')
        try:
            page.wait_for_function('window.__fmtHyphReady===true', timeout=15000)
        except Exception:
            errors.append('elválasztó nem töltődött be')
        page.evaluate('document.fonts.ready')
        page.wait_for_timeout(800)
        tot = scan(page, w, 'alap', 'main')
        tot += scan(page, w, 'fejléc', 'header.topbar') if page.query_selector('header.topbar') else 0
        tot += scan(page, w, 'lábléc', 'footer') if page.query_selector('footer') else 0
        if not QUICK:
            # widgetek gombsoros állapotai
            ws = page.evaluate("[...document.querySelectorAll('[data-w]')].map((e,i)=>{e.dataset.audit=i;return [i,e.dataset.w]})")
            for i, name in ws:
                sel = f'[data-audit="{i}"]'
                nseg = page.evaluate("s=>[...document.querySelector(s).querySelectorAll('.seg')].map(g=>g.querySelectorAll('button').length)", sel)
                for gi, nb in enumerate(nseg):
                    for bi in range(nb):
                        page.evaluate("([s,g,b])=>document.querySelector(s).querySelectorAll('.seg')[g].querySelectorAll('button')[b].click()", [sel, gi, bi])
                        page.wait_for_timeout(90)
                        tot += scan(page, w, f'{name}:seg{gi}={bi}', sel)
                    page.evaluate("([s,g])=>document.querySelector(s).querySelectorAll('.seg')[g].querySelectorAll('button')[0].click()", [sel, gi])
                ntog = page.evaluate("s=>document.querySelector(s).querySelectorAll('.tog input').length", sel)
                if ntog:
                    page.evaluate("s=>document.querySelector(s).querySelectorAll('.tog input').forEach(x=>x.click())", sel)
                    page.wait_for_timeout(120)
                    tot += scan(page, w, f'{name}:kapcsolók', sel)
                    page.evaluate("s=>document.querySelector(s).querySelectorAll('.tog input').forEach(x=>x.click())", sel)
            # kvízek
            qz = page.evaluate("[...document.querySelectorAll('[data-quiz]')].map(e=>e.dataset.quiz)")
            for q in qz:
                sel = f'[data-quiz="{q}"]'
                for k in range(12):
                    has = page.evaluate("s=>!!document.querySelector(s+' .q-opts button')", sel)
                    if not has:
                        break
                    tot += scan(page, w, f'kvíz {q}:{k + 1}', sel)
                    page.evaluate("([s,k])=>{const b=[...document.querySelectorAll(s+' .q-opts button')];b[k%b.length].click()}", [sel, k])
                    page.wait_for_timeout(60)
                    tot += scan(page, w, f'kvíz {q}:{k + 1}+magyarázat', sel)
                    page.evaluate("s=>document.querySelector(s+' .q-nav button').click()", sel)
                    page.wait_for_timeout(60)
                tot += scan(page, w, f'kvíz {q}:eredmény', sel)
            # igaz/hamis
            page.evaluate("document.querySelectorAll('.tf-item').forEach((r,i)=>{const b=r.querySelectorAll('.tf-btns button');if(b.length)b[i%2].click()})")
            page.wait_for_timeout(200)
            tot += scan(page, w, 'igaz/hamis', '#tf')
        print(f'{w}px: {tot} sortörés', file=sys.stderr)
        cx.close()
    br.close()

out_path.write_text(json.dumps({'results': results, 'holes': holes, 'errors': errors}, ensure_ascii=False, indent=1), encoding='utf-8')
seen = collections.OrderedDict()
for r in results:
    for v in r['viol']:
        key = (re.sub(r'„.*”', '', v).strip(), r['ctx'])
        seen.setdefault(key, set()).add((r['w'], r['state']))
bykind = collections.Counter(k[0] for k in seen)
print('HIBÁK (egyedi):', sum(bykind.values()))
for k, n in bykind.most_common():
    print(f'  {n:4d}  {k}')
hs = {}
for hh in holes:
    k = hh['line']
    if k not in hs or hh['ratio'] > hs[k]['ratio']:
        hs[k] = hh
print('LYUKAK (≥0,6 em, egyedi sorok):', len(hs), ' ≥0,8 em:', sum(1 for x in hs.values() if x['ratio'] >= 0.8), ' ≥1,0 em:', sum(1 for x in hs.values() if x['ratio'] >= 1.0))
print('JS-hibák:', errors[:5])
