import { buildIndex } from './lib.mjs';
const idx = buildIndex();
console.log(`index: ${idx.count} dates, ${idx.first} .. ${idx.last}`);
