# QA and release evidence

This document separates required coverage from recorded execution. **A listed check is not a claim it passed.** The integration owner records final command results and deployed evidence in the execution section below.

## Required checks

| Layer | Release coverage |
| --- | --- |
| Lint/typecheck/build | Supported pinned runtime, source checks, production asset build, required deployment gate and local hooks |
| Domain | Integer cents, bounded quantities/line count/size, tax entry, explicit zero-cost confirmation, required publication fields, unchanged timing, private-note exclusion, immutable snapshot |
| Worker/D1 | Actual Workers runtime and D1 migrations; ownership, parameterized queries, constraints, durable create/edit/publish/decision/export, retention and purge |
| Access | Missing/guessed/cross-workspace IDs; owner/customer isolation; recovery rotation, session revocation; expired/revoked/superseded capabilities; Origin/CSRF; token/hash/cache/log handling |
| Atomicity | Duplicate POST, exact idempotent retry, changed payload denial, old version, simultaneous approve/revoke/revise, zero affected rows, transaction/storage failure |
| Protection | Actual rate limits, required Turnstile failure, workspace/request limits, unavailable storage, bounded output |
| Browser | Blank start, explicit save, reopen, preview without decision, publish/copy, independent customer response, unrelated stranger denial, owner refresh and export |
| Usability | Phone layout, keyboard/focus, unselected acknowledgment, all decision choices, reduced motion, long text, retry preserves input, successful server commit before seal |
| Print | Representative exact-version records, selectable text, prices, version/hash/timestamps, no owner notes or capabilities; local rendering and visual inspection |
| Deployment | Authorized resource identity, binding/migrations/secrets, two independent anonymous contexts against deployed app, deployed commit/build identifiers, manual and Git-triggered deployments distinguished |

## Execution record

Executed on 2026-09-06 with pinned Node **24.19.0**:

| Check | Recorded result |
| --- | --- |
| `npm run typecheck` | PASS, frontend/shared/tests and Worker TypeScript checks |
| `npm test` | PASS, 8 deterministic domain tests (release owner run) |
| `npm run test:integration` | PASS, 40 tests in actual Workers/D1 runtime, including 13 delayed owner writes after revocation and session/workspace expiry checks |
| `npm run test:browser` | PASS, 8 Chromium tests; full release gate browser run 35.0 seconds |
| Browser test source lint | PASS, `eslint tests/browser/product.spec.ts --max-warnings 0` |
| `npm run build` | PASS, production Vite build (release owner run) |
| Full `npm run verify` release gate | PASS, lint, both type checks, 8 unit, 40 Worker/D1 integration, production build, 8 browser tests, public-source scan |
| Deployed independent owner/customer smoke | NOT RUN: no verified deployed application URL |
| Native Git-triggered Worker deployment | NOT CONFIGURED: owner selected narrower manual CLI deployment |

The browser happy path used actual UI entry and Save, real publication, successful clipboard readback, a separate intended-customer context, an unrelated stranger context, committed approval, owner refresh, matching owner/customer exports, reload persistence, and management recovery in another context. Separate tests recorded declined and changes-requested outcomes; rejected a stale customer version; exercised cross-workspace denial, recovery rotation and session revocation; required explicit zero-cost confirmation; and preserved an entered tax amount.

One explicitly fault-injected test allowed the decision POST to commit to real local D1, then dropped that HTTP response. The UI showed no receipt before confirmation and retained the response; an exact idempotent retry recovered the original server timestamp. Happy-path tests did not mock API responses.

Repeated release gates initially exhausted the reused local preview's hourly recovery/link-exchange quota and correctly blocked deployment with HTTP 429. `npm run test:browser` now prepares migrations and resets only `rate_limits` metadata in the explicitly separate local D1 database before a suite. It preserves local drafts/decisions and has no remote mode. Run local browser suites serially. Production limits are unchanged; native integration tests exercise actual server quota boundaries without this browser preparation.

The 390-pixel customer document had no horizontal overflow; keyboard response ordering/name focus and reduced motion passed. Axe reported no WCAG 2 A/AA or 2.1 A/AA violations in the scanned long-text customer state. Malicious markup rendered as text. These checks cover the scanned states, not every possible page/input combination.

Nine original synthetic UI captures are in `portfolio-handoff/assets/`; no functional capabilities or actual customer data were captured. Local browser print generated `.local/qa/fictional-approved-record.pdf` and `.local/qa/fictional-long-scope-record.pdf`. Both representative PDFs were rendered to two pages each, and all four pages were visually inspected: legible scope/totals, version and timestamp, clean page breaks, a complete response receipt, wrapping long/malicious text, and no private note or bearer token. These are browser-produced verification files; they do not prove that an end user completed Save as PDF.

The shared portfolio is **NOT INTEGRATED** in this run by owner instruction. Its current public schema and maintenance conventions were read for the handoff only. Integration must rerun portfolio checks against latest main.

The isolated production smoke is prepared in `tests/production/` with `playwright.production.config.ts`; it is separate from local tests and requires the explicit verified live origin. It waits for real Turnstile completion, uses no mocks/bypass/sitekey override, and reports interactive verification as BLOCKED. Its safe evidence goes only to ignored `.local/qa/production-smoke.json`. Preparation, typechecking and linting do not count as deployed execution.
