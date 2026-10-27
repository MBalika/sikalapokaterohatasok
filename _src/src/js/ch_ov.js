// CH0 – Áttekintés: hatáskártyák jelalakjai, „Hatásdetektív”
import { register, h, $, $$, shell } from './core.js';
import { tracePath } from './ui.js';

// a hatáskártyák fejlécében a csatorna jelalakja
document.addEventListener('DOMContentLoaded', paintFx);
if (document.readyState !== 'loading') setTimeout(paintFx, 0);
function paintFx() {
  $$('svg[data-wave]').forEach((s) => { if (s.dataset.done) return; s.dataset.done = 1; const w = s.dataset.wave; s.innerHTML = `<path d="${tracePath(w, 240, 86, w === 'quake' ? 1 : 0.4, w === 'vib' ? 4.5 : 9.5, 300)}"/>`; });
}

const FXN = { vib: 'Rezgés', quake: 'Földrengés', cav: 'Üreg', wash: 'Kimosás', frost: 'Fagy', clay: 'Agyag' };
const FXC = { vib: 'c1', quake: 'c2', cav: 'c3', wash: 'c4', frost: 'c5', clay: 'c7' };
const CASES = [
  { t: 'Belvárosi foghíjtelken vibrátorral szádfalat vernek. A szomszédos, 1900 körül épült ház utcai fala két hét alatt megrepedt, a lábazatnál 2 cm süllyedést mértek. Alatta telített, finom homok van.', a: 'vib', e: 'A vibrátor rezgése a telített, laza finom homokot tömöríti. A forrás 20–30 m-es hatászónáján belül a szomszéd épületben rezgést kell mérni.' },
  { t: 'Dunaparti, homokos-kavicsos talajra épült raktár sarka a tavaszi árhullám gyors levonulása után megsüllyedt. A rézsű lábánál apró homokkúpok látszottak.', a: 'wash', e: 'Gyors apadáskor a part alatti talajvíz magasan marad, erős áramlás indul a meder felé, és ez elhordja a finom szemcséket – a homokkúpok a kimosott anyag.' },
  { t: 'Egy egri ház udvarán reggelre kerek, három méteres gödör nyílt, a ház hátsó fala megbillent. A telek alatt tufába vájt, régi borospince fut.', a: 'cav', e: 'Az átázott tufában a pince boltozata beszakadt, a föld az üreg felé mozdult. A felszínen teknő vagy beszakadás jelenik meg.' },
  { t: 'Az új hűtőház (−28 °C) padlója a harmadik évtől domborodni kezdett, a raktárpolcok megdőltek, a kapuk beszorultak.', a: 'frost', e: 'A padló alatt évről évre mélyebbre hatol a fagy, az iszapos rétegben jéglencsék nőnek. Hőszigetelés és padlófűtés kell.' },
  { t: 'Hajnalban rázkódás ébresztette a város lakóit. Több kémény ledőlt, a régi vályogházak falain ferde repedések jelentek meg.', a: 'quake', e: 'Kéményledőlés, falrepedés: legalább VII. fokú intenzitás. A rengés hatása a fészektől távolodva csökken, a puha talaj felerősíti.' },
  { t: 'Egy földszintes, 0,6 m mélyen alapozott ház falán egy aszályos nyár végén ferde repedések nyíltak, télre szinte bezárultak. A ház kövér agyagon áll, a kertben nagy nyárfák nőnek.', a: 'clay', e: 'Térfogatváltozó agyag: kiszáradva zsugorodik, átnedvesedve duzzad, a repedések évszakosan nyílnak és záródnak. Részletesen: <a href="https://kedvezotlen-altalaj.vercel.app/#terfogatvaltozo" target="_blank" rel="noopener">Alapozás kedvezőtlen altalajon ↗</a>' },
  { t: 'A pince ablakát egész télen nyitva hagyták. A pincepadló megemelkedett és megrepedt, tavasszal visszaroskadt.', a: 'frost', e: 'A nyitott ablakon a hideg a pince padlója alatt is átfagyasztotta a talajt. A fagyemelés olvadáskor visszaroskadással jár.' },
  { t: 'Amikor egy munkagödröt víztelenítettek, a zsompból szivattyúzott víz napokig zavaros, homokos volt. A szomszéd ház alapja alatt fellazult a talaj, a ház megsüllyedt.', a: 'wash', e: 'Folyós homokból a szivattyú a vízzel a homokot is kiszívja. A zavaros víz figyelmeztető jel: szűrőzött kutakkal, szűrőréteggel kell víztelenteni.' },
  { t: 'Az épület alatt elhaladt az új metróalagút. Fél év alatt 5 cm-t süllyedt az épület, megrepedtek a főfalak és a boltozatok.', a: 'cav', e: 'Az alagút is üreg: a vájás körül a föld befelé mozdul, a felszínen süllyedési teknő halad végig. Ilyenkor folyamatos épületfigyelés kell.' },
  { t: 'Egy nyomda nagyteljesítményű gépe mellett az üzemcsarnok padlója idővel megsüllyedt. A gép felpörgésekor a gépalap egy fordulatszámnál feltűnően erősen rezgett.', a: 'vib', e: 'A gépalap dinamikusan terhelt alap. Ha a gép fordulatszáma a rendszer önrezgésszámának közelébe esik, rezonancia lép fel.' },
  { t: 'Alföldi tanya, a ház alatt laza, vízzel telített homok. Egy rengés után a ház megdőlt, az udvaron a repedésekből homok buzgott fel.', a: 'quake', e: 'Folyósodás: a ciklikus nyírás a laza, telített homokban megemeli a pórusvíznyomást, a talaj elveszti a teherbírását. A homokbuzgár a jele.' },
];

register('ov-sort', (root) => {
  const { viz, out } = shell(root, { tag: 'Játék' });
  const grid = h('div', { class: 'grid2' });
  let ok = 0, done = 0;
  const score = h('div', { class: 'stat' }, h('div', { class: 'stat-l' }, 'Eredmény'), h('div', { class: 'stat-v' }, `0\u00a0/\u00a0${CASES.length}`));
  CASES.forEach((c, i) => {
    const exp = h('p', { class: 'note', hidden: true, style: 'margin:10px 0 0' });
    const btns = h('div', { class: 'btnrow', style: 'margin-top:10px' });
    const card = h('div', { class: 'card', style: 'display:flex;flex-direction:column' }, h('span', { class: 'k', style: 'color:var(--muted)' }, `${String(i + 1).padStart(2, '0')}. kárhely`), h('p', { style: 'margin:0;font-size:15.5px' }, c.t), btns, exp);
    Object.keys(FXN).forEach((k) => {
      const b = h('button', { type: 'button', class: 'btn btn-line btn-sm', style: `--c:var(--${FXC[k]})` }, FXN[k]);
      b.addEventListener('click', () => {
        if (card.dataset.done) return; card.dataset.done = 1; done++;
        const right = k === c.a; if (right) ok++;
        $$('button', btns).forEach((x) => { x.disabled = true; });
        b.style.cssText += right ? ';background:var(--ok);color:#fff;border-color:var(--ok);opacity:1' : ';background:var(--bad);color:#fff;border-color:var(--bad);opacity:1';
        if (!right) { const rb = $$('button', btns).find((x) => x.textContent === FXN[c.a]); rb.style.cssText += ';border-color:var(--ok);color:var(--ok);opacity:1;border-width:2px'; }
        exp.hidden = false; exp.innerHTML = `<b style="color:var(--${FXC[c.a]})">${FXN[c.a]}.</b> ${c.e}`;
        card.style.borderColor = right ? 'var(--ok)' : 'var(--bad)';
        $('.stat-v', score).textContent = `${ok}\u00a0/\u00a0${CASES.length}`;
        if (done === CASES.length) score.dataset.s = ok >= 0.8 * CASES.length ? 'ok' : ok >= 0.6 * CASES.length ? 'warn' : 'bad';
      });
      btns.append(b);
    });
    grid.append(card);
  });
  viz.append(grid);
  out.append(score, h('div', { class: 'verdict' }, h('b', {}, 'Tipp'), 'A helyszíni nyomok sokat elárulnak: homokkúp – kimosás vagy folyósodás; kerek beszakadás – üreg; télen emelkedő, tavasszal visszaroskadó padló – fagy; nyár végén nyíló, télre záródó repedés kövér agyagon – duzzadó-zsugorodó agyag.'));
});
