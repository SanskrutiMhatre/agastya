'use strict';
/*
  XInclude containment (decisions.md C6, found before checkpoint 2b).

  The build runs xsltproc with --xinclude, and libxml2 processes XInclude
  recursively, including in data modules the publication pulls in. An
  <xi:include href="file:///..." parse="text"/> would therefore copy any
  local file into a PDF. The entity guard (vendor/engine/xmlGuard.js) does
  not cover this, so:

    - a data module may contain no XInclude element at all;
    - a publication module may include only csdb/<name>.xml (or a bare
      <name>.xml, which the build repoints into csdb/), parsed as XML.

  Elements are found by namespace (XInclude 2001 and the older 2003 namespace,
  both of which libxml2 honours), after a namespace-aware parse, so a
  prefix or a character-referenced namespace URI cannot hide one. An element
  name cannot be written with character references, so text without
  "include" in it needs no parse.
*/

const { DOMParser } = require('@xmldom/xmldom');

const XI_NAMESPACES = new Set(['http://www.w3.org/2001/XInclude', 'http://www.w3.org/2003/XInclude']);
const PM_HREF = /^(csdb\/)?[A-Za-z0-9][A-Za-z0-9._-]*\.xml$/i;

// [{ href, parse, line }] for every XInclude element; null when the text cannot be parsed.
function findIncludes(text) {
  const s = String(text);
  if (!/include/i.test(s)) return [];
  let failed = false;
  const fail = () => { failed = true; };
  const doc = new DOMParser({ locator: {}, errorHandler: { warning: () => {}, error: fail, fatalError: fail } }).parseFromString(s, 'text/xml');
  if (failed || !doc || !doc.documentElement) return null;
  const out = [];
  const all = doc.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (XI_NAMESPACES.has(el.namespaceURI) && (el.localName === 'include' || el.localName === 'fallback')) {
      if (el.localName === 'include') out.push({ href: el.getAttribute('href') || '', parse: el.getAttribute('parse') || '', line: el.lineNumber || 1 });
    }
  }
  return out;
}

const isPublicationModule = (text) => /^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*|<\?[\s\S]*?\?>\s*)*(<!DOCTYPE[\s\S]*?>\s*)?<pm[\s>]/.test(String(text).replace(/^﻿/, ''));

/*
  Returns null when the content is acceptable, else { message, line }.
  `kind` is 'pm' or 'dm'; omitted, it is taken from the root element.
*/
function xincludeProblem(text, kind = null) {
  const k = kind || (isPublicationModule(text) ? 'pm' : 'dm');
  const found = findIncludes(text);
  if (found === null) {
    // The well-formedness check reports the parse error; be safe if it did not.
    return /XInclude/i.test(String(text)) ? { message: 'XML refused: it uses XInclude and could not be checked.', line: 1 } : null;
  }
  for (const inc of found) {
    if (k !== 'pm') return { message: 'XML refused: XInclude is not allowed in a data module.', line: inc.line };
    if (!PM_HREF.test(inc.href) || inc.href.split('/').includes('..')) {
      return { message: `XML refused: a publication module may include only data modules in csdb/ ("${inc.href.slice(0, 80)}").`, line: inc.line };
    }
    if (/^publication\.xml$/i.test(inc.href)) {
      return { message: 'XML refused: the publication module cannot include itself.', line: inc.line };
    }
    if (inc.parse && inc.parse !== 'xml') return { message: 'XML refused: XInclude must parse the included module as XML.', line: inc.line };
  }
  return null;
}

module.exports = { xincludeProblem, findIncludes, isPublicationModule };
