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
| `npm run test:integration` | PASS, all 45 cases in the final actual Workers/D1 run (28.13 seconds) |
| `npm run test:browser` | PASS, 8 Chromium tests; final release gate browser run 39.1 seconds |
| Browser test source lint | PASS, `eslint tests/browser/product.spec.ts --max-warnings 0` |
| `npm run build` | PASS, production Vite build (release owner run) |
| Full release gate | PASS: lint, both typechecks, 8 unit, 45 native Workers/D1, 8 browser, production build and public source security scan (83 files), using the fresh isolated browser server |
| Remote D1 migrations and Worker upload | PASS: migrations 0001/0002 applied before the initial upload; no pending migrations at the successful final manual upload. Source and Worker versions are recorded in [Deployment](DEPLOYMENT.md) |
| Deployed independent owner/customer workflow | PASS: interactive original owner plus independent customer, stranger and recovered-owner contexts; real protection, stored approval, matching exports/readbacks/reloads and complete synthetic cleanup |
| Original all-in-one automated production attempt | BLOCKED at first-save Turnstile before any workspace was created; later verification used real interactive protection and independent test contexts without bypass |
| Final deployed public checks | PASS, 9 checks completed at 17:40:09.285 UTC: blank homepage, real protection configuration, unauthorized session denial, invalid-owner-cookie clearing without owner payload, and privacy/security headers across four read-only responses |
| Native Git-triggered Worker deployment | NOT CONFIGURED: owner selected narrower manual CLI deployment |

The browser happy path used actual UI entry and Save, real publication, successful clipboard readback, a separate intended-customer context, an unrelated stranger context, committed approval, owner refresh, matching owner/customer exports, reload persistence, and management recovery in another context. Separate tests recorded declined and changes-requested outcomes; rejected a stale customer version; exercised cross-workspace denial, recovery rotation and session revocation; required explicit zero-cost confirmation; and preserved an entered tax amount.

One explicitly fault-injected test allowed the decision POST to commit to real local D1, then dropped that HTTP response. The UI showed no receipt before confirmation and retained the response; an exact idempotent retry recovered the original server timestamp. Happy-path tests did not mock API responses.

Browser tests now own a separate Wrangler process on **port 4174**, use the dedicated local database state at **`.local/browser-state`**, and start a fresh server for each suite (`reuseExistingServer: false`). This separates them from the interactive preview on port 4173. Preparation applies local migrations and resets only `rate_limits` metadata in that explicit browser-test database; it has no remote mode and does not erase drafts or decisions. Run browser suites serially. Production limits remain unchanged, and native integration tests exercise actual server quota boundaries without this browser preparation.

Two earlier local-environment failures correctly stopped deployment: repeated runs exhausted a reused preview's recovery/exchange quota (HTTP 429), then a long-running Windows asset watcher hit EPERM and stopped serving rebuilt assets (homepage 404). The isolated quota metadata and fresh per-suite Wrangler lifecycle address those test-environment causes. Neither blocked run uploaded a production release or was counted as a passing gate.

The 390-pixel customer document had no horizontal overflow; keyboard response ordering/name focus and reduced motion passed. Axe reported no WCAG 2 A/AA or 2.1 A/AA violations in the scanned long-text customer state. Malicious markup rendered as text. These checks cover the scanned states, not every possible page/input combination.

Nine original synthetic UI captures are in `portfolio-handoff/assets/`; no functional capabilities or actual customer data were captured. Local browser print generated `.local/qa/fictional-approved-record.pdf` and `.local/qa/fictional-long-scope-record.pdf`. Both representative PDFs were rendered to two pages each, and all four pages were visually inspected: legible scope/totals, version and timestamp, clean page breaks, a complete response receipt, wrapping long/malicious text, and no private note or bearer token. These are browser-produced verification files; they do not prove that an end user completed Save as PDF.

The shared portfolio is **NOT INTEGRATED** in this run by owner instruction. Its current public schema and maintenance conventions were read for the handoff only. Integration must rerun portfolio checks against latest main.

The isolated production smoke in `tests/production/` with `playwright.production.config.ts` first ran against [the deployed application](https://cpl-extra-work-approval.astarrett.workers.dev) on 2026-09-06, from 17:11:41 to 17:12:31 UTC. It verified protection configuration and a blank owner composer with no workspace, then recorded **BLOCKED** when real Turnstile did not complete within the first-save wait. No workspace was created; the remaining workflow was **NOT RUN in that attempt**. The original result remains in ignored `.local/qa/production-smoke.json`.

The completed production verification used four independent contexts: the original interactive owner, a fresh phone-sized customer, an unrelated stranger and a fresh recovered owner. The original owner saved and published through real Turnstile and confirmed customer-link copy. The customer approved the fictional $350 side gate with one additional working day through the real UI at **2026-09-06T17:23:59.330Z**. All 13 customer/stranger checks and all 12 recovered-owner checks passed. Owner and customer UI exports, scoped API readbacks and reloads matched the same version, content hash and server timestamp. Private notes were absent from the published snapshot and customer export; capabilities were absent from exports and request URLs. Recovery used the real UI in a fresh context without imported owner cookies.

The original owner then deleted the synthetic workspace through Settings with the typed confirmation. A read-only remote D1 check found **zero** remaining workspaces, requests, versions, decisions, owner sessions and review sessions; the verification query wrote no rows. Safe combined evidence is in ignored `.local/qa/production-workflow.json`, with the independent customer and recovery reports beside it. No protection bypass, mocked API response or sitekey override was used.

This production workflow was exercised on source `ded201fd190df2930e98055638e36ebc70cc48f9`, Worker `15196e5c-d930-4072-ad13-66d07e410563`. The subsequent invalid-owner-cookie correction clears confirmed invalid sessions while preserving cookies on storage failure. Three targeted regressions passed, followed by the final 45-case native and 8-case browser gate. Final source `9c5ad12498edbf23939c0b38b987a9a708f55d19` was deployed as Worker `4fea902a-cbf5-4534-b2a5-3f5d47b423d0`; the final nine read-only public checks passed and are retained in ignored `.local/qa/final-public-check.json`. The production approval was not repeated after this focused correction.

After the complete local gate, the remote D1 SQL parser required parentheses around existing `CASE … END` expressions. This syntax-only migration correction retained the guards, passed a fresh 42-case native run, and both remote migrations then succeeded before the manual Worker upload.
