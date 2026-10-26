'use strict';
// The two-tabs save conflict, in the editor and in the builder: the second tab
// is told live that a newer version exists, and its stale save is refused
// with the conflict dialog; its text survives as the user's draft.
const { test, expect, run, signedIn, shots, xmlView, appendXml, expectXml } = require('./fixtures');

test('editor: two tabs on one module; the second tab is warned live and its save is refused', async ({ browser }) => {
  const r = run();
  const { ctx, page: tab1 } = await signedIn(browser, 'arjun.das');
  const tab2 = await ctx.newPage();
  for (const p of [tab1, tab2]) {
    await p.goto(`/projects/${r.projectId}?tab=dms`);
    await p.getByRole('link', { name: 'AGS-A-24-00-00-00A-030A-D' }).click();
    await xmlView(p);
  }
  // Tab 2 starts editing; tab 1 saves first.
  await appendXml(tab2, '\n<!-- tab two -->');
  await appendXml(tab1, '\n<!-- tab one -->');
  await tab1.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(tab1.getByText('A new revision was recorded.')).toBeVisible();
  await expect(tab1.getByText(/saved a newer version/)).toHaveCount(0, { timeout: 2000 });

  // Tab 2 learns about it without doing anything.
  await expect(tab2.getByText('You (in another tab or window) saved a newer version')).toBeVisible();
  await shots(tab2, '30-editor-newer-version', { fullPage: false });
  await tab2.getByRole('button', { name: 'Save', exact: true }).click();
  const dialog = tab2.getByRole('dialog', { name: 'Someone else saved this module' });
  await expect(dialog).toBeVisible();
  await shots(tab2, '31-editor-conflict', { fullPage: false });
  await dialog.getByRole('button', { name: 'Load the latest version' }).click();
  await expectXml(tab2, /tab one/);
  // Its own text is offered back from the draft.
  await expect(tab2.getByText('You have an unsaved draft of this module')).toBeVisible();
  await tab2.getByRole('button', { name: 'Discard draft' }).click();
  await ctx.close();
});

test('editor: a co-author\'s save reaches the other author live', async ({ browser }) => {
  const r = run();
  const a = await signedIn(browser, 'arjun.das');
  const m = await signedIn(browser, 'meera.iyer');
  for (const p of [a.page, m.page]) {
    await p.goto(`/projects/${r.projectId}?tab=dms`);
    await p.getByRole('link', { name: 'AGS-A-00-00-00-00A-012A-D' }).click();
    await xmlView(p);
  }
  await appendXml(m.page, '\n<!-- Meera -->');
  await m.page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(a.page.getByText('Meera Iyer saved a newer version')).toBeVisible();
  await a.page.getByRole('button', { name: 'Load the latest version' }).click();
  await expectXml(a.page, /Meera/);
  await a.ctx.close();
  await m.ctx.close();
});

test('builder: two tabs; the stale tab is warned and its save is refused', async ({ browser }) => {
  const r = run();
  const { ctx, page: tab1 } = await signedIn(browser, 'arjun.das');
  const tab2 = await ctx.newPage();
  for (const p of [tab1, tab2]) {
    await p.goto(`/projects/${r.projectId}?tab=publication`);
    await expect(p.getByTestId('pm-counts')).toHaveText(/^8 modules · 3 chapters/);
  }
  await tab1.getByTestId('pm-row-0').click();
  await tab1.getByRole('button', { name: 'Move down' }).click();
  await tab1.getByRole('button', { name: 'Save publication' }).click();
  await expect(tab1.getByText('Publication saved', { exact: true })).toBeVisible();

  await expect(tab2.getByText(/saved the publication/)).toBeVisible();
  await tab2.getByTestId('pm-row-2').click();
  await tab2.getByRole('button', { name: 'Move up' }).click();
  await tab2.getByRole('button', { name: 'Save publication' }).click();
  const dialog = tab2.getByRole('dialog', { name: 'Someone else saved the publication' });
  await expect(dialog).toBeVisible();
  await shots(tab2, '32-builder-conflict', { fullPage: false });
  await dialog.getByRole('button', { name: 'Load the latest version' }).click();
  await expect(tab2.getByTestId('pm-row-1')).toContainText('General');

  // Put the original order back.
  await tab1.reload();
  await tab1.getByTestId('pm-row-1').click();
  await tab1.getByRole('button', { name: 'Move up' }).click();
  await tab1.getByRole('button', { name: 'Save publication' }).click();
  await expect(tab1.getByTestId('pm-row-0')).toContainText('General');
  await ctx.close();
});
