'use strict';
// Resolves a Publication Module's STRUCTURAL <dmRef> entries (a chapter/section
// pointing at a data module purely by its dmCode, with no <xi:include>) against
// the actual files in csdb/, converting each into a real <xi:include href="...">
// before either build pipeline ever runs.
//
// Why this exists: both s1000dtojss.xsl and s1000dtofo.xsl only pull in a
// referenced module's real content via xi:include (document(@href) internally).
// A PM built with <dmRef> alone — a common, valid S1000D authoring style for a
// multi-file CSDB — silently produces an EMPTY section for every such entry in
// both pipelines (verified with an isolated test), because neither one
// implements the "look up a dmCode against the files on disk" resolution step
// a real S1000D CSDB/IETP toolchain would do. This module is that step, done
// once in Node (which has real filesystem access) rather than in XSLT 1.0
// (which cannot enumerate a directory), so both pipelines gain the fix for
// free — the module contains no other changes to either.
//
// A dmRef whose target isn't found on disk is left untouched, so the existing
// "PM references a data module that is not present in the source" warning
// still fires exactly as before — this only ever ADDS resolvable references,
// never changes behaviour for a genuinely missing module.

const fs = require('fs');
const path = require('path');

// The canonical dotted identity string for a DM code — must stay in exact sync
// with identity.xsl's dmcode-string template, since that is the format the
// rest of the pipeline itself uses to compare two dmCodes for equality. This
// module doesn't need to MATCH that format for xsltproc's sake (once a dmRef
// becomes an xi:include, that logic is never consulted again) — but reusing it
// keeps one mental model for "how are two dmCodes compared" across the app.
function dmCodeString(attrs, extAttrs) {
    const parts = [];
    if (extAttrs) parts.push(extAttrs.extensionProducer || '', extAttrs.extensionCode || '');
    parts.push(
        attrs.modelIdentCode || '', attrs.systemDiffCode || '', attrs.systemCode || '',
        (attrs.subSystemCode || '') + (attrs.subSubSystemCode || ''),
        attrs.assyCode || '',
        (attrs.disassyCode || '') + (attrs.disassyCodeVariant || ''),
        (attrs.infoCode || '') + (attrs.infoCodeVariant || ''),
        attrs.itemLocationCode || '',
    );
    return parts.join('-');
}

// Parse name="value" attribute pairs out of a self-closing (or opening) tag's
// raw text, e.g. the inside of '<dmCode modelIdentCode="RDR" .../>'.
function parseAttrs(tagInner) {
    const attrs = {};
    const re = /([\w:-]+)\s*=\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(tagInner))) attrs[m[1]] = m[2];
    return attrs;
}

// Read just enough of a DM file to get its own dmCode (identAndStatusSection
// always sits at the top) — mirrors the same bounded-read approach used
// elsewhere in this app (e.g. the Explorer's per-module metadata) rather than
// reading potentially-large files in full just for a handful of attributes.
function readOwnDmCode(absPath) {
    let head = '';
    try {
        const fd = fs.openSync(absPath, 'r');
        const buf = Buffer.alloc(8192);
        const n = fs.readSync(fd, buf, 0, buf.length, 0);
        fs.closeSync(fd);
        head = buf.toString('utf8', 0, n);
    } catch { return null; }
    const identSection = /<dmIdent>([\s\S]*?)<\/dmIdent>/.exec(head);
    const scope = identSection ? identSection[1] : head;
    const dmCode = /<dmCode\b([^>]*)\/>/.exec(scope);
    if (!dmCode) return null;
    const ext = /<identExtension\b([^>]*)\/>/.exec(scope);
    return dmCodeString(parseAttrs(dmCode[1]), ext ? parseAttrs(ext[1]) : null);
}

// Map every DMC-*.xml file in csdb/ to its own canonical dmCode string.
function buildDmCodeIndex(csdbAbsDir) {
    const index = new Map();
    if (!fs.existsSync(csdbAbsDir)) return index;
    for (const f of fs.readdirSync(csdbAbsDir)) {
        if (!/^DMC-.*\.xml$/i.test(f)) continue;
        const code = readOwnDmCode(path.join(csdbAbsDir, f));
        if (code && !index.has(code)) index.set(code, f); // first occurrence wins on a duplicate
    }
    return index;
}

/*
  Rewrite every resolvable structural <dmRef> in `pmText` into an
  <xi:include href="{csdbRelDir}/{file}"/>.

  Returns { text, resolved, total, unresolved } — `text` is unchanged
  (===pmText) when there was nothing to do, so a caller can skip writing a temp
  file entirely in the common (xi:include-only) case.

  `unresolved` lists the data-module codes a dmRef asked for and this project
  does not have, with the pmEntry title that asked. A reference that cannot be
  resolved is still left exactly as written — guessing at it would be worse —
  but it used to be left SILENTLY, and the entry then contributed nothing to
  the book with no error anywhere. Front-matter references are where that bites
  hardest: a PM asking for a title page and a table of contents that are not in
  the CSDB builds a book whose prelims come from somewhere else entirely, and
  nothing says the request was dropped.
*/
const XI_NS = 'http://www.w3.org/2001/XInclude';

function resolveDmRefs(pmText, csdbAbsDir, csdbRelDir) {
    const dmRefRe = /<dmRef>([\s\S]*?)<\/dmRef>/g;
    let total = 0, resolved = 0, index = null;
    const unresolved = [];
    /*
      The nearest <pmEntryTitle> BEFORE this reference. A bare data-module code
      is not something most people can place at a glance; "Table of contents"
      is. Searching backwards from the reference finds the entry that contains
      it, because a pmEntry always titles itself before listing its content.
    */
    const titleFor = (at) => {
        const before = pmText.slice(0, at);
        const m = before.match(/<pmEntryTitle>([^<]*)<\/pmEntryTitle>(?![\s\S]*<pmEntryTitle>)/);
        return m ? m[1].trim() : '';
    };
    let out = pmText.replace(dmRefRe, (whole, inner, at) => {
        total++;
        const dmCodeMatch = /<dmCode\b([^>]*)\/>/.exec(inner);
        if (!dmCodeMatch) return whole; // not a simple code reference — leave as-is
        const extMatch = /<identExtension\b([^>]*)\/>/.exec(inner);
        const wanted = dmCodeString(parseAttrs(dmCodeMatch[1]), extMatch ? parseAttrs(extMatch[1]) : null);
        if (!index) index = buildDmCodeIndex(csdbAbsDir); // built once, lazily, only if a dmRef is actually present
        const file = index.get(wanted);
        if (!file) {
            /*
              Left as written, as before — but recorded, so the caller can say
              so. Except a BREX reference: those name the business rules the
              publication was authored against, are not content, and are
              routinely not shipped with it. Reporting one as a missing module
              would be a false alarm on almost every project, and a warning
              that is usually wrong is one people learn to ignore.
            */
            if (!/<brexDmRef>\s*$/.test(pmText.slice(Math.max(0, at - 40), at))) {
                unresolved.push({ code: wanted, title: titleFor(at) });
            }
            return whole;
        }
        resolved++;
        const href = (csdbRelDir ? csdbRelDir.replace(/\\/g, '/') + '/' : '') + file;
        return `<xi:include href="${href}"/>`;
    });
    // A PM built purely with dmRef (no pre-existing xi:include) never had a
    // reason to declare the XInclude namespace — inject it on the root <pm>
    // element whenever we've actually introduced an xi:include, so the
    // result is valid XML rather than an undefined-prefix parse error.
    if (resolved > 0 && !new RegExp('xmlns:xi\\s*=\\s*"' + XI_NS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"').test(out)) {
        out = out.replace(/<pm(\s|>)/, `<pm xmlns:xi="${XI_NS}"$1`);
    }
    return { text: out, resolved, total, unresolved };
}

/*
  Repoint <xi:include> hrefs that do not resolve as written but whose file is
  sitting in csdb/ under the same name.

  A PM that references its modules by bare file name — href="DMC-....xml" while
  the modules live in csdb/ — is a common export style, and the JSS pipeline has
  always coped with it: its xi:include template retries the file name alone
  under $csdb.dir when the href as written finds nothing. The direct pipeline
  resolves includes with --xinclude instead, which has no such retry, so every
  one of those modules was reported missing, guarded into an <xi:fallback/> by
  guardMissingIncludes below, and silently dropped — the same project built a
  full book on one engine and a near-empty one on the other, with no error to
  explain the difference.

  Doing the retry here, in Node, means both engines resolve the same set of
  modules. A PM whose paths are already correct is left completely untouched.
*/
function repairIncludePaths(pmText, projectAbsDir, csdbRelDir) {
    if (!csdbRelDir) return { text: pmText, repaired: 0 };
    const csdbAbs = path.join(projectAbsDir, csdbRelDir);

    // Built once, and only if something actually needs repairing. Keyed
    // lower-case because a PM routinely cites ".XML" for a ".xml" on disk and
    // on Windows those are the same file.
    let index = null;
    const lookup = (name) => {
        if (!index) {
            index = new Map();
            let names = [];
            try { names = fs.readdirSync(csdbAbs); } catch { /* no csdb dir */ }
            for (const f of names) if (!index.has(f.toLowerCase())) index.set(f.toLowerCase(), f);
        }
        return index.get(String(name).toLowerCase());
    };

    let repaired = 0;
    const text = pmText.replace(/<xi:include\b([^>]*?)(\/?)>/g, (whole, attrsRaw, selfClose) => {
        const m = /\bhref\s*=\s*"([^"]*)"/.exec(attrsRaw);
        if (!m) return whole;
        const href = m[1];
        // Only local relative paths are ours to repair.
        if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href) || path.isAbsolute(href)) return whole;
        if (fs.existsSync(path.join(projectAbsDir, href.replace(/\\/g, '/')))) return whole;

        const actual = lookup(path.basename(href.replace(/\\/g, '/')));
        if (!actual) return whole; // genuinely absent — leave it for the guard below

        repaired++;
        const fixed = csdbRelDir.replace(/\\/g, '/') + '/' + actual;
        return `<xi:include${attrsRaw.replace(m[0], `href="${fixed}"`)}${selfClose}>`;
    });
    return { text, repaired };
}

// Give every <xi:include> whose target file is absent an empty <xi:fallback/>.
//
// XInclude's defined behaviour for an unresolvable href is a FATAL error, so a
// single missing data module aborts the whole build and produces no PDF at all
// — which is what the direct s1000dtofo pipeline does today, since it resolves
// modules with --xinclude. The s1000dtojss pipeline reaches modules through
// document() instead, which yields an empty node-set and merely warns, so the
// two pipelines disagree on the same project. <xi:fallback/> is the standard,
// spec-defined way to say "substitute nothing if this can't be loaded", which
// makes the direct pipeline degrade the same way: skip the missing module,
// keep building, and leave the existing "not present in source" warnings as
// the signal that something is absent.
//
// Only applied to includes we can prove are missing — an include that resolves
// is left completely untouched, so nothing changes for a healthy project.
function guardMissingIncludes(pmText, projectAbsDir) {
    const re = /<xi:include\b([^>]*?)\/>/g;
    let missing = 0;
    const out = pmText.replace(re, (whole, attrsRaw) => {
        const href = (/\bhref\s*=\s*"([^"]*)"/.exec(attrsRaw) || [])[1];
        if (!href) return whole;
        // Only local relative paths are checkable; leave URLs/absolutes alone.
        if (/^[a-z][a-z0-9+.-]*:/i.test(href) || path.isAbsolute(href)) return whole;
        const target = path.join(projectAbsDir, href.replace(/\\/g, '/'));
        if (fs.existsSync(target)) return whole;
        missing++;
        return `<xi:include${attrsRaw}><xi:fallback/></xi:include>`;
    });
    return { text: out, missing };
}

// Insert generated front-matter modules as the first pmEntry of the PM, so
// they render ahead of the publication's own chapters.
//
// They go in a pmEntry with no pmEntryTitle: s1000dtofo passes such an entry
// straight through to its children rather than emitting a heading for it, so
// the pages appear as front matter rather than as a numbered chapter.
function injectFrontMatter(pmText, relPaths) {
    if (!relPaths || !relPaths.length) return { text: pmText, injected: 0 };
    const open = /<content(\s[^>]*)?>/.exec(pmText);
    if (!open) return { text: pmText, injected: 0 };
    const includes = relPaths
        .map((p) => `    <xi:include href="${p.replace(/\\/g, '/')}"/>`)
        .join('\n');
    const block = `\n  <pmEntry>\n${includes}\n  </pmEntry>`;
    const at = open.index + open[0].length;
    let out = pmText.slice(0, at) + block + pmText.slice(at);
    if (!/xmlns:xi\s*=/.test(out)) {
        out = out.replace(/<pm(\s|>)/, `<pm xmlns:xi="${XI_NS}"$1`);
    }
    return { text: out, injected: relPaths.length };
}

// ---------------------------------------------------------------------------
// pmRef: a pmEntry pointing at a WHOLE OTHER publication module, not a single
// data module — e.g. an "Annexure" chapter that is really a different S1000D
// manual, bound into this one as its own nested front matter + chapters.
// ---------------------------------------------------------------------------

// pmCode's canonical dotted identity string, mirroring dmCodeString's role for
// dmCode — must stay in sync with s1000d-pm-code (frontmatter-s1000d.xsl),
// the one other place this app formats a pmCode for comparison/display.
function pmCodeString(attrs) {
    return [attrs.modelIdentCode || '', attrs.pmIssuer || '', attrs.pmNumber || '', attrs.pmVolume || ''].join('-');
}

// Read just enough of a PM file to get its own pmCode, issueInfo and title —
// mirrors readOwnDmCode's bounded-read approach.
function readOwnPmMeta(absPath) {
    let head = '';
    try {
        const fd = fs.openSync(absPath, 'r');
        const buf = Buffer.alloc(8192);
        const n = fs.readSync(fd, buf, 0, buf.length, 0);
        fs.closeSync(fd);
        head = buf.toString('utf8', 0, n);
    } catch { return null; }
    const identSection = /<pmIdent>([\s\S]*?)<\/pmIdent>/.exec(head);
    const identScope = identSection ? identSection[1] : head;
    const pmCode = /<pmCode\b([^>]*)\/>/.exec(identScope);
    if (!pmCode) return null;
    const issue = /<issueInfo\b([^>]*)\/>/.exec(identScope);
    // pmTitle sits in pmAddressItems, a sibling of pmIdent, not inside it —
    // read from the wider head rather than the narrowed identSection.
    const titleMatch = /<pmTitle>([\s\S]*?)<\/pmTitle>/.exec(head);
    return {
        code: pmCodeString(parseAttrs(pmCode[1])),
        pmCode: parseAttrs(pmCode[1]),
        issueInfo: issue ? parseAttrs(issue[1]) : {},
        pmTitle: titleMatch ? titleMatch[1].trim() : '',
    };
}

/*
  Every OTHER project in the workspace that has its own resolvable pmCode —
  the candidate list for "add a publication reference" in the PMC Builder.
  A project with no pmCode yet (a fresh, unconfigured one) is left out rather
  than offered as a broken choice.
*/
function listAnnexCandidates(projectsAbsDir, excludeProjectId) {
    const out = [];
    if (!fs.existsSync(projectsAbsDir)) return out;
    let ids;
    try { ids = fs.readdirSync(projectsAbsDir); } catch { return out; }
    for (const id of ids) {
        if (id === excludeProjectId) continue;
        const projDir = path.join(projectsAbsDir, id);
        let stat;
        try { stat = fs.statSync(projDir); } catch { continue; }
        if (!stat.isDirectory()) continue;
        let cfg;
        try { cfg = JSON.parse(fs.readFileSync(path.join(projDir, 'project.json'), 'utf8')); } catch { continue; }
        const pmFile = (cfg.input && cfg.input.pm) || 'publication.xml';
        const meta = readOwnPmMeta(path.join(projDir, pmFile));
        if (!meta) continue;
        out.push({ id, pmCode: meta.pmCode, code: meta.code, pmTitle: meta.pmTitle, issueInfo: meta.issueInfo });
    }
    return out;
}

/*
  Scan every OTHER project in the workspace for one whose own publication
  module carries the given pmCode. Each project is self-contained (its own
  publication.xml/project.json), so this is the only way to find "the
  project this pmRef means" — there is no cross-project registry to look
  it up in, by design, matching how a project can be zipped and moved
  without breaking its own internal references.

  First match wins on a duplicate pmCode across two projects, the same rule
  buildDmCodeIndex uses for a duplicate dmCode — an authoring mistake this
  cannot adjudicate, so it resolves deterministically rather than guessing.
*/
function findProjectByPmCode(projectsAbsDir, wantedPmCode, excludeProjectId) {
    if (!fs.existsSync(projectsAbsDir)) return null;
    let ids;
    try { ids = fs.readdirSync(projectsAbsDir); } catch { return null; }
    for (const id of ids) {
        if (id === excludeProjectId) continue;
        const projDir = path.join(projectsAbsDir, id);
        let stat;
        try { stat = fs.statSync(projDir); } catch { continue; }
        if (!stat.isDirectory()) continue;
        let cfg;
        try { cfg = JSON.parse(fs.readFileSync(path.join(projDir, 'project.json'), 'utf8')); } catch { continue; }
        const pmFile = (cfg.input && cfg.input.pm) || 'publication.xml';
        const meta = readOwnPmMeta(path.join(projDir, pmFile));
        if (meta && meta.code === wantedPmCode) {
            return {
                id, dir: projDir, pmFile,
                csdbDir: (cfg.input && cfg.input.csdbDir) || 'csdb',
                issueInfo: meta.issueInfo,
            };
        }
    }
    return null;
}

/*
  Strip a document's XML declaration and DOCTYPE, both of which are only
  legal at the very start of a document. A resolved pmRef nests one whole
  <pm>...</pm> document inside another (see the "pmEntry" template in
  s1000dtofo.xsl, extended to descend into a pm child) — real, exported
  S1000D publication modules routinely carry both: an XML declaration, and a
  DOCTYPE with an internal subset declaring the standard ISO character
  entity sets (%ISOEntities; and similar). Leaving either in place once the
  document is nested is a parser error ("StartTag: invalid element name"),
  found the hard way against a real multi-annex publication whose synthetic
  test fixtures never had a DOCTYPE to catch it.

  This does NOT expand any entities the stripped DOCTYPE declared — it only
  removes the declaration itself. A publication module's own top-level text
  (title, entry titles) using a custom, non-standard entity from its own
  DOCTYPE would still break; the standard ISO sets this guards against are
  overwhelmingly the common case, and a custom one is no worse off than it
  was before pmRef embedding existed (i.e., not supported).
*/
function stripXmlProlog(text) {
    return text
        .replace(/^\s*<\?xml[^>]*\?>\s*/, '')
        .replace(/^\s*<!DOCTYPE[^[>]*(\[[\s\S]*?\])?\s*>\s*/, '');
}

/*
  Find every <pmRef> in a PM and resolve each against the other projects in
  this workspace, matching by pmCode alone.

  This is the FIND step only — it does not rewrite pmText. Splicing another
  project's content in means staging its files (csdb/, Media/, its own
  front-matter settings) into the current build's working directory first,
  which is filesystem orchestration the caller (server.js, which knows the
  build's working directory) owns — a pure text-transform module has no
  business reaching outside the one project directory it was given.

  A pmRef whose pmCode matches no project is reported in `unresolved`, the
  same non-fatal shape resolveDmRefs already reports a missing dmRef in —
  left exactly as written, never silently dropped, never a build failure.

  A pmRef whose target project resolves but whose declared issueInfo does not
  match that project's OWN current issueInfo is still resolved (this tool
  holds one working copy per project, not an issue history) but flagged via
  `issueMismatch` — "this annex asked for issue 000/01, the project's current
  state is issue 001/00" — so a real mismatch is visible rather than silently
  building against whatever the annex project happens to be right now.
*/
function resolvePmRefs(pmText, projectsAbsDir, currentProjectId) {
    const pmRefRe = /<pmRef>([\s\S]*?)<\/pmRef>/g;
    let total = 0;
    const matches = [];
    const unresolved = [];
    const titleFor = (at) => {
        const before = pmText.slice(0, at);
        const m = before.match(/<pmEntryTitle>([^<]*)<\/pmEntryTitle>(?![\s\S]*<pmEntryTitle>)/);
        return m ? m[1].trim() : '';
    };
    let m;
    while ((m = pmRefRe.exec(pmText))) {
        total++;
        const inner = m[1];
        const at = m.index;
        const identSection = /<pmRefIdent>([\s\S]*?)<\/pmRefIdent>/.exec(inner);
        const scope = identSection ? identSection[1] : inner;
        const pmCodeMatch = /<pmCode\b([^>]*)\/>/.exec(scope);
        const title = titleFor(at);
        if (!pmCodeMatch) continue; // not a simple pmCode reference — leave for a human to look at
        const wanted = pmCodeString(parseAttrs(pmCodeMatch[1]));
        const issueMatch = /<issueInfo\b([^>]*)\/>/.exec(scope);
        const wantedIssue = issueMatch ? parseAttrs(issueMatch[1]) : {};
        const project = findProjectByPmCode(projectsAbsDir, wanted, currentProjectId);
        if (!project) {
            unresolved.push({ code: wanted, title });
            continue;
        }
        const issueMismatch = !!(wantedIssue.issueNumber && project.issueInfo.issueNumber
            && (wantedIssue.issueNumber !== project.issueInfo.issueNumber
                || wantedIssue.inWork !== project.issueInfo.inWork));
        matches.push({ raw: m[0], at, wanted, title, project, wantedIssue, issueMismatch });
    }
    return { total, matches, unresolved };
}

module.exports = {
    resolveDmRefs, repairIncludePaths, guardMissingIncludes, injectFrontMatter,
    dmCodeString, parseAttrs, buildDmCodeIndex,
    pmCodeString, findProjectByPmCode, resolvePmRefs, readOwnPmMeta, listAnnexCandidates, stripXmlProlog,
};
