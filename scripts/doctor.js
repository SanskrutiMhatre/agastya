'use strict';
/*
  npm run doctor: is everything the PDF build and validation need present
  INSIDE the project folder? (decisions.md P5)

  Checks the bundled Java runtime, xsltproc, Apache FOP and its fonts, the
  warm FOP server, the S1000D schema sets and entity files, the XSLT
  pipelines and front-matter stencils, and the house template. Each tool is
  actually run (execFile, argument arrays, no shell), not just looked for.
  Finally it scans the application code for any path that reaches outside
  the project. Exits 1 if anything is missing.
*/

const { runChecks, ROOT } = require('../server/health/toolchain');

async function main() {
  const { results, tools } = await runChecks();
  const outside = tools.filter((t) => t.linked && !t.insideProject);
  const width = Math.max(...results.map((r) => r.name.length));
  for (const r of results) {
    process.stdout.write(`${r.note ? ' note' : r.ok ? '  ok ' : ' MISS'}  ${r.name.padEnd(width)}  ${r.detail}\n`);
  }
  const missing = results.filter((r) => !r.ok);
  process.stdout.write(missing.length
    ? `\n${missing.length} problem(s). The PDF build will not work until they are fixed.\n`
    : outside.length
      ? `\nAll ${results.length} checks passed, but ${outside.map((t) => t.name).join(' and ')} ${outside.length === 1 ? 'is a link' : 'are links'} to tools outside ${ROOT} (see the notes).\n`
      : `\nAll ${results.length} checks passed. Everything the build needs is inside ${ROOT}.\n`);
  process.exitCode = missing.length ? 1 : 0;
}

main().catch((e) => { console.error('doctor failed:', e.message); process.exitCode = 1; });
