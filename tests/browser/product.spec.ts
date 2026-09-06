import { test, expect, type Browser, type BrowserContext, type Page, type APIResponse, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sample from '../../portfolio-handoff/staging/fictional-fencing-request.json' with { type: 'json' };
import type { DraftInput, OwnerRequest, ReviewRecord } from '../../shared/domain';

const origin = 'http://localhost:4174';
const headers = { Origin: origin, 'X-CPL-Request': '1', 'Content-Type': 'application/json' };
const assets = path.resolve('portfolio-handoff/assets');
const qa = path.resolve('.local/qa');
const privateNote = 'OWNER-ONLY synthetic note: exclude this from customer views and exports.';
const draft = (overrides: Partial<DraftInput> = {}): DraftInput => ({ ...sample, schedule: { kind: 'impact', details: sample.schedule.details }, privateNotes: privateNote, ...overrides });

async function json<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), `API operation returned HTTP ${response.status()}`).toBeTruthy();
  return response.json() as Promise<T>;
}

async function api(context: BrowserContext, endpoint: string, method = 'GET', data?: unknown) {
  return context.request.fetch(`${origin}${endpoint}`, { method, headers, ...(data === undefined ? {} : { data }) });
}

async function cleanup(context: BrowserContext) {
  try { await api(context, '/api/workspace', 'DELETE', { confirmation: 'DELETE' }); } finally { await context.close(); }
}

async function newOwner(browser: Browser, input = draft()) {
  const owner = await browser.newContext({ baseURL: origin, permissions: ['clipboard-read', 'clipboard-write'] });
  const created = await json<{ managementLink: string }>(await api(owner, '/api/workspaces', 'POST', {}));
  const saved = await json<{ request: OwnerRequest }>(await api(owner, '/api/requests', 'POST', { draft: input, idempotencyKey: randomUUID() }));
  return { owner, managementLink: created.managementLink, request: saved.request };
}

async function publish(owner: BrowserContext, request: OwnerRequest) {
  return json<{ request: OwnerRequest; customerLink: string }>(await api(owner, `/api/requests/${request.id}/publish`, 'POST', { revision: request.revision, expiryDays: 7, idempotencyKey: randomUUID() }));
}

async function customerPage(browser: Browser, link: string, mobile = false) {
  const customer = await browser.newContext({ baseURL: origin, viewport: mobile ? { width: 390, height: 844 } : { width: 1100, height: 850 }, reducedMotion: 'reduce' });
  const page = await customer.newPage();
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto(link);
  await expect(page.getByRole('article', { name: 'Published extra work request' })).toBeVisible();
  expect(new URL(page.url()).hash === '', 'Entry fragment removed before rendering').toBeTruthy();
  expect(requests.every(url => !url.includes('#')), 'No fragment capability in HTTP requests').toBeTruthy();
  expect(requests.every(url => new URL(url).origin === origin), 'Private review makes no external requests').toBeTruthy();
  return { customer, page };
}

async function chooseResponse(page: Page, action: 'approved' | 'declined' | 'changes_requested') {
  const labels = { approved: 'Approve extra work', declined: 'Decline', changes_requested: 'Request changes' };
  await page.getByRole('button', { name: labels[action], exact: true }).click();
  await expect(page.getByLabel('Your name', { exact: false })).toBeFocused();
  await page.getByLabel('Your name', { exact: false }).fill('Morgan Example (fictional)');
  if (action === 'approved') {
    const acknowledgment = page.getByRole('checkbox');
    await expect(acknowledgment).not.toBeChecked();
    await page.getByRole('button', { name: 'Review my response' }).click();
    await expect(page.getByRole('alert')).toContainText('Acknowledge');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await acknowledgment.check();
  } else if (action === 'changes_requested') {
    await page.getByLabel('What would you like changed?', { exact: false }).fill('Please use a latch that can be opened from both sides.');
  } else {
    await page.getByLabel('Reason for declining', { exact: false }).fill('We will leave the gate out for now.');
  }
  await page.getByRole('button', { name: 'Review my response' }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirm your response' });
  await expect(dialog).toContainText('$350.00 USD');
  await expect(dialog).toContainText('One additional working day');
  await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  return dialog;
}

async function capture(target: Page | Locator, filename: string) {
  await mkdir(assets, { recursive: true });
  const targetPage = 'url' in target ? target as Page : (target as Locator).page();
  await targetPage.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  if ('getByRole' in target && 'url' in target) {
    const page = target as Page;
    const originalViewport = page.viewportSize();
    try {
      if (originalViewport) {
        const documentHeight = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
        await page.setViewportSize({ width: originalViewport.width, height: Math.min(7000, Math.max(originalViewport.height, documentHeight)) });
      }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      expect(new URL(page.url()).hash === '').toBeTruthy();
      await expect(page.locator('textarea.secret-link')).toHaveCount(0);
      await page.screenshot({ path: path.join(assets, filename), fullPage: true, animations: 'disabled' });
    } finally { if (originalViewport) await page.setViewportSize(originalViewport); }
  } else await (target as Locator).screenshot({ path: path.join(assets, filename), animations: 'disabled' });
}

async function downloadedJson(page: Page) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export record', exact: true }).click();
  const downloaded = await download;
  const filename = await downloaded.path();
  expect(filename !== null).toBeTruthy();
  return JSON.parse(await readFile(filename!, 'utf8')) as { timezone: string; request?: OwnerRequest; review?: ReviewRecord };
}

test('blank first visit creates no workspace; real UI saves, publishes, copies, records and exports across independent contexts', async ({ browser }) => {
  test.setTimeout(90000);
  const owner = await browser.newContext({ baseURL: origin, permissions: ['clipboard-read', 'clipboard-write'] });
  const customerContexts: BrowserContext[] = [];
  try {
    const page = await owner.newPage();
    let workspaceCreates = 0;
    page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/workspaces') workspaceCreates++; });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Agree on the extra work');
    await expect(page.getByLabel('Business name', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Customer name', { exact: true })).toHaveValue('');
    expect(workspaceCreates).toBe(0);
    expect((await api(owner, '/api/session')).status()).toBe(401);
    await page.reload();
    await expect(page.getByLabel('Business name', { exact: true })).toHaveValue('');
    expect(workspaceCreates).toBe(0);

    for (const [label, value] of [
      ['Business name', sample.businessName], ['Business contact', sample.businessContact], ['Customer name', sample.customerName],
      ['Job title', sample.jobTitle], ['Job reference', sample.jobReference], ['Service address or job location', sample.serviceAddress],
      ['Additional scope', sample.scope], ['Reason for the change', sample.reason], ['Included work', sample.includedWork], ['Exclusions', sample.exclusions],
    ]) await page.getByLabel(label!, { exact: label === 'Business name' || label === 'Customer name' || label === 'Job title' || label === 'Additional scope' || label === 'Reason for the change' || label === 'Service address or job location' }).fill(value!);
    await page.getByLabel('Line 1 description', { exact: true }).fill(sample.lineItems[0]!.description);
    await page.getByLabel('Line 1 unit price', { exact: true }).fill('350.00');
    await page.getByRole('radio', { name: /Specify a timing impact/ }).check();
    await page.getByLabel('Declared timing impact', { exact: true }).fill(sample.schedule.details);
    await page.getByText('Private owner notes', { exact: false }).click();
    await page.getByLabel('Private notes', { exact: false }).fill(privateNote);
    await page.locator('details.private-notes summary').click();
    await capture(page, 'extra-work-approval-composer.png');

    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    const privateDialog = page.getByRole('dialog', { name: 'Keep your private workspace key.' });
    await expect(privateDialog).toBeVisible();
    const managementLink = await privateDialog.getByLabel('Private management / recovery link').inputValue();
    expect(new URL(managementLink).hash.length === 44, 'Management token has 32-byte base64url form').toBeTruthy();
    await privateDialog.getByRole('button', { name: 'Copy PRIVATE recovery link' }).click();
    await expect(privateDialog.getByRole('button', { name: 'Copied to clipboard' })).toBeVisible();
    expect(await page.evaluate(expected => navigator.clipboard.readText().then(actual => actual === expected), managementLink)).toBeTruthy();
    await privateDialog.getByRole('button', { name: 'I’ve kept my private link' }).click();
    await expect(page.getByText('Draft saved on server', { exact: false })).toBeVisible();
    expect(workspaceCreates).toBe(1);

    await page.setViewportSize({ width: 1280, height: 1600 });
    await page.getByRole('button', { name: 'Preview customer view', exact: false }).click();
    const preview = page.getByRole('dialog', { name: 'Review the customer view' });
    await expect(preview.getByRole('article', { name: 'Read-only customer preview' })).toBeVisible();
    await expect(preview).not.toContainText(privateNote);
    await expect(preview.getByRole('button', { name: 'Approve extra work', exact: true })).toHaveCount(0);
    await capture(preview, 'extra-work-approval-preview.png');
    await preview.getByRole('button', { name: 'Save & prepare publication' }).click();
    await expect(preview).toContainText('Hosted record available until');
    await preview.getByRole('button', { name: 'Publish request', exact: true }).click();
    const share = page.getByRole('dialog', { name: 'Ready for your customer.' });
    const customerLink = await share.getByLabel('Customer review link', { exact: false }).inputValue();
    expect(new URL(customerLink).hash.length === 44).toBeTruthy();
    await share.getByRole('button', { name: 'Copy customer link', exact: true }).click();
    await expect(share.getByRole('button', { name: 'Copied to clipboard' })).toBeVisible();
    expect(await page.evaluate(expected => navigator.clipboard.readText().then(actual => actual === expected), customerLink)).toBeTruthy();
    await capture(share.getByRole('button', { name: 'Copied to clipboard' }), 'extra-work-approval-copy-confirmation.png');
    await share.getByRole('button', { name: 'Back to the record' }).click();
    await page.setViewportSize({ width: 1280, height: 720 });
    const versionId = new URL(customerLink).pathname.split('/').pop()!;

    const stranger = await browser.newContext({ baseURL: origin }); customerContexts.push(stranger);
    const strangerPage = await stranger.newPage();
    await strangerPage.goto(`/review/${versionId}`);
    await expect(strangerPage.getByRole('heading', { name: 'This request isn’t available.' })).toBeVisible();
    await expect(strangerPage.getByText(sample.scope, { exact: true })).toHaveCount(0);
    expect((await api(stranger, `/api/review/${versionId}`)).status()).toBe(401);

    const { customer, page: reviewPage } = await customerPage(browser, customerLink, true); customerContexts.push(customer);
    await expect(reviewPage.locator('body')).not.toContainText(privateNote);
    await expect(reviewPage.getByRole('button', { name: 'Decline', exact: true })).toBeVisible();
    await expect(reviewPage.getByRole('button', { name: 'Request changes', exact: true })).toBeVisible();
    await capture(reviewPage, 'extra-work-approval-customer-phone.png');
    const confirm = await chooseResponse(reviewPage, 'approved');
    await capture(confirm, 'extra-work-approval-confirm.png');
    await confirm.getByRole('button', { name: 'Confirm approval' }).click();
    await expect(reviewPage.getByRole('region', { name: 'Recorded response' })).toContainText('Approved');
    await expect(reviewPage.getByRole('dialog')).toHaveCount(0);
    await capture(reviewPage, 'extra-work-approval-receipt.png');
    const customerExport = await downloadedJson(reviewPage);
    expect(customerExport.review?.decision?.action).toBe('approved');
    expect(customerExport.review?.snapshot.totalCents).toBe(35000);
    expect(customerExport.timezone).toBe('UTC');
    expect(JSON.stringify(customerExport).includes(privateNote)).toBeFalsy();
    expect(JSON.stringify(customerExport).includes('privateNotes')).toBeFalsy();
    expect(JSON.stringify(customerExport).includes(new URL(managementLink).hash.slice(1))).toBeFalsy();

    await page.getByRole('button', { name: 'Refresh response', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Recorded response' })).toContainText('Approved');
    const ownerExport = await downloadedJson(page);
    expect(ownerExport.request?.draft.privateNotes).toBe(privateNote);
    expect(ownerExport.request?.versions[0]?.decision?.decidedAt).toBe(customerExport.review?.decision?.decidedAt);
    expect(ownerExport.request?.versions[0]?.contentHash).toBe(customerExport.review?.contentHash);
    expect((await api(stranger, `/api/requests/${ownerExport.request!.id}`)).status()).toBe(401);
    expect((await api(customer, `/api/requests/${ownerExport.request!.id}/export`)).status()).toBe(401);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'The job ledger.' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: sample.jobTitle })).toContainText('Approved');
    await capture(page, 'extra-work-approval-ledger.png');
    const recovery = await browser.newContext({ baseURL: origin }); customerContexts.push(recovery);
    const recoveredPage = await recovery.newPage();
    await recoveredPage.goto(managementLink);
    await expect(recoveredPage.getByRole('heading', { name: 'The job ledger.' })).toBeVisible();
    await expect(recoveredPage.getByRole('row').filter({ hasText: sample.jobTitle })).toContainText('Approved');
    expect(new URL(recoveredPage.url()).hash === '').toBeTruthy();
    expect(await recoveredPage.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);

    await mkdir(qa, { recursive: true });
    await reviewPage.emulateMedia({ media: 'print' });
    await expect(reviewPage.getByRole('button', { name: 'Print / Save as PDF' })).toBeHidden();
    await expect(reviewPage.getByRole('article')).toBeVisible();
    await reviewPage.pdf({ path: path.join(qa, 'fictional-approved-record.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
    await reviewPage.emulateMedia({ media: 'screen' });
    await reviewPage.reload();
    await expect(reviewPage.getByRole('region', { name: 'Recorded response' })).toContainText('Approved');
  } finally {
    for (const context of customerContexts) await context.close();
    await cleanup(owner);
  }
});

for (const action of ['declined', 'changes_requested'] as const) {
  test(`independent customer ${action} is durable and never becomes approval`, async ({ browser }) => {
    const { owner, request } = await newOwner(browser);
    let customer: BrowserContext | undefined;
    try {
      const published = await publish(owner, request);
      const opened = await customerPage(browser, published.customerLink); customer = opened.customer;
      const confirm = await chooseResponse(opened.page, action);
      await confirm.getByRole('button', { name: action === 'declined' ? 'Confirm decline' : 'Confirm change request' }).click();
      const label = action === 'declined' ? 'Declined' : 'Changes requested';
      await expect(opened.page.getByRole('region', { name: 'Recorded response' })).toContainText(label);
      await capture(opened.page, `extra-work-approval-${action === 'declined' ? 'declined' : 'changes'}.png`);
      const record = await json<{ request: OwnerRequest }>(await api(owner, `/api/requests/${request.id}`));
      expect(record.request.status).toBe(action);
      expect(record.request.versions[0]?.decision?.action).toBe(action);
      await opened.page.reload();
      await expect(opened.page.getByRole('region', { name: 'Recorded response' })).toContainText(label);
      await expect(opened.page.getByRole('button', { name: 'Approve extra work', exact: true })).toHaveCount(0);
    } finally { if (customer) await customer.close(); await cleanup(owner); }
  });
}

test('uncertain committed response shows no success before receipt and recovers with the same idempotent retry', async ({ browser }) => {
  const { owner, request } = await newOwner(browser);
  let customer: BrowserContext | undefined;
  try {
    const published = await publish(owner, request);
    const opened = await customerPage(browser, published.customerLink); customer = opened.customer;
    const page = opened.page;
    const confirm = await chooseResponse(page, 'approved');
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    let committed: () => void = () => {};
    const reachedServer = new Promise<void>(resolve => { committed = resolve; });
    let first = true;
    // Explicit network-fault injection only: the first POST commits to real local D1,
    // then its browser response is lost. Happy-path tests never intercept API responses.
    await page.route('**/api/review/*/decision', async route => {
      if (!first) { await route.continue(); return; }
      first = false;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      committed();
      await gate;
      await route.abort('connectionreset');
    });
    await confirm.getByRole('button', { name: 'Confirm approval' }).click();
    await reachedServer;
    await expect(page.getByRole('region', { name: 'Recorded response' })).toHaveCount(0);
    await expect(confirm.getByRole('button', { name: 'Recording response…' })).toBeDisabled();
    release();
    await expect(confirm.getByRole('alert')).toContainText('Your entries are preserved');
    await expect(confirm).toContainText('Morgan Example (fictional)');
    await expect(page.getByRole('region', { name: 'Recorded response' })).toHaveCount(0);
    const committedRecord = await json<{ request: OwnerRequest }>(await api(owner, `/api/requests/${request.id}`));
    const firstTime = committedRecord.request.versions[0]?.decision?.decidedAt;
    expect(committedRecord.request.status).toBe('approved');
    await confirm.getByRole('button', { name: 'Confirm approval' }).click();
    await expect(page.getByRole('region', { name: 'Recorded response' })).toContainText('Approved');
    const exported = await downloadedJson(page);
    expect(exported.review?.decision?.decidedAt).toBe(firstTime);
    expect(exported.review?.versionNumber).toBe(1);
  } finally { if (customer) await customer.close(); await cleanup(owner); }
});

test('a revised request keeps immutable version history and denies an old customer decision', async ({ browser }) => {
  const { owner, request } = await newOwner(browser);
  let customer: BrowserContext | undefined;
  try {
    const first = await publish(owner, request);
    const opened = await customerPage(browser, first.customerLink); customer = opened.customer;
    const confirm = await chooseResponse(opened.page, 'approved');
    const changed = await json<{ request: OwnerRequest }>(await api(owner, `/api/requests/${request.id}`, 'PUT', { revision: first.request.revision, draft: draft({ scope: `${sample.scope} Revised latch position for this new version.` }) }));
    const second = await publish(owner, changed.request);
    expect(second.request.versions).toHaveLength(2);
    expect(second.request.versions[0]?.snapshot.scope).toBe(sample.scope);
    expect(second.request.versions[0]?.status).toBe('superseded');
    await confirm.getByRole('button', { name: 'Confirm approval' }).click();
    await expect(confirm.getByRole('alert')).toBeVisible();
    await expect(opened.page.getByRole('region', { name: 'Recorded response' })).toHaveCount(0);
    const latest = await json<{ request: OwnerRequest }>(await api(owner, `/api/requests/${request.id}`));
    expect(latest.request.status).toBe('awaiting');
    expect(latest.request.versions.every(version => version.decision === null)).toBeTruthy();
  } finally { if (customer) await customer.close(); await cleanup(owner); }
});

test('review scopes do not replace owner access and recovery rotation revokes the old management entry', async ({ browser }) => {
  const { owner, request, managementLink } = await newOwner(browser);
  const others: BrowserContext[] = [];
  try {
    const published = await publish(owner, request);
    const ownerPage = await owner.newPage();
    await ownerPage.goto(published.customerLink);
    await expect(ownerPage.getByRole('article')).toBeVisible();
    expect((await api(owner, '/api/session')).status()).toBe(200);
    const unrelated = await newOwner(browser, draft({ jobTitle: 'Separate fictional workspace' })); others.push(unrelated.owner);
    expect((await api(unrelated.owner, `/api/requests/${request.id}`)).status()).toBe(404);
    expect((await api(unrelated.owner, `/api/requests/${request.id}/export`)).status()).toBe(404);
    const rotated = await json<{ managementLink: string }>(await api(owner, '/api/recovery/rotate', 'POST', {}));
    const oldEntry = await browser.newContext({ baseURL: origin }); others.push(oldEntry);
    const oldPage = await oldEntry.newPage();
    await oldPage.goto(managementLink);
    await expect(oldPage.getByRole('heading', { name: 'Workspace access unavailable.' })).toBeVisible();
    const newEntry = await browser.newContext({ baseURL: origin }); others.push(newEntry);
    const newPage = await newEntry.newPage();
    await newPage.goto(rotated.managementLink);
    await expect(newPage.getByRole('heading', { name: 'The job ledger.' })).toBeVisible();
    await json(await api(owner, '/api/sessions/revoke', 'POST', {}));
    expect((await api(owner, '/api/session')).status()).toBe(401);
    expect((await api(newEntry, '/api/session')).status()).toBe(401);
    await json(await api(owner, '/api/recover', 'POST', { token: new URL(rotated.managementLink).hash.slice(1) }));
  } finally { for (const context of others) await cleanup(context); await cleanup(owner); }
});

test('mobile documents, keyboard decision controls, reduced motion, and WCAG scan remain usable with long malicious text', async ({ browser }) => {
  const malicious = '<img src=x onerror="window.__ewaXss=1"> <script>window.__ewaXss=1</script>';
  const { owner, request } = await newOwner(browser, draft({ scope: `${sample.scope}\n${malicious}\n${'Long synthetic description for a readable job record. '.repeat(45)}`, terms: 'Owner-supplied plain terms only.\n' + 'UnbrokenText'.repeat(30) }));
  let customer: BrowserContext | undefined;
  try {
    const published = await publish(owner, request);
    const opened = await customerPage(browser, published.customerLink, true); customer = opened.customer;
    const page = opened.page;
    await expect(page.getByText(malicious, { exact: false })).toBeVisible();
    expect(await page.evaluate(() => Object.hasOwn(window, '__ewaXss'))).toBeFalsy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.getByRole('button', { name: 'Approve extra work', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Request changes', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Decline', exact: true })).toBeFocused();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBeTruthy();
    const styles = await page.locator('.decision-option').first().evaluate(element => ({ animation: getComputedStyle(element).animationDuration, transition: getComputedStyle(element).transitionDuration }));
    expect(styles.animation.split(',').every(value => parseFloat(value) <= 0.01)).toBeTruthy();
    expect(styles.transition.split(',').every(value => parseFloat(value) <= 0.01)).toBeTruthy();
    await page.emulateMedia({ media: 'print' });
    await mkdir(qa, { recursive: true });
    await page.pdf({ path: path.join(qa, 'fictional-long-scope-record.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally { if (customer) await customer.close(); await cleanup(owner); }
});

test('zero-cost publication requires explicit confirmation and user-entered tax survives UI editing', async ({ browser }) => {
  const { owner, request } = await newOwner(browser, draft({ lineItems: [{ description: 'Zero-cost scope clarification', quantity: 1, unitPriceCents: 0 }] }));
  try {
    const page = await owner.newPage();
    await page.goto('/');
    await page.getByRole('button', { name: sample.jobTitle, exact: true }).click();
    await expect(page.getByRole('checkbox', { name: /zero-cost/ })).not.toBeChecked();
    await page.getByRole('button', { name: 'Preview customer view' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Save & prepare publication' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Explicitly confirm');
    await page.getByRole('dialog').getByRole('button', { name: 'Back to editing' }).click();
    await page.getByRole('checkbox', { name: /zero-cost/ }).check();
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByText('Draft saved on server')).toBeVisible();
    const saved = await json<{ request: OwnerRequest }>(await api(owner, `/api/requests/${request.id}`));
    expect(saved.request.draft.zeroCostConfirmed).toBeTruthy();
    await page.getByLabel('Entered tax', { exact: true }).fill('2.75');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByText('Draft saved on server')).toBeVisible();
    const taxed = await json<{ request: OwnerRequest }>(await api(owner, `/api/requests/${request.id}`));
    expect(taxed.request.draft.taxCents).toBe(275);
    expect(taxed.request.totalCents).toBe(275);
  } finally { await cleanup(owner); }
});
