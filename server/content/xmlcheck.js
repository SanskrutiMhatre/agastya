'use strict';
/*
  The XML safety guard applied to every write (decisions.md C6):

    1. size limit and no NUL bytes;
    2. checkXmlSafety (vendor/engine/xmlGuard.js): no parsed external
       entities (XXE), no local file identifiers, no internal parameter
       entities, a cap on entity declarations; NDATA graphic entities and the
       S1000D ISO entity set are allowed;
    3. no doubled document (two XML declarations in one file);
    4. well-formed, checked by libxml2 (xmllint-wasm, the same parser the
       build uses), with the line of the first error;
    5. XInclude contained (content/xinclude.js): none in data modules, only
       csdb/*.xml in a publication module.

  Schema validity is NOT required to save: work in progress may be invalid.
  Validation is a separate, explicit step.
*/

const { validateXML } = require('xmllint-wasm');
const { checkXmlSafety } = require('../../vendor/engine/xmlGuard');
const { isDoubledXml } = require('../../vendor/engine/doubled');
const { xincludeProblem } = require('./xinclude');

const MAX_XML_BYTES = 8 * 1024 * 1024;

class ContentError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}

async function wellFormed(xml) {
  const r = await validateXML({ xml: [{ fileName: 'doc.xml', contents: xml }], normalization: 'format' });
  const first = (r.errors || []).find((e) => e.loc && e.loc.lineNumber);
  if (!first && !(r.errors || []).length) return { ok: true };
  const msg = String((first || r.errors[0]).message || '').replace(/^.*?parser error\s*:\s*/, '').trim();
  return { ok: false, line: first ? first.loc.lineNumber : 1, message: msg };
}

// Throws ContentError if the content may not be written.
async function assertWritableXml(text) {
  if (typeof text !== 'string') throw new ContentError(400, 'VALIDATION', 'The XML must be text.');
  if (Buffer.byteLength(text, 'utf8') > MAX_XML_BYTES) throw new ContentError(413, 'TOO_LARGE', 'The XML is larger than 8 MB.');
  if (text.includes('\0')) throw new ContentError(400, 'XML_REFUSED', 'XML refused: it contains NUL characters.');
  const guard = checkXmlSafety(text);
  if (!guard.ok) throw new ContentError(400, 'XML_REFUSED', guard.error);
  if (isDoubledXml(null, text)) {
    throw new ContentError(400, 'DOCUMENT_DOUBLED', 'XML refused: the file contains the document twice (two XML declarations).');
  }
  const wf = await wellFormed(text);
  if (!wf.ok) throw new ContentError(400, 'NOT_WELL_FORMED', `The XML is not well formed (line ${wf.line}): ${wf.message}`, { line: wf.line });
  const xi = xincludeProblem(text);
  if (xi) throw new ContentError(400, 'XML_REFUSED', xi.message, { line: xi.line });
}

module.exports = { assertWritableXml, wellFormed, ContentError, MAX_XML_BYTES };
