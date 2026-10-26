'use strict';
/*
  node scripts/validate-xml.js <file.xml> [...]

  Checks each file against the S1000D schema set it declares (bundled in
  vendor/schemas) and against the XML safety guard. Prints one line per
  problem; exits 1 if any file fails.
*/
const fs = require('node:fs');
const path = require('node:path');
const { validateDocument } = require('../vendor/engine/validateSchema');
const { checkXmlSafety } = require('../vendor/engine/xmlGuard');

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: node scripts/validate-xml.js <file.xml> [...]'); process.exitCode = 2; return; }
  let failed = 0;
  for (const f of files) {
    const xml = fs.readFileSync(f, 'utf8');
    const guard = checkXmlSafety(xml);
    const r = await validateDocument(path.basename(f), xml);
    const problems = [...(guard.ok ? [] : [{ line: 1, message: guard.error }]), ...r.diagnostics];
    if (!r.schema) problems.push({ line: 1, message: `no schema checked${r.note ? `: ${r.note}` : ''}` });
    if (problems.length) {
      failed++;
      for (const p of problems) console.log(`FAIL ${path.basename(f)}:${p.line}  ${p.message.trim()}`);
    } else {
      console.log(`ok   ${path.basename(f)}  (${r.schema})`);
    }
  }
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
