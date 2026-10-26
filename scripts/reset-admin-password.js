'use strict';
/*
  Break-glass recovery for the single Software Administrator (decisions.md A9).

  Nobody can approve the administrator's own forgot-password request, so an
  operator with shell access to the server machine runs this instead:

    npm run reset-admin            (or: node scripts/reset-admin-password.js)

  It issues a temporary password through the same path as every other reset
  (username@year, 24 h, single use, forced change, all sessions revoked),
  prints it once to this terminal, and records the event in the audit log
  without the value. Stop the server first if it holds the database busy.
*/

const path = require('node:path');
const { Store } = require('../server/db/store');
const { createAudit } = require('../server/audit');
const { issueTempPassword } = require('../server/auth/accounts');

async function main() {
  const dataDir = process.env.AGASTYA_DATA_DIR || path.join(__dirname, '..', 'data');
  const store = new Store(path.join(dataDir, 'agastya.db'));
  const now = () => new Date();
  store.migrate(now().toISOString());
  const admin = store.getAdmin();
  if (!admin) {
    console.error('No Software Administrator exists yet. Set AGASTYA_INITIAL_ADMIN_USERNAME / _PASSWORD and start the server.');
    process.exitCode = 1;
    return;
  }
  const audit = createAudit({ store, now });
  if (admin.disabled_at) store.updateUser(admin.id, { disabled_at: null }, now().toISOString());
  const { tempPassword, expiresAt } = await issueTempPassword({
    store, audit, target: admin, actor: { id: null, username: 'break-glass-cli' }, ip: 'local-cli', reason: 'break-glass', now,
  });
  store.close();
  process.stdout.write(`Temporary password for "${admin.username}": ${tempPassword}\n`
    + `Valid until ${expiresAt} for one sign-in; a new password must be chosen immediately.\n`);
}

main().catch((e) => { console.error('Reset failed:', e.message); process.exitCode = 1; });
