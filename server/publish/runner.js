'use strict';
/*
  One place that runs a build for a request: progress goes to the event hub
  (and from there to the project's WebSocket subscribers), the outcome is
  recorded in `builds` for the dashboards, and errors are re-thrown for the
  route to answer. Used by the full build, the module preview and the
  snapshot taken at submission.
*/

const pdf = require('./pdf');

function createBuildRunner({ store, events, log = console, now = () => new Date() }) {
  const at = () => now().toISOString();

  async function run({ project, dir, kind, user, target = null, dmRel = null }) {
    const base = { projectId: project.id, kind, target, by: user.fullName || user.username };
    const emit = (phase, message = '') => events.emit('build', { ...base, phase, message, at: at() });
    emit('start', kind === 'preview' ? `Preview of ${target || 'a data module'} started` : 'Publication build started');
    const onMessage = (line) => emit('progress', line);
    const started = Date.now();
    try {
      const r = kind === 'preview'
        ? await pdf.buildPreview(dir, dmRel, { log, onMessage })
        : await pdf.buildPublication(dir, { log, onMessage });
      store.recordBuild({ projectId: project.id, kind, target, userId: user.id, ok: true, ms: r.totalMs, now: at() });
      emit('done', `Finished in ${(r.totalMs / 1000).toFixed(1)} s`);
      return r;
    } catch (e) {
      store.recordBuild({ projectId: project.id, kind, target, userId: user.id, ok: false, ms: Date.now() - started, errorCode: e.code || 'BUILD_FAILED', now: at() });
      emit('error', e instanceof pdf.BuildError ? e.message : 'The build failed.');
      throw e;
    }
  }

  return { run };
}

module.exports = { createBuildRunner };
