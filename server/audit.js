'use strict';
// Append-only audit. Metadata is sanitised so no password, hash, token or
// cookie material can land in a row even by accident, and a failing audit
// write never breaks the operation it describes. Every stored row is offered
// to the notifier, which decides who should hear about it.

const SENSITIVE_KEY = /pass(word)?|hash|token|secret|cookie|credential|session_?key/i;

function sanitiseMeta(meta) {
  if (meta == null) return null;
  return JSON.parse(JSON.stringify(meta, (k, v) => (k && SENSITIVE_KEY.test(k) ? undefined : v)));
}

function createAudit({ store, notifier = null, now = () => new Date(), log = console }) {
  return function audit(fields) {
    let id = null;
    const row = { ...fields, at: now().toISOString(), meta: null };
    try {
      row.meta = sanitiseMeta(fields.meta);
      id = store.appendAudit(row);
    } catch (e) {
      log.error('[audit] write failed (operation unaffected):', e.message);
      return null;
    }
    if (notifier) {
      try { notifier(id, row); } catch (e) { log.error('[notify] failed (operation unaffected):', e.message); }
    }
    return id;
  };
}

module.exports = { createAudit, sanitiseMeta, SENSITIVE_KEY };
