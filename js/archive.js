import { getResult, fmt } from './store.js';
import { LEVELS } from './engine.js';

const idx = await fetch('data/index.json').then((r) => r.json());
const puzzles = idx.puzzles.slice().reverse(); // newest first
const $ = (s) => document.querySelector(s);
const solvedCount = puzzles.reduce((n, p) => n + LEVELS.filter((l) => getResult(p.date, l)).length, 0);
$('#sub').textContent = `${idx.count} days, ${idx.first} to ${idx.last}. You've solved ${solvedCount} of ${idx.count * 3}.`;
$('#latest').href = `play.html?d=${idx.last}&l=easy`;
$('#random').addEventListener('click', () => {
  const open = puzzles.flatMap((p) => LEVELS.filter((l) => !getResult(p.date, l)).map((l) => [p.date, l]));
  if (!open.length) { alert('You have solved everything. Wait for tomorrow.'); return; }
  const [d, l] = open[Math.floor(Math.random() * open.length)];
  location.href = `play.html?d=${d}&l=${l}`;
});

const list = $('#list');
let month = '';
for (const p of puzzles) {
  const m = p.date.slice(0, 7);
  if (m !== month) {
    month = m;
    const h = document.createElement('div'); h.className = 'month';
    h.textContent = new Date(p.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    list.append(h);
    list.append(Object.assign(document.createElement('div'), { className: 'days', id: `m-${m}` }));
  }
  const day = document.createElement('div'); day.className = 'day';
  const d = document.createElement('div'); d.className = 'd';
  d.textContent = new Date(p.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
  const chips = document.createElement('div'); chips.className = 'chips';
  for (const l of LEVELS) {
    const a = document.createElement('a'); a.href = `play.html?d=${p.date}&l=${l}`;
    const r = getResult(p.date, l);
    a.textContent = r ? fmt(r.best) : l[0].toUpperCase();
    a.title = `${l}: ${p.levels[l].rows}×${p.levels[l].cols}, ${p.levels[l].dominoes} dominoes`;
    if (r) a.className = 'done';
    chips.append(a);
  }
  day.append(d, chips);
  document.getElementById(`m-${m}`).append(day);
}
