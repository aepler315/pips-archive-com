import { allResults, exportAll, importAll, eraseAll, fmt } from './store.js';
import { LEVELS } from './engine.js';

const $ = (s) => document.querySelector(s);
const res = allResults();
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

const card = (k, v) => { const d = document.createElement('div'); d.className = 'stat'; d.innerHTML = `<div class="k"></div><div class="v"></div>`; d.querySelector('.k').textContent = k; d.querySelector('.v').textContent = v; return d; };
const days = new Set(res.map((r) => r.date));
const fullDays = [...days].filter((d) => LEVELS.every((l) => res.some((r) => r.date === d && r.level === l))).length;
let streak = 0; { const sorted = [...days].sort().reverse(); let cur = null;
  for (const d of sorted) { if (cur && (new Date(cur) - new Date(d)) !== 864e5) break; streak++; cur = d; } }
$('#cards').append(card('Puzzles solved', res.length), card('Days fully solved', fullDays), card('Consecutive dates', streak));

const tb = $('#table tbody');
for (const l of LEVELS) {
  const xs = res.filter((r) => r.level === l).map((r) => r.best);
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${l}</td><td class="n">${xs.length}</td><td class="n">${xs.length ? fmt(Math.min(...xs)) : '–'}</td><td class="n">${xs.length ? fmt(median(xs)) : '–'}</td><td class="n">${xs.length ? fmt(mean(xs)) : '–'}</td>`;
  tb.append(tr);
}
const rb = $('#recent tbody');
for (const r of res.slice().sort((a, b) => b.lastAt.localeCompare(a.lastAt)).slice(0, 30)) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><a href="play.html?d=${r.date}&l=${r.level}">${r.date}</a></td><td>${r.level}</td><td class="n">${fmt(r.first)}</td><td class="n">${fmt(r.best)}</td>`;
  rb.append(tr);
}
if (!res.length) rb.innerHTML = '<tr><td colspan="4">Nothing yet. <a href="./">Pick a puzzle</a>.</td></tr>';

$('#export').addEventListener('click', () => {
  const blob = new Blob([exportAll()], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `pipsarchive-${new Date().toISOString().slice(0, 10)}.json` });
  a.click(); URL.revokeObjectURL(a.href);
});
$('#import').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { const n = importAll(await f.text()); alert(`Imported ${n} results.`); location.reload(); }
  catch (err) { alert(`Import failed: ${err.message}`); }
});
$('#erase').addEventListener('click', () => { if (confirm('Erase all solve data in this browser?')) { eraseAll(); location.reload(); } });
