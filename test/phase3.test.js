'use strict';
// Phase 3, the Project Manager dashboard (decisions.md M1-M10), over real
// HTTP: the queue and review are scoped to the chosen manager; decisions
// need a comment and a matching fingerprint; data module statuses move only
// through the approval flow; the history chain keeps every comment, shown
// only to who may see it; every decision is audited without its text;
// notifications; snapshot containment; team activity; and a manager's
// control over the Authors they created.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, adminClient, makeUser } = require('./helpers');
const workflow = require('../server/content/workflow');

const GOLDEN = path.join(__dirname, '..', 'samples', 'golden');
const read = (p) => fs.readFileSync(p, 'utf8');

let t, admin, pm, pm2, author, coauthor, outsider, project, ownProject, otherProject, ws;
const R = {}; // requests by step

async function upload(c, url, fields, file) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields || {})) form.append(k, v);
  if (file) form.append('file', new Blob([file.data]), file.name);
  const res = await fetch(t.base + url, { method: 'POST', body: form, headers: { cookie: c.cookie } });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const modules = async (c = author) => (await c.get(`/api/projects/${project.id}/dms`)).body.modules;
const statuses = async () => {
  const out = {};
  for (const m of await modules()) out[m.dmc] = m.status;
  return out;
};
const SPARE = 'AGS-A-31-00-00-00A-040A-D';
const placed = (s) => Object.entries(s).filter(([dmc]) => dmc !== SPARE).map(([, v]) => v);
async function save(c, dm, transform = (x) => x.replace('</dmodule>', '\n</dmodule>')) {
  const g = await c.get(`/api/projects/${project.id}/dms/${dm.id}`);
  return c.raw('PUT', `/api/projects/${project.id}/dms/${dm.id}`, { xml: transform(g.body.xml), baseRevision: g.body.revision });
}
const submit = (to, note) => author.post(`/api/projects/${project.id}/requests`, { approverId: to.user.id, ...(note ? { note } : {}) });
const decide = (c, id, outcome, comment) => c.post(`/api/requests/${id}/decision`, comment === undefined ? { outcome } : { outcome, comment });
const notes = async (c) => (await c.get('/api/notifications')).body.notifications;
const lastAudit = (action) => t.store.db.prepare('SELECT * FROM audit_log WHERE action = ? ORDER BY id DESC').get(action);

test.before(async () => {
  t = await startServer();
  admin = await adminClient(t);
  pm = await makeUser(t, admin, { username: 'priya.rao', fullName: 'Priya Rao', role: 'project_manager' });
  pm2 = await makeUser(t, admin, { username: 'vikram.s', fullName: 'Vikram Shah', role: 'project_manager' });
  author = await makeUser(t, pm, { username: 'arjun.das', fullName: 'Arjun Das', role: 'author' });
  coauthor = await makeUser(t, pm, { username: 'meera.iyer', fullName: 'Meera Iyer', role: 'author' });
  outsider = await makeUser(t, pm2, { username: 'ravi.k', fullName: 'Ravi K', role: 'author' });
  project = (await pm.post('/api/projects', { name: 'Hydraulics manual' })).body.project;
  for (const u of [author, coauthor]) assert.equal((await pm.post(`/api/projects/${project.id}/members`, { userId: u.user.id })).status, 201);
  // The Author's own project (invisible to every manager) and a project of pm2's the Author also works on.
  ownProject = (await author.post('/api/projects', { name: 'Arjun notes' })).body.project;
  await author.post(`/api/projects/${ownProject.id}/members`, { userId: coauthor.user.id });
  otherProject = (await pm2.post('/api/projects', { name: 'Avionics manual' })).body.project;
  await pm2.post(`/api/projects/${otherProject.id}/members`, { userId: author.user.id });

  ws = path.join(t.dataDir, 'projects', project.id);
  for (const f of fs.readdirSync(path.join(GOLDEN, 'csdb')).filter((x) => x.endsWith('.xml'))) {
    const r = await author.post(`/api/projects/${project.id}/dms/import`, { filename: f, content: read(path.join(GOLDEN, 'csdb', f)) });
    assert.equal(r.status, 201, r.text);
  }
  const icn = 'ICN-AGS-A-240000-A-0AGS1-00001-A-01-1';
  await upload(author, `/api/projects/${project.id}/graphics`, { icn }, { data: fs.readFileSync(path.join(GOLDEN, 'csdb', `${icn}.png`)), name: 'x.png' });
  for (const m of ['emblem.png', 'publisher-logo.png']) fs.copyFileSync(path.join(GOLDEN, 'Media', m), path.join(ws, 'Media', m));
  const g = await author.get(`/api/projects/${project.id}/publication`);
  await author.raw('PUT', `/api/projects/${project.id}/publication`, { xml: read(path.join(GOLDEN, 'publication.xml')), baseRevision: g.body.revision });
  const r = await author.post(`/api/projects/${project.id}/dms`, { dmc: { modelIdentCode: 'AGS', systemDiffCode: 'A', systemCode: '31', subSystemCode: '0', subSubSystemCode: '0', assyCode: '00', disassyCode: '00', disassyCodeVariant: 'A', infoCode: '040', infoCodeVariant: 'A', itemLocationCode: 'D' }, techName: 'Spare', schemaType: 'descript' });
  assert.equal(r.status, 201, r.text);
});
test.after(() => t.stop());

test('every module starts as draft, and submission moves the frozen ones to in_review (M3)', async () => {
  assert.ok(Object.values(await statuses()).every((s) => s === 'draft'));
  const r = await submit(pm, 'First issue');
  assert.equal(r.status, 201, r.text);
  R.first = r.body.request;
  const s = await statuses();
  assert.ok(placed(s).every((x) => x === 'in_review'), JSON.stringify(s));
  assert.equal(s['AGS-A-31-00-00-00A-040A-D'], 'draft', 'a module the publication does not place stays draft');
  const a = JSON.parse(lastAudit('request.submitted').meta);
  assert.equal(a.modulesInReview, placed(s).length);
  assert.equal(a.previousRequestId, null);
});

test('the manager is told of the submission, and the queue is scoped to them (M1, M9)', async () => {
  const n = (await notes(pm)).find((x) => x.title === 'Approval requested: ' + R.first.title);
  assert.ok(n, 'the manager is notified');
  assert.equal(n.link, `/approvals/${R.first.id}`);
  const q = (await pm.get('/api/requests/queue')).body;
  assert.equal(q.pending, 1);
  assert.deepEqual(q.requests.map((x) => x.id), [R.first.id]);
  assert.equal((await pm2.get('/api/requests/queue')).body.requests.length, 0, 'another manager sees nothing');
  assert.equal((await admin.get('/api/requests/queue')).body.requests.length, 1, 'the administrator has oversight');
  assert.equal((await author.get('/api/requests/queue')).status, 403);
  assert.equal((await pm.get('/api/auth/me')).body.queues.approvals, 1);
  for (const c of [pm2, outsider, coauthor]) {
    assert.equal((await c.get(`/api/requests/${R.first.id}`)).status, 404);
    assert.equal((await c.get(`/api/requests/${R.first.id}/snapshot.pdf`)).status, 404);
    assert.equal((await c.get(`/api/requests/${R.first.id}/validation`)).status, 404);
    assert.equal((await c.get(`/api/requests/${R.first.id}/source?rel=publication.xml`)).status, 404);
  }
});

test('the review shows the frozen snapshot only: files, modules, validation, sources and revisions (M1, M10)', async () => {
  const d = (await pm.get(`/api/requests/${R.first.id}`)).body;
  assert.equal(d.canDecide, true);
  assert.ok(d.files.some((f) => f.rel === 'publication.xml'));
  assert.ok(d.files.every((f) => /^[0-9a-f]{64}$/.test(f.sha256)));
  assert.equal(d.modules.length, placed(await statuses()).length);
  assert.ok(d.modules.every((m) => m.status === 'in_review'));
  assert.deepEqual(d.history.map((h) => h.id), [R.first.id]);
  const v = (await pm.get(`/api/requests/${R.first.id}/validation`)).body;
  assert.equal(v.counts.error, 0);
  const rel = d.modules[0].rel;
  const src = (await pm.get(`/api/requests/${R.first.id}/source?rel=${encodeURIComponent(rel)}`)).body;
  assert.equal(src.text, read(path.join(t.dataDir, 'snapshots', R.first.id, 'sources', rel)));
  const img = d.files.find((f) => f.rel.endsWith('.png'));
  const ir = await pm.get(`/api/requests/${R.first.id}/source?rel=${encodeURIComponent(img.rel)}`);
  assert.equal(ir.status, 200);
  assert.equal(ir.headers.get('content-type'), 'image/png');
  const revs = (await pm.get(`/api/requests/${R.first.id}/revisions?rel=${encodeURIComponent(rel)}`)).body.revisions;
  assert.ok(revs.length >= 1);
  const one = (await pm.get(`/api/requests/${R.first.id}/revisions/${revs[0].id}`)).body;
  assert.equal(one.revision.rel, rel);
  assert.ok(one.text.includes('<dmodule'));
  // Containment: nothing outside the manifest, no traversal, no other project's revisions.
  for (const bad of ['csdb/DMC-AGS-A-31-00-00-00A-040A-D.xml', '../manifest.json', '../../users.db', 'sources/../../manifest.json', 'project.json/../publication.xml']) {
    const r = await pm.get(`/api/requests/${R.first.id}/source?rel=${encodeURIComponent(bad)}`);
    assert.ok([400, 404].includes(r.status), `${bad}: ${r.status}`);
    assert.ok(!r.text.includes(t.dataDir));
  }
  assert.equal((await pm.get(`/api/requests/${R.first.id}/source?rel=${encodeURIComponent('C:\\Windows\\win.ini')}`)).status, 400);
  const spareRev = t.store.db.prepare('SELECT r.id FROM revisions r JOIN documents d ON d.id = r.document_id WHERE d.rel_path = ?').get(`csdb/DMC-${SPARE}.xml`);
  assert.ok(spareRev, 'the spare module has a revision');
  assert.equal((await pm.get(`/api/requests/${R.first.id}/revisions/${spareRev.id}`)).status, 404, 'a revision of a file outside the snapshot');
  assert.equal((await pm.get(`/api/requests/${R.first.id}/revisions/abc`)).status, 404);
  assert.equal((await pm.get(`/api/requests/${R.first.id}/revisions/99999999`)).status, 404);
});

test('decision rules: chosen manager only, comment required, known fields only (M2)', async () => {
  const id = R.first.id;
  assert.equal((await decide(admin, id, 'approve', 'ok')).body.code, 'OVERRIDE_REQUIRED');
  assert.equal((await decide(author, id, 'approve', 'ok')).status, 403, 'the submitter cannot decide');
  assert.equal((await decide(coauthor, id, 'approve', 'ok')).status, 404);
  assert.equal((await decide(pm2, id, 'approve', 'ok')).status, 404);
  assert.equal((await decide(outsider, id, 'approve', 'ok')).status, 404);
  assert.equal((await decide(pm, id, 'approve')).status, 400, 'no comment');
  assert.equal((await decide(pm, id, 'approve', '')).status, 400, 'empty comment');
  assert.equal((await decide(pm, id, 'approve', 'x'.repeat(4001))).status, 400, 'comment too long');
  assert.equal((await decide(pm, id, 'publish', 'ok')).status, 400, 'unknown outcome');
  assert.equal((await pm.post(`/api/requests/${id}/decision`, { outcome: 'approve', comment: 'ok', status: 'approved' })).status, 400, 'unknown field');
  assert.equal((await pm.get(`/api/requests/${id}`)).body.request.status, 'pending', 'nothing was decided');
  assert.equal((await admin.get(`/api/requests/${id}`)).body.canDecide, false);
});

test('requesting changes returns the modules to draft, notifies the Author, and is audited without the comment (M2, M3, M9)', async () => {
  const comment = 'Torque values in the removal procedure are out of date. Please check step 4.';
  const r = await decide(pm, R.first.id, 'changes', comment);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.request.status, 'changes_requested');
  assert.equal(r.body.request.decidedBy.id, pm.user.id);
  assert.equal(r.body.request.decisionComment, comment);
  assert.ok(placed(await statuses()).every((x) => x === 'draft'));
  const a = lastAudit('request.decided');
  const meta = JSON.parse(a.meta);
  assert.equal(meta.outcome, 'changes_requested');
  assert.equal(meta.commentLength, comment.length);
  assert.equal(meta.fingerprint, t.store.getRequest(R.first.id).content_fingerprint);
  assert.equal(a.actor_id, pm.user.id);
  assert.equal(a.target_id, R.first.id);
  assert.ok(!JSON.stringify(a).includes('Torque'), 'the comment text is not in the audit log');
  const n = (await notes(author)).find((x) => x.title === `Changes requested: ${R.first.title}`);
  assert.ok(n);
  assert.equal(n.link, `/projects/${project.id}?tab=publication`);
  assert.equal((await decide(pm, R.first.id, 'approve', 'again')).body.code, 'NOT_PENDING');
  assert.equal((await pm.get('/api/auth/me')).body.queues.approvals, 0);
});

test('the rework loop: edit, resubmit; the earlier comment stays in the history (M5, M9)', async () => {
  const dm = (await modules()).find((m) => m.dmc.endsWith('030A-D'));
  assert.equal((await save(author, dm)).status, 200, 'the lock lifted with the decision');
  const r = await submit(pm, 'Fixed step 4');
  assert.equal(r.status, 201, r.text);
  R.second = r.body.request;
  assert.equal(R.second.previousRequestId, R.first.id);
  const n = (await notes(pm)).find((x) => x.title === `Resubmitted for approval: ${R.second.title}`);
  assert.ok(n && /changes were requested/.test(n.body));
  const d = (await pm.get(`/api/requests/${R.second.id}`)).body;
  assert.deepEqual(d.history.map((h) => h.id), [R.first.id, R.second.id]);
  assert.match(d.history[0].decisionComment, /Torque values/);
  assert.equal(JSON.parse(lastAudit('request.submitted').meta).resubmission, 'changes_requested');
  const ok = await decide(pm, R.second.id, 'approve', 'Approved for release.');
  assert.equal(ok.status, 200, ok.text);
  assert.ok(placed(await statuses()).every((x) => x === 'approved'));
  assert.ok((await notes(author)).some((x) => x.title === `Approved: ${R.second.title}`));
});

test('saving an approved module makes it draft again, recorded in the audit (M3)', async () => {
  const dm = (await modules()).find((m) => m.dmc.endsWith('030A-D'));
  assert.equal(dm.status, 'approved');
  assert.equal((await save(coauthor, dm)).status, 200);
  const s = await statuses();
  assert.equal(s[dm.dmc], 'draft');
  assert.equal(placed(s).filter((x) => x === 'approved').length, placed(s).length - 1, 'the other modules stay approved');
  assert.equal(JSON.parse(lastAudit('dm.saved').meta).status, 'approved->draft');
  // A module status cannot be set by an editing route.
  const g = await author.get(`/api/projects/${project.id}/dms/${dm.id}`);
  assert.equal((await author.raw('PUT', `/api/projects/${project.id}/dms/${dm.id}`, { xml: g.body.xml, baseRevision: g.body.revision, status: 'approved' })).status, 400);
});

test('rejection by another manager continues the same chain; comment visibility follows M6', async () => {
  const r = await submit(pm2);
  assert.equal(r.status, 201, r.text);
  R.third = r.body.request;
  assert.equal(R.third.previousRequestId, R.second.id, 'an approved request is still part of the history');
  const d = (await pm2.get(`/api/requests/${R.third.id}`)).body;
  assert.equal(d.history.length, 3);
  assert.ok(d.history.every((h) => !h.commentHidden), 'the manager it is addressed to reads the whole history');
  assert.equal((await pm.get(`/api/requests/${R.third.id}`)).status, 404, 'not the manager it was sent to');
  assert.equal((await decide(pm2, R.third.id, 'reject', 'Wrong publication title for this issue.')).status, 200);
  assert.ok(placed(await statuses()).every((x) => x === 'draft'));
  // The owning manager reads their own decisions, not pm2's comment; Authors on the project read them all.
  const forPm = (await pm.get(`/api/projects/${project.id}/requests`)).body.requests;
  const third = forPm.find((x) => x.id === R.third.id);
  assert.equal(third.decisionComment, null);
  assert.equal(third.commentHidden, true);
  assert.match(forPm.find((x) => x.id === R.first.id).decisionComment, /Torque/);
  for (const c of [author, coauthor, admin]) {
    const list = (await c.get(`/api/projects/${project.id}/requests`)).body.requests;
    assert.equal(list.find((x) => x.id === R.third.id).decisionComment, 'Wrong publication title for this issue.');
  }
  assert.equal((await outsider.get(`/api/projects/${project.id}/requests`)).status, 404);
});

test('withdrawing returns the modules to draft and keeps the chain (M3, M5)', async () => {
  const r = await submit(pm);
  R.fourth = r.body.request;
  assert.equal(R.fourth.previousRequestId, R.third.id);
  assert.equal(JSON.parse(lastAudit('request.submitted').meta).resubmission, 'rejected');
  assert.ok(placed(await statuses()).every((x) => x === 'in_review'));
  assert.equal((await author.post(`/api/requests/${R.fourth.id}/withdraw`, {})).status, 200);
  assert.ok(placed(await statuses()).every((x) => x === 'draft'));
});

test('a decision is blocked and the request made stale when the live content changed after submission (M2)', async () => {
  const r = await submit(pm);
  R.fifth = r.body.request;
  assert.ok(placed(await statuses()).every((x) => x === 'in_review'));
  // A change that bypasses the application (and so its lock and listeners), straight on disk.
  const file = path.join(ws, 'csdb', 'DMC-AGS-A-24-00-00-00A-030A-D.xml');
  fs.writeFileSync(file, read(file).replace('</dmodule>', '<!-- changed --></dmodule>'));
  const d = await decide(pm, R.fifth.id, 'approve', 'Looks good');
  assert.equal(d.status, 409);
  assert.equal(d.body.code, 'STALE');
  assert.equal(d.body.request.status, 'stale');
  assert.ok(!d.text.includes(t.dataDir));
  assert.equal(t.store.getRequest(R.fifth.id).status, 'stale');
  assert.equal(t.store.getRequest(R.fifth.id).decided_by, null, 'nothing was decided');
  assert.ok(placed(await statuses()).every((x) => x === 'draft'));
  assert.equal(JSON.parse(lastAudit('request.stale').meta).cause, 'decision.fingerprint');
  assert.ok((await notes(author)).some((x) => x.title === `Request out of date: ${project.name}`));
  assert.equal((await decide(pm, R.fifth.id, 'approve', 'again')).body.code, 'NOT_PENDING');
  assert.equal(t.store.db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.decided' AND target_id = ?").get(R.fifth.id).n, 0);
});

test('every decision is in the audit log, one entry each (M2)', async () => {
  const rows = t.store.db.prepare("SELECT target_id, meta FROM audit_log WHERE action = 'request.decided' ORDER BY id").all();
  assert.deepEqual(rows.map((x) => [x.target_id, JSON.parse(x.meta).outcome]), [
    [R.first.id, 'changes_requested'], [R.second.id, 'approved'], [R.third.id, 'rejected'],
  ]);
  for (const x of rows) assert.ok(!/comment"\s*:/.test(x.meta), 'no comment text');
});

test('an event of an older request does not move a module a newer request governs (M3)', async () => {
  const r = await submit(pm);
  R.sixth = r.body.request;
  assert.equal(r.status, 201, r.text);
  const moved = workflow.applyRequestEvent(t.store, t.dataDir, t.store.getRequest(R.second.id), 'stale');
  assert.deepEqual(moved, []);
  assert.ok(placed(await statuses()).every((x) => x === 'in_review'));
  await author.post(`/api/requests/${R.sixth.id}/withdraw`, {});
});

test('team activity: owned projects only, Author actions with the draft flag and time, never content (M8)', async () => {
  const dm = (await modules()).find((m) => m.dmc.endsWith('020A-D')) || (await modules())[0];
  const secret = 'UNSAVED-SECRET-TEXT-8341';
  assert.equal((await author.raw('PUT', `/api/projects/${project.id}/drafts/dm-${dm.id}`, { content: `<dmodule>${secret}</dmodule>`, baseRevision: 1 })).status, 200);
  await author.post(`/api/projects/${ownProject.id}/dms`, { dmc: { modelIdentCode: 'OWN', systemDiffCode: 'A', systemCode: '00', subSystemCode: '0', subSubSystemCode: '0', assyCode: '00', disassyCode: '00', disassyCodeVariant: 'A', infoCode: '040', infoCodeVariant: 'A', itemLocationCode: 'D' }, techName: 'Private', schemaType: 'descript' });
  const d = (await pm.get('/api/dashboard/manager')).body;
  const ta = d.teamActivity;
  assert.ok(ta.items.length > 0);
  assert.ok(ta.items.every((x) => x.project.id === project.id), 'only the project the manager owns');
  assert.ok(!JSON.stringify(d).includes(secret), 'no draft content');
  assert.ok(!JSON.stringify(d).includes('Private'), 'nothing from the Author-owned project');
  const item = ta.items.find((x) => x.target.id === dm.id && x.author.id === author.user.id);
  assert.ok(item && item.draftSince, JSON.stringify(ta.items.slice(0, 3)));
  assert.ok(ta.items.every((x) => [author.user.id, coauthor.user.id].includes(x.author.id)), 'Authors only');
  assert.deepEqual(ta.authors.map((a) => a.id).sort(), [author.user.id, coauthor.user.id].sort());
  assert.equal(ta.authors.find((a) => a.id === author.user.id).drafts >= 1, true);
  assert.equal(d.totals.pendingRequests, 0);
  // pm2's team activity covers only Avionics, where nothing happened yet.
  assert.deepEqual((await pm2.get('/api/dashboard/manager')).body.teamActivity.items, []);
  // An Author-owned project reaches a manager only through a submitted request.
  assert.equal((await pm.get(`/api/projects/${ownProject.id}`)).status, 404);
  // The project page: each assigned Author's last action and time, no content.
  const p = (await pm.get(`/api/projects/${project.id}`)).body;
  const la = p.authors.find((x) => x.id === author.user.id).lastActivity;
  assert.ok(la && /^(dm|publication|graphic|request)\./.test(la.action) && la.at, JSON.stringify(la));
  assert.deepEqual(Object.keys(la).sort(), ['action', 'at']);
});

test('administrator dashboard: every request by status, with the latest (oversight)', async () => {
  const d = (await admin.get('/api/dashboard/admin')).body.submissions;
  const all = t.store.db.prepare('SELECT status, COUNT(*) AS n FROM publication_requests GROUP BY status').all();
  assert.equal(d.total, all.reduce((n, x) => n + Number(x.n), 0));
  for (const x of all) assert.equal(d.byStatus[x.status], Number(x.n), x.status);
  assert.ok(d.recent.length > 0 && d.recent.length <= 6);
  assert.ok(d.recent.every((x) => x.decisionComment === null || typeof x.decisionComment === 'string'));
  assert.equal((await pm.get('/api/dashboard/admin')).status, 403);
});

test('a manager disables and enables Authors they created; the owners of other projects are told (M7)', async () => {
  assert.equal((await pm2.post(`/api/users/${author.user.id}/disable`)).status, 404, 'not their Author');
  assert.equal((await coauthor.post(`/api/users/${author.user.id}/disable`)).status, 403);
  assert.equal((await pm.post(`/api/users/${pm2.user.id}/disable`)).status, 404, 'not a manager of managers');
  const r = await pm.post(`/api/users/${author.user.id}/disable`);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.user.status, 'disabled');
  assert.equal((await author.get('/api/auth/me')).status, 401, 'signed out at once');
  const n2 = (await notes(pm2)).find((x) => x.title === 'Author disabled: arjun.das');
  assert.ok(n2 && /Avionics manual/.test(n2.body), 'the owner of another project is told');
  assert.ok((await notes(coauthor)).some((x) => x.title === 'Author disabled: arjun.das') === false, 'the Author owns Arjun notes; members of it are not owners');
  assert.ok(!(await notes(pm)).some((x) => x.title === 'Author disabled: arjun.das'), 'not the actor');
  const a = lastAudit('user.disabled');
  assert.equal(a.actor_id, pm.user.id);
  assert.equal((await pm.post(`/api/users/${author.user.id}/enable`)).status, 200);
  assert.equal(lastAudit('user.enabled').actor_id, pm.user.id);
  // The administrator can too.
  assert.equal((await admin.post(`/api/users/${coauthor.user.id}/disable`)).status, 200);
  assert.ok((await notes(pm)).some((x) => x.title === 'Author disabled: meera.iyer'), 'the owning manager hears of the administrator\'s action');
  assert.equal((await admin.post(`/api/users/${coauthor.user.id}/enable`)).status, 200);
});
