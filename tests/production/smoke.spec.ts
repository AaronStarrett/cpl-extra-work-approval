import { test, expect, type Page, type Locator, type BrowserContext } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sample from '../../portfolio-handoff/staging/fictional-fencing-request.json' with { type: 'json' };
import type { OwnerRequest, ReviewRecord } from '../../shared/domain';

type CheckState = 'PASS' | 'NOT RUN';
interface SafeEvidence {
  startedAt: string;
  finishedAt: string | null;
  applicationOrigin: string;
  result: 'RUNNING' | 'PASS' | 'FAILED' | 'BLOCKED';
  stage: string;
  reasonCode: string | null;
  independentContexts: number;
  protection: 'Real deployed Turnstile; no response mocks, bypass, or sitekey override';
  checks: Record<string, CheckState>;
  recordedResponse: { action: string; versionNumber: number; totalCents: number; contentHash: string; decidedAtUtc: string } | null;
  cleanup: 'PENDING' | 'NO WORKSPACE CREATED' | 'DELETED AND VERIFIED' | 'FAILED';
  cleanupWorkspaceId: string | null;
}

class SmokeBlocked extends Error {
  constructor(readonly reasonCode: string) { super(reasonCode); }
}

async function realChallengeReady(container: Page | Locator, stage: 'create' | 'publish') {
  // Observe only the real widget's completion field. Do not invoke callbacks,
  // replace sitekeys, solve an interactive challenge, or mint/inject any token.
  const responseField = container.locator('input[name="cf-turnstile-response"]');
  try {
    await expect.poll(async () => {
      if (await responseField.count() !== 1) return false;
      return (await responseField.inputValue()).length > 0;
    }, { timeout: 45000, intervals: [500, 1000, 2000] }).toBeTruthy();
  } catch { throw new SmokeBlocked(`TURNSTILE_${stage.toUpperCase()}_REQUIRES_INTERACTIVE_VERIFICATION_OR_IS_UNAVAILABLE`); }
}

async function exportThroughUi(page: Page): Promise<{ timezone: string; request?: OwnerRequest; review?: ReviewRecord }> {
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export record', exact: true }).click();
  const download = await waiting;
  const filename = await download.path();
  if (!filename) throw new Error('EXPORT_FILE_UNAVAILABLE');
  return JSON.parse(await readFile(filename, 'utf8')) as { timezone: string; request?: OwnerRequest; review?: ReviewRecord };
}

async function cleanupSyntheticWorkspace(owner: BrowserContext | undefined, origin: string, headers: Record<string, string>): Promise<{ status: SafeEvidence['cleanup']; workspaceId: string | null }> {
  if (!owner) return { status: 'NO WORKSPACE CREATED', workspaceId: null };
  let workspaceId: string | null = null;
  try {
    const session = await owner.request.get(`${origin}/api/session`);
    if (session.status() === 401) return { status: 'NO WORKSPACE CREATED', workspaceId: null };
    if (session.status() !== 200) return { status: 'FAILED', workspaceId: null };
    const data = await session.json() as { workspace: { id: string } };
    workspaceId = data.workspace.id;
    const deleted = await owner.request.delete(`${origin}/api/workspace`, { headers, data: { confirmation: 'DELETE' } });
    if (deleted.status() !== 200 || (await owner.request.get(`${origin}/api/session`)).status() !== 401) return { status: 'FAILED', workspaceId };
    return { status: 'DELETED AND VERIFIED', workspaceId: null };
  } catch { return { status: 'FAILED', workspaceId }; }
}

test('bounded live synthetic approval and cleanup with real deployed protection', async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error('EXPLICIT_PRODUCTION_ORIGIN_REQUIRED');
  const origin = new URL(baseURL).origin;
  const startedAt = new Date().toISOString();
  const evidence: SafeEvidence = {
    startedAt, finishedAt: null, applicationOrigin: origin, result: 'RUNNING', stage: 'initialization', reasonCode: null,
    independentContexts: 3,
    protection: 'Real deployed Turnstile; no response mocks, bypass, or sitekey override',
    checks: Object.fromEntries(['realProtectionConfigured', 'blankOwnerNoWorkspace', 'firstSaveViaUi', 'publicationViaUi', 'clipboardReadback', 'strangerBlankAndDenied', 'customerScopedReview', 'customerApprovalViaUi', 'ownerRefreshAndExport', 'matchingDatabaseReadback', 'reloadPersistence', 'privateNoteExcluded', 'noCapabilityInNetworkUrls', 'cleanup'].map(key => [key, 'NOT RUN'])) as Record<string, CheckState>,
    recordedResponse: null, cleanup: 'PENDING', cleanupWorkspaceId: null,
  };
  const evidencePath = path.resolve('.local/qa/production-smoke.json');
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
  const apiHeaders = { Origin: origin, 'X-CPL-Request': '1', 'Content-Type': 'application/json' };
  let owner: BrowserContext | undefined;
  let customer: BrowserContext | undefined;
  let stranger: BrowserContext | undefined;
  let failed = false;
  let bearerValues: string[] = [];
  const networkUrls: string[] = [];
  const privateNote = 'PRIVATE synthetic production smoke note; exclude from customer record.';
  try {
    owner = await browser.newContext({ baseURL: origin, permissions: ['clipboard-read', 'clipboard-write'] });
    customer = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 } });
    stranger = await browser.newContext({ baseURL: origin });
    for (const context of [owner, customer, stranger]) context.on('request', request => networkUrls.push(request.url()));
    const page = await owner.newPage();
    evidence.stage = 'verify production configuration';
    const configResponse = await owner.request.get(`${origin}/api/config`);
    expect(configResponse.status()).toBe(200);
    const config = await configResponse.json() as { protectionRequired: boolean; turnstileSiteKey: string | null };
    if (!config.protectionRequired || !config.turnstileSiteKey) throw new SmokeBlocked('REAL_PRODUCTION_PROTECTION_NOT_CONFIGURED');
    evidence.checks.realProtectionConfigured = 'PASS';

    evidence.stage = 'blank owner composer';
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Agree on the extra work');
    await expect(page.getByLabel('Business name', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Customer name', { exact: true })).toHaveValue('');
    expect((await owner.request.get(`${origin}/api/session`)).status()).toBe(401);
    evidence.checks.blankOwnerNoWorkspace = 'PASS';
    for (const [label, value] of [
      ['Business name', sample.businessName], ['Business contact', sample.businessContact], ['Customer name', sample.customerName],
      ['Job title', sample.jobTitle], ['Job reference', sample.jobReference], ['Service address or job location', sample.serviceAddress],
      ['Additional scope', sample.scope], ['Reason for the change', sample.reason], ['Included work', sample.includedWork], ['Exclusions', sample.exclusions],
    ]) await page.getByLabel(label!, { exact: label === 'Business name' || label === 'Customer name' || label === 'Job title' || label === 'Additional scope' || label === 'Reason for the change' || label === 'Service address or job location' }).fill(value!);
    await page.getByLabel('Line 1 description', { exact: true }).fill(sample.lineItems[0]!.description);
    await page.getByLabel('Line 1 unit price', { exact: true }).fill('350.00');
    await page.getByRole('radio', { name: /Specify a timing impact/ }).check();
    await page.getByLabel('Declared timing impact', { exact: true }).fill(sample.schedule.details);
    await page.locator('details.private-notes summary').click();
    await page.getByLabel('Private notes', { exact: false }).fill(privateNote);
    await page.locator('details.private-notes summary').click();

    evidence.stage = 'real Turnstile for first save';
    await realChallengeReady(page, 'create');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    const privateDialog = page.getByRole('dialog', { name: 'Keep your private workspace key.' });
    await expect(privateDialog).toBeVisible();
    const managementLink = await privateDialog.getByLabel('Private management / recovery link').inputValue();
    bearerValues.push(new URL(managementLink).hash.slice(1));
    await privateDialog.getByRole('button', { name: 'I’ve kept my private link' }).click();
    await expect(page.getByText('Draft saved on server', { exact: false })).toBeVisible();
    evidence.checks.firstSaveViaUi = 'PASS';

    evidence.stage = 'real Turnstile for publication';
    await page.getByRole('button', { name: 'Preview customer view' }).click();
    const preview = page.getByRole('dialog', { name: 'Review the customer view' });
    await expect(preview).not.toContainText(privateNote);
    await expect(preview.getByRole('button', { name: 'Approve extra work', exact: true })).toHaveCount(0);
    await preview.getByRole('button', { name: 'Save & prepare publication' }).click();
    await realChallengeReady(preview, 'publish');
    await preview.getByRole('button', { name: 'Publish request', exact: true }).click();
    const share = page.getByRole('dialog', { name: 'Ready for your customer.' });
    await expect(share).toBeVisible();
    const customerLink = await share.getByLabel('Customer review link', { exact: false }).inputValue();
    const versionId = new URL(customerLink).pathname.split('/').pop()!;
    bearerValues.push(new URL(customerLink).hash.slice(1));
    await share.getByRole('button', { name: 'Copy customer link', exact: true }).click();
    await expect(share.getByRole('button', { name: 'Copied to clipboard' })).toBeVisible();
    expect(await page.evaluate(expected => navigator.clipboard.readText().then(value => value === expected), customerLink)).toBeTruthy();
    await share.getByRole('button', { name: 'Back to the record' }).click();
    evidence.checks.publicationViaUi = 'PASS';
    evidence.checks.clipboardReadback = 'PASS';

    evidence.stage = 'unrelated stranger denial';
    const strangerPage = await stranger.newPage();
    await strangerPage.goto('/');
    await expect(strangerPage.getByLabel('Business name', { exact: true })).toHaveValue('');
    expect((await stranger.request.get(`${origin}/api/session`)).status()).toBe(401);
    expect((await stranger.request.get(`${origin}/api/requests`)).status()).toBe(401);
    await strangerPage.goto(`/review/${versionId}`);
    await expect(strangerPage.getByRole('heading', { name: 'This request isn’t available.' })).toBeVisible();
    expect((await stranger.request.get(`${origin}/api/review/${versionId}`)).status()).toBe(401);
    evidence.checks.strangerBlankAndDenied = 'PASS';

    evidence.stage = 'independent customer review';
    const reviewPage = await customer.newPage();
    await reviewPage.goto(customerLink);
    await expect(reviewPage.getByRole('article', { name: 'Published extra work request' })).toBeVisible();
    expect(new URL(reviewPage.url()).hash === '').toBeTruthy();
    await expect(reviewPage.locator('body')).not.toContainText(privateNote);
    await expect(reviewPage.getByRole('button', { name: 'Request changes', exact: true })).toBeVisible();
    await expect(reviewPage.getByRole('button', { name: 'Decline', exact: true })).toBeVisible();
    expect((await customer.request.get(`${origin}/api/session`)).status()).toBe(401);
    evidence.checks.customerScopedReview = 'PASS';

    evidence.stage = 'customer approval';
    await reviewPage.getByRole('button', { name: 'Approve extra work', exact: true }).click();
    await reviewPage.getByLabel('Your name', { exact: false }).fill('Morgan Example (fictional)');
    await expect(reviewPage.getByRole('checkbox')).not.toBeChecked();
    await reviewPage.getByRole('checkbox').check();
    await reviewPage.getByRole('button', { name: 'Review my response' }).click();
    const confirmation = reviewPage.getByRole('dialog', { name: 'Confirm your response' });
    await expect(confirmation).toContainText('$350.00 USD');
    await expect(confirmation).toContainText(sample.schedule.details);
    await confirmation.getByRole('button', { name: 'Confirm approval' }).click();
    await expect(reviewPage.getByRole('region', { name: 'Recorded response' })).toContainText('Approved');
    evidence.checks.customerApprovalViaUi = 'PASS';

    evidence.stage = 'owner refresh and both exports';
    const customerExport = await exportThroughUi(reviewPage);
    await page.getByRole('button', { name: 'Refresh response', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Recorded response' })).toContainText('Approved');
    const ownerExport = await exportThroughUi(page);
    expect(customerExport.review?.decision?.action).toBe('approved');
    expect(customerExport.review?.snapshot.totalCents).toBe(35000);
    expect(ownerExport.request?.versions[0]?.decision?.decidedAt === customerExport.review?.decision?.decidedAt).toBeTruthy();
    expect(ownerExport.request?.versions[0]?.contentHash === customerExport.review?.contentHash).toBeTruthy();
    expect(ownerExport.timezone).toBe('UTC');
    expect(customerExport.timezone).toBe('UTC');
    const exportedCustomerText = JSON.stringify(customerExport);
    expect(exportedCustomerText.includes('privateNotes') || exportedCustomerText.includes(privateNote)).toBeFalsy();
    expect(bearerValues.some(token => exportedCustomerText.includes(token))).toBeFalsy();
    evidence.checks.ownerRefreshAndExport = 'PASS';
    evidence.checks.privateNoteExcluded = 'PASS';
    const requestId = ownerExport.request!.id;
    expect((await stranger.request.get(`${origin}/api/requests/${requestId}/export`)).status()).toBe(401);
    expect((await customer.request.get(`${origin}/api/requests/${requestId}`)).status()).toBe(401);
    const readbackResponse = await owner.request.get(`${origin}/api/requests/${requestId}`);
    expect(readbackResponse.status()).toBe(200);
    const readback = await readbackResponse.json() as { request: OwnerRequest };
    const recorded = readback.request.versions[0]!;
    expect(recorded.decision?.action).toBe('approved');
    expect(recorded.decision?.decidedAt === customerExport.review?.decision?.decidedAt).toBeTruthy();
    evidence.checks.matchingDatabaseReadback = 'PASS';
    evidence.recordedResponse = { action: recorded.decision!.action, versionNumber: recorded.versionNumber, totalCents: recorded.snapshot.totalCents, contentHash: recorded.contentHash, decidedAtUtc: recorded.decision!.decidedAt };

    evidence.stage = 'reload persistence';
    await page.reload();
    await expect(page.getByRole('heading', { name: 'The job ledger.' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: sample.jobTitle })).toContainText('Approved');
    await reviewPage.reload();
    await expect(reviewPage.getByRole('region', { name: 'Recorded response' })).toContainText('Approved');
    evidence.checks.reloadPersistence = 'PASS';
    expect(networkUrls.some(url => bearerValues.some(token => url.includes(token)))).toBeFalsy();
    evidence.checks.noCapabilityInNetworkUrls = 'PASS';
    evidence.result = 'PASS';
  } catch (error) {
    failed = true;
    evidence.result = error instanceof SmokeBlocked ? 'BLOCKED' : 'FAILED';
    evidence.reasonCode = error instanceof SmokeBlocked ? error.reasonCode : 'STEP_DID_NOT_COMPLETE_OR_ASSERTION_FAILED';
    // Do not copy exception messages, DOM, URLs, cookies or provider payloads into evidence.
  } finally {
    const cleanup = await cleanupSyntheticWorkspace(owner, origin, apiHeaders);
    evidence.cleanup = cleanup.status;
    evidence.cleanupWorkspaceId = cleanup.workspaceId;
    if (cleanup.status === 'FAILED') {
      evidence.result = 'FAILED';
      evidence.reasonCode = 'SYNTHETIC_WORKSPACE_CLEANUP_REQUIRES_ATTENTION';
      failed = true;
    } else evidence.checks.cleanup = 'PASS';
    for (const context of [customer, stranger, owner]) if (context) await context.close().catch(() => {});
    bearerValues = [];
    networkUrls.length = 0;
    evidence.finishedAt = new Date().toISOString();
    await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
  }
  if (failed) throw new Error(`PRODUCTION_SMOKE_${evidence.result}: ${evidence.reasonCode}; see safe evidence JSON.`);
});
