'use strict';
// Write-time XML safety guard (XXE and friends).
//
// Applied wherever XML content enters the workspace: the editor save route,
// batch uploads, and package import. The build pipeline runs xsltproc with
// --nonet, so remote fetches are already off; the remaining attack is a
// LOCAL one — a parsed general entity whose SYSTEM identifier points at a
// file on this machine, which entity expansion would copy into the built
// document. S1000D content legitimately declares unparsed NDATA entities for
// graphics ("ICN-....png"), and some tool chains reference public DTDs by
// http URL in the DOCTYPE, so the guard distinguishes rather than banning
// DOCTYPE outright:
//
//   allowed  <!ENTITY ICN-X SYSTEM "icn-x.png" NDATA png>   (unparsed, relative)
//   allowed  <!DOCTYPE dmodule SYSTEM "http://www.s1000d.org/...">   (--nonet never fetches it)
//   allowed  <!DOCTYPE x SYSTEM "local.dtd">                (relative, stays in the project)
//   refused  <!ENTITY x SYSTEM "file:///etc/passwd">        (parsed external entity — XXE)
//   allowed  <!ENTITY % ISOEntities PUBLIC "..." "http://www.s1000d.org/...">
//            (the ISO character set every S1000D tool chain declares; the
//             http identifier is never fetched, so it warns and parses on)
//   refused  <!ENTITY % p SYSTEM "file:///etc/passwd">      (local read)
//   refused  <!ENTITY % p "replacement text">               (internal, expansion)
//   refused  any SYSTEM/PUBLIC identifier with '..', an absolute path, a
//            drive letter, a backslash, or a non-http(s) URL scheme
//   refused  more than MAX_ENTITY_DECLS entity declarations (expansion bombs)

const MAX_ENTITY_DECLS = 500;

// A SYSTEM/PUBLIC identifier that is safe to keep: a relative path that
// cannot leave the project directory and is not a URL (http(s) allowed for
// the DOCTYPE external subset only — never fetched thanks to --nonet).
function safeIdentifier(id, { allowHttp }) {
  const s = String(id || '').trim();
  if (!s) return true;
  if (/^https?:\/\//i.test(s)) return !!allowHttp;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return false; // any other scheme (file:, php:, jar:, ...)
  if (s.includes('\\')) return false;
  if (s.startsWith('/') || s.startsWith('~')) return false;
  if (/^[a-zA-Z]:/.test(s)) return false; // Windows drive letter
  if (s.split('/').some((seg) => seg === '..')) return false;
  return true;
}

/*
  Scan the prolog (everything before the root element opens). Entity
  declarations can only legally appear there, in the DOCTYPE's internal
  subset, so the scan is cheap even for very large documents.
*/
function checkXmlSafety(content) {
  const text = String(content == null ? '' : content);
  // The prolog ends at the first '<' that starts a real element. Find the
  // DOCTYPE region: from '<!DOCTYPE' to its matching '>' at bracket depth 0.
  const dt = text.search(/<!DOCTYPE/i);
  if (dt === -1) return { ok: true };

  let i = dt + 9, depth = 0, end = -1, quote = null;
  while (i < text.length) {
    const c = text[i];
    if (quote) { if (c === quote) quote = null; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === '[') depth++;
    else if (c === ']') depth--;
    else if (c === '>' && depth <= 0) { end = i; break; }
    i++;
  }
  const doctype = text.slice(dt, end === -1 ? Math.min(text.length, dt + 262144) : end + 1);

  /*
    Parameter entities.

    These were refused outright, on the grounds that they are the classic XXE
    and expansion vector. That was too broad to survive contact with real
    content: every S1000D export declares the ISO character entity set —

      <!ENTITY % ISOEntities PUBLIC "ISO 8879-1986//ENTITIES ..."
                                    "http://www.s1000d.org/S1000D_4-2/ent/ISOEntities">

    — so the guard refused ordinary data modules and publication modules, and a
    guard that blocks the normal case is one people work around by switching it
    off.

    What actually makes a parameter entity dangerous is narrower:

      EXTERNAL, pointing at a local path — the file-disclosure vector. Judged
      by the same safeIdentifier rule as every other identifier here, so
      "file:///...", an absolute path, a drive letter, a backslash or ".."
      is still refused. An http(s) identifier is allowed because it is never
      fetched: every xsltproc invocation in this application passes --nonet,
      and libxml then reports a network entity as a WARNING and parses the
      document anyway.

      INTERNAL, carrying its own replacement text — the expansion vector, where
      a parameter entity nests others to explode the document. That has no
      legitimate use in this content set and stays refused.
  */
  const paramEntityRe = /<!ENTITY\s+%\s+([^\s%>]+)\s+([\s\S]*?)>/g;
  let pe;
  while ((pe = paramEntityRe.exec(doctype))) {
    const decl = pe[2].trim();
    if (!/^(SYSTEM|PUBLIC)\b/i.test(decl)) {
      return {
        ok: false,
        error: `XML refused: parameter entity "${pe[1]}" carries its own replacement text, which can be used to expand a document without limit.`,
      };
    }
    for (const q of decl.matchAll(/(["'])([\s\S]*?)\1/g)) {
      if (!safeIdentifier(q[2], { allowHttp: true })) {
        return {
          ok: false,
          error: `XML refused: parameter entity "${pe[1]}" references an unsafe location ("${q[2]}").`,
        };
      }
    }
  }

  // Every general entity declaration in the internal subset.
  const entityRe = /<!ENTITY\s+([^\s%>]+)\s+((?:SYSTEM|PUBLIC)\b[^>]*|(["'])[\s\S]*?\3[^>]*)>/gi;
  let m, count = 0;
  while ((m = entityRe.exec(doctype))) {
    count++;
    if (count > MAX_ENTITY_DECLS) {
      return { ok: false, error: `XML refused: more than ${MAX_ENTITY_DECLS} entity declarations.` };
    }
    const decl = m[2];
    if (/^(SYSTEM|PUBLIC)\b/i.test(decl)) {
      // External entity. Unparsed (NDATA) graphic entities are the legitimate
      // S1000D use; a parsed external entity is exactly the XXE vector.
      const ndata = /\bNDATA\b/i.test(decl);
      const ids = [...decl.matchAll(/(["'])([\s\S]*?)\1/g)].map((q) => q[2]);
      const sysId = ids.length ? ids[ids.length - (/\bNDATA\b/i.test(decl) ? 1 : 1)] : '';
      if (!ndata) {
        return { ok: false, error: `XML refused: parsed external entity "${m[1]}" (classic XXE). Only unparsed NDATA entities may reference files.` };
      }
      for (const id of ids) {
        if (!safeIdentifier(id, { allowHttp: false })) {
          return { ok: false, error: `XML refused: entity "${m[1]}" references an unsafe location ("${id}").` };
        }
      }
      void sysId;
    }
  }

  // The DOCTYPE's own external identifier (external DTD subset).
  const head = doctype.split('[')[0];
  const ext = /(SYSTEM|PUBLIC)\s+("([^"]*)"|'([^']*)')(\s+("([^"]*)"|'([^']*)'))?/i.exec(head);
  if (ext) {
    const ids = [ext[3] || ext[4], ext[7] || ext[8]].filter((x) => x !== undefined);
    for (const id of ids) {
      if (!safeIdentifier(id, { allowHttp: true })) {
        return { ok: false, error: `XML refused: DOCTYPE references an unsafe location ("${id}").` };
      }
    }
  }

  return { ok: true };
}

// Relative-path safety for anything user-supplied that will be joined onto a
// project directory. One rule for every route.
function safeRelPath(rel) {
  const s = String(rel || '').replace(/\\/g, '/');
  if (!s || s.length > 512) return null;
  if (s.startsWith('/') || /^[a-zA-Z]:/.test(s)) return null;
  if (s.split('/').some((seg) => seg === '..' || seg === '' || seg === '.')) return null;
  if (s.includes('\0')) return null;
  return s;
}

module.exports = { checkXmlSafety, safeRelPath, MAX_ENTITY_DECLS };
