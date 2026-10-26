'use strict';
/*
  Live updates over WebSocket (PROMPT.md: "every WebSocket connection
  authenticated and project-scoped"; decisions.md C5).

  One path, /ws?project=<id>. The upgrade is refused before any socket
  exists unless all of these hold:
    - the Origin header is present and its host equals Host (a page on
      another site cannot open a socket with the user's cookie);
    - the session cookie resolves to a live, ungated session;
    - evaluate(user, 'content.read', { project, membership }) allows it
      (a project the user cannot see is refused exactly like a missing one).
  The server only pushes; anything a client sends closes the socket. The
  session and the project rule are checked again before every delivery,
  after every audited action and every 15 s, so a sign-out, a revoked
  session, a disabled account or a removed membership ends the stream.

  Events come from the in-process hub (ctx.events):
    'build'   { projectId, kind, phase: start|progress|done|error, message, by, target }
    'content' { projectId, action, docId, revision, by, byId }
  Only text summaries go out: build lines are already free of paths.
*/

const { WebSocketServer } = require('ws');
const { evaluate } = require('./auth/authz');
const { parseCookies, COOKIE_NAME } = require('./auth/sessions');

const MAX_SOCKETS_PER_SESSION = 8;
const PROJECT_ID = /^prj-[0-9a-f]{10}$/;

function refuse(socket, status, text) {
  try {
    socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${text.length}\r\n\r\n${text}`);
  } catch { /* already gone */ }
  socket.destroy();
}

function createRealtime({ store, sessions, events, log = console }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024, perMessageDeflate: false });
  const clients = new Set();

  function authorise(cookieHeader, projectId) {
    const auth = sessions.resolveFromCookieHeader(cookieHeader || '');
    if (!auth) return { ok: false, status: 401 };
    const project = store.getProject(projectId);
    const membership = project ? store.getMembership(project.id, auth.user.id) : null;
    const v = evaluate(auth.user, 'content.read', { project, membership });
    if (!v.ok) return { ok: false, status: v.http === 401 ? 401 : v.http === 403 && v.code !== 'FORBIDDEN' ? 403 : 404 };
    return { ok: true, auth };
  }

  function handleUpgrade(req, socket, head) {
    let url;
    try { url = new URL(req.url, 'http://local'); } catch { return refuse(socket, 400, 'Bad Request'); }
    if (url.pathname !== '/ws') return refuse(socket, 404, 'Not Found');
    let originHost = null;
    try { originHost = new URL(req.headers.origin || '').host; } catch { originHost = null; }
    if (!originHost || originHost !== req.headers.host) return refuse(socket, 403, 'Forbidden');
    const projectId = url.searchParams.get('project') || '';
    if (!PROJECT_ID.test(projectId) || [...url.searchParams.keys()].some((k) => k !== 'project')) return refuse(socket, 404, 'Not Found');
    const a = authorise(req.headers.cookie, projectId);
    if (!a.ok) return refuse(socket, a.status, a.status === 401 ? 'Unauthorized' : a.status === 403 ? 'Forbidden' : 'Not Found');
    const token = parseCookies(req.headers.cookie || '')[COOKIE_NAME];
    const sameSession = [...clients].filter((c) => c.sessionId === a.auth.session.id).length;
    if (sameSession >= MAX_SOCKETS_PER_SESSION) return refuse(socket, 429, 'Too Many Requests');

    wss.handleUpgrade(req, socket, head, (ws) => {
      const client = { ws, projectId, userId: a.auth.user.id, sessionId: a.auth.session.id, cookie: `${COOKIE_NAME}=${token}` };
      clients.add(client);
      ws.on('message', () => ws.close(1008, 'Receive-only'));
      ws.on('close', () => clients.delete(client));
      ws.on('error', () => clients.delete(client));
      ws.send(JSON.stringify({ type: 'hello', projectId }));
    });
  }

  // Still allowed? A client that is not is closed (4401) and dropped.
  function stillAllowed(c) {
    const a = authorise(c.cookie, c.projectId);
    if (a.ok && a.auth.session.id === c.sessionId) return true;
    try { c.ws.close(4401, 'Not authorised'); } catch { /* gone */ }
    clients.delete(c);
    return false;
  }

  function deliver(projectId, payload) {
    const text = JSON.stringify(payload);
    for (const c of clients) {
      if (c.projectId !== projectId) continue;
      // Re-checked every time: revocation and membership changes take effect at once.
      if (!stillAllowed(c)) continue;
      try { c.ws.send(text); } catch (e) { log.warn && log.warn(`[ws] send failed: ${e.message}`); }
    }
  }

  /*
    Every socket is also re-checked after any audited action (sign-out,
    session revocation, disable, membership or role change) and every 15 s,
    so a stream ends even when its project is quiet.
  */
  let sweepQueued = false;
  function sweep() { sweepQueued = false; for (const c of [...clients]) stillAllowed(c); }
  const onAudit = () => { if (!sweepQueued && clients.size) { sweepQueued = true; setImmediate(sweep); } };
  const timer = setInterval(sweep, 15000);
  if (timer.unref) timer.unref();

  const onBuild = (e) => deliver(e.projectId, { type: 'build', kind: e.kind, phase: e.phase, message: e.message || '', by: e.by || null, target: e.target || null, at: e.at });
  const onContent = (e) => deliver(e.projectId, { type: 'content', action: e.action, docId: e.docId || null, revision: e.revision || null, by: e.by || null, byId: e.byId || null, at: e.at });
  events.on('build', onBuild);
  events.on('content', onContent);
  events.on('audit', onAudit);

  function close() {
    clearInterval(timer);
    events.off('build', onBuild);
    events.off('content', onContent);
    events.off('audit', onAudit);
    for (const c of clients) { try { c.ws.terminate(); } catch { /* gone */ } }
    clients.clear();
    wss.close();
  }

  return { handleUpgrade, close, sweep, count: () => clients.size };
}

module.exports = { createRealtime };
