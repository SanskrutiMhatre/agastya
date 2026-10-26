'use strict';
/*
  Validate project XML against the S1000D schema issue each file DECLARES.

  Well-formedness (validateXml.js) answers "can this be parsed". This answers
  the question authors actually get wrong: whether the element they added is
  allowed where they put it, and whether the attributes a data module must
  carry are present. Neither the build nor any earlier check looked at that —
  xsltproc transforms whatever parses, so an invalid module produced a book
  with a quietly missing section rather than an error.

  Per declared issue, never a single fixed schema set. A project's modules can
  legitimately be written to different issues, and the schemas differ in ways
  that matter: schemas/PROVENANCE.md records descript.xsd carrying Issue 5.0
  while proced.xsd carried 4.2 in the folder this replaced, so every
  description module in that setup was checked against rules it was never
  written to. Reading the declaration is what makes the answer trustworthy.

  libxml2 again — the same engine as the build and as the well-formedness
  check, here as WebAssembly (xmllint-wasm, MIT). No native module to compile
  for the customer's machine, and no network: the schemas are read from disk
  and handed to the validator, so the http:// URL in a file's
  noNamespaceSchemaLocation is never fetched.
*/
const fs = require('fs');
const path = require('path');
const { validateXML } = require('xmllint-wasm');

const SCHEMA_ROOT = require('./paths').SCHEMAS;

/*
  "http://www.s1000d.org/S1000D_4-2/xml_schema_flat/descript.xsd"
    -> { issue: '4.2', file: 'descript.xsd' }

  The issue travels in the URL as 4-2; the directories are named 4.2, matching
  how the specification is written and how anyone would search for it.
*/
function declaredSchema(xml) {
    const m = /noNamespaceSchemaLocation\s*=\s*"([^"]+)"/.exec(xml);
    if (!m) return null;
    const loc = m[1];
    const file = loc.split(/[\/]/).pop();
    if (!/\.xsd$/i.test(file)) return null;
    const iss = /S1000D[_-]?(\d)[-._](\d)/i.exec(loc);
    return { issue: iss ? `${iss[1]}.${iss[2]}` : null, file, loc };
}

// Read once per issue: the schemas import one another, so the validator needs
// the whole set present, not just the one file the document names.
const preloadCache = new Map();
function preloadFor(issue) {
    if (preloadCache.has(issue)) return preloadCache.get(issue);
    const dir = path.join(SCHEMA_ROOT, issue);
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.xsd')); } catch { /* no such issue */ }
    const set = files.length
        ? files.map((f) => ({ fileName: f, contents: fs.readFileSync(path.join(dir, f), 'utf8') }))
        : null;
    preloadCache.set(issue, set);
    return set;
}

const installedIssues = () => {
    try { return fs.readdirSync(SCHEMA_ROOT).filter((d) => /^\d/.test(d)).sort(); }
    catch { return []; }
};

/*
  Files are validated in GROUPS — one call per (issue, schema) rather than one
  per document. The validator carries the whole schema set into WebAssembly on
  every call, and that setup, not the checking, is the cost: 21 real modules
  take 314ms together and 4.6s apart.
*/
async function validateProjectSchema(dir, relFiles, opts) {
    const o = opts || {};
    const groups = new Map();
    const notes = [];
    let checked = 0;

    for (const rel of relFiles) {
        let xml;
        try { xml = fs.readFileSync(path.join(dir, rel), 'utf8'); } catch { continue; }
        const decl = declaredSchema(xml);
        // No declaration: not an S1000D document (the generated front-matter
        // pages are ours, and answer to no schema). Silence is right here.
        if (!decl || !decl.issue) continue;

        /*
          A document with unresolved XIncludes cannot be schema-checked as
          authored, and this is not a shortcoming to work around: XInclude is
          resolved BEFORE validation by definition, so the schema sees an
          <xi:include> element where it expects the content, and rejects it.

          This project's publication modules legitimately carry them — the
          build resolves dmRef and xi:include into the real modules — so
          checking the file as it sits on disk produced twenty complaints about
          the one thing that is working correctly. A validator that is loudly
          wrong about normal input is worse than one that says nothing, so it
          says what it did not check, once, instead.
        */
        if (xml.indexOf('XInclude') !== -1 || xml.indexOf(':include ') !== -1) {
            notes.push({
                sev: 'info', title: 'Not checked against a schema', rel, line: 1,
                loc: rel.split('/').pop(),
                detail: 'This file uses XInclude to pull in other documents. A schema cannot see through'
                    + ' an unresolved include, so only its well-formedness was checked.',
            });
            continue;
        }

        /*
          Which issue to judge this file by.

          The file's own declaration is the default and the right answer almost
          always: a project can legitimately hold modules written to different
          issues, and checking them all against one set is the mistake
          PROVENANCE.md records. An explicit choice exists for the case the
          declaration cannot cover — content that says 4.2 but is being moved
          to 5.0, or a supplier's modules that declare an issue this
          installation does not have.

          The SCHEMA name still comes from the file: descript.xsd or proced.xsd
          is what kind of module it is, which no override should change.
        */
        const issue = o.issue && o.issue !== 'auto' ? o.issue : decl.issue;
        const preload = preloadFor(issue);
        if (!preload) {
            /*
              A declared issue we do not ship. Reported, not skipped: silence
              would read as "checked and fine", which is the one thing it is
              not.
            */
            notes.push({
                sev: 'info', title: 'Not checked against a schema', rel, line: 1,
                loc: rel.split('/').pop(),
                detail: (o.issue && o.issue !== 'auto'
                    ? `Validation was set to S1000D Issue ${issue}, and no schema set for it is installed`
                    : `This file declares S1000D Issue ${decl.issue}, and no schema set for that issue is installed`)
                    + ` (available: ${installedIssues().join(', ') || 'none'}).`,
            });
            continue;
        }
        if (!preload.some((p) => p.fileName === decl.file)) {
            notes.push({
                sev: 'info', title: 'Not checked against a schema', rel, line: 1,
                loc: rel.split('/').pop(),
                detail: `This file names "${decl.file}", which is not part of the Issue ${issue} schema set.`,
            });
            continue;
        }
        const key = `${issue}|${decl.file}`;
        if (!groups.has(key)) groups.set(key, { issue, file: decl.file, docs: [] });
        groups.get(key).docs.push({ rel, xml });
        checked++;
    }

    const issues = [];
    for (const g of groups.values()) {
        const preload = preloadFor(g.issue);
        const schema = [{ fileName: g.file, contents: preload.find((p) => p.fileName === g.file).contents }];
        /*
          fileName is the project-relative path, so every diagnostic comes back
          naming the file it belongs to — the whole point of validating a batch
          in one call rather than losing track of which document failed.
        */
        const byName = new Map();
        const docs = g.docs.map((d, i) => {
            const flat = `${i}_${d.rel.split('/').pop()}`;
            byName.set(flat, d.rel);
            return { fileName: flat, contents: d.xml };
        });
        let res;
        try {
            res = await validateXML({ xml: docs, schema, preload });
        } catch (e) {
            notes.push({
                sev: 'info', title: 'Schema check could not run', rel: g.docs[0].rel, line: 1,
                loc: g.file, detail: `Validating against ${g.file} (Issue ${g.issue}) failed: ${(e && e.message) || String(e)}`,
            });
            continue;
        }
        for (const err of res.errors || []) {
            const rel = byName.get(err.loc && err.loc.fileName) || g.docs[0].rel;
            issues.push({
                sev: 'crit',
                title: 'Does not match the S1000D schema',
                rel,
                line: (err.loc && err.loc.lineNumber) || 1,
                loc: `${rel.split('/').pop()}:${(err.loc && err.loc.lineNumber) || 1}`,
                // libxml prefixes every one with "Schemas validity error : ",
                // which is the same on all of them and so carries nothing.
                detail: String(err.message || '').replace(/^Schemas validity error\s*:\s*/, '')
                    + ` (Issue ${g.issue}, ${g.file})`,
            });
        }
    }

    issues.sort((a, b) => a.rel.localeCompare(b.rel) || a.line - b.line);
    notes.sort((a, b) => a.rel.localeCompare(b.rel));
    return { issues: [...issues, ...(o.includeNotes === false ? [] : notes)], checked };
}


/*
  One document, from memory, for the editor.

  The project-wide check reads files off disk; this one is handed the buffer as
  it currently stands, because the whole point is to answer before it is saved.
  The same schemas and the same engine, so a squiggle in the editor and a
  finding in the validation report can never contradict each other.

  Parse errors come back from the same call: xmllint reports a document it
  cannot read before it gets as far as the schema. Where a document declares no
  schema, or one we do not have, it is still parsed — that is the difference
  between "<par> is not allowed here" and "this file no longer parses", and
  both are worth knowing while typing.
*/
async function validateDocument(rel, xml, opts) {
    const o = opts || {};
    // Agastya: o.file names the schema file when the document declares none
    // (the module's recorded schema type), as the Agastya original does.
    const declared = declaredSchema(xml);
    const decl = o.file ? { ...(declared || {}), file: o.file } : declared;
    const issue = o.issue && o.issue !== 'auto' ? o.issue : (decl && decl.issue);
    const preload = issue ? preloadFor(issue) : null;
    const known = preload && decl && preload.some((p) => p.fileName === decl.file);

    // An unresolved include cannot be schema-checked; parse it and stop there.
    const hasInclude = xml.indexOf('XInclude') !== -1 || xml.indexOf(':include ') !== -1;

    const args = { xml: [{ fileName: 'doc.xml', contents: xml }] };
    if (known && !hasInclude) {
        args.schema = [{ fileName: decl.file, contents: preload.find((p) => p.fileName === decl.file).contents }];
        args.preload = preload;
    } else {
        // No schema to check against: --format still parses, so this reports
        // exactly the errors that stop the build.
        args.normalization = 'format';
    }

    let res;
    try { res = await validateXML(args); }
    catch (e) { return { diagnostics: [], note: (e && e.message) || String(e) }; }

    return {
        schema: known && !hasInclude ? `${decl.file} (Issue ${issue})` : null,
        diagnostics: (res.errors || []).map((err) => ({
            line: (err.loc && err.loc.lineNumber) || 1,
            message: String(err.message || '').replace(/^Schemas validity error\s*:\s*/, ''),
        })),
    };
}

module.exports = { validateProjectSchema, validateDocument, declaredSchema, installedIssues };
