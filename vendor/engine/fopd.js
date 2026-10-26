'use strict';
// Warm-JVM FOP renderer manager.
//
// Spawns FopServer (a long-lived Java process) once and reuses it for every
// render, removing fop.bat's ~1.7s JVM/class-load cold start per build. Requests
// are serialized (one FO at a time) which matches the app's single-build model.
// If the process can't start or dies, callers fall back to fop.bat.

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const readline = require('readline');

// engine/ lives under server/, so tools are at ../tools relative to it.
const toolPaths = require('./paths');
const FOP_HOME = toolPaths.FOP_HOME;
/*
  Classpath: our compiled FopServer.class dir + fop's jars (build + lib).
  The class dir must be explicit — an explicit -cp does not include '.'.

  Resolved against the UNPACKED copy. In a packaged build this file lives
  inside app.asar, and while Node reads through the archive transparently, the
  JVM is an external process and cannot — nor can the OS chdir into it, which
  is what produced "Warm FOP renderer: off (spawn ENOTDIR)" and silently
  demoted every build to the slower fop launcher. engine/fopserver is
  asar-unpacked precisely so it exists as real files; this is the same
  .asar -> .asar.unpacked mapping server.js applies to the stylesheets.
*/
const UNPACKED_DIR = __dirname.replace(/\.asar([\\/])/, '.asar.unpacked$1');
const CLASS_DIR = path.join(UNPACKED_DIR, 'fopserver');
const CLASSPATH = [CLASS_DIR, path.join(FOP_HOME, 'build', '*'), path.join(FOP_HOME, 'lib', '*')].join(path.delimiter);
// The bundled JRE, so a machine with no Java installed still renders.
const JAVA = toolPaths.JAVA;

let proc = null;
let rl = null;
let ready = null;         // Promise that resolves once the JVM prints READY
let queue = Promise.resolve();
let disabled = false;     // set true after a failed start, so we stop retrying

function start() {
  if (proc) return ready;
  ready = new Promise((resolve, reject) => {
    try {
      // The font configuration is passed as an argument rather than left to a
      // default inside FopServer, so this path and build.js's `fop -c` are
      // demonstrably reading the same file.
      proc = spawn(JAVA, ['-cp', CLASSPATH, 'FopServer', toolPaths.FOP_XCONF], {
        cwd: CLASS_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
        // Without this the JVM inherits an AppImage's LD_LIBRARY_PATH, which
        // points at Electron's bundled libraries rather than the system ones
        // the JRE needs, and the daemon dies on startup. See paths.childEnv.
        env: toolPaths.childEnv(),
      });
    } catch (e) {
      disabled = true;
      return reject(e);
    }
    let settled = false;
    const fail = (e) => { if (!settled) { settled = true; disabled = true; cleanup(); reject(e); } };

    proc.on('error', fail);
    proc.on('exit', () => { const wasReady = settled; cleanup(); if (!wasReady) fail(new Error('FopServer exited during startup')); });

    rl = readline.createInterface({ input: proc.stdout });
    rl.once('line', (line) => {
      if (line.trim() === 'READY') { settled = true; resolve(); }
      else fail(new Error('Unexpected FopServer output: ' + line));
    });
    // Surface Java stderr for diagnostics, but drop FOP's routine INFO chatter.
    proc.stderr.on('data', (d) => {
      const s = String(d).trim();
      if (s && !/processEvent|Rendered page|INFO:/.test(s)) console.error('[fopd] ' + s);
    });

    setTimeout(() => fail(new Error('FopServer startup timed out')), 20000);
  });
  return ready;
}

function cleanup() {
  try { if (rl) rl.close(); } catch {}
  try { if (proc) proc.kill(); } catch {}
  proc = null; rl = null; ready = null;
}

// Render one FO to PDF via the warm process. baseDir is the URI base for
// resolving relative image references in the FO. Rejects on failure so the
// caller can fall back to fop.bat.
function render({ baseDir, foPath, pdfPath }) {
  if (disabled) return Promise.reject(new Error('fopd disabled'));
  // Chain onto the queue so only one render runs at a time.
  const job = queue.then(async () => {
    await start();
    return new Promise((resolve, reject) => {
      const onLine = (line) => {
        rl.removeListener('line', onLine);
        if (line.startsWith('OK')) resolve({ pdf: pdfPath });
        else reject(new Error(line.replace(/^ERR:\s*/, '') || 'FOP render failed'));
      };
      const onExit = () => reject(new Error('FopServer died mid-render'));
      rl.on('line', onLine);
      proc.once('exit', onExit);
      proc.stdin.write([baseDir, foPath, pdfPath].join('\t') + '\n');
    });
  });
  // Keep the queue alive even if this job rejects.
  queue = job.then(() => {}, () => {});
  return job;
}

// Render a trivial FO once so FOP's font detection (a one-time ~4s cost paid on
// the FIRST real render, not at JVM start) happens up front. After this the
// user's very first build is already warm.
function warmup() {
  return render({
    baseDir: CLASS_DIR,
    // Read by the JVM, so it too must be the unpacked copy, not the asar path.
    foPath: path.join(CLASS_DIR, 'warmup.fo'),
    pdfPath: path.join(os.tmpdir(), 'jss-fop-warmup.pdf'),
  });
}

function stop() {
  if (proc) { try { proc.stdin.write('QUIT\n'); } catch {} }
  cleanup();
}

function isAvailable() { return !disabled; }

module.exports = { render, start, warmup, stop, isAvailable };
