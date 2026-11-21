#!/usr/bin/env python3
"""Fordítás-karbantartó a magyar forrás szerkesztése után.
  python3 i18n/sync.py snap            → a mostani egységek mentése (i18n/.ws_old.tsv) – SZERKESZTÉS ELŐTT
  python3 i18n/sync.py miss            → a hiányzó egységek (i18n/missing.tsv) mellé a leghasonlóbb régi magyar szöveg és angol párja
  python3 i18n/sync.py prune           → a fel nem használt kulcsok törlése az en_*.tsv fájlokból
A build (python3 build.py) írja a missing.tsv-t; a „fel nem használt” kulcsokat a build kimenete sorolja fel."""
import sys, subprocess, pathlib, glob, difflib, re
R = pathlib.Path(__file__).resolve().parent; SRC = R.parent / 'src'
FILES = ['index.src.html', *[f'chapters/{p.name}' for p in sorted((SRC / 'chapters').glob('*.html'))], *[f'js/{p.name}' for p in sorted((SRC / 'js').glob('*.js'))]]
def ws(): return subprocess.run(['node', str(R / 'worksheet.mjs'), str(SRC), *FILES], capture_output=True, text=True).stdout
def tsv():
    T = {}
    for f in sorted(glob.glob(str(R / 'en_*.tsv'))):
        for ln in open(f, encoding='utf-8'):
            if ln.strip() and not ln.startswith('#') and '\t' in ln: k, v = ln.rstrip('\n').split('\t', 1); T[k] = (v, f)
    return T
cmd = sys.argv[1] if len(sys.argv) > 1 else 'miss'
if cmd == 'snap':
    (R / '.ws_old.tsv').write_text(ws(), encoding='utf-8'); print('mentve')
elif cmd == 'miss':
    old = {}
    for ln in (R / '.ws_old.tsv').read_text(encoding='utf-8').split('\n'):
        if '\t' in ln: k, v = ln.split('\t', 1); old[k] = v.lstrip('~')
    T = tsv(); cand = [(k, v) for k, v in old.items() if k in T or k + '!' in T]
    for ln in (R.parent / 'missing.tsv' if (R.parent / 'missing.tsv').exists() else R / 'missing.tsv').read_text(encoding='utf-8').split('\n'):
        if not ln.strip(): continue
        k, hu, *rest = ln.split('\t')
        best = max(cand, key=lambda c: difflib.SequenceMatcher(None, hu, c[1]).quick_ratio(), default=None)
        print(f'## {k}  {rest[0] if rest else ""}\nÚJ : {hu}')
        if best:
            r = difflib.SequenceMatcher(None, hu, best[1]).ratio()
            if r > 0.45: print(f'RÉGI ({r:.2f}): {best[1]}\nEN  : {(T.get(best[0]) or T.get(best[0] + "!"))[0]}')
        print()
elif cmd == 'prune':
    r = subprocess.run(['node', str(R / 'apply.mjs'), str(SRC), str(R.parent / '.en'), ','.join(sorted(glob.glob(str(R / 'en_*.tsv')))), *FILES], capture_output=True, text=True, cwd=R, env={**__import__('os').environ, 'NUMFIX': '1', 'ATTRS': 'data-sub,data-l'})
    n = re.search(r'fel nem használt: (\d+)', r.stdout); m = re.search(r'^  fel nem használt: (.*)$', r.stdout, re.M); un = set(m.group(1).split()) if (m and n and int(n.group(1)) > 0) else set()
    if not un: print('nincs fel nem használt kulcs'); sys.exit(0)
    print('(egyszerre legfeljebb 20 kulcsot töröl – ismételd, amíg van)')
    for f in sorted(glob.glob(str(R / 'en_*.tsv'))):
        L = open(f, encoding='utf-8').read().split('\n'); K = [l for l in L if not ('\t' in l and not l.startswith('#') and l.split('\t', 1)[0] in un)]
        if len(K) != len(L): open(f, 'w', encoding='utf-8').write('\n'.join(K)); print(pathlib.Path(f).name, '−', len(L) - len(K))
