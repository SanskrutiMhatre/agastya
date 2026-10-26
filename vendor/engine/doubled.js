'use strict';
/*
  One test for "this document contains itself twice", used at every point that
  writes an XML file.

  The shape comes from two lineages of the same document being merged: Yjs
  joins independent insertions of the same text by concatenating them, so the
  file ends up holding the whole document twice and the next build dies at the
  xi:include with "Extra content at the end of the document".

  The causes are fixed, but a room that was damaged BEFORE they were fixed
  still holds the doubled text, and anything that writes from it — the room's
  own flush, a save from the editor tab that has it open, an upload of a file
  exported from it — puts the damage back. Guarding one path at a time is how
  this came back twice: the flush was guarded, and the next save wrote it
  anyway.

  Two XML declarations cannot occur in a valid document, which is what makes
  this safe to act on. No correct file is ever mistaken for a damaged one, so
  refusing the write can never destroy real work.
*/

const XML_FILE = /\.xml$/i;

// A declaration is only a declaration at the start of a document or a line;
// the characters "<?xml" quoted inside text are not one.
const DECLARATION = /<\?xml[\s?]/g;

function declarationCount(text) {
    return (String(text == null ? '' : text).match(DECLARATION) || []).length;
}

/*
  `rel` may be omitted when the caller already knows it is XML. When given, a
  non-XML file is never rejected: it has no declarations to count, and a text
  file that happens to contain the characters twice is not this problem.
*/
function isDoubledXml(rel, text) {
    if (rel != null && !XML_FILE.test(String(rel))) return false;
    return declarationCount(text) > 1;
}

// The same sentence wherever a write is refused, so the person reading it in a
// build log and in a dialog is told the same thing and given the same way out.
const DOUBLED_MESSAGE =
    'This document contains itself twice — two copies of the same XML joined end to end. '
    + 'It was not saved, because writing it would fail the next build. '
    + 'Close the application and run: node tools/repair-doubled.js --fix';

module.exports = { isDoubledXml, declarationCount, DOUBLED_MESSAGE };
