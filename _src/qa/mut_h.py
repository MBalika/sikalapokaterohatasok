"""Formázás-őr stabilitása: tétlen oldalon 3 s alatt 0 DOM-mutáció (fejezetenként), U+200B nem nő; látható szövegben nincs index nélküli jelölés.
Használat: python3 mut_h.py <url>"""
import sys, re
from playwright.sync_api import sync_playwright
url = sys.argv[1]
CNT = "()=>{const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n=0,x;while(x=w.nextNode()){const v=x.nodeValue;for(let i=0;i<v.length;i++)if(v.charCodeAt(i)===0x200b)n++;}return n;}"
IDLE = """()=>new Promise(r=>{let n=0,ex=[];const mo=new MutationObserver(rs=>{n+=rs.length;for(const m of rs){if(ex.length<4){const t=m.target.nodeType===3?m.target.parentElement:m.target;ex.push(m.type+':'+(t&&t.className?String(t.className.baseVal??t.className).slice(0,40):t&&t.nodeName)+(m.attributeName?'@'+m.attributeName:''));}}});mo.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true});setTimeout(()=>{mo.disconnect();r([n,ex]);},3000);})"""
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1280, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url, wait_until='load')
    pg.wait_for_function('window.__fmtHyphReady===true', timeout=15000)
    pg.wait_for_timeout(1500)
    z0 = pg.evaluate(CNT)
    out = [('betöltés után (hős)', pg.evaluate(IDLE))]
    ids = pg.evaluate("[...document.querySelectorAll('section.ch')].map(s=>s.id)")
    for cid in ids:
        pg.evaluate(f"document.getElementById('{cid}').scrollIntoView()")
        pg.wait_for_timeout(1800)
        out.append((cid, pg.evaluate(IDLE)))
        # végiggörgetés a fejezeten (widgetek indulnak)
        pg.evaluate(f"(()=>{{const s=document.getElementById('{cid}');const r=s.getBoundingClientRect();window.scrollBy(0, r.height/2);}})()")
        pg.wait_for_timeout(1500)
        out.append((cid + ' közepe', pg.evaluate(IDLE)))
    # interakció: minden csúszka középre, majd tétlen mérés
    pg.evaluate("document.querySelectorAll('main input[type=range]').forEach(e=>{e.value=(+e.min+ +e.max)/2;e.dispatchEvent(new Event('input'))})")
    pg.wait_for_timeout(1500)
    pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    pg.wait_for_timeout(1500)
    out.append(('csúszkák után, lap alja', pg.evaluate(IDLE)))
    z1 = pg.evaluate(CNT)
    # idempotencia: minden blokkot újrafeldolgoztatunk (x hozzáadása, majd eltávolítása), a szöveg nem változhat
    pg.evaluate("""()=>{window.__idem=[...document.querySelectorAll('main p, main li, main dd, main .verdict, main .w-foot, main .q-exp, main td, main .stat-l, main .ctl-hint')].slice(0,1500);window.__idemB=window.__idem.map(e=>e.innerHTML);window.__idemX=window.__idem.map(e=>{const t=document.createTextNode('x');e.appendChild(t);return t;});}""")
    pg.wait_for_timeout(600)
    pg.evaluate("()=>window.__idemX.forEach(t=>t.remove())")
    pg.wait_for_timeout(600)
    idem = pg.evaluate("()=>{const o=[];window.__idem.forEach((e,i)=>{if(e.innerHTML!==window.__idemB[i]){const a=window.__idemB[i],b=e.innerHTML;let k=0;while(k<a.length&&a[k]===b[k])k++;o.push([a.slice(Math.max(0,k-60),k+60),b.slice(Math.max(0,k-60),k+60)]);}});return [window.__idem.length,o.slice(0,5),o.length];}")
    txt = pg.evaluate("(()=>{const w=document.createTreeWalker(document.querySelector('main'),NodeFilter.SHOW_TEXT);const o=[];let x;while(x=w.nextNode()){const p=x.parentElement;if(p&&p.closest('script,style'))continue;o.push(x.nodeValue);}return o.join('\\n');})()")
    b.close()
for k, (n, ex) in out:
    print(f'{k:28s} {n:4d} mutáció / 3 s  {ex if n else ""}')
print('U+200B:', z0, '→', z1, '; JS-hibák:', errs[:3])
print('Idempotencia: %d blokk, %d változott' % (idem[0], idem[2]))
for a_, b_ in idem[1]: print('  ', repr(a_), '\n →', repr(b_))
bad = sorted(set(re.findall(r'\b(?:D15|D85|d85|d15|d50|d60|d10|NSPT|vs30|vs,30|agR|Smax|ikr|T1|I0|Ct|cu|Vs|ys|y1|K1|K2|K3|qc|Eoed)\b', txt)))
print('Index nélküli jelölés a látható szövegben:', bad)
