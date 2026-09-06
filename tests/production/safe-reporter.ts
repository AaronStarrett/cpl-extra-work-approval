import type { Reporter, TestResult, FullResult } from '@playwright/test/reporter';

// Never print Playwright error details, page DOM, URLs, console payloads or attachments:
// a failure may occur while a private capability is displayed in an owner dialog.
export default class SafeProductionReporter implements Reporter {
  onBegin() { process.stdout.write('PRODUCTION_SMOKE_STARTED: fresh synthetic contexts; real protection; no screenshots or traces.\n'); }
  onTestEnd(_test: unknown, result: TestResult) {
    process.stdout.write(`PRODUCTION_SMOKE_TEST_STATUS=${result.status}\n`);
  }
  onError() { process.stdout.write('PRODUCTION_SMOKE_RUNNER_ERROR: details intentionally omitted to protect private runtime values.\n'); }
  onEnd(result: FullResult) {
    process.stdout.write(`PRODUCTION_SMOKE_RUN_STATUS=${result.status}; safe evidence: .local/qa/production-smoke.json\n`);
  }
  printsToStdio() { return true; }
}
