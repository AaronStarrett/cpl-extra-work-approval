import { defineConfig, devices } from '@playwright/test';

// The pinned runner otherwise captures an automatic page snapshot on failure.
// A private capability dialog may be open at that instant.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

function suppliedProductionOrigin(): string {
  let url: URL;
  try { url = new URL(process.env.CPL_LIVE_URL ?? ''); }
  catch { throw new Error('Set CPL_LIVE_URL to the explicitly verified Extra Work Approval HTTPS origin.'); }
  if (url.protocol !== 'https:' || !url.hostname.startsWith('cpl-extra-work-approval.') || !url.hostname.endsWith('.workers.dev') || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('CPL_LIVE_URL must be the verified Extra Work Approval workers.dev origin, without credentials, path, query or fragment.');
  }
  return url.origin;
}

export default defineConfig({
  testDir: 'tests/production',
  testMatch: 'smoke.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180000,
  globalTimeout: 210000,
  expect: { timeout: 12000 },
  reporter: [['./tests/production/safe-reporter.ts']],
  outputDir: '.local/production-smoke-results',
  preserveOutput: 'never',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: suppliedProductionOrigin(),
    actionTimeout: 15000,
    navigationTimeout: 30000,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
});
