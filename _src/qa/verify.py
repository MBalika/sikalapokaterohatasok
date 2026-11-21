"""Független újraszámolás: a widgetek alapállapotban kiírt értékeit vetjük össze saját képletekkel.
Használat: python3 verify.py <url>   (a szerver a repó gyökerében fut)"""
import sys, math, re
from playwright.sync_api import sync_playwright
url = sys.argv[1]
def num(s): return float(re.sub(r'[^\d,.\-−]', '', s.split('→')[-1]).replace(',', '.').replace('−', '-').rstrip('.'))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1440, 'height': 1000}); pg.goto(url + '?all&nohero'); pg.wait_for_timeout(2500)
    S = pg.evaluate("""()=>Object.fromEntries([...document.querySelectorAll('[data-w]')].map(w=>[w.dataset.w,{stats:[...w.querySelectorAll('.stat')].map(s=>[s.querySelector('.stat-l')?.innerText.trim(),s.querySelector('.stat-v')?.innerText.replace(/\\s+/g,' ').trim()]),sl:[...w.querySelectorAll('input[type=range]')].map(i=>+i.value)}]))""")
    b.close()
def show(name): print(name, S[name]['stats'], S[name]['sl'])
ok = True
def chk(label, got, exp, tol=0.02):
    global ok; g = num(got); good = abs(g - exp) <= tol * max(1, abs(exp)); ok &= good; print(('  OK ' if good else '  !! ') + f'{label}: oldal {got}  ↔  számolt {exp:.4g}')
# 1. hatászóna: v = v7,6·(7,6/r)^n ; alap: vibrációs tipikus 4,3 mm/s
w = S['dyn-zone']; r = w['sl'][0]; v = num(w['stats'][0][1]); lim = num(w['stats'][1][1]); dmin = num(w['stats'][2][1])
n = math.log(v / 4.3) / math.log(7.6 / r); print(f'dyn-zone: r={r} v={v} → n={n:.2f}'); chk('szükséges távolság', w['stats'][2][1], 7.6 * (4.3 / lim) ** (1 / n), 0.06)
# 2. kráter
w = S['dyn-crater']; D, L, a = w['sl']; chk('kráter sugara 3D+L/2', w['stats'][1][1], 3 * D + L / 2); chk('tömörödési zóna 3D', w['stats'][0][1], 3 * D)
# 3. gépalap (Lysmer)
w = S['dyn-machine']; B, Lh, H, mg, rpm, vs = w['sl']; rho, nu = 1900, 0.33
r0 = math.sqrt(B * Lh / math.pi); G = rho * vs ** 2; k = 4 * G * r0 / (1 - nu); m = B * Lh * H * 2400 + mg * 1000
fn = math.sqrt(k / m) / (2 * math.pi); chk('gépalap saját frekvencia', w['stats'][0][1], fn, 0.04); chk('üzemi frekvencia', w['stats'][1][1], rpm / 60)
# 4. magnitúdó-energia
w = S['eq-energy']; M = w['sl'][0]; E = 10 ** (1.5 * M + 4.8); print('eq-energy', w['stats'][0], f'számolt {E:.3g} J')
# 5. visszatérési idő
w = S['eq-agr']; tL, P = w['sl'][:2]; chk('visszatérési idő', w['stats'][2][1], -tL / math.log(1 - P / 100))
# 6. alagút: Smax = VL·πD²/4 / (√(2π)·i)
w = S['cav-tunnel']; z0, D, VL = w['sl'][:3]; i = num(w['stats'][1][1]); chk('Peck Smax (mm)', w['stats'][0][1], VL / 100 * math.pi * D ** 2 / 4 / (math.sqrt(2 * math.pi) * i) * 1000, 0.03); chk('i = K·z0 (agyag)', w['stats'][1][1], 0.5 * z0)
# 7. buzgár
w = S['wash-grad']; dh, Ls, g1 = w['sl']; chk('i = Δh/L', w['stats'][0][1], dh / Ls); chk('i_kr = γ′/γw', w['stats'][1][1], g1 / 9.81); chk('σ′ = (γ′ − i·γw)·L', w['stats'][2][1], (g1 - dh / Ls * 9.81) * Ls / 100, 0.03)
# 8. kimélyülés (CSU, lekerekített orr K1 = 1,0)
w = S['wash-scour']; V, y1, a = w['sl'][:3]; Fr = V / math.sqrt(9.81 * y1); chk('Froude', w['stats'][0][1], Fr, 0.03); chk('y_s', w['stats'][1][1], a * 2.0 * 1.0 * 1.0 * 1.1 * (y1 / a) ** 0.35 * Fr ** 0.43, 0.03)
# 9. vs,30 (alapszelvény)
w = S['eq-class']; sl = w['sl']; hs, vv = sl[0::2], sl[1::2]; chk('vs,30', w['stats'][0][1], 30 / sum(h / v for h, v in zip(hs, vv)), 0.02)
for nme in ('frost-depth', 'eq-spec', 'cav-trough'): show(nme)
print('MINDEN EGYEZIK' if ok else 'VAN ELTÉRÉS')
