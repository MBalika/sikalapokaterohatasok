# Síkalapokat érő hatások – interaktív tananyag

Élő oldal: https://sikalapokaterohatasok.vercel.app

Egyoldalas, statikus oldal (`index.html`), a forrás a `_src/` mappában (a Vercel nem teszi ki).

- Újraépítés: `cd _src && npm install && python3 build.py` → `../index.html`
- Fejezetek: `_src/src/chapters/NN_*.html`; widgetek: `_src/src/js/ch_*.js`; hős: `hero.js`; stílus: `style.css`
- Videók: `video/h1–h6.html` (önálló lejátszók, `#autoplay`), bélyegképek: `img/thumb/`
- Magyar elválasztás: `vendor/hyphenopoly/`; betűk: `fonts/` (Fraunces, Manrope, DM Mono)
- Teszt: `index.html?all` (minden widget azonnal), `?nohero` (a 3D hős nélkül)
