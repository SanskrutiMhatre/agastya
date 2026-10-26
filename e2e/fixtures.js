'use strict';
// Shared helpers for the browser scenarios: the run's details, a page signed
// in as a given account, and screenshots in both themes.
const fs = require('node:fs');
const path = require('node:path');
const { test: base, expect } = require('@playwright/test');

const STATE_DIR = path.join(__dirname, '.state');
const SHOTS = path.join(__dirname, 'screenshots');

function run() {
  return JSON.parse(fs.readFileSync(path.join(STATE_DIR, 'run.json'), 'utf8'));
}

// A new browser context signed in as `username`, in the given theme.
async function signedIn(browser, username, { theme = 'light' } = {}) {
  const ctx = await browser.newContext({
    baseURL: run().base,
    storageState: path.join(STATE_DIR, `${username}.json`),
    colorScheme: theme,
    viewport: { width: 1440, height: 900 },
  });
  await ctx.addInitScript((t) => {
    try { localStorage.setItem('agastya-theme', t); } catch { /* blocked */ }
    window.__AGASTYA_E2E__ = true; // lets the scenarios read the XML panel's text
  }, theme);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.errors = errors;
  return { ctx, page };
}

// Screenshot the current page in light, then in dark (switching the stored preference).
async function shots(page, name, { fullPage = true } = {}) {
  for (const theme of ['light', 'dark']) {
    const dir = path.join(SHOTS, theme);
    fs.mkdirSync(dir, { recursive: true });
    await page.evaluate((t) => {
      try { localStorage.setItem('agastya-theme', t); } catch { /* blocked */ }
      document.documentElement.classList.toggle('dark', t === 'dark');
    }, theme);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage });
  }
  await page.evaluate(() => { document.documentElement.classList.remove('dark'); try { localStorage.setItem('agastya-theme', 'light'); } catch { /* blocked */ } });
}

// An account's API session (from its saved browser state, so the browser session stays valid) for set-up steps.
function apiAs(username) {
  const r = run();
  const state = JSON.parse(fs.readFileSync(path.join(STATE_DIR, `${username}.json`), 'utf8'));
  const headers = { cookie: `agastya_session=${state.cookies[0].value}`, origin: r.base, 'content-type': 'application/json' };
  const call = async (method, url, body) => {
    const res = await fetch(r.base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { r, call };
}
const authorApi = () => apiAs('arjun.das');

// Make sure the Author's publication has a pending request; returns it.
async function ensurePending() {
  const { r, call } = authorApi();
  const list = (await call('GET', `/api/projects/${r.projectId}/requests`)).body.requests;
  const open = list.find((x) => x.status === 'pending');
  if (open) return open;
  const res = await call('POST', `/api/projects/${r.projectId}/requests`, { approverId: r.accounts['priya.rao'].id });
  if (res.status !== 201) throw new Error(`submit failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.request;
}

// ---- the data module editor (checkpoint 2c) ----------------------------------

// Show the Monaco XML panel and wait until it is ready.
async function xmlView(page) {
  await page.getByRole('radio', { name: 'XML' }).click();
  await page.getByTestId('xml-panel').locator('.view-lines').waitFor();
  await expect.poll(() => page.evaluate(() => typeof window.__agastyaXml === 'function')).toBe(true);
}
const xmlValue = (page) => page.evaluate(() => (window.__agastyaXml ? window.__agastyaXml() : null));
// Type at the end of the XML, as an author would.
async function appendXml(page, text) {
  await page.getByTestId('xml-panel').locator('.view-lines').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(text);
}
const expectXml = (page, re) => expect.poll(() => xmlValue(page), { timeout: 15000 }).toMatch(re);
// The editor offers no way to change the module: no editable text in the document view, a read-only panel.
async function expectEditorReadOnly(page) {
  await expect(page.locator('[contenteditable="plaintext-only"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(Save|Saved)$/ })).toHaveCount(0);
  await xmlView(page);
  await expect(page.locator('[data-readonly]')).toHaveAttribute('data-readonly', 'true');
}

module.exports = { test: base, expect, run, signedIn, shots, ensurePending, authorApi, apiAs, xmlView, xmlValue, appendXml, expectXml, expectEditorReadOnly };
