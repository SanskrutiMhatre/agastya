'use strict';
// The content lock (decisions.md L1-L4) and the submission refusal message
// (B6), over real HTTP: while a request is pending, every frozen source of
// the publication is read-only for every Author on the project; the
// administrator is exempt from the lock (their edits are the Phase 4
// override); the lock lifts when the request stops being pending.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, adminClient, makeUser, tmpdir } = require('./helpers');
const { createLocks, LockedError } = require('../server/content/locks');

const GOLDEN = path.join(__dirname, '..', 'samples', 'golden');
const read = (p) => fs.readFileSync(p, 'utf8');

let t, admin, pm, author, coauthor, outsider, project, ws, request;

async function upload(c, url, fields, file) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields || {})) form.append(k, v);
  if (file) form.append('file', new Blob([file.data]), file.name);
  const res = await fetch(t.base + url, { method: 'POST', body: form, headers: { cookie: c.cookie } });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const dms = async (c) => (await c.get(`/api/projects/${project.id}/dms`)).body;
const byCode = async (c, suffix) => (await dms(c)).modules.find((m) => m.dmc.endsWith(suffix));
async function save(c, dm, transform = (x) => x.replace('</dmodule>', '\n</dmodule>')) {
  const g = await c.get(`/api/projects/${project.id}/dms/${dm.id}`);
  return c.raw('PUT', `/api/projects/${project.id}/dms/${dm.id}`, { xml: transform(g.body.xml), baseRevision: g.body.revision });
}

test.before(async () => {
  t = await startServer();
  admin = await adminClient(t);
  pm = await makeUser(t, admin, { username: 'priya.rao', fullName: 'Priya Rao', role: 'project_manager' });
  author = await makeUser(t, pm, { username: 'arjun.das', fullName: 'Arjun Das', role: 'author' });
  coauthor = await makeUser(t, pm, { username: 'meera.iyer', fullName: 'Meera Iyer', role: 'author' });
  outsider = await makeUser(t, pm, { username: 'ravi.k', fullName: 'Ravi K', role: 'author' });
  project = (await author.post('/api/projects', { name: 'Locked manual' })).body.project;
  await author.post(`/api/projects/${project.id}/members`, { userId: coauthor.user.id });
  ws = path.join(t.dataDir, 'projects', project.id);
  for (const f of fs.readdirSync(path.join(GOLDEN, 'csdb')).filter((x) => x.endsWith('.xml'))) {
    await author.post(`/api/projects/${project.id}/dms/import`, { filename: f, content: read(path.join(GOLDEN, 'csdb', f)) });
  }
  const icn = 'ICN-AGS-A-240000-A-0AGS1-00001-A-01-1';
  await upload(author, `/api/projects/${project.id}/graphics`, { icn }, { data: fs.readFileSync(path.join(GOLDEN, 'csdb', `${icn}.png`)), name: 'x.png' });
  for (const m of ['emblem.png', 'publisher-logo.png']) fs.copyFileSync(path.join(GOLDEN, 'Media', m), path.join(ws, 'Media', m));
  const g = await author.get(`/api/projects/${project.id}/publication`);
  await author.raw('PUT', `/api/projects/${project.id}/publication`, { xml: read(path.join(GOLDEN, 'publication.xml')), baseRevision: g.body.revision });
  // A module the publication does not place.
  const r = await author.post(`/api/projects/${project.id}/dms`, { dmc: { modelIdentCode: 'AGS', systemDiffCode: 'A', systemCode: '31', subSystemCode: '0', subSubSystemCode: '0', assyCode: '00', disassyCode: '00', disassyCodeVariant: 'A', infoCode: '040', infoCodeVariant: 'A', itemLocationCode: 'D' }, techName: 'Spare', schemaType: 'descript' });
  assert.equal(r.status, 201, r.text);
});
test.after(() => t.stop());

test('the refusal to submit lists every validation error with its module', async () => {
  const dm = await byCode(author, '030A-D');
  assert.equal((await save(author, dm, (x) => x.replace('<description>', '<description><bogusElement/>'))).status, 200);
  const r = await author.post(`/api/projects/${project.id}/requests`, { approverId: pm.user.id });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'VALIDATION_FAILED');
  assert.match(r.body.error, /DMC-AGS-A-24-00-00-00A-030A-D \(PDU-200 power distribution unit – Technical data\)/);
  assert.ok(r.body.errors.length >= 1);
  const e = r.body.errors.find((x) => x.module && x.module.dmc.endsWith('030A-D'));
  assert.ok(e && e.kind === 'schema' && e.line > 1 && /bogusElement/.test(e.message), JSON.stringify(r.body.errors));
  assert.equal(e.module.id, dm.id);
  assert.equal(e.file, 'DMC-AGS-A-24-00-00-00A-030A-D.xml');
  assert.ok(!JSON.stringify(r.body).includes(t.dataDir), 'no server paths');
  assert.equal((await save(author, dm, (x) => x.replace('<bogusElement/>', ''))).status, 200);
});

test('nothing is locked before submission', async () => {
  const list = await dms(author);
  assert.equal(list.lock, null);
  assert.ok(list.modules.every((m) => m.locked === false));
});

test('submitting locks the publication module, its modules, graphics and settings for every Author on the project', async () => {
  const r = await author.post(`/api/projects/${project.id}/requests`, { approverId: pm.user.id });
  assert.equal(r.status, 201, r.text);
  request = r.body.request;

  const list = await dms(author);
  assert.equal(list.lock.requestId, request.id);
  assert.equal(list.lock.manager, 'Priya Rao');
  const locked = list.modules.filter((m) => m.locked).map((m) => m.dmc).sort();
  assert.equal(locked.length, 9, '8 placed modules and the BREX they name');
  assert.ok(!locked.includes('AGS-A-31-00-00-00A-040A-D'), 'the unplaced module stays free');

  for (const who of [author, coauthor]) {
    const dm = await byCode(who, '520A-D');
    const g = await who.get(`/api/projects/${project.id}/dms/${dm.id}`);
    assert.equal(g.body.lock.requestId, request.id);
    const s = await save(who, dm);
    assert.equal(s.status, 423, s.text);
    assert.equal(s.body.code, 'LOCKED_PENDING_APPROVAL');
    assert.match(s.body.error, /^Locked: pending approval\. .*submitted by Arjun Das to Priya Rao/);
    assert.equal((await who.del(`/api/projects/${project.id}/dms/${dm.id}`)).status, 423, 'no delete');
    const pmDoc = await who.get(`/api/projects/${project.id}/publication`);
    assert.equal(pmDoc.body.lock.requestId, request.id);
    assert.equal((await who.raw('PUT', `/api/projects/${project.id}/publication`, { xml: pmDoc.body.xml, baseRevision: pmDoc.body.revision })).status, 423);
    const model = (await who.get(`/api/projects/${project.id}/publication/model`)).body;
    assert.equal(model.lock.requestId, request.id);
    assert.equal((await who.raw('PUT', `/api/projects/${project.id}/publication/model`, { entries: model.entries, baseRevision: model.revision })).status, 423);
    assert.equal((await who.post(`/api/projects/${project.id}/publication/import`, { xml: pmDoc.body.xml, baseRevision: pmDoc.body.revision })).status, 423);
    const icn = 'ICN-AGS-A-240000-A-0AGS1-00001-A-01-1';
    assert.equal((await upload(who, `/api/projects/${project.id}/graphics`, { icn }, { data: fs.readFileSync(path.join(GOLDEN, 'csdb', `${icn}.png`)), name: 'x.png' })).status, 423, 'a frozen graphic');
    assert.equal((await who.raw('PUT', `/api/projects/${project.id}/settings/wording`, { authority: 'x' })).status, 423, 'frozen build settings');
    // Not frozen: the unplaced module and new modules.
    assert.equal((await save(who, await byCode(who, '31-00-00-00A-040A-D'))).status, 200);
  }
  assert.equal((await upload(author, `/api/projects/${project.id}/graphics`, { icn: 'ICN-AGS-NEW-00001' }, { data: fs.readFileSync(path.join(GOLDEN, 'Media', 'emblem.png')), name: 'x.png' })).status, 201, 'a new graphic is not frozen');
  assert.equal(t.store.getRequest(request.id).status, 'pending', 'unfrozen work does not make the request stale');
});

test('lock and scope: an Author not on the project gets 404, never the lock; managers cannot write anyway', async () => {
  const dm = await byCode(author, '520A-D');
  assert.equal((await outsider.get(`/api/projects/${project.id}/dms/${dm.id}`)).status, 404);
  const s = await outsider.raw('PUT', `/api/projects/${project.id}/dms/${dm.id}`, { xml: '<dmodule/>', baseRevision: 1 });
  assert.equal(s.status, 404);
  assert.ok(!/Locked/.test(s.text), 'the lock is not revealed to someone who cannot see the project');
  assert.equal((await pm.get(`/api/projects/${project.id}/dms`)).status, 404);
});

test('the administrator is exempt from the lock (their edit is the Phase 4 override)', async () => {
  const dm = await byCode(admin, '520A-D');
  const s = await save(admin, dm);
  assert.equal(s.status, 403);
  assert.equal(s.body.code, 'OVERRIDE_REQUIRED', 'refused as an override, not as locked');
  const locks = createLocks({ store: t.store, dataDir: t.dataDir });
  const adminUser = { id: 'x', role: 'software_admin' };
  assert.doesNotThrow(() => locks.assertUnlocked(adminUser, project.id, dm.file && `csdb/${dm.file}`));
  assert.throws(() => locks.assertUnlocked({ id: 'y', role: 'author' }, project.id, `csdb/${dm.file}`), LockedError);
});

test('withdrawing lifts the lock at once', async () => {
  assert.equal((await author.post(`/api/requests/${request.id}/withdraw`)).status, 200);
  const list = await dms(coauthor);
  assert.equal(list.lock, null);
  assert.ok(list.modules.every((m) => !m.locked));
  assert.equal((await save(coauthor, await byCode(coauthor, '520A-D'))).status, 200);
});

test('a request that goes stale (sources changed outside Agastya) lifts the lock', async () => {
  const r = await author.post(`/api/projects/${project.id}/requests`, { approverId: pm.user.id });
  assert.equal(r.status, 201, r.text);
  const placed = await byCode(author, '720A-D');
  assert.equal((await save(author, placed)).status, 423);
  // A file of the publication is changed on disk; the next content event finds the fingerprint changed.
  const file = path.join(ws, 'csdb', placed.file);
  fs.writeFileSync(file, read(file).replace('</dmodule>', '<!-- edited outside -->\n</dmodule>'));
  assert.equal((await save(author, await byCode(author, '31-00-00-00A-040A-D'))).status, 200);
  assert.equal(t.store.getRequest(r.body.request.id).status, 'stale');
  assert.equal((await dms(author)).lock, null);
  assert.equal((await save(author, placed)).status, 200, 'unlocked');
});

test('a data module placed in two publications is locked by a pending request on either', () => {
  // The application has one publication per project; the lock is the union of every pending request's sources.
  const dir = tmpdir('agastya-locks-');
  const manifest = (id, files) => {
    fs.mkdirSync(path.join(dir, 'snapshots', id), { recursive: true });
    fs.writeFileSync(path.join(dir, 'snapshots', id, 'manifest.json'), JSON.stringify({ files: files.map((rel) => ({ rel })) }));
  };
  const a = '11111111-1111-1111-1111-111111111111', b = '22222222-2222-2222-2222-222222222222';
  manifest(a, ['publication.xml', 'csdb/DMC-A.xml', 'csdb/DMC-SHARED.xml']);
  manifest(b, ['publication.xml', 'csdb/DMC-B.xml', 'csdb/DMC-SHARED.xml']);
  let pending = [a, b];
  const row = (id) => ({ id, snapshot_dir: `snapshots/${id}`, submitted_by_name: 'Arjun Das', manager_name: 'Priya Rao', submitted_at: '2026-10-25T00:00:00Z', publication_title: id === a ? 'One' : 'Two' });
  const store = { listPendingRequestsForProject: () => pending.map(row), getRequest: (id) => row(id) };
  const locks = createLocks({ store, dataDir: dir });
  const author2 = { id: 'u', role: 'author' };
  assert.throws(() => locks.assertUnlocked(author2, 'p', 'csdb/DMC-SHARED.xml'), LockedError);
  pending = [b];
  assert.throws(() => locks.assertUnlocked(author2, 'p', 'csdb/DMC-SHARED.xml'), LockedError, 'still locked by the other');
  assert.doesNotThrow(() => locks.assertUnlocked(author2, 'p', 'csdb/DMC-A.xml'));
  pending = [];
  assert.doesNotThrow(() => locks.assertUnlocked(author2, 'p', 'csdb/DMC-SHARED.xml'));
});
