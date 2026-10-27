// Fejezetek (mérőcsatornák), videók, BME-felvétel
import DUR from '../../durations.json';
export const CHAPTERS = [
  { id: 'attekintes', no: 'CH0', nav: 'Áttekintés', t: 'Áttekintés', k: 'Mi éri az alapot?', c: 'c0', wave: 'calm' },
  { id: 'dinamikus', no: 'CH1', nav: 'Rezgés', t: 'Dinamikus hatások', k: 'rezgés · rezonancia · tömörödés', c: 'c1', wave: 'vib' },
  { id: 'foldrenges', no: 'CH2', nav: 'Földrengés', t: 'Földrengések', k: 'fészek · intenzitás · EC8', c: 'c2', wave: 'quake' },
  { id: 'ureg', no: 'CH3', nav: 'Üregek', t: 'Földalatti üregnyitás', k: 'pince · bánya · alagút', c: 'c3', wave: 'drop' },
  { id: 'kimosas', no: 'CH4', nav: 'Kimosás', t: 'A talajvíz kimosó hatása', k: 'apadás · szemcsék · zsomp', c: 'c4', wave: 'flow' },
  { id: 'fagy', no: 'CH5', nav: 'Fagy', t: 'Fagyhatás', k: 'jéglencse · fagyhatár · hűtőház', c: 'c5', wave: 'heave' },
  { id: 'videok', no: 'REC', nav: 'Videók', t: 'Videótár', k: 'hat animáció', c: 'c6', wave: 'calm' },
  { id: 'teszt', no: 'TEST', nav: 'Teszt', t: 'Önellenőrzés', k: 'igaz/hamis · fogalomtár', c: 'c6', wave: 'calm' },
];

// Saját animációs videók (video/<n>.html, img/thumb/<n>.jpg)
export const VIDEOS = [
  { n: 'h1', t: 'Rezeg a talaj', s: 'Dinamikus hatások: források, érzékeny talajok, önrezgésszám, hatászóna, gépalap', d: '', g: 'electro', c: 'c1' },
  { n: 'h2', t: 'Földrengések', s: 'Fészek és epicentrum, magnitúdó és intenzitás, hazai rengések, tervezés az EC8 szerint', d: '', g: 'deep house', c: 'c2' },
  { n: 'h3', t: 'Üreg az épület alatt', s: 'Pincék, bányák, alagutak: süllyedési teknő, szakadólap, védekezés', d: '', g: 'synthwave', c: 'c3' },
  { n: 'h4', t: 'Elhordja a víz', s: 'Gyors apadás, szemcsekimosás, hídpillérek, zsompos víztelenítés folyós homokban', d: '', g: 'afro', c: 'c4' },
  { n: 'h5', t: 'Felemeli a fagy', s: 'Jéglencse-képződés, külső falak, pinceablak, hűtőházak', d: '', g: 'future bass', c: 'c5' },
  { n: 'h6', t: 'Összefoglaló és kvíz', s: 'Egy város, öt hatás – hat kérdés a fejezet anyagából', d: '', g: 'reggaeton', c: 'c6' },
];
for (const v of VIDEOS) if (DUR[v.n]) v.d = DUR[v.n];

export const YT = {
  er4WW_v5qgk: { title: 'Hídpillér körüli kimélyülés 3D modellezése', dur: '0:21', tech: 'Kimélyülés a hídpillér körül', kick: 'Kimosás a pillér körül', caps: ['4,5 perc', '15 perc', '28,5 perc', '38,5 perc'] },
};
