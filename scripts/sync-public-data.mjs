// Mirror data/puzzles/*.json (and the index) into public/data so Vite serves
// them from the client build the same way it already does in `vite dev`
// (which serves the whole project root). Generated, not committed: rebuilt
// on every `npm run build` / `npm test` so it can never drift from data/.
import { readdirSync, mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, PUZZLE_DIR, INDEX_PATH } from './lib.mjs';

const OUT_DIR = join(ROOT, 'public', 'data');
const OUT_PUZZLES = join(OUT_DIR, 'puzzles');

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_PUZZLES, { recursive: true });

let n = 0;
for (const f of readdirSync(PUZZLE_DIR)) {
  if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) continue;
  copyFileSync(join(PUZZLE_DIR, f), join(OUT_PUZZLES, f));
  n++;
}
if (existsSync(INDEX_PATH)) copyFileSync(INDEX_PATH, join(OUT_DIR, 'index.json'));

console.log(`synced ${n} puzzle files into public/data`);
