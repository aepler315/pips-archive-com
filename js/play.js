import { parsePuzzle, emptyState, place, remove, flip, canPlace, evaluate, adjacent, key, LEVELS } from './engine.js';
import { boardSvg, traySvg, tile, pips, paintCells } from './render.js';
import { getResult, getProgress, saveProgress, clearProgress, recordSolve, fmt } from './store.js';

const qs = new URLSearchParams(location.search);
const date = qs.get('d');
const level = LEVELS.includes(qs.get('l')) ? qs.get('l') : 'easy';
const $ = (s) => document.querySelector(s);

if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
  $('#title').textContent = 'No puzzle chosen';
  $('#sub').innerHTML = 'Pick a date from the <a href="./">archive</a>.';
  throw new Error('no date');
}

const raw = await fetch(`data/puzzles/${date}.json`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
  .catch((e) => { $('#title').textContent = `No puzzle for ${date}`; $('#sub').innerHTML = `It may not be archived yet. <a href="./">Back to the archive</a>.`; throw e; });

const puzzle = parsePuzzle(raw[level]);
const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
document.title = `Pips ${date} ${level} — pipsarchive`;
$('#title').textContent = dateLabel;
$('#sub').textContent = `${level[0].toUpperCase() + level.slice(1)} · by ${raw[level].constructors ?? 'unknown'}`;
for (const l of LEVELS) {
  const a = $(`#lvl-${l}`); a.href = `play.html?d=${date}&l=${l}`;
  if (l === level) a.setAttribute('aria-current', 'page');
  if (getResult(date, l)) a.classList.add('done');
}

// ---- state ----
let state = emptyState(puzzle);
let elapsed = 0;                 // ms accumulated while visible and unsolved
let tickStart = null;            // performance.now() when the current running stretch began
let solvedFlag = false;
let sel = null;                  // { kind: 'tray', d } | { kind: 'board', d } | null
let anchor = null;               // [r,c] first-tapped cell for a tray selection

const progress = getProgress(date, level);
if (progress?.state?.length === state.length) { state = progress.state; elapsed = progress.elapsed ?? 0; }

// ---- board ----
const { svg, cellRects, hitRects, tiles, assigned } = boardSvg(puzzle);
$('#board').append(svg);
const trayEl = $('#tray');
const trayBtns = puzzle.dominoes.map(([a, b], d) => {
  const btn = document.createElement('button');
  btn.setAttribute('aria-label', `domino ${a}-${b}`);
  btn.append(traySvg(a, b));
  btn.addEventListener('click', () => onTray(d));
  trayEl.append(btn);
  return btn;
});

function draw() {
  const ev = evaluate(puzzle, state);
  paintCells(cellRects, puzzle, assigned, ev.regions, anchor);
  tiles.replaceChildren();
  state.forEach((p, d) => {
    if (!p) return;
    const [a, b] = puzzle.dominoes[d];
    const g = tile(p.cells[0], p.cells[1], a, b, 'tile' + (sel?.kind === 'board' && sel.d === d ? ' selected' : ''));
    tiles.append(g);
  });
  if (anchor && sel?.kind === 'tray') tiles.append(pips(anchor[1], anchor[0], puzzle.dominoes[sel.d][0], 'pip ghost'));
  trayBtns.forEach((btn, d) => {
    btn.className = (state[d] ? 'placed' : '') + (sel?.kind === 'tray' && sel.d === d ? ' selected' : '');
    btn.disabled = !!state[d];
  });
  $('#placed').textContent = `${ev.placed} / ${ev.total} placed`;
  $('#board-actions').replaceChildren();
  if (sel?.kind === 'board') {
    $('#board-actions').append(btn('Flip', () => { state = flip(state, sel.d); afterMove(); }),
                               btn('Return to tray', () => { state = remove(state, sel.d); sel = null; afterMove(); }));
  }
  $('#hint').textContent = solvedFlag ? '' : sel?.kind === 'tray'
    ? (anchor ? 'Tap a neighbouring cell for the other half.' : 'Tap the cell for the first half.')
    : sel?.kind === 'board' ? 'Tap again to flip, or return it to the tray.' : 'Tap a domino, then two cells.';
  if (ev.solved && !solvedFlag) onSolved();
}
const btn = (label, fn, cls = 'btn') => { const b = document.createElement('button'); b.className = cls; b.textContent = label; b.addEventListener('click', fn); return b; };

// ---- interaction ----
function onTray(d) {
  if (solvedFlag || state[d]) return;
  sel = sel?.kind === 'tray' && sel.d === d ? null : { kind: 'tray', d };
  anchor = null; draw();
}
function onPlaced(d) {
  if (solvedFlag) return;
  if (sel?.kind === 'board' && sel.d === d) { state = flip(state, d); afterMove(); return; }
  sel = { kind: 'board', d }; anchor = null; draw();
}
function onCell(cell) {
  if (solvedFlag) return;
  const occupiedBy = state.findIndex((p) => p && p.cells.some((c) => key(...c) === key(...cell)));
  if (occupiedBy >= 0) { onPlaced(occupiedBy); return; }
  if (sel?.kind !== 'tray') { sel = null; anchor = null; draw(); return; }
  if (!anchor) { anchor = cell; draw(); return; }
  if (key(...anchor) === key(...cell)) { anchor = null; draw(); return; }
  if (adjacent(anchor, cell) && canPlace(puzzle, state, sel.d, anchor, cell)) {
    state = place(puzzle, state, sel.d, anchor, cell);
    const next = state.findIndex((p) => !p);
    sel = next >= 0 ? { kind: 'tray', d: next } : null;
    anchor = null; afterMove();
  } else { anchor = cell; draw(); }
}
for (const [k, hit] of hitRects) hit.addEventListener('click', () => onCell(k.split(',').map(Number)));
svg.addEventListener('click', (e) => { if (e.target === svg) { sel = null; anchor = null; draw(); } });

function afterMove() {
  if (!solvedFlag && tickStart === null) startClock();
  persist(); draw();
}
function persist() { if (!solvedFlag) saveProgress(date, level, state, currentElapsed()); }

// ---- clock: runs only while the tab is visible and the puzzle is unsolved ----
const timerEl = $('#timer');
const currentElapsed = () => elapsed + (tickStart === null ? 0 : performance.now() - tickStart);
function startClock() { if (tickStart === null && !solvedFlag) { tickStart = performance.now(); timerEl.classList.remove('paused'); } }
function stopClock() { if (tickStart !== null) { elapsed += performance.now() - tickStart; tickStart = null; timerEl.classList.add('paused'); } }
setInterval(() => { timerEl.textContent = fmt(currentElapsed()); }, 250);
timerEl.textContent = fmt(elapsed);
const started = () => state.some(Boolean);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopClock(); persist(); } else if (started()) startClock();
});
addEventListener('pagehide', () => { stopClock(); persist(); });
if (started()) startClock();

// ---- solve / reset ----
function onSolved() {
  stopClock(); solvedFlag = true; sel = null; anchor = null;
  const ms = Math.round(elapsed);
  const res = recordSolve(date, level, ms);
  const box = $('#solved');
  box.hidden = false;
  box.querySelector('strong').textContent = fmt(ms);
  box.querySelector('.detail').textContent = res.plays > 1 ? `Best ${fmt(res.best)} over ${res.plays} plays.` : 'First solve.';
  $(`#lvl-${level}`).classList.add('done');
  $('#hint').textContent = '';
}
$('#share').addEventListener('click', async () => {
  const text = `Pips ${date} ${level}: ${fmt(Math.round(elapsed))}\nhttps://pipsarchive.com/play.html?d=${date}&l=${level}`;
  try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); $('#share').textContent = 'Copied'; } } catch {}
});
$('#reset').addEventListener('click', () => {
  if (!confirm('Clear the board and restart the clock?')) return;
  stopClock(); state = emptyState(puzzle); elapsed = 0; solvedFlag = false; sel = null; anchor = null;
  clearProgress(date, level); $('#solved').hidden = true; timerEl.textContent = fmt(0); draw();
});

if (getResult(date, level) && !progress) {
  // Previously solved and not mid-replay: start fresh but show the record.
  const r = getResult(date, level);
  $('#hint').textContent = `You solved this in ${fmt(r.first)}. Playing again keeps your best.`;
}
draw();
