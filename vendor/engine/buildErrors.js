'use strict';
/*
  Turn a build failure into something the person who caused it can act on.

  The pipeline is two external programs, and when either refuses, what comes
  back is written for whoever wrote the program. libxml2 answers with an
  absolute path, a line number and a phrase like "Extra content at the end of
  the document". FOP answers with a Java stack trace wrapped around one useful
  sentence. Neither says which file in THIS project is wrong or what to do, and
  the application used to discard all of it and show "Build failed" — the least
  informative possible summary of a message that named the file and the line.

  So: find the one line that matters, say it in the project's own terms, and
  add a hint where the cause is a known one. The raw output is kept alongside,
  because a summary that guesses wrong must never be the only thing left.
*/
const path = require('path');

// FOP writes a timestamped banner and the emitting class before each message,
// and warns about things that did not stop the build. None of it is signal.
const NOISE = [
  /^\s*$/,
  /^[A-Z][a-z]{2} \d{1,2}, \d{4}/,          // "Aug 29, 2026 9:21:41 AM"
  /^\s*(WARNING|INFO):/,
  /^\s*at [\w.$]+\(/,                        // stack frames
  /^\s*\.{3}/,
  /^SEVERE: Exception$/,
];
const isNoise = (l) => NOISE.some((re) => re.test(l));

// Absolute paths help nobody: the project directory is the only frame of
// reference the reader has.
function relativise(file, workDir) {
  if (!file) return file;
  let f = String(file).replace(/^file:\/+/, '').replace(/\\/g, '/');
  if (workDir) {
    const w = String(workDir).replace(/\\/g, '/').replace(/\/+$/, '');
    if (f.toLowerCase().startsWith(w.toLowerCase() + '/')) return f.slice(w.length + 1);
  }
  // A path from somewhere else entirely (a temp dir): the name is the useful part.
  return f.includes('/') ? path.posix.basename(f) : f;
}

/*
  Known causes, in the words of what actually went wrong.

  Only for messages whose cause is genuinely specific — a hint that restates
  the error ("the XML is invalid") teaches nothing and costs the reader a line.
*/
const HINTS = [
  [/Extra content at the end of the document/,
   'The file holds more than one XML document. This is usually a file that was written twice — '
   + 'check whether it was open in the editor while something else replaced it.'],
  [/XML declaration allowed only at the start/,
   'A second "<?xml ...?>" appears partway through the file, which means two documents were joined end to end.'],
  [/Opening and ending tag mismatch|Premature end of data in tag/,
   'A tag is left open. The line given is where the parser gave up, which is usually AFTER the tag that was never closed.'],
  [/xmlParseEntityRef: no name/,
   'A bare "&" in the text. Write it as "&amp;".'],
  [/could not load .*, and no fallback was found/,
   'A referenced file is missing from the project. Check that the data module was uploaded and that the reference spells its name exactly.'],
  [/is missing child elements/,
   'The layout produced an empty box the PDF format does not allow. This is a bug in the stylesheet, not in your document — please report the file you were building.'],
  [/^Failed to (open|read)|FileNotFoundException/,
   'A file the build needed is not where it was expected.'],
];
const hintFor = (msg) => (HINTS.find(([re]) => re.test(msg)) || [])[1] || null;

/*
  libxml2:  /abs/path/file.xml:24: parser error : Extra content at the end...
            /abs/path/file.xml:45: element include: XInclude error : could not load ...
  FOP:      SEVERE: javax.xml.transform.TransformerException: file:/abs/x.fo:6:60: "fo:table-cell" is ...
*/
const LIBXML = /^(.*?):(\d+):\s*(?:element \w+:\s*)?[\w ]*error\s*:\s*(.+)$/;
const FOP = /(?:Exception|Error):\s*(?:file:)?(\S+?\.(?:fo|xml|xsl)):(\d+):(\d+):\s*(.+?)(?:\s*\(See position[^)]*\))?$/;
const FOP_BARE = /^SEVERE:\s*(?:[\w.$]+(?:Exception|Error):\s*)?(.+?)(?:\s*\(See position[^)]*\))?$/;

/*
  Returns { summary, file, line, hint, raw } — summary is always a sentence
  worth showing; file/line are set when the tools named them.
*/
function explainBuildFailure(err, opts) {
  const o = opts || {};
  const raw = [err && err.stderr, err && err.stdout, err && err.message]
    .filter(Boolean).join('\n');
  const lines = raw.split(/\r?\n/).filter((l) => !isNoise(l));

  for (const line of lines) {
    let m = FOP.exec(line);
    if (m) {
      const message = m[4].trim();
      return {
        summary: `${relativise(m[1], o.workDir)}, line ${m[2]}: ${message}`,
        file: relativise(m[1], o.workDir), line: Number(m[2]),
        hint: hintFor(message), raw,
      };
    }
    m = LIBXML.exec(line);
    // The caret line libxml prints under the offending column also contains a
    // colon sometimes; require a plausible message to avoid matching it.
    if (m && m[3] && m[3].trim().length > 3) {
      const message = m[3].trim();
      return {
        summary: `${relativise(m[1], o.workDir)}, line ${m[2]}: ${message}`,
        file: relativise(m[1], o.workDir), line: Number(m[2]),
        hint: hintFor(message), raw,
      };
    }
  }

  // No file:line anywhere — take the first thing FOP called severe, then the
  // first line of any kind, and only then the exception's own message.
  for (const line of lines) {
    const m = FOP_BARE.exec(line.trim());
    if (m && m[1].trim().length > 3) {
      const message = m[1].trim();
      return { summary: message, file: null, line: null, hint: hintFor(message), raw };
    }
  }
  const first = lines.find((l) => l.trim().length > 3);
  const message = (first || (err && err.message) || 'The build failed with no output.').trim();
  return { summary: message, file: null, line: null, hint: hintFor(message), raw };
}

module.exports = { explainBuildFailure };
