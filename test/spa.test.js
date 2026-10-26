'use strict';
// The built client is served at "/" and at every client route, never for /api.
// (Found by the browser tests: Express 5's "/*splat" did not match "/".)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, tmpdir } = require('./helpers');

test('the client shell is served at / and at client routes; /api stays JSON', async () => {
  const dist = tmpdir('agastya-dist-');
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Agastya</title><div id="root"></div>');
  const t = await startServer({ clientDist: dist });
  try {
    for (const url of ['/', '/signin', '/projects/prj-0000000000?tab=publication']) {
      const r = await fetch(t.base + url);
      assert.equal(r.status, 200, url);
      assert.match(await r.text(), /<div id="root">/, url);
    }
    const api = await fetch(`${t.base}/api/nothing-here`);
    assert.equal(api.status, 404);
    assert.equal((await api.json()).code, 'NOT_FOUND');
  } finally {
    await t.stop();
  }
});
