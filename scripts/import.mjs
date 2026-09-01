// Import raw NYT payload files from a directory (e.g. a community archive clone).
//   node scripts/import.mjs <dir> [<dir>...]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { savePayload, buildIndex } from './lib.mjs';

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (f.endsWith('.json')) yield p;
  }
}
let added = 0, skipped = 0, bad = 0;
for (const dir of process.argv.slice(2)) {
  for (const f of walk(dir)) {
    let raw; try { raw = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
    if (!raw?.printDate || !raw.easy) continue;
    try { if (savePayload(raw)) added++; else skipped++; }
    catch (e) { bad++; console.error('BAD', f, e.message); }
  }
}
const idx = buildIndex();
console.log(`added ${added}, skipped (already had) ${skipped}, rejected ${bad}; index ${idx.count} dates`);
