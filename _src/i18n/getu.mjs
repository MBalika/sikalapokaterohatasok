import { collect } from './catalog.mjs';
const [root, file, ...ids] = process.argv.slice(2); const seen = new Set();
for (const u of collect(root, [file])) { if ((ids.includes(u.id) || ids.some(x => x.startsWith('/') && u.t.includes(x.slice(1)))) && !seen.has(u.id)) { seen.add(u.id); console.log(u.id + '\t' + u.cls + '\t' + u.t.replace(/\n/g, '⏎')); } }
