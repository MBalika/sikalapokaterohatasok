// Belépési pont
import { bootWidgets, bootAll } from './core.js';
import { LAYOUT } from './layout.js';
import { initUI, startGuard } from './ui.js';
import { initHero } from './hero.js';
import './ch_ov.js';
import './ch_dyn.js';
import './ch_eq.js';
import './ch_cav.js';
import './ch_wash.js';
import './ch_frost.js';
import './tf.js';

initUI();
if (!/[?&]nohero\b/.test(location.search)) { try { initHero(); } catch (e) { console.error('Hős hiba', e); } }
if (/[?&]all\b/.test(location.search)) bootAll(); else bootWidgets();
startGuard();
try { LAYOUT.start(); } catch (e) { console.error('Elrendezés hiba', e); }
