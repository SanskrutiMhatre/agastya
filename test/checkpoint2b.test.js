'use strict';
// Checkpoint 2b over real HTTP and WebSocket: the publication builder, the
// XInclude guard, autosaved drafts, live updates, approval submission with
// a frozen snapshot (withdraw, stale), the Author dashboard, and scope.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require('ws');
const { startServer, adminClient, makeUser } = require('./helpers');

const ROOT = path.join(__dirname, '..');
const GOLDEN = path.join(ROOT, 'samples', 'golden');
const read = (p) => fs.readFileSync(p, 'utf8');

let t, admin, pm, pm2, author, partner, outsider, project, ws;

async function upload(c, url, fields, file) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields || {})) form.append(k, v);
  if (file) form.append('file', new Blob([file.data]), file.name);
  const res = await fetch(t.base + url, { method: 'POST', body: form, headers: { cookie: c.cookie } });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// Open the project socket; resolves with { ws, messages, status } once open, or the refusal status.
function socket(c, projectId, { origin } = {}) {
  return new Promise((resolve) => {
    const host = new URL(t.base).host;
    const s = new WebSocket(`ws://${host}/ws?project=${projectId}`, { headers: { cookie: c ? c.cookie : '', origin: origin === undefined ? `http://${host}` : origin } });
    const messages = [];
    s.on('message', (d) => messages.push(JSON.parse(String(d))));
    s.on('open', () => resolve({ ws: s, messages, status: 101 }));
    s.on('unexpected-response', (req, res) => resolve({ ws: null, messages, status: res.statusCode }));
    s.on('error', () => resolve({ ws: null, messages, status: 0 }));
  });
}
const until = async (fn, ms = 15000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); }
  return false;
};

test.before(async () => {
  t = await startServer();
  admin = await adminClient(t);
  pm = await makeUser(t, admin, { username: 'priya.rao', fullName: 'Priya Rao', role: 'project_manager' });
  pm2 = await makeUser(t, admin, { username: 'other.pm', fullName: 'Other Manager', role: 'project_manager' });
  author = await makeUser(t, pm, { username: 'arjun.das', fullName: 'Arjun Das', role: 'author' });
  partner = await makeUser(t, pm, { username: 'meera.iyer', fullName: 'Meera Iyer', role: 'author' });
  outsider = await makeUser(t, pm, { username: 'ravi.k', fullName: 'Ravi K', role: 'author' });
  project = (await author.post('/api/projects', { name: 'PDU-200 Manual' })).body.project;
  await author.post(`/api/projects/${project.id}/members`, { userId: partner.user.id });
  ws = path.join(t.dataDir, 'projects', project.id);
  for (const f of fs.readdirSync(path.join(GOLDEN, 'csdb')).filter((x) => x.endsWith('.xml'))) {
    const r = await author.post(`/api/projects/${project.id}/dms/import`, { filename: f, content: read(path.join(GOLDEN, 'csdb', f)) });
    assert.equal(r.status, 201, r.text);
  }
  const icn = 'ICN-AGS-A-240000-A-0AGS1-00001-A-01-1';
  await upload(author, `/api/projects/${project.id}/graphics`, { icn }, { data: fs.readFileSync(path.join(GOLDEN, 'csdb', `${icn}.png`)), name: 'x.png' });
  for (const m of ['emblem.png', 'publisher-logo.png']) fs.copyFileSync(path.join(GOLDEN, 'Media', m), path.join(ws, 'Media', m));
});
test.after(() => t.stop());

test('builder: the new project publication is empty; the pool lists every module', async () => {
  const m = (await author.get(`/api/projects/${project.id}/publication/model`)).body;
  assert.equal(m.counts.total, 0);
  assert.equal(m.pool.length, 9);
  assert.ok(m.pool.every((x) => x.dmCode && x.dmCode.modelIdentCode === 'AGS'));
  assert.ok(m.revision >= 1);
});

let model;
test('builder: a tree is saved through the write path, keeping the PM header', async () => {
  const m = (await author.get(`/api/projects/${project.id}/publication/model`)).body;
  const pick = (code) => { const p = m.pool.find((x) => x.dmc.includes(code)); return { type: 'dm', dmCode: p.dmCode, techName: p.techName, infoName: p.infoName }; };
  const entries = [
    { type: 'folder', title: 'General', children: [pick('018A'), pick('012A')] },
    { type: 'folder', title: 'Description', children: [pick('040A'), pick('030A')] },
    { type: 'folder', title: 'Maintenance', children: [pick('320A'), pick('520A'), pick('310A'), pick('720A')] },
  ];
  const before = read(path.join(ws, 'publication.xml'));
  const r = await author.raw('PUT', `/api/projects/${project.id}/publication/model`, { entries, baseRevision: m.revision });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.body.counts, { folders: 3, dms: 8, total: 11 });
  assert.equal(r.body.unresolved.length, 0);
  assert.equal(r.body.model.pool.length, 1, 'only the BREX module is left unplaced');
  const after = read(path.join(ws, 'publication.xml'));
  assert.equal(after.slice(0, after.indexOf('<content')), before.slice(0, before.indexOf('<content')), 'identification and status section unchanged');
  const revs = t.store.listRevisions(t.store.findLiveDocument(project.id, 'publication.xml').id);
  assert.equal(revs[0].reason, 'Saved from the publication builder');
  model = r.body.model;
  model.revision = r.body.revision;
});

test('builder: stale base revision is a 409 conflict and changes nothing', async () => {
  const before = read(path.join(ws, 'publication.xml'));
  const r = await partner.raw('PUT', `/api/projects/${project.id}/publication/model`, { entries: model.entries.slice(0, 1), baseRevision: model.revision - 1 });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'CONFLICT');
  assert.equal(read(path.join(ws, 'publication.xml')), before);
});

test('builder: guards (empty index, unknown fields, hostile values, depth)', async () => {
  const put = (body, q = '') => author.raw('PUT', `/api/projects/${project.id}/publication/model${q}`, { baseRevision: model.revision, ...body });
  assert.equal((await put({ entries: [] })).body.code, 'EMPTY_PUBLICATION');
  assert.equal((await put({ entries: [{ type: 'folder', title: 'x', children: [], role: 'admin' }] })).body.code, 'VALIDATION');
  assert.equal((await put({ entries: [{ type: 'script' }] })).body.code, 'VALIDATION');
  assert.equal((await put({ entries: [{ type: 'dm', dmCode: { modelIdentCode: 'AGS"/><x a="' } }] })).body.code, 'VALIDATION');
  assert.equal((await put({ entries: [{ type: 'include', href: 'file:///C:/Windows/win.ini' }] })).body.code, 'XML_REFUSED');
  assert.equal((await put({ entries: [{ type: 'include', href: '../../agastya.db' }] })).body.code, 'XML_REFUSED');
  let deep = { type: 'folder', title: 'd', children: [] };
  for (let i = 0; i < 14; i++) deep = { type: 'folder', title: 'd', children: [deep] };
  assert.equal((await put({ entries: [deep] })).body.code, 'VALIDATION');
  assert.equal((await put({ entries: model.entries, extra: 1 })).body.code, 'UNKNOWN_FIELD');
  const pmClient = await pm.raw('PUT', `/api/projects/${project.id}/publication/model`, { entries: model.entries, baseRevision: model.revision });
  assert.equal(pmClient.status, 404, 'the Author owns this project; a manager who does not cannot see it');
  assert.equal((await admin.raw('PUT', `/api/projects/${project.id}/publication/model`, { entries: model.entries, baseRevision: model.revision })).body.code, 'OVERRIDE_REQUIRED');
  assert.equal((await outsider.get(`/api/projects/${project.id}/publication/model`)).status, 404);
});

test('builder: export forms and import', async () => {
  const ietm = await author.get(`/api/projects/${project.id}/publication/ietm-form`);
  assert.equal(ietm.status, 200);
  assert.match(ietm.headers.get('content-disposition'), /attachment; filename="PMC-IETM-/);
  assert.match(ietm.text, /<dmRef>/);
  const pdfForm = await author.get(`/api/projects/${project.id}/publication/pdf-form`);
  assert.match(pdfForm.text, /<xi:include href="csdb\/DMC-AGS-A-00-00-00-00A-018A-D\.xml"/);
  // Import the golden PM verbatim; then put the builder's tree back.
  const golden = read(path.join(GOLDEN, 'publication.xml'));
  const imp = await author.post(`/api/projects/${project.id}/publication/import`, { xml: golden, baseRevision: model.revision });
  assert.equal(imp.status, 200, imp.text);
  assert.deepEqual(imp.body.counts, { folders: 3, dms: 8, total: 11 });
  assert.equal(read(path.join(ws, 'publication.xml')), golden, 'stored verbatim');
  assert.equal((await author.post(`/api/projects/${project.id}/publication/import`, { xml: '<pm><content/></pm>', baseRevision: imp.body.revision })).body.code, 'EMPTY_PUBLICATION');
  const xxe = golden.replace('<pm ', '<!DOCTYPE pm [<!ENTITY x SYSTEM "file:///C:/Windows/win.ini">]>\n<pm ');
  assert.equal((await author.post(`/api/projects/${project.id}/publication/import`, { xml: xxe, baseRevision: imp.body.revision })).body.code, 'XML_REFUSED');
  const m = (await author.get(`/api/projects/${project.id}/publication/model`)).body;
  model = m;
});

test('XInclude is refused in data modules and contained in the publication module', async () => {
  const dm = (await author.get(`/api/projects/${project.id}/dms`)).body.modules.find((x) => x.dmc.endsWith('040A-D'));
  const g = await author.get(`/api/projects/${project.id}/dms/${dm.id}`);
  const withInclude = g.body.xml.replace('<dmodule ', '<dmodule xmlns:xi="http://www.w3.org/2001/XInclude" ').replace('<description>', '<description><xi:include href="../../agastya.db" parse="text"/>');
  const r = await author.raw('PUT', `/api/projects/${project.id}/dms/${dm.id}`, { xml: withInclude, baseRevision: g.body.revision });
  assert.equal(r.body.code, 'XML_REFUSED', r.text);
  assert.match(r.body.error, /XInclude/);
  const encoded = g.body.xml.replace('<dmodule ', '<dmodule xmlns:q="http&#x3a;//www.w3.org/2001/XInclude" ').replace('<description>', '<description><q:include href="x.xml"/>');
  assert.equal((await author.raw('PUT', `/api/projects/${project.id}/dms/${dm.id}`, { xml: encoded, baseRevision: g.body.revision })).body.code, 'XML_REFUSED');
  const pmDoc = await author.get(`/api/projects/${project.id}/publication`);
  const bad = pmDoc.body.xml.replace('<pm ', '<pm xmlns:xi="http://www.w3.org/2001/XInclude" ').replace('<content>', '<content><pmEntry><xi:include href="C:/secret.xml"/></pmEntry>');
  assert.equal((await author.raw('PUT', `/api/projects/${project.id}/publication`, { xml: bad, baseRevision: pmDoc.body.revision })).body.code, 'XML_REFUSED');
  // A file placed on disk outside Agastya is refused at build time too.
  const file = path.join(ws, 'csdb', 'DMC-AGS-A-99-00-00-00A-040A-D.xml');
  fs.writeFileSync(file, withInclude);
  const b = await author.post(`/api/projects/${project.id}/build`);
  assert.equal(b.status, 422);
  assert.equal(b.body.code, 'UNSAFE_INCLUDE');
  fs.unlinkSync(file);
});

test('drafts: private to their author, kept until the real save, never for readers', async () => {
  const dm = (await author.get(`/api/projects/${project.id}/dms`)).body.modules[0];
  const url = `/api/projects/${project.id}/drafts/dm-${dm.id}`;
  assert.equal((await author.get(url)).status, 404);
  assert.equal((await author.raw('PUT', url, { content: '<dmodule>half-typed', baseRevision: 1 })).status, 200);
  assert.equal((await author.get(url)).body.draft.content, '<dmodule>half-typed');
  assert.equal((await partner.get(url)).status, 404, 'another writer does not see my draft');
  assert.equal((await pm.get(url)).status, 404, 'a manager without the project sees nothing');
  assert.equal((await admin.get(url)).body.code, 'OVERRIDE_REQUIRED', 'drafts belong to writers');
  assert.equal((await author.raw('PUT', `/api/projects/${project.id}/drafts/dm-00000000-0000-0000-0000-000000000000`, { content: 'x' })).status, 404);
  assert.equal((await author.raw('PUT', `/api/projects/${project.id}/drafts/..%2F..%2Fx`, { content: 'x' })).status, 404);
  assert.equal((await author.raw('PUT', url, { content: 'x', evil: 1 })).body.code, 'UNKNOWN_FIELD');
  const mine = (await author.get('/api/drafts/mine')).body.drafts;
  assert.equal(mine.length, 1);
  assert.equal(mine[0].link, `/projects/${project.id}/dms/${dm.id}`);
  assert.equal((await author.get('/api/dashboard/author')).body.drafts.length, 1);
  // The real save removes the draft.
  const g = await author.get(`/api/projects/${project.id}/dms/${dm.id}`);
  const s = await author.raw('PUT', `/api/projects/${project.id}/dms/${dm.id}`, { xml: g.body.xml.replace('</dmodule>', '\n</dmodule>'), baseRevision: g.body.revision });
  assert.equal(s.status, 200, s.text);
  assert.equal((await author.get(url)).status, 404);
});

test('WebSocket: authenticated, origin-checked, project-scoped; pushes builds and saves; ends on sign-out', async () => {
  assert.equal((await socket(null, project.id)).status, 401, 'no session');
  assert.equal((await socket(author, project.id, { origin: 'http://evil.example' })).status, 403, 'cross-site origin');
  assert.equal((await socket(author, project.id, { origin: '' })).status, 403, 'no origin');
  assert.equal((await socket(outsider, project.id)).status, 404, 'not on the project');
  assert.equal((await socket(pm2, project.id)).status, 404, 'a manager who does not own it');
  assert.equal((await socket(author, 'prj-0000000000')).status, 404, 'no such project');
  assert.equal((await socket(author, '../etc')).status, 404);

  const a = await socket(author, project.id);
  const p = await socket(partner, project.id);
  const adm = await socket(admin, project.id);
  assert.equal(a.status, 101); assert.equal(p.status, 101); assert.equal(adm.status, 101, 'oversight may watch');
  assert.ok(await until(() => a.messages.some((m) => m.type === 'hello')));

  // A save by the partner reaches the author.
  const dm = (await partner.get(`/api/projects/${project.id}/dms`)).body.modules[1];
  const g = await partner.get(`/api/projects/${project.id}/dms/${dm.id}`);
  await partner.raw('PUT', `/api/projects/${project.id}/dms/${dm.id}`, { xml: g.body.xml.replace('</dmodule>', '\n</dmodule>'), baseRevision: g.body.revision });
  assert.ok(await until(() => a.messages.some((m) => m.type === 'content' && m.action === 'dm.saved' && m.docId === dm.id && m.by === 'Meera Iyer')));

  // Build progress is streamed as it happens.
  const b = await author.post(`/api/projects/${project.id}/build`);
  assert.equal(b.status, 200, b.text);
  const builds = a.messages.filter((m) => m.type === 'build' && m.kind === 'full');
  assert.equal(builds[0].phase, 'start');
  assert.ok(builds.filter((m) => m.phase === 'progress').length >= 3);
  assert.equal(builds.at(-1).phase, 'done');
  assert.ok(!JSON.stringify(a.messages).includes(t.dataDir), 'no server paths in live messages');

  // Removing the partner from the project ends their stream at once, even with nothing else happening.
  await author.del(`/api/projects/${project.id}/members/${partner.user.id}`);
  assert.ok(await until(() => p.ws.readyState === WebSocket.CLOSED, 3000), 'removed member disconnected');
  await author.post(`/api/projects/${project.id}/members`, { userId: partner.user.id });
  // Signing out ends the stream too.
  const p2 = await socket(partner, project.id);
  assert.equal(p2.status, 101);
  const signedOut = t.client(); signedOut.cookie = partner.cookie;
  await signedOut.post('/api/auth/logout');
  assert.ok(await until(() => p2.ws.readyState === WebSocket.CLOSED, 3000), 'signed-out session disconnected');
  const relog = await partner.post('/api/auth/login', { username: 'meera.iyer', password: partner.password });
  assert.equal(relog.status, 200);

  // Sending anything closes the socket (push only).
  a.ws.send('hello?');
  assert.ok(await until(() => a.ws.readyState === WebSocket.CLOSED));
  adm.ws.close();
});

test('the inline PDFs may be framed by the app only', async () => {
  const pdf = await author.get(`/api/projects/${project.id}/output.pdf`);
  assert.equal(pdf.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.match(pdf.headers.get('content-security-policy'), /frame-ancestors 'self'/);
  const dm = (await author.get(`/api/projects/${project.id}/dms`)).body.modules.find((x) => x.dmc.endsWith('520A-D'));
  assert.equal((await author.get(`/api/projects/${project.id}/dms/${dm.id}/preview.pdf`)).status, 404);
  const res = await fetch(`${t.base}/api/projects/${project.id}/dms/${dm.id}/preview`, { method: 'POST', headers: { cookie: author.cookie } });
  assert.equal(res.status, 200);
  const prev = await author.get(`/api/projects/${project.id}/dms/${dm.id}/preview.pdf`);
  assert.equal(prev.status, 200);
  assert.equal(prev.headers.get('content-type'), 'application/pdf');
  assert.equal((await outsider.get(`/api/projects/${project.id}/dms/${dm.id}/preview.pdf`)).status, 404);
  const last = (await author.get(`/api/projects/${project.id}/builds/last`)).body;
  assert.equal(last.build.ok, true);
  assert.equal(last.pdfAvailable, true);
});

let request;
test('submit for approval: refused while validation fails; otherwise built and frozen', async () => {
  const approvers = (await author.get(`/api/projects/${project.id}/approvers`)).body;
  assert.equal(approvers.defaultId, pm.user.id, 'the creating manager is the default');
  assert.deepEqual(approvers.approvers.map((a) => a.username).sort(), ['other.pm', 'priya.rao']);
  assert.equal((await pm.get(`/api/projects/${project.id}/approvers`)).status, 404);

  // A module with a schema error blocks submission.
  const dm = (await author.get(`/api/projects/${project.id}/dms`)).body.modules.find((x) => x.dmc.endsWith('030A-D'));
  const g = await author.get(`/api/projects/${project.id}/dms/${dm.id}`);
  const broken = g.body.xml.replace('<description>', '<description><bogusElement/>');
  const s1 = await author.raw('PUT', `/api/projects/${project.id}/dms/${dm.id}`, { xml: broken, baseRevision: g.body.revision });
  assert.equal(s1.status, 200, s1.text);
  const refused = await author.post(`/api/projects/${project.id}/requests`, { approverId: pm.user.id });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, 'VALIDATION_FAILED');
  const s2 = await author.raw('PUT', `/api/projects/${project.id}/dms/${dm.id}`, { xml: g.body.xml, baseRevision: s1.body.revision });
  assert.equal(s2.status, 200);

  // Bad approvers and other roles.
  assert.equal((await author.post(`/api/projects/${project.id}/requests`, { approverId: partner.user.id })).body.code, 'APPROVER_INVALID');
  assert.equal((await author.post(`/api/projects/${project.id}/requests`, {})).status, 400);
  assert.equal((await author.post(`/api/projects/${project.id}/requests`, { approverId: pm.user.id, role: 'x' })).body.code, 'UNKNOWN_FIELD');
  assert.equal((await outsider.post(`/api/projects/${project.id}/requests`, { approverId: pm.user.id })).status, 404);
  assert.equal((await admin.post(`/api/projects/${project.id}/requests`, { approverId: pm.user.id })).status, 403, 'the administrator cannot create requests');
  assert.equal((await pm2.post(`/api/projects/${project.id}/requests`, { approverId: pm.user.id })).status, 404);

  const r = await author.post(`/api/projects/${project.id}/requests`, { approverId: pm.user.id, note: 'First issue for review' });
  assert.equal(r.status, 201, r.text);
  request = r.body.request;
  assert.equal(request.status, 'pending');
  assert.equal(request.manager.id, pm.user.id);
  // The snapshot: sources, PDF, report, manifest; outside the workspace; read-only.
  const row = t.store.getRequest(request.id);
  const snap = path.join(t.dataDir, row.snapshot_dir);
  assert.ok(!snap.startsWith(ws));
  const manifest = JSON.parse(read(path.join(snap, 'manifest.json')));
  assert.equal(manifest.fingerprint, row.content_fingerprint);
  const rels = manifest.files.map((f) => f.rel);
  assert.ok(rels.includes('publication.xml') && rels.includes('project.json'));
  assert.equal(rels.filter((x) => /^csdb\/DMC-.*\.xml$/.test(x)).length, 9, '8 placed modules + their BREX');
  assert.ok(rels.includes('csdb/ICN-AGS-A-240000-A-0AGS1-00001-A-01-1.png'));
  assert.equal(read(path.join(snap, 'sources', 'publication.xml')), read(path.join(ws, 'publication.xml')));
  assert.equal(fs.readFileSync(path.join(snap, 'publication.pdf')).slice(0, 5).toString(), '%PDF-');
  assert.throws(() => fs.appendFileSync(path.join(snap, 'manifest.json'), 'x'), 'the snapshot is read-only');
  assert.throws(() => t.store.db.prepare("UPDATE publication_requests SET content_fingerprint = 'x'").run(), /immutable/);
  assert.throws(() => t.store.db.prepare('DELETE FROM publication_requests').run(), /kept/);
  // One open request per publication.
  assert.equal((await partner.post(`/api/projects/${project.id}/requests`, { approverId: pm.user.id })).body.code, 'REQUEST_PENDING');
});

test('requests: the chosen manager reads that request and its snapshot only; the manager is notified', async () => {
  const one = await pm.get(`/api/requests/${request.id}`);
  assert.equal(one.status, 200);
  assert.ok(one.body.files.length >= 10);
  assert.ok(one.body.files.every((f) => !f.rel.includes(t.dataDir)));
  const pdf = await fetch(`${t.base}/api/requests/${request.id}/snapshot.pdf`, { headers: { cookie: pm.cookie } });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.equal((await pm.get(`/api/projects/${project.id}`)).status, 404, 'still no sight of the live project');
  assert.equal((await pm2.get(`/api/requests/${request.id}`)).status, 404);
  assert.equal((await outsider.get(`/api/requests/${request.id}`)).status, 404);
  assert.equal((await partner.get(`/api/requests/${request.id}`)).status, 404, 'a co-author did not submit it');
  assert.equal((await admin.get(`/api/requests/${request.id}`)).status, 200);
  assert.equal((await author.get(`/api/requests/${request.id}/../../../agastya.db`)).status, 404);
  const n = (await pm.get('/api/notifications')).body.notifications;
  assert.ok(n.some((x) => x.kind === 'request' && /Approval requested/.test(x.title)));
  const dash = (await author.get('/api/dashboard/author')).body;
  assert.equal(dash.requests[0].status, 'pending');
  assert.equal(dash.totals.pendingRequests, 1);
  assert.equal(dash.publications[0].request.status, 'pending');
});

test('requests: withdraw is the submitter\'s, while pending', async () => {
  assert.equal((await pm.post(`/api/requests/${request.id}/withdraw`)).status, 403);
  assert.equal((await partner.post(`/api/requests/${request.id}/withdraw`)).status, 404);
  assert.equal((await admin.post(`/api/requests/${request.id}/withdraw`)).status, 403);
  const w = await author.post(`/api/requests/${request.id}/withdraw`);
  assert.equal(w.status, 200);
  assert.equal(w.body.request.status, 'withdrawn');
  assert.equal((await author.post(`/api/requests/${request.id}/withdraw`)).body.code, 'NOT_PENDING');
  assert.ok((await pm.get('/api/notifications')).body.notifications.some((x) => /withdrawn/i.test(x.title)));
});

test('requests: a change to the sources after submission makes the request stale', async () => {
  const r = await author.post(`/api/projects/${project.id}/requests`, { approverId: pm2.user.id });
  assert.equal(r.status, 201, r.text);
  const id = r.body.request.id;
  // Building or validating changes no source.
  await author.post(`/api/projects/${project.id}/validate`);
  assert.equal(t.store.getRequest(id).status, 'pending');
  // Placed modules are locked while it is pending (decisions.md L1).
  const dm = (await partner.get(`/api/projects/${project.id}/dms`)).body.modules.find((x) => x.dmc.endsWith('040A-D'));
  const g = await partner.get(`/api/projects/${project.id}/dms/${dm.id}`);
  const edited = g.body.xml.replace('</dmodule>', '<!-- edit -->\n</dmodule>');
  const locked = await partner.raw('PUT', `/api/projects/${project.id}/dms/${dm.id}`, { xml: edited, baseRevision: g.body.revision });
  assert.equal(locked.body.code, 'LOCKED_PENDING_APPROVAL');
  assert.equal(t.store.getRequest(id).status, 'pending');
  // A change to a source made outside Agastya is found at the next content event (here: a new graphic).
  fs.writeFileSync(path.join(ws, 'csdb', dm.file), edited);
  await upload(partner, `/api/projects/${project.id}/graphics`, { icn: 'ICN-AGS-STALE-00001' }, { data: fs.readFileSync(path.join(GOLDEN, 'Media', 'emblem.png')), name: 'x.png' });
  const row = t.store.getRequest(id);
  assert.equal(row.status, 'stale');
  assert.match(row.stale_reason, /graphic uploaded by Meera Iyer/);
  assert.ok((await author.get('/api/notifications')).body.notifications.some((x) => /out of date/.test(x.title)));
  assert.ok((await pm2.get('/api/notifications')).body.notifications.some((x) => /out of date/.test(x.title)));
  // A stale request is not open: the Author can submit again.
  const again = await author.post(`/api/projects/${project.id}/requests`, { approverId: pm.user.id });
  assert.equal(again.status, 201, again.text);
  assert.equal((await author.get(`/api/projects/${project.id}/requests`)).body.requests.length, 3);
});
