'use strict';
// Where the bundled toolchain lives (Agastya layout).
//
// Copied from JSS Publisher server/engine/paths.js and rewritten for
// Agastya (see vendor/PROVENANCE.md). Everything the PDF build runs is inside
// the project folder: decisions.md P5. There is deliberately NO fallback to
// a `java` or `xsltproc` on PATH and no environment override: a build that
// silently used whatever happened to be installed would pass on a developer
// machine and fail on a clean one. `npm run doctor` reports anything missing.
//
//   <root>/tools/jre                      Temurin JRE (FOP runs on it)
//   <root>/tools/libxslt-1.1.28-win32-x86 xsltproc and its DLLs
//   <root>/tools/fop-2.10/fop             Apache FOP jars
//   <root>/tools/fop.xconf, fonts/        DejaVu Sans registration
//   <root>/vendor/schemas                 S1000D XSD sets + ISO entities
//   <root>/vendor/pipeline                XSLT pipelines and front-matter stencils

const fs = require('fs');
const path = require('path');

const WIN = process.platform === 'win32';
const exe = (name) => (WIN ? `${name}.exe` : name);

const ROOT = path.join(__dirname, '..', '..');
const TOOLS = path.join(ROOT, 'tools');
const SCHEMAS = path.join(ROOT, 'vendor', 'schemas');
const PIPELINE = path.join(ROOT, 'vendor', 'pipeline');

const XSLTPROC_DIR = path.join(TOOLS, 'libxslt-1.1.28-win32-x86');
const JAVA = path.join(TOOLS, 'jre', 'bin', exe('java'));
const FOP_HOME = path.join(TOOLS, 'fop-2.10', 'fop');

// The environment for a spawned tool. A copy, so a child can never change ours.
function childEnv(extra) {
  return { ...process.env, ...(extra || {}) };
}

module.exports = {
  ROOT,
  TOOLS,
  SCHEMAS,
  PIPELINE,
  childEnv,
  // Registers the bundled DejaVu Sans family; given to both the cold FOP CLI
  // and the warm FopServer so a document renders identically either way.
  FOP_XCONF: path.join(TOOLS, 'fop.xconf'),
  XSLTPROC: path.join(XSLTPROC_DIR, 'bin', exe('xsltproc')),
  /*
    FOP's CLI run directly on the bundled JRE, with no launcher script:
    java -cp "<fop>/build/*;<fop>/lib/*" org.apache.fop.cli.Main. The JVM
    expands the wildcards itself, so they are single, unquoted arguments.
  */
  FOP_ARGS: [
    '-cp',
    [path.join(FOP_HOME, 'build', '*'), path.join(FOP_HOME, 'lib', '*')].join(path.delimiter),
    'org.apache.fop.cli.Main',
  ],
  FOP_HOME,
  JAVA,
  JRE_HOME: path.join(TOOLS, 'jre'),
  hasBundledJre: fs.existsSync(JAVA),
  // Ghostscript is not shipped with Agastya; the optional lossless pass is off.
  GS: null,
  hasGhostscript: false,
};
