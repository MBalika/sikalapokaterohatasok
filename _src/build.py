#!/usr/bin/env python3
"""Összeállítja a ../index.html-t: src/index.src.html + src/chapters/*.html (névsorrendben)
+ beágyazott CSS + esbuild-del csomagolt JS (three.js is benne).
Használat:  cd _src && npm install && python3 build.py
Fejlesztői build:  BUILD_ID=x CHAPTERS=01,02 python3 build.py  →  ../dev-x.html
"""
import os, subprocess, sys, pathlib

R = pathlib.Path(__file__).resolve().parent
os.chdir(R)
SRC = R / 'src'
BID = os.environ.get('BUILD_ID', '')
CHS = [c for c in os.environ.get('CHAPTERS', '').split(',') if c]
outjs = f'dist/app{"-" + BID if BID else ""}.js'
r = subprocess.run(['npx', 'esbuild', 'src/js/main.js', '--bundle', '--format=iife', '--minify', '--target=es2019', '--loader:.json=json',
                    '--outfile=' + outjs, '--log-level=warning', '--legal-comments=none'], capture_output=True, text=True)
if r.returncode:
    print(r.stderr); sys.exit(1)
if r.stderr.strip():
    print(r.stderr)

css = (R / 'fonts.css').read_text(encoding='utf-8') + (SRC / 'style.css').read_text(encoding='utf-8') + ''.join('\n/* ' + p.name + ' */\n' + p.read_text(encoding='utf-8') for p in sorted((SRC / 'css').glob('*.css')))
body = (SRC / 'index.src.html').read_text(encoding='utf-8')
chapters = ''.join((p.read_text(encoding='utf-8') + '\n') for p in sorted((SRC / 'chapters').glob('*.html')) if not CHS or any(p.name.startswith(c) for c in CHS))
body = body.replace('<!--CHAPTERS-->', chapters)
js = (R / outjs).read_text(encoding='utf-8').replace('</script', '<\\/script')

TITLE = 'Síkalapokat érő hatások'
DESC = ('Interaktív tananyag a síkalapokat érő hatásokról: rezgés és rezonancia, földrengések és az EC8, földalatti üregek, '
        'a talajvíz kimosó hatása és a fagyhatás – szimulátorokkal, valós esetekkel, animációs videókkal és kvízekkel.')
fonts = ('<link rel="preload" href="fonts/fraunces-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>'
         '<link rel="preload" href="fonts/manrope-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>')
icon = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 36'%3E%3Crect x='1' y='1' width='34' height='34' rx='9' fill='%231b1e26'/%3E"
        "%3Cpath d='M4 22h6l2-9 3 15 3-19 3 13 2-5 2 5h7' fill='none' stroke='%23ff5a4e' stroke-width='2.6' stroke-linejoin='round' stroke-linecap='round'/%3E%3C/svg%3E")
theme_boot = "<script>try{var t=localStorage.getItem('hz-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}</script>"
hyph = ('<script src="vendor/hyphenopoly/Hyphenopoly_Loader.js"></script>\n'
        '<script>Hyphenopoly.config({ require: { "hu": "FORCEHYPHENOPOLY" }, setup: { hide: "none", selectors: { ".hyphenate": { minWordLength: 6, compound: "auto" } } } });</script>')
html = f'''<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{TITLE}</title>
<meta name="description" content="{DESC}">
<meta name="theme-color" content="#f3eee3">
<meta property="og:title" content="{TITLE} – interaktív tananyag">
<meta property="og:description" content="{DESC}">
<meta property="og:image" content="https://sikalapokaterohatasok.vercel.app/img/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{icon}">
{theme_boot}
{fonts}
{hyph}
<style>
{css}
</style>
</head>
<body>
{body}
<script>{js}</script>
</body>
</html>
'''
outname = f'dev-{BID}.html' if BID else 'index.html'
(R.parent / outname).write_text(html, encoding='utf-8')
print(outname, len(html) // 1024, 'KB')
