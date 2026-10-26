'use strict';
// The self-contained toolchain (npm run doctor) and the golden PDF test
// (npm run golden) as part of the test suite.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFile } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const run = (script) => new Promise((resolve) => {
  execFile(process.execPath, [path.join(ROOT, 'scripts', script)], { cwd: ROOT, timeout: 300000, windowsHide: true },
    (err, stdout, stderr) => resolve({ code: err ? err.code || 1 : 0, out: `${stdout}${stderr}` }));
});

test('doctor: every tool, schema and pipeline is found inside the project', async () => {
  const r = await run('doctor.js');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /All \d+ checks passed/);
});

test('golden: the sample publication builds and matches its baseline', async () => {
  const r = await run('golden.mjs');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Golden OK: \d+ pages, text identical to the baseline\./);
});
