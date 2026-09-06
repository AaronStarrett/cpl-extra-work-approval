# Separate bounded production smoke

This suite is **not included** in the default local browser tests or deployment build gate. Run it only after the actual Extra Work Approval workers.dev origin has been verified and the bounded live synthetic test is authorized. The product brief authorizes this smoke; it does not authorize real customer communication or paid services.

Set `CPL_LIVE_URL` to that verified HTTPS origin, without a path, query or fragment, then run from the application root with the pinned runtime:

```powershell
npm exec -- playwright test --config=playwright.production.config.ts
```

There is no default deployment URL and no local fallback. The suite uses one test, three fresh independent owner/customer/stranger contexts, no retries, a three-minute test boundary and a three-and-a-half-minute runner boundary. It does not alter the deployed sitekey, bypass protection, mock API responses, solve a challenge, or send a message. Each real Turnstile widget gets at most 45 seconds to complete automatically; interactive verification or provider unavailability is reported as **BLOCKED**, not passed.

The successful path enters a fictional $350 side-gate request through the real UI, saves, previews, publishes, verifies actual clipboard readback, opens the restricted customer link, confirms approval, refreshes the owner ledger, downloads both exports into transient test storage, compares the persisted version/hash/server timestamp, and checks reload persistence. A separate stranger remains blank and cannot list/export/read the private request. The owner workspace is deleted in `finally`, and the owner session is checked afterward. Cleanup problems are explicitly reported.

Only `.local/qa/production-smoke.json` is retained as safe evidence: stage/check statuses, public origin, synthetic amount, immutable content hash and server time. If cleanup fails, it may include the non-secret synthetic workspace ID so the operator can remove that test workspace; successful runs retain no workspace identifier. No bearer link, token, cookie, private note, full record or provider response is written there. Screenshots, traces and video are disabled; the reporter omits exception/DOM/console payloads and runner artifacts are not preserved. Never enable a verbose/default reporter or traces while a capability dialog is open.

The suite has been prepared, not live-executed, until its safe evidence records the actual result. A blocked real Turnstile check remains pending for an interactive authorized browser; do not replace it with a fixture or test key to obtain a passing result.
