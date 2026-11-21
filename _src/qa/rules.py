"""A /formazas szabályai: egy ténylegesen megjelenített sortörés szabályos-e."""
import re

NBSPS = '  '
INVIS = '⁠​­'

def norm(s):
    for ch in INVIS:
        s = s.replace(ch, '')
    for ch in NBSPS:
        s = s.replace(ch, ' ')
    return s.replace('‑', '-')

OPS_END = set('=≤≥<>≈×±→+−÷⇒/(„[{')
OPS_START = set('=≤≥<>≈×±→+−÷⇒·/:)]},.;?!%°′″')
SHORT = {'a', 'az', 's', 'e', 'é', 'egy', 'és'}
NUMW = {'két','kettő','három','négy','öt','hat','hét','nyolc','kilenc','tíz','húsz','száz','ezer','első','második','harmadik','negyedik','ötödik','mindkét','néhány'}
ABBR = {'kb.', 'pl.', 'ill.', 'ún.', 'max.', 'min.', 'vö.', 'ld.', 'lásd', 'ca.', 'átl.', 'kb', 'dr.', 'sz.', 'ssz.'}
FUNCS = {'tg', 'sin', 'cos', 'ctg', 'ln', 'lg', 'log', 'arctg', 'exp', 'tan', 'cot'}
UNIT = r'(?:kPa|MPa|GPa|kN/m³|kN/m²|kN/m|kN|MN|m³|m²|m/s|cm²|mm²|cm|mm|km|kg|mBf|m|t|%|‰|°C?|db|fok|méter|perc|óra|nap|hét|hónap|év|s)(?![A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű])'
GREEK = 'αβγδεζηθικλμνξοπρστυφχψωΓΔΘΛΞΠΣΦΨΩ'
# jelzős szakkifejezések (első szó, második szó töve)
TERMS = [
    ('kedvező', 'esetleges'), ('esetleges', 'teher'), ('esetleges', 'felborító'), ('kritikus', 'állapot'),
    ('drénezetlen', 'nyírószil'), ('belső', 'mag'), ('hasznos', 'széless'), ('passzív', 'földellen'),
    ('tervezési', 'érték'), ('karakterisztikus', 'érték'), ('parciális', 'tényez'), ('általános', 'állékony'),
    ('hatékony', 'feszülts'), ('semleges', 'feszülts'), ('teljes', 'feszülts'), ('ödométeres', 'modul'),
    ('kompressziós', 'görb'), ('rugalmas', 'féltér'), ('kiterjedt', 'feltölt'), ('lamellás', 'összegz'),
    ('megengedhető', 'teher'), ('süllyedési', 'teknő'), ('Jáky', 'szerint'), ('Kögler', 'szerint'), ('Kany', 'szerint'),
]

def last_tok(s):
    m = re.search(r'(\S+)\s*$', s)
    return m.group(1) if m else ''

def first_tok(s):
    m = re.match(r'\s*(\S+)', s)
    return m.group(1) if m else ''

def is_sep_dot(s, i):
    """A s[i]=='·' felsorolás-elválasztó? (/formazas: ha utána legalább háromtagú betűszó jön)"""
    if not (0 < i < len(s) - 1 and s[i - 1] == ' ' and s[i + 1] == ' '):
        return False
    return re.match(r'[A-Za-zÀ-ÿŐőŰű]{3,}', first_tok(s[i + 2:])) is not None

def members(s):
    """Felsorolás-tagok határai: [(start,end)], elválasztó: felsorolás-' · ' és '; '."""
    cuts = []
    for m in re.finditer(r' · |; | – ', s):
        if m.group() != ' · ' or is_sep_dot(s, m.start() + 1):
            cuts.append((m.start(), m.end()))
    out, st = [], 0
    for a, b in cuts:
        out.append((st, a)); st = b
    out.append((st, len(s)))
    return out, len(cuts)

def listy(m):
    return re.search(r'[\d=≤≥<>≈:' + GREEK + r']', m) is not None

HUW = set('mi mit ki kit ha de ez ezt nem van így már még sem is le fel be el meg ide oda aki ami hol hát új jó sok kis ott itt úgy ő ők ma mai sőt pl'.split())

def check(text, p, c, typ, lcw=80):
    """text: a blokk teljes szövege; p: az előző sor utolsó karaktere; c: az új sor első karaktere."""
    t = norm(text)
    # indexek átszámítása a láthatatlan karakterek eltávolítása után
    P = len(norm(text[:p + 1])) - 1
    C = len(norm(text[:c]))
    before, after = t[:P + 1], t[C:]
    v = []
    if typ == 'emerg':
        v.append('szó közben tört')
    if typ == 'hyph':
        a_ = re.search(r'(\S*)-$', before); b_ = re.match(r'([A-Za-zÀ-ÿŐőŰű]*)', after)
        L = a_.group(1) if a_ else ''
        if not (re.fullmatch(r'[A-Za-zÀ-ÿŐőŰű]{3,}', L or '') and len(b_.group(1)) >= 5):
            v.append('kötőjelnél tört')
    if typ == 'shy':
        raw_tok = re.search(r'[^ \t\n\r]*$', text[:p + 1]).group(0) + re.match(r'[^ \t\n\r]*', text[c:]).group(0)
        if '\u2060' in raw_tok:
            after_part = re.match(r'[^ \t\n\r]*', text[c:]).group(0)
            grp = re.sub('[\u2060\u00ad]', '', raw_tok)
            # a 16 karakternél hosszabb csoport utolsó szava elválasztható
            if not (len(grp) > 16 and not re.search('[\u00a0\u202f]', after_part)):
                v.append('elválasztás kötött csoportban')
    lb, fa = last_tok(before), first_tok(after)
    lc = before[-1:] ; fc = after[:1]
    if lc == '/' and re.search(r'[a-záéíóöőúüű]{3,}/$', before) and re.match(r'[a-záéíóöőúüű]{3,}', after):
        pass
    elif lc in OPS_END:
        v.append(f'sorvégi operátor/zárójel „{lc}”')
    if lc == '·' and not is_sep_dot(t, P):
        v.append('sorvégi szorzópont')
    if lc == ':' and (re.match(r'[\d−+\-±' + GREEK + r']', fa) or (len(fa) <= 3 and fa.lower().strip(',.') not in SHORT and fa.lower().strip(',.') not in HUW and re.match(r'[A-Za-z]', fa))):
        v.append('címke és értéke szétvált')
    if fc in OPS_START:
        v.append(f'sorkezdő operátor/írásjel „{fc}”')
    if re.fullmatch(r'[−+\-]?\d[\d.,]*', lb) or (re.fullmatch(r'\d+\.', lb) and not re.match(r'[A-ZÁÉÍÓÖŐÚÜŰ]', fa)):
        v.append('szám a sor végén')
    if re.match(UNIT, after) and re.search(r'\d\s*$', before):
        v.append('szám és mértékegység szétvált')
    if lb.lower() in SHORT and typ != 'shy':
        v.append(f'névelő/rövid szó a sor végén („{lb}”)')
    if lb.lower() in NUMW and typ != 'shy':
        v.append(f'számnév a sor végén („{lb}”)')
    if lb.lower() in ABBR:
        v.append(f'rövidítés a sor végén („{lb}”)')
    if lb.lower() in FUNCS:
        v.append('függvénynév és argumentuma szétvált')
    for w1, w2 in TERMS:
        if lb.lower().strip(',.;:') == w1.lower() and re.match(re.escape(w2.lower()) + r'\w{0,5}(?!\w)', fa.lower().strip(',.;:)')):
            v.append(f'szakkifejezés kettétört („{w1} {w2}…”)'); break
    if re.match(r'(megfelel|nem felel|nem megfelel|OK\b|✓|✗)', after) and re.search(r'[–—\-→=]\s*$', before):
        v.append('verdikt elszakadt')
    # rövid zárójeles kifejezés
    o = before.rfind('('); cl = before.rfind(')')
    if o > cl:
        e = after.find(')')
        if e >= 0 and (len(before) - o - 1) + e <= max(10, min(24, int(0.30 * lcw))):
            v.append('rövid zárójeles kifejezés kettétört')
    # felsorolás-tag
    mem, nsep = members(t)
    for a, b in mem:
        if a <= P < C <= b:
            m = t[a:b].strip()
            if len(m) <= max(12, min(38, int(0.42 * lcw))) and nsep >= 1 and (listy(m) or nsep >= 2):
                v.append(f'felsorolás-tag kettétört („{m}”)')
            break
    return v
