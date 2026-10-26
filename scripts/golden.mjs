/*
  npm run golden            build samples/golden to PDF and compare with the stored baseline
  npm run golden -- --update   rebuild and REPLACE the baseline (only after checking the PDF)

  The golden test is the end-to-end proof of the PDF toolchain:
    1. every sample source passes the XML safety guard and its S1000D 4.2 schema;
    2. the sample is copied to a throwaway directory and built with the
       bundled Java, xsltproc and FOP (no warm daemon, so the run is cold and
       repeatable);
    3. page count and the text of every page are compared with
       samples/golden/baseline.json.
  Exits 1 on any failure, printing the first differences. The built PDF is
  left in the temporary directory and its path printed, for inspection.
*/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { extractPdfText } from './pdf-text.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE = path.join(ROOT, 'samples', 'golden');
const BASELINE = path.join(SAMPLE, 'baseline.json');
const update = process.argv.includes('--update');

const { validateDocument } = require('../vendor/engine/validateSchema');
const { checkXmlSafety } = require('../vendor/engine/xmlGuard');
const { buildPublication } = require('../server/publish/pdf');

function fail(msg) { console.error(`\nGOLDEN FAILED: ${msg}`); process.exitCode = 1; }

// 1. Sources
const sources = ['publication.xml', ...fs.readdirSync(path.join(SAMPLE, 'csdb')).filter((f) => f.endsWith('.xml')).map((f) => `csdb/${f}`)];
let invalid = 0;
for (const rel of sources) {
  const xml = fs.readFileSync(path.join(SAMPLE, rel), 'utf8');
  const guard = checkXmlSafety(xml);
  const r = await validateDocument(rel, xml);
  const problems = [...(guard.ok ? [] : [guard.error]), ...r.diagnostics.map((d) => `line ${d.line}: ${d.message.trim()}`), ...(r.schema ? [] : ['no schema was checked'])];
  if (problems.length) { invalid++; console.log(`  invalid  ${rel}\n           ${problems.join('\n           ')}`); }
}
console.log(`Sources: ${sources.length} files, ${invalid ? `${invalid} invalid` : 'all valid against S1000D 4.2'}`);
if (invalid) { fail('sample sources are not valid'); process.exit(); }

// 2. Build in a throwaway copy
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'agastya-golden-'));
fs.cpSync(SAMPLE, work, { recursive: true, filter: (src) => path.basename(src) !== 'baseline.json' });
const t0 = Date.now();
let built;
try {
  built = await buildPublication(work, { warmFop: false, log: { error: () => {} } });
} catch (e) {
  fail(`build failed: ${e.message}${e.hint ? ` (${e.hint})` : ''}`);
  process.exit();
}
console.log(`Build: ${((Date.now() - t0) / 1000).toFixed(1)} s, PDF at ${built.pdf}`);
for (const n of built.notes) console.log(`  note: ${n}`);
if (built.unmapped.length) console.log(`  unmapped elements: ${built.unmapped.map((u) => `${u.name} x${u.count}`).join(', ')}`);

// 3. Compare
const actual = await extractPdfText(built.pdf);
if (update) {
  fs.writeFileSync(BASELINE, JSON.stringify({
    note: 'Golden baseline for samples/golden. Regenerate only with: npm run golden -- --update (after checking the PDF).',
    pageCount: actual.pageCount,
    pages: actual.pages,
  }, null, 2) + '\n');
  console.log(`Baseline written: ${actual.pageCount} pages -> ${path.relative(ROOT, BASELINE)}`);
  process.exit();
}
if (!fs.existsSync(BASELINE)) { fail('no baseline yet; run: npm run golden -- --update'); process.exit(); }
const expected = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
const diffs = [];
if (expected.pageCount !== actual.pageCount) diffs.push(`page count: expected ${expected.pageCount}, got ${actual.pageCount}`);
for (let i = 0; i < Math.max(expected.pages.length, actual.pages.length); i++) {
  if (expected.pages[i] === actual.pages[i]) continue;
  const e = (expected.pages[i] || '').split('\n');
  const a = (actual.pages[i] || '').split('\n');
  const line = e.findIndex((l, j) => l !== a[j]);
  diffs.push(`page ${i + 1}, line ${line + 1}:\n      expected: ${JSON.stringify(e[line] ?? '(no line)')}\n      got:      ${JSON.stringify(a[line] ?? '(no line)')}`);
  if (diffs.length >= 6) break;
}
if (diffs.length) {
  console.log(diffs.map((d) => `  - ${d}`).join('\n'));
  fail(`${diffs.length}${diffs.length >= 6 ? '+' : ''} difference(s) from the baseline`);
} else {
  console.log(`Golden OK: ${actual.pageCount} pages, text identical to the baseline.`);
}
