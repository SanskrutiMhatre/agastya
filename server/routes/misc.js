'use strict';
// Health, notifications and the SPA fallback.

const fs = require('node:fs');
const path = require('node:path');
const { body } = require('../http/validate');

/*
  Reference data for the authoring dialogs, seeded from the Agastya original
  (backend/data/config-*.json, copied to vendor/reference-data). Read once;
  only code/name pairs are served.
*/
const REF_DIR = path.join(__dirname, '..', '..', 'vendor', 'reference-data');
const REF_FILES = {
  countries: 'country-codes', languages: 'language-codes', securityClasses: 'security-classes',
  infoCodes: 'info-codes', sns: 'sns', originators: 'originator-cages', rpcs: 'rpc-cages',
};
let refCache = null;
function referenceData() {
  if (refCache) return refCache;
  const out = {};
  for (const [key, file] of Object.entries(REF_FILES)) {
    let list = [];
    try { list = JSON.parse(fs.readFileSync(path.join(REF_DIR, `${file}.json`), 'utf8')); } catch { list = []; }
    out[key] = list.map((r) => ({ code: String(r.code || r.cage || ''), name: String(r.name || '') })).filter((r) => r.code);
  }
  refCache = out;
  return out;
}

function register({ app, store, authz, now, clientDist }) {
  const { requireAuth, publicRoute } = authz;

  app.get('/api/health',
    publicRoute('Liveness probe for deployment health checks; reports nothing but that the server answers.'),
    (req, res) => res.json({ status: 'ok' }));

  app.get('/api/reference-data',
    requireAuth(),
    (req, res) => res.json(referenceData()));

  app.get('/api/notifications',
    requireAuth(),
    (req, res) => {
      const id = req.auth.user.id;
      res.json({ notifications: store.listNotifications(id, 30), unread: store.unreadNotificationCount(id) });
    });

  app.post('/api/notifications/read',
    requireAuth(),
    body({ ids: { type: 'intArray', max: 200 } }),
    (req, res) => {
      const n = store.markNotificationsRead(req.auth.user.id, req.valid.ids || null, now().toISOString());
      res.json({ ok: true, marked: n });
    });

  // Unknown API paths are a JSON 404, never the SPA shell.
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.', code: 'NOT_FOUND' }));

  const indexHtml = clientDist && path.join(clientDist, 'index.html');
  app.get('/{*splat}', // also matches '/' itself (Express 5)
    publicRoute('The built client shell; the sign-in page has to load before anyone can authenticate.'),
    (req, res) => {
      if (indexHtml && fs.existsSync(indexHtml)) {
        res.set('Cache-Control', 'no-cache');
        return res.sendFile(indexHtml);
      }
      res.status(404).type('text/plain').send('Client not built. Run "npm run build:client", or use the Vite dev server.');
    });
}

module.exports = { register };
