'use strict';
// The content lock through the real UI: while the publication is pending
// approval, its modules and publication module show "Locked: pending
// approval" and are read-only for the Author and the co-author; a module the
// publication does not place stays editable; the administrator sees the
// state but is refused by the server as an override, not as locked; an Author
// not on the project sees nothing; withdrawing lifts the lock.
const { test, expect, run, signedIn, shots, ensurePending, authorApi, xmlView, appendXml, expectEditorReadOnly } = require('./fixtures');

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { await ensurePending(); });

test('Author: module list, editor, builder and XML view are locked', async ({ browser }) => {
  const r = run();
  const { ctx, page } = await signedIn(browser, 'arjun.das');
  await page.goto(`/projects/${r.projectId}?tab=dms`);
  await expect(page.getByTestId('lock-banner')).toContainText('Locked: pending approval');
  const row520 = page.getByRole('row', { name: /AGS-A-24-10-00-00A-520A-D/ });
  await expect(row520.getByText('Locked')).toBeVisible();
  await expect(row520.getByRole('button', { name: /Delete/ })).toHaveCount(0);
  const spare = page.getByRole('row', { name: /AGS-A-31-00-00-00A-040A-D/ });
  await expect(spare.getByText('Locked')).toHaveCount(0);
  await shots(page, '50-module-list-locked');

  await row520.getByRole('link', { name: 'AGS-A-24-10-00-00A-520A-D' }).click();
  await expect(page.getByTestId('lock-banner')).toContainText('This data module is part of the publication Arjun Das submitted to Priya Rao');
  await shots(page, '51-editor-locked', { fullPage: false });
  await expectEditorReadOnly(page);

  await page.goto(`/projects/${r.projectId}?tab=publication`);
  await expect(page.getByTestId('lock-banner').first()).toContainText('The publication module');
  await expect(page.getByRole('button', { name: 'Add chapter' })).toHaveCount(0);
  await expect(page.getByTestId('current-request')).toContainText('locked until the request is withdrawn or decided');
  await shots(page, '52-builder-locked');
  await page.getByRole('tab', { name: 'XML' }).click();
  await expect(page.getByLabel('Publication module XML')).toHaveAttribute('readonly', '');
  await expect(page.getByRole('button', { name: /Save publication module|Saved/ })).toHaveCount(0);

  // A module the publication does not place can still be edited and saved.
  await page.goto(`/projects/${r.projectId}?tab=dms`);
  await page.getByRole('link', { name: 'AGS-A-31-00-00-00A-040A-D' }).click();
  await expect(page.getByTestId('lock-banner')).toHaveCount(0);
  await xmlView(page);
  await appendXml(page, '\n<!-- not locked -->');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('A new revision was recorded.')).toBeVisible();
  expect(page.errors).toEqual([]);
  await ctx.close();
});

test('co-author: the same modules are locked for them', async ({ browser }) => {
  const r = run();
  const { ctx, page } = await signedIn(browser, 'meera.iyer');
  await page.goto(`/projects/${r.projectId}?tab=dms`);
  await page.getByRole('link', { name: 'AGS-A-24-00-00-00A-040A-D' }).click();
  await expect(page.getByTestId('lock-banner')).toContainText('Locked: pending approval');
  await expectEditorReadOnly(page);
  await page.goto(`/projects/${r.projectId}?tab=publication`);
  await expect(page.getByRole('button', { name: 'Add chapter' })).toHaveCount(0);
  await expect(page.getByLabel('Authority line')).toHaveAttribute('readonly', '');
  await ctx.close();
});

test('administrator: sees the locked state; the server refuses their write as an override, not as locked', async ({ browser }) => {
  const r = run();
  const { ctx, page } = await signedIn(browser, 'admin');
  await page.goto(`/projects/${r.projectId}?tab=dms`);
  await expect(page.getByTestId('lock-banner')).toBeVisible();
  const res = await page.evaluate(async ({ projectId }) => {
    const list = await (await fetch(`/api/projects/${projectId}/dms`)).json();
    const m = list.modules.find((x) => x.dmc.endsWith('520A-D'));
    const g = await (await fetch(`/api/projects/${projectId}/dms/${m.id}`)).json();
    const put = await fetch(`/api/projects/${projectId}/dms/${m.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ xml: g.xml, baseRevision: g.revision }) });
    return { status: put.status, body: await put.json() };
  }, { projectId: r.projectId });
  expect(res.status).toBe(403);
  expect(res.body.code).toBe('OVERRIDE_REQUIRED');
  await ctx.close();
});

test('an Author not on the project sees neither the project nor the lock', async ({ browser }) => {
  const r = run();
  const { ctx, page } = await signedIn(browser, 'ravi.k');
  await page.goto(`/projects/${r.projectId}?tab=dms`);
  await expect(page.getByText('Project not found')).toBeVisible();
  await expect(page.getByTestId('lock-banner')).toHaveCount(0);
  await ctx.close();
});

test('withdrawing lifts the lock in the open editor after a reload', async ({ browser }) => {
  const r = run();
  const pending = await ensurePending();
  const { ctx, page } = await signedIn(browser, 'arjun.das');
  await page.goto(`/projects/${r.projectId}?tab=publication`);
  await page.getByRole('button', { name: 'Withdraw' }).click();
  await page.getByRole('dialog', { name: 'Withdraw the request?' }).getByRole('button', { name: 'Withdraw' }).click();
  await expect(page.getByTestId('current-request')).toContainText('Withdrawn');
  await page.reload();
  await expect(page.getByTestId('lock-banner')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add chapter' })).toBeVisible();
  const { call } = authorApi();
  expect((await call('GET', `/api/requests/${pending.id}`)).body.request.status).toBe('withdrawn');
  await ctx.close();
});
