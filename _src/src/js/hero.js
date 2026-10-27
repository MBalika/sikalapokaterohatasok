// Hős: „Egy ház, öt hatás” – 3D metszet egy sávalapos házzal; a választott hatás szerint deformálódik a talaj és a ház,
// a ház két sarkának függőleges (földrengésnél vízszintes) mozgását egy regisztráló „toll” rajzolja.
import * as THREE from 'three';
import { $, h, cssVar, clamp, smooth, onTheme } from './core.js';

const X0 = -18, X1 = 18, YB = -14, ZB = -11;           // a talajtömb: x, alsó sík, hátsó sík (elöl a z = 0 metszet)
const HOUSE = { x0: -5, x1: 5, z0: -8, z1: 0, h: 6.2, roof: 2.6 };
const FOOT = { L: { x: -4.6, b: 0.9, top: -0.25, bot: -0.75 }, R: { x: 4.6, b: 0.9, top: -0.35, bot: -1.15 } }; // a bal sávalap sekély (fagyhatár fölött)
const RIVER = { x0: 11.5, x1: 13.6, bed: -3.4 };       // jobb oldalon folyó (rézsű 11,5 → 13,6 m között)
const LAYERS = [ // y felső, név, szín-változó
  { top: 0, bot: -0.9, key: '--soilE', name: 'feltöltés' },
  { top: -0.9, bot: -6.2, key: '--soilA', name: 'iszapos finom homok' },
  { top: -6.2, bot: YB, key: '--soilB', name: 'agyag' },
];
const EX = 10; // torzítás (a süllyedés tízszeresen látszik)

const FX = {
  vib: { c: 'c1', n: 'Rezgés', tag: 'CH1 · rezgés', cap: '<b>Szádfalverés 9 m-re.</b> A vibrátor rezgése a telített, laza finom homokot tömöríti: a közelebbi sarok jobban süllyed, a fal megreped.', rec: 'v' },
  quake: { c: 'c2', n: 'Földrengés', tag: 'CH2 · földrengés', cap: '<b>Rengés a mélyben.</b> A fészekből induló hullámok a felszínen vízszintesen rázzák az épületet – a puha talaj felerősíti a mozgást.', rec: 'hz' },
  cav: { c: 'c3', n: 'Üreg', tag: 'CH3 · üreg', cap: '<b>Beszakad a régi pince.</b> A föld az üreg felé mozdul, a felszínen süllyedési teknő nyílik; a ház a teknő felé billen.', rec: 'v' },
  wash: { c: 'c4', n: 'Kimosás', tag: 'CH4 · kimosás', cap: '<b>Gyorsan apad a folyó.</b> A part alatti talajvíz a meder felé áramlik, kimossa a finom szemcséket, az alap alatt üreg nő.', rec: 'v' },
  frost: { c: 'c5', n: 'Fagy', tag: 'CH5 · fagy', cap: '<b>Három hét fagy.</b> Az iszapos talajban jéglencsék nőnek; a fagyhatár fölött álló bal oldali alapot megemeli a fagy.', rec: 'v' },
};
const ORDER = ['vib', 'quake', 'cav', 'wash', 'frost'];
const LOOP = 13; // s

const col = (k) => new THREE.Color(cssVar(k) || '#888');

export function initHero() {
  const cv = $('#heroCv'); if (!cv) return;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'low-power' }); } catch (e) { $('#heroCap').innerHTML = '<b>A 3D nézethez WebGL kell.</b> A böngésző ezt most nem támogatja.'; return; }
  renderer.setPixelRatio(Math.min(1.75, devicePixelRatio || 1));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1.6, 0.5, 300);
  const camBase = new THREE.Vector3(-10, 9, 47), look = new THREE.Vector3(0.8, -3.3, -3);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(-12, 20, 16); scene.add(sun);

  /* ---------------- terep (felső felület), oldallap, metszet */
  const top = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, -ZB, 144, 22), new THREE.MeshLambertMaterial({ vertexColors: true }));
  top.geometry.rotateX(-Math.PI / 2); top.geometry.translate(0, 0, ZB / 2);
  const topP0 = Float32Array.from(top.geometry.attributes.position.array);
  top.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(topP0.length), 3));
  scene.add(top);
  const groundY = (x) => x < RIVER.x0 ? 0 : x > RIVER.x1 ? RIVER.bed : RIVER.bed * smooth((x - RIVER.x0) / (RIVER.x1 - RIVER.x0));

  const sec = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, -YB, 144, 56), new THREE.MeshBasicMaterial({ vertexColors: true }));
  sec.geometry.translate(0, YB / 2, 0);
  const secP0 = Float32Array.from(sec.geometry.attributes.position.array);
  sec.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(secP0.length), 3));
  scene.add(sec);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(-ZB, -YB, 10, 28), new THREE.MeshLambertMaterial({ vertexColors: true }));
  side.geometry.rotateY(-Math.PI / 2); side.geometry.translate(X0, YB / 2, ZB / 2);
  side.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(side.geometry.attributes.position.count * 3), 3));
  scene.add(side);

  const layerColor = (y, x, z = 0) => {
    const L = LAYERS.find((l) => y <= l.top + 1e-6 && y >= l.bot - 1e-6) || LAYERS[2];
    const c = col(L.key);
    const n = (Math.sin(x * 3.1 + y * 5.3 + z) * 0.5 + Math.sin(x * 7.7 - y * 2.9) * 0.5) * 0.035;
    c.offsetHSL(0, 0, n + (y < -10 ? -0.04 : 0));
    return c;
  };
  function paintStatic() {
    const sc = sec.geometry.attributes.color, sp = secP0;
    for (let i = 0; i < sc.count; i++) { const x = sp[i * 3], y = sp[i * 3 + 1]; const c = layerColor(y, x); sc.setXYZ(i, c.r, c.g, c.b); }
    sc.needsUpdate = true;
    const dc = side.geometry.attributes.color, dp = side.geometry.attributes.position;
    for (let i = 0; i < dc.count; i++) { const c = layerColor(dp.getY(i), dp.getZ(i)); c.multiplyScalar(0.86); dc.setXYZ(i, c.r, c.g, c.b); }
    dc.needsUpdate = true;
  }
  paintStatic();

  /* ---------------- víz (folyó a metszetben és felül), talajvízszint */
  const waterMat = new THREE.MeshLambertMaterial({ color: col('--water'), transparent: true, opacity: 0.62 });
  const riverTop = new THREE.Mesh(new THREE.PlaneGeometry(X1 - RIVER.x0 + 0.5, -ZB), waterMat);
  riverTop.rotation.x = -Math.PI / 2; riverTop.position.set((X1 + RIVER.x0) / 2, -1, ZB / 2); scene.add(riverTop);
  const riverSec = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: col('--water'), transparent: true, opacity: 0.55 }));
  riverSec.position.z = 0.03; scene.add(riverSec);
  const gwLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: col('--water'), dashSize: 0.5, gapSize: 0.3 }));
  gwLine.position.z = 0.05; scene.add(gwLine);
  const gwTri = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.4, 3), new THREE.MeshBasicMaterial({ color: col('--water') })); gwTri.rotation.x = Math.PI; gwTri.position.z = 0.06; scene.add(gwTri);

  /* ---------------- ház, alapok */
  const house = new THREE.Group(); scene.add(house);
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xe9e1d0 }), roofMat = new THREE.MeshLambertMaterial({ color: 0xa4553d }), winMat = new THREE.MeshLambertMaterial({ color: 0x3c5160 });
  const W = HOUSE.x1 - HOUSE.x0, D = HOUSE.z1 - HOUSE.z0;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, HOUSE.h, D), wallMat); body.position.set(0, HOUSE.h / 2, (HOUSE.z0 + HOUSE.z1) / 2); house.add(body);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, 0.45, D + 0.12), new THREE.MeshLambertMaterial({ color: 0x9d968b })); plinth.position.set(0, 0.22, body.position.z); house.add(plinth);
  const rs = new THREE.Shape(); rs.moveTo(-W / 2 - 0.5, 0); rs.lineTo(W / 2 + 0.5, 0); rs.lineTo(0, HOUSE.roof); rs.closePath();
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: D + 0.8, bevelEnabled: false }), roofMat); roof.position.set(0, HOUSE.h, HOUSE.z0 - 0.4); house.add(roof);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.7), new THREE.MeshLambertMaterial({ color: 0x8c4a36 })); chim.position.set(2.2, HOUSE.h + 1.7, -5); house.add(chim);
  for (const fl of [0, 1]) for (const xw of [-3.2, -0.6, 2.4]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.35, 0.08), winMat); w.position.set(xw, 1.25 + fl * 3, 0.03); house.add(w);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.08), new THREE.MeshLambertMaterial({ color: 0x6b4a33 })); door.position.set(0.95, 1.05, 0.03); house.add(door);
  // repedés a homlokzaton (bal ill. jobb oldali változat)
  const crackMat = new THREE.LineBasicMaterial({ color: 0x2a1a12 });
  const mkCrack = (pts) => { const g = new THREE.BufferGeometry().setFromPoints(pts.map(([x, y]) => new THREE.Vector3(x, y, 0.07))); const l = new THREE.Line(g, crackMat); l.visible = false; house.add(l); return l; };
  // a repedés mindig a jobban süllyedő (lejjebb kerülő) rész felé emelkedik
  const crackR = mkCrack([[1.65, 1.92], [2.0, 2.3], [1.95, 2.6], [2.4, 3.05], [2.35, 3.4], [2.85, 3.9], [2.8, 4.3], [3.3, 4.9]]);
  const crackL = mkCrack([[-1.95, 1.92], [-2.3, 2.35], [-2.2, 2.7], [-2.65, 3.1], [-2.55, 3.5], [-3.0, 3.95], [-2.95, 4.3], [-3.4, 4.95]]);
  // sávalapok metszete (a metszetsíkban) + a fal lábazata
  const footMat = new THREE.MeshBasicMaterial({ color: col('--concrete') });
  const foots = {};
  for (const k of ['L', 'R']) {
    const f = FOOT[k]; const m = new THREE.Mesh(new THREE.PlaneGeometry(f.b, f.top - f.bot), footMat);
    m.position.set(f.x, (f.top + f.bot) / 2, 0.04); scene.add(m); foots[k] = m;
    const st = new THREE.Mesh(new THREE.PlaneGeometry(0.42, -f.top), new THREE.MeshBasicMaterial({ color: col('--concrete2') })); st.position.set(f.x, f.top / 2, 0.045); scene.add(st); foots[k + 's'] = st;
  }

  /* ---------------- hatásonként külön elemek */
  // rezgés: szádfalverő gép (kezelővel a fülkében), szádlemez, hullámgyűrűk
  const rig = new THREE.Group(); rig.position.set(-12.5, 0, -6.2); scene.add(rig);
  const yel = new THREE.MeshLambertMaterial({ color: 0xe0a21c }), dark = new THREE.MeshLambertMaterial({ color: 0x2c2f33 }), steel = new THREE.MeshLambertMaterial({ color: 0x7a8590 });
  for (const s of [-1, 1]) { const tr = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.9, 0.8), dark); tr.position.set(0, 0.45, s * 1.25); rig.add(tr); }
  const rb = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.4, 2.6), yel); rb.position.set(-0.4, 1.6, 0); rig.add(rb);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.3), new THREE.MeshLambertMaterial({ color: 0x8fb4c7, transparent: true, opacity: 0.7 })); cab.position.set(0.7, 2.95, 0.6); rig.add(cab);
  const opBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 4, 8), new THREE.MeshLambertMaterial({ color: 0xf27b1d })); opBody.position.set(0.55, 2.85, 0.6); rig.add(opBody);
  const opHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 })); opHead.position.set(0.55, 3.35, 0.6); rig.add(opHead);
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.45, 12, 0.45), yel); mast.position.set(2.0, 6.6, 0); rig.add(mast);
  const vibro = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.9), steel); vibro.position.set(2.75, 4.2, 0); rig.add(vibro);
  const pileSheet = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 0.06), new THREE.MeshLambertMaterial({ color: 0x6a5446 })); pileSheet.position.set(2.75, 0.5, 0); rig.add(pileSheet);
  const ringMat = new THREE.LineBasicMaterial({ color: col('--c1'), transparent: true, opacity: 0.8 });
  const rings = []; for (let i = 0; i < 5; i++) { const pts = []; for (let k = 0; k <= 64; k++) { const a = (k / 64) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a), 0.06, Math.sin(a))); } const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat); scene.add(l); rings.push(l); }
  const densMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: col('--c1'), transparent: true, opacity: 0.0 })); densMesh.position.z = 0.02; scene.add(densMesh);

  // földrengés: vető, fészek, hullámfrontok
  const faultMat = new THREE.LineDashedMaterial({ color: col('--c2'), dashSize: 0.35, gapSize: 0.25 });
  const fault = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-15, -14, 0.05), new THREE.Vector3(-6, -8.5, 0.05)]), faultMat); fault.computeLineDistances(); scene.add(fault);
  const hypo = new THREE.Mesh(new THREE.CircleGeometry(0.42, 5), new THREE.MeshBasicMaterial({ color: col('--c2') })); hypo.position.set(-10.5, -11.2, 0.07); scene.add(hypo);
  const waveMat = new THREE.LineBasicMaterial({ color: col('--c2'), transparent: true, opacity: 0.9 });
  const waves = []; for (let i = 0; i < 4; i++) { const l = new THREE.Line(new THREE.BufferGeometry(), waveMat); l.position.z = 0.06; scene.add(l); waves.push(l); }

  // üreg: téglaboltozatos pince a ház bal fele alatt, beszakadás
  const CAV = { x: -2.2, y0: -5.4, y1: -3.2, w: 3.0 };
  const cavMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x1a1612 })); cavMesh.position.z = 0.03; scene.add(cavMesh);
  const archMat = new THREE.MeshBasicMaterial({ color: col('--brick') });
  const archPieces = []; for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.BufferGeometry(), archMat); m.position.z = 0.035; scene.add(m); archPieces.push(m); }
  const shearMat = new THREE.LineDashedMaterial({ color: col('--c3'), dashSize: 0.4, gapSize: 0.25 });
  const shearL = new THREE.Line(new THREE.BufferGeometry(), shearMat), shearR = new THREE.Line(new THREE.BufferGeometry(), shearMat); shearL.position.z = shearR.position.z = 0.06; scene.add(shearL, shearR);

  // kimosás: szemcsék, üreg az alap alatt
  const NP = 140; const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const parts = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: col('--c4'), size: 0.22 })); parts.position.z = 0.07; scene.add(parts);
  const pSeed = Array.from({ length: NP }, (_, i) => ({ x: 2 + ((i * 37) % 97) / 97 * 10, y: -1.6 - ((i * 53) % 89) / 89 * 3.6, s: 0.6 + ((i * 29) % 31) / 31 }));
  const washCav = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x1a1612 })); washCav.position.z = 0.032; scene.add(washCav);

  // fagy: fagyott zóna, jéglencsék, hó
  const frostMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: col('--ice'), transparent: true, opacity: 0.45 })); frostMesh.position.z = 0.025; scene.add(frostMesh);
  const lensMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  const lenses = []; for (let i = 0; i < 16; i++) { const l = new THREE.Line(new THREE.BufferGeometry(), lensMat); l.position.z = 0.055; scene.add(l); lenses.push({ l, x: -16 + ((i * 47) % 100) / 100 * 26, d: 0.25 + ((i * 31) % 17) / 17 * 0.85, w: 0.8 + ((i * 13) % 7) / 7 * 1.6 }); }

  /* ---------------- állapot, mezők */
  let mode = 'vib', t0 = performance.now() / 1000, T = 0, running = true, visible = true, paused = false;
  const rec = { L: [], R: [] };

  const env = () => smooth((T - 1.2) / 7.0); // 0 → 1 a hatás kifejlődése
  // függőleges elmozdulás (m, torzítva) a metszet (x, y) pontjában
  function uy(x, y) {
    const e = env();
    if (mode === 'vib') { // tömörödés a homokban, a gép felé erősödő
      const g = Math.exp(-((x + 7) ** 2) / 70); const yb = -6.2;
      return y < yb ? 0 : -0.75 * e * g * clamp((y - yb) / (0 - yb), 0, 1) ** 0.8;
    }
    if (mode === 'cav') {
      const c = smooth((T - 2.2) / 1.6); const yc = CAV.y1; if (y < CAV.y0) return 0;
      if (y < yc) return 0;
      const hgt = y - yc, i = 1.4 + 0.42 * hgt; const S = c * (1.6 * 1.4) / i * (1 + 0.15 * e);
      return -S * Math.exp(-((x - CAV.x) ** 2) / (2 * i * i));
    }
    if (mode === 'wash') {
      const c = smooth((T - 3.2) / 6.0); const xc = 4.8, yc = -1.8;
      if (y < -4.5) return 0;
      const hgt = Math.max(0, y - yc), i = 0.9 + 0.35 * hgt;
      return -c * 0.85 * (0.9 / i) * Math.exp(-((x - xc) ** 2) / (2 * i * i)) * (y < yc ? Math.exp(-((y - yc) ** 2) / 1.2) : 1);
    }
    if (mode === 'frost') { // emelés a fagyott zónában (a ház fűtött belseje alatt kevésbé)
      const yf = frontY(x); if (y < yf) return 0;
      const sus = y > -0.9 ? 0.55 : 1.0; // a homokos-iszapos réteg fagyérzékeny
      return 1.3 * e * sus * clamp((y - yf) / (-yf + 0.001), 0, 1) * (1 - 0.75 * insideHouse(x));
    }
    return 0;
  }
  const insideHouse = (x) => clamp((Math.min(x - (HOUSE.x0 + 0.4), (HOUSE.x1 - 0.4) - x)) / 1.4, 0, 1);
  const frontY = (x) => -(0.15 + 1.05 * env()) * (1 - 0.7 * insideHouse(x));
  // vízszintes elmozdulás (földrengés) – nyírórúd első alakja, a felszínen a legnagyobb
  const quakeA = () => { if (mode !== 'quake') return 0; const a = T - 3.0; if (a < 0) return 0; return 0.55 * Math.min(1, a * 1.5) * Math.exp(-Math.max(0, a - 2.8) * 0.45) * Math.sin(a * 2 * Math.PI * 1.25); };
  const ux = (y) => quakeA() * Math.cos((Math.PI / 2) * (y / YB));

  /* ---------------- elrendezés hatásonként */
  function setMode(m) {
    mode = m; t0 = performance.now() / 1000; T = 0; rec.L = []; rec.R = [];
    const F = FX[m];
    $$btn.forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    $('#heroTag').innerHTML = `Mérőállomás · <b>${F.tag}</b> · torzítva ×${EX}`;
    $('#heroCap').innerHTML = F.cap;
    $('#heroSim').style.setProperty('--ch', `var(--${F.c})`);
    rig.visible = m === 'vib'; rings.forEach((r) => (r.visible = m === 'vib')); densMesh.visible = m === 'vib';
    fault.visible = hypo.visible = m === 'quake'; waves.forEach((w) => (w.visible = m === 'quake'));
    cavMesh.visible = m === 'cav'; archPieces.forEach((a) => (a.visible = m === 'cav')); shearL.visible = shearR.visible = m === 'cav';
    parts.visible = washCav.visible = m === 'wash';
    frostMesh.visible = m === 'frost'; lenses.forEach((l) => (l.l.visible = m === 'frost'));
    gwLine.visible = gwTri.visible = m !== 'frost';
    render();
  }
  const ctrl = $('#heroCtrl');
  const $$btn = ORDER.map((m) => { const b = h('button', { type: 'button', 'data-m': m, style: `--c:var(--${FX[m].c})` }, h('i'), FX[m].n); b.addEventListener('click', () => setMode(m)); ctrl.append(b); return b; });

  /* ---------------- képkocka */
  const tmpC = new THREE.Color();
  function shapeGeo(mesh, pts) { const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); mesh.geometry.dispose(); mesh.geometry = new THREE.ShapeGeometry(s); }
  function lineGeo(line, pts, dashed = false) { line.geometry.dispose(); line.geometry = new THREE.BufferGeometry().setFromPoints(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z || 0))); if (dashed) line.computeLineDistances(); }
  const riverLevel = () => (mode === 'wash' ? -0.9 - 2.1 * smooth((T - 1.0) / 3.2) : -1.6);
  const gwAt = (x) => { // talajvízszint a metszetben
    const rl = riverLevel();
    if (mode !== 'wash') return Math.min(-1.6, -1.6);
    const lag = -0.9 - 1.0 * smooth((T - 3.0) / 9.0); // a part alatti szint lassan követi
    const k = clamp((x - (-6)) / (RIVER.x0 + 0.6 - (-6)), 0, 1);
    return lag + (rl - lag) * k ** 2.2;
  };
  function frame() {
    const now = performance.now() / 1000; T = (now - t0) % LOOP;
    if (now - t0 >= LOOP) { t0 = now - T; rec.L = []; rec.R = []; }
    const e = env();
    // metszet: a folyómeder fölötti pontok a terepre kerülnek, majd elmozdulnak
    const sp = sec.geometry.attributes.position, s0 = secP0;
    for (let i = 0; i < sp.count; i++) { const x = s0[i * 3]; const y = Math.min(s0[i * 3 + 1], groundY(x)); sp.setXY(i, x + ux(y), y + uy(x, y)); }
    sp.needsUpdate = true;
    // terep felülről
    const tp = top.geometry.attributes.position, tc = top.geometry.attributes.color;
    const grass = col('--soilD'), snow = new THREE.Color(0xf4f7fb), sand = col('--soilA');
    for (let i = 0; i < tp.count; i++) {
      const x = topP0[i * 3], z = topP0[i * 3 + 2]; let y = groundY(x) + uy(x, groundY(x));
      if (mode === 'vib') { const r = Math.hypot(x - rig.position.x - 2.75, z - rig.position.z); y += 0.05 * e * Math.sin(r * 2.2 - T * 14) * Math.exp(-r / 10); }
      tp.setXYZ(i, x + ux(0), y, z);
      tmpC.copy(x > RIVER.x0 ? sand : grass); if (mode === 'frost') tmpC.lerp(snow, 0.85 * e); tmpC.offsetHSL(0, 0, Math.sin(x * 1.7 + z * 2.3) * 0.02);
      tc.setXYZ(i, tmpC.r, tmpC.g, tmpC.b);
    }
    tp.needsUpdate = true; tc.needsUpdate = true; top.geometry.computeVertexNormals();
    // ház: a két sarok elmozdulásából merev elfordulás
    const yL = uy(FOOT.L.x, FOOT.L.bot);
    const yR = uy(FOOT.R.x, FOOT.R.bot);
    const ang = Math.atan2(yR - yL, FOOT.R.x - FOOT.L.x);
    house.rotation.z = ang; house.position.set(ux(0) * 1.0 + (mode === 'quake' ? quakeA() * 0.25 * Math.sin(T * 9) : 0), (yL + yR) / 2, 0);
    if (mode === 'quake') { body.rotation.z = -quakeA() * 0.05; roof.position.x = -quakeA() * 0.3; } else { body.rotation.z = 0; roof.position.x = 0; }
    const diff = Math.abs(yR - yL);
    crackL.visible = diff > 0.2 && yL < yR; crackR.visible = diff > 0.2 && yR < yL;
    for (const k of ['L', 'R']) { const f = FOOT[k]; const dy = k === 'L' ? yL : yR; foots[k].position.set(f.x + ux(f.bot), (f.top + f.bot) / 2 + dy, 0.04); foots[k].rotation.z = ang; foots[k + 's'].position.set(f.x + ux(0), f.top / 2 + dy, 0.045); }
    // víz
    const rl = riverLevel(); riverTop.position.y = rl;
    const bedPts = []; for (let x = RIVER.x0; x <= X1 + 0.01; x += 0.25) bedPts.push([x, Math.min(groundY(x), rl)]);
    shapeGeo(riverSec, [[RIVER.x0 + (RIVER.x1 - RIVER.x0) * clamp(rl / RIVER.bed, 0, 1) * 0.9, rl], [X1, rl], ...bedPts.reverse().filter((p) => p[1] < rl - 0.01)]);
    if (gwLine.visible) { const pts = []; for (let x = X0; x <= RIVER.x0 + 1.2; x += 0.4) pts.push([x + ux(gwAt(x)), gwAt(x) + uy(x, gwAt(x)), 0]); lineGeo(gwLine, pts, true); gwTri.position.set(-14 + ux(gwAt(-14)), gwAt(-14) + 0.32, 0.06); }
    // hatás-specifikus rajzok
    if (mode === 'vib') {
      rings.forEach((r, i) => { const ph = ((T * 0.9 + i / rings.length) % 1); const R = 1 + ph * 18; r.scale.set(R, 1, R); r.position.set(rig.position.x + 2.75, 0.08, rig.position.z); r.material.opacity = 0.85 * (1 - ph) * (T > 1 && T < 10.5 ? 1 : 0); });
      vibro.position.y = 4.2 - 2.4 * smooth((T - 1) / 9) + 0.04 * Math.sin(T * 60); pileSheet.position.y = vibro.position.y - 3.7;
      const pts = []; for (let k = 0; k <= 40; k++) { const a = Math.PI * 2 * k / 40; const x = -6.5 + Math.cos(a) * 6.2, y0 = -3.5 + Math.sin(a) * 2.4; pts.push([x, y0 + uy(x, y0)]); }
      shapeGeo(densMesh, pts); densMesh.material.opacity = 0.26 * e;
    }
    if (mode === 'quake') {
      const a = T - 0.8; waves.forEach((wv, i) => { const R = (a - i * 0.55) * 7.5; if (R <= 0.2) { wv.visible = false; return; } wv.visible = true; const pts = []; for (let k = 0; k <= 120; k++) { const an = (k / 120) * Math.PI * 2; const x = hypo.position.x + Math.cos(an) * R, y = hypo.position.y + Math.sin(an) * R; if (x > X0 && x < X1 && y < 0 && y > YB) pts.push([x + ux(y), y, 0]); else if (pts.length && pts[pts.length - 1] !== null) pts.push(null); } const seg = []; let best = []; for (const p of pts) { if (p === null) { if (seg.length > best.length) best = seg.slice(); seg.length = 0; } else seg.push(p); } if (seg.length > best.length) best = seg; lineGeo(wv, best); wv.material.opacity = clamp(1 - R / 40, 0, 1); });
      hypo.scale.setScalar(1 + 0.25 * Math.sin(T * 8));
    }
    if (mode === 'cav') {
      const c = smooth((T - 2.2) / 1.6);
      const cx = CAV.x, w = CAV.w, y0 = CAV.y0, y1 = CAV.y1, yy1 = y1 + uy(cx, y1 + 0.01);
      const vault = []; for (let k = 0; k <= 16; k++) { const a = Math.PI * (k / 16); vault.push([cx + Math.cos(a) * w / 2, y0 + 1.1 + Math.sin(a) * (yy1 - y0 - 1.1) * (1 - 0.65 * c)]); }
      shapeGeo(cavMesh, [[cx - w / 2, y0], [cx + w / 2, y0], ...vault.map(([x, y]) => [x, Math.max(y0 + 0.2 + 0.9 * c, y)])]);
      archPieces.forEach((m, i) => { const a0 = Math.PI * (1 - i / 9), a1 = Math.PI * (1 - (i + 1) / 9); const R0 = w / 2, R1 = w / 2 + 0.35; const yc = y0 + 1.1;
        const pts = [[Math.cos(a0) * R0, Math.sin(a0) * R0 * 1.0], [Math.cos(a1) * R0, Math.sin(a1) * R0], [Math.cos(a1) * R1, Math.sin(a1) * R1], [Math.cos(a0) * R1, Math.sin(a0) * R1]];
        shapeGeo(m, pts); const fall = c * (1.3 + (i % 3) * 0.35) * (Math.sin(Math.PI * (i + 0.5) / 9)); m.position.set(cx + (i - 4) * 0.04 * c, yc - fall, 0.035); m.rotation.z = c * (i - 4) * 0.12; });
      const phi = 30, ang = (45 + phi / 2) * Math.PI / 180, L = (0 - y0) / Math.tan(ang);
      lineGeo(shearL, [[cx - w / 2, y0], [cx - w / 2 - L, 0 + uy(cx - w / 2 - L, 0)]], true); lineGeo(shearR, [[cx + w / 2, y0], [cx + w / 2 + L, 0 + uy(cx + w / 2 + L, 0)]], true);
      shearL.material.opacity = 1;
    }
    if (mode === 'wash') {
      const pa = pGeo.attributes.position; const on = smooth((T - 3.0) / 1.0);
      for (let i = 0; i < NP; i++) { const p = pSeed[i]; let x = p.x + ((T * 1.4 * p.s) % 11); if (x > RIVER.x1 + 1) x -= 11; const y = Math.min(gwAt(x) - 0.2, p.y) + 0.15 * Math.sin(x * 2 + i); pa.setXYZ(i, x, on > 0.01 && y < gwAt(x) ? y : 99, 0); }
      pa.needsUpdate = true;
      const c = smooth((T - 3.2) / 6.0); const pts = []; for (let k = 0; k <= 20; k++) { const a = (k / 20) * Math.PI * 2; pts.push([4.8 + Math.cos(a) * (0.25 + 1.3 * c), -1.85 + Math.sin(a) * (0.12 + 0.42 * c)]); }
      shapeGeo(washCav, pts); washCav.visible = c > 0.02;
    }
    if (mode === 'frost') {
      const pts = []; for (let x = X0; x <= RIVER.x0; x += 0.4) pts.push([x, groundY(x) + uy(x, 0)]); for (let x = RIVER.x0; x >= X0; x -= 0.4) pts.push([x, frontY(x) + uy(x, frontY(x))]);
      shapeGeo(frostMesh, pts); frostMesh.material.opacity = 0.5 * e;
      lenses.forEach((L, i) => { const yd = -L.d * (1 - 0.7 * insideHouse(L.x)); const show = frontY(L.x) < yd - 0.05 && T > 2 + i * 0.25; L.l.visible = show; if (show) { const y = yd + uy(L.x, yd); lineGeo(L.l, [[L.x - L.w / 2, y], [L.x + L.w / 2, y + 0.02]]); } });
    }
    // regisztráló toll
    const vL = mode === 'quake' ? ux(0) : yL, vR = mode === 'quake' ? ux(0) : yR;
    rec.L.push([T, vL]); rec.R.push([T, vR]);
    const mm = (v) => Math.round((v / EX) * 1000);
    recText = mode === 'quake' ? `vízszintes ${mm(Math.abs(ux(0)))} mm` : `bal ${mm(yL) > 0 ? '+' : ''}${mm(yL)} · jobb ${mm(yR) > 0 ? '+' : ''}${mm(yR)} mm`;
    drawRec();
    render();
  }
  function render() {
    const w = cv.clientWidth, hgt = cv.clientHeight; if (!w || !hgt) return;
    if (cv.width !== Math.round(w * renderer.getPixelRatio()) || cv.height !== Math.round(hgt * renderer.getPixelRatio())) { renderer.setSize(w, hgt, false); cam.aspect = w / hgt; cam.updateProjectionMatrix(); }
    const narrow = w / hgt < 1.45; cam.position.copy(camBase).multiplyScalar(narrow ? 1.12 : 1); cam.position.x += mouse.x * 1.6; cam.position.y += mouse.y * 0.8; cam.lookAt(look);
    renderer.render(scene, cam);
  }
  const rc = $('#heroRec'), rg = rc.getContext('2d'); let recText = '';
  function drawRec() {
    const dpr = Math.min(2, devicePixelRatio || 1), W2 = rc.clientWidth, H2 = rc.clientHeight; if (rc.width !== W2 * dpr) { rc.width = W2 * dpr; rc.height = H2 * dpr; }
    rg.setTransform(dpr, 0, 0, dpr, 0, 0); rg.clearRect(0, 0, W2, H2);
    rg.strokeStyle = cssVar('--line2'); rg.setLineDash([2, 4]); rg.beginPath(); rg.moveTo(0, H2 / 2); rg.lineTo(W2, H2 / 2); rg.stroke(); rg.setLineDash([]);
    const sc = mode === 'quake' ? H2 * 0.75 : H2 * 0.55;
    const drawOne = (arr, color, wdt) => { rg.strokeStyle = color; rg.lineWidth = wdt; rg.beginPath(); arr.forEach(([t, v], i) => { const x = (t / LOOP) * W2, y = H2 / 2 - clamp(v / 0.9, -1, 1) * sc / 1.2 * (mode === 'quake' ? 1 : 1); i ? rg.lineTo(x, y) : rg.moveTo(x, y); }); rg.stroke(); };
    drawOne(rec.L, cssVar('--ink2'), 1.4); if (mode !== 'quake') drawOne(rec.R, cssVar('--ch') || cssVar('--pen'), 2);
    rg.font = '500 12px "DM Mono", monospace'; const tw = rg.measureText(recText).width;
    rg.fillStyle = cssVar('--surface2'); rg.fillRect(W2 - tw - 10, H2 / 2 - 10, tw + 10, 20);
    rg.fillStyle = cssVar('--ch') || cssVar('--pen'); rg.textAlign = 'right'; rg.textBaseline = 'middle'; rg.fillText(recText, W2 - 2, H2 / 2 + 1); rg.textAlign = 'left'; rg.textBaseline = 'alphabetic';
  }
  const mouse = { x: 0, y: 0 };
  cv.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); mouse.x = ((e.clientX - r.left) / r.width - 0.5) * 2; mouse.y = ((e.clientY - r.top) / r.height - 0.5) * 2; });
  cv.addEventListener('pointerleave', () => { mouse.x = mouse.y = 0; });

  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { rootMargin: '80px' }).observe(cv);
  addEventListener('sims:pause', () => { paused = true; });
  addEventListener('sims:resume', () => { paused = false; });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastF = 0;
  const tick = (ts) => { if (visible && !paused && !document.hidden && ts - lastF > 30) { frame(); lastF = ts; } requestAnimationFrame(tick); };
  onTheme(() => { paintStatic(); waterMat.color = col('--water'); riverSec.material.color = col('--water'); gwLine.material.color = col('--water'); footMat.color = col('--concrete'); archMat.color = col('--brick'); frostMesh.material.color = col('--ice'); render(); });
  const q = new URLSearchParams(location.search);
  setMode(FX[q.get('hero')] ? q.get('hero') : 'vib');
  if (q.has('heroT')) { const ft = +q.get('heroT'); t0 = performance.now() / 1000 - ft; frame(); paused = true; return; }
  if (reduce) { t0 = performance.now() / 1000 - 9; frame(); } else requestAnimationFrame(tick);
}
