'use strict';
/*
  Validation of project content.

    validateModule   one data module (saved or in-editor text):
                     XSD per declared S1000D issue + BREX: the project's own
                     BREX module named in brexDmRef, otherwise the bundled
                     S1000D default 4.2 BREX (as the Agastya original does),
                     with a note saying which was used
    validateProject  every live data module, plus publication-level checks:
                     missing graphics, publication entries that resolve to
                     no data module, and element ids repeated across modules
                     (which make cross-references land in the wrong place
                     once the book is assembled)

  Findings: { sev: 'error'|'warning'|'info', kind, rel, line, message }.
*/

const fs = require('node:fs');
const path = require('node:path');
const { validateDocument, declaredSchema, installedIssues } = require('../../vendor/engine/validateSchema');
const { resolveDmRefs } = require('../../vendor/engine/resolveDmRefs');
const brex = require('./brex');
const graphics = require('./graphics');
const { parseOwnDmc, formatDmc } = require('./dmc');

function csdbFiles(dir) {
  const csdb = path.join(dir, 'csdb');
  try { return fs.readdirSync(csdb).filter((f) => /\.xml$/i.test(f)).map((f) => `csdb/${f}`); } catch { return []; }
}

// BREX modules in the project, keyed by their own code string.
function brexIndex(dir) {
  const index = new Map();
  for (const rel of csdbFiles(dir)) {
    const text = fs.readFileSync(path.join(dir, rel), 'utf8');
    if (!/<brex[\s>]/.test(text)) continue;
    const own = parseOwnDmc(text);
    if (own) index.set(formatDmc(own), { rel, text });
  }
  return index;
}

// The bundled S1000D Issue 4.2 default BREX (vendor/brex, copied from Agastya).
const DEFAULT_BREX_FILE = path.join(__dirname, '..', '..', 'vendor', 'brex', 'S1000D-default-4.2.xml');
const DEFAULT_BREX_LABEL = 'S1000D default BREX (Issue 4.2)';
function defaultRules() {
  try { return brex.rulesFor('default:4.2', fs.readFileSync(DEFAULT_BREX_FILE, 'utf8')); } catch { return null; }
}

function brexFor(text, index) {
  const ref = brex.brexRefOf(text);
  const found = ref && index.get(ref);
  if (found) return { ref, rel: found.rel, own: true, rules: brex.rulesFor(`${found.rel}:${found.text.length}:${found.text.slice(-64)}`, found.text) };
  const rules = defaultRules();
  if (!rules) return { ref, note: 'No BREX was available, so business rules were not checked.' };
  return {
    ref, rel: DEFAULT_BREX_LABEL, own: false, rules,
    note: ref
      ? `This module references ${ref}, which is not in the project. The S1000D default business rules were used instead.`
      : 'This module does not reference a BREX, so the S1000D default business rules were used.',
  };
}

/*
  Which S1000D issue to validate against (the Agastya original's
  SchemaIssue.resolveIssue): an explicit request, else the issue the module
  declares; an issue that is not installed falls back to the nearest older
  installed one (else the oldest), and a module that declares none is checked
  against Issue 4.2. Every substitution comes back as a note.
*/
const DEFAULT_ISSUE = '4.2';
function resolveIssue(text, requested) {
  const head = String(text).slice(0, 4000);
  const decl = declaredSchema(head);
  const tagged = /S1000D[_-](\d+)(?:[-.](\d+))?/i.exec(head);
  const declared = (decl && decl.issue) || (tagged ? `${tagged[1]}.${tagged[2] || '0'}` : null);
  const available = installedIssues().sort((a, b) => parseFloat(b) - parseFloat(a));
  const wanted = (requested && requested !== 'auto' ? requested : null) || declared;
  if (wanted && available.includes(wanted)) return { issue: wanted, declared };
  if (wanted) {
    const pick = available.filter((i) => parseFloat(i) <= parseFloat(wanted))[0] || available[available.length - 1];
    if (pick) return { issue: pick, declared, note: `This module declares S1000D Issue ${wanted}, which is not installed. It was checked against Issue ${pick} instead, so some reported problems may be differences between the two issues rather than faults in the document.` };
  }
  const fallback = available.includes(DEFAULT_ISSUE) ? DEFAULT_ISSUE : available[0];
  return { issue: fallback, declared, note: declared ? null : `This module does not declare which S1000D issue it targets, so it was checked against Issue ${fallback}.` };
}

const SCHEMA_FILE = /^[a-z]+$/;

/*
  opts: { index, schemaType (the module's recorded type, used when the file
  declares no schema), issue (explicit issue, or 'auto') }.
*/
async function validateModule(dir, rel, text, { index = null, schemaType = null, issue: requested = null } = {}) {
  const findings = [];
  const decl = declaredSchema(String(text).slice(0, 4000));
  const resolved = resolveIssue(text, requested);
  const file = !decl && schemaType && SCHEMA_FILE.test(schemaType) ? `${schemaType}.xsd` : undefined;
  const schema = await validateDocument(rel, text, { issue: resolved.issue, file });
  for (const d of schema.diagnostics) findings.push({ sev: 'error', kind: 'schema', rel, line: d.line, message: d.message.trim() });
  if (resolved.note && schema.schema) findings.push({ sev: 'info', kind: 'schema', rel, line: 1, message: resolved.note });
  if (!schema.schema) {
    const named = (decl && decl.file) || file;
    findings.push({ sev: 'info', kind: 'schema', rel, line: 1, message: named
      ? `No S1000D schema was checked: Issue ${resolved.issue} has no ${named}.`
      : 'No S1000D schema was checked: the module declares no schema and its type is not known.' });
  }

  const b = brexFor(text, index || brexIndex(dir));
  let brexSummary = { ref: b.ref || null, source: b.rel || null, projectOwn: !!b.own, note: b.note || null };
  if (b.rules) {
    const r = brex.checkBrex(text, b.rules);
    for (const f of r.findings) findings.push({ sev: 'error', kind: 'brex', rel, line: f.line, message: f.message, location: f.location, rule: f.rule, decisionId: f.decisionId || undefined });
    if (b.note) findings.push({ sev: 'info', kind: 'brex', rel, line: 1, message: b.note });
    brexSummary = { ...brexSummary, evaluated: r.evaluated, skipped: r.skipped, advisory: r.advisory };
  } else {
    findings.push({ sev: 'info', kind: 'brex', rel, line: 1, message: b.note });
  }
  return {
    valid: !findings.some((f) => f.sev === 'error'),
    schema: schema.schema,
    issue: { used: resolved.issue, declared: resolved.declared, note: resolved.note || null },
    brex: brexSummary,
    findings,
  };
}

/*
  `modules`: [{ rel, schemaType? }] for live data modules. Returns { counts, findings }.
*/
async function validateProject(dir, modules) {
  const index = brexIndex(dir);
  const findings = [];
  const texts = [];
  for (const m of modules) {
    let text;
    try { text = fs.readFileSync(path.join(dir, m.rel), 'utf8'); } catch { findings.push({ sev: 'error', kind: 'file', rel: m.rel, line: 1, message: 'The file is missing.' }); continue; }
    texts.push({ rel: m.rel, text });
    const r = await validateModule(dir, m.rel, text, { index, schemaType: m.schemaType || null });
    findings.push(...r.findings);
  }

  // Missing graphics.
  const declared = graphics.declaredEntities(texts.map((t) => t.text));
  for (const t of texts) {
    for (const icn of graphics.referencedIcns(t.text)) {
      if (!graphics.findFile(dir, icn, declared)) {
        const exp = graphics.expectedLocation(icn, declared);
        findings.push({ sev: 'error', kind: 'graphic', rel: t.rel, line: 1, icn, message: `Graphic ${icn} is missing; the build expects ${exp.rel}.` });
      }
    }
  }

  // Publication entries that resolve to nothing.
  const pmPath = path.join(dir, 'publication.xml');
  if (fs.existsSync(pmPath)) {
    const r = resolveDmRefs(fs.readFileSync(pmPath, 'utf8'), path.join(dir, 'csdb'), 'csdb');
    for (const u of r.unresolved || []) {
      findings.push({ sev: 'error', kind: 'reference', rel: 'publication.xml', line: 1, code: u.code, message: `The publication module refers to ${u.code}${u.title ? ` ("${u.title}")` : ''}, which is not in this project.` });
    }
  }

  // Ids used by more than one module.
  const owners = new Map();
  for (const t of texts) {
    for (const m of t.text.matchAll(/\sid\s*=\s*"([^"]+)"/g)) {
      const list = owners.get(m[1]) || new Set();
      list.add(t.rel);
      owners.set(m[1], list);
    }
  }
  for (const [id, rels] of owners) {
    if (rels.size > 1) findings.push({ sev: 'warning', kind: 'id', rel: [...rels][0], line: 1, message: `The id "${id}" is used in ${rels.size} modules (${[...rels].map((r) => path.basename(r)).join(', ')}). Cross-references to it may point to the wrong place in the book.` });
  }

  const counts = { error: 0, warning: 0, info: 0, modules: modules.length };
  for (const f of findings) counts[f.sev]++;
  return { counts, findings };
}

module.exports = { validateModule, validateProject, brexIndex, csdbFiles };
