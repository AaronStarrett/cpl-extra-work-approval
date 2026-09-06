# Deployment and operations

The authorized application resource name is `cpl-extra-work-approval`. The public repository has been created and verified at [AaronStarrett/cpl-extra-work-approval](https://github.com/AaronStarrett/cpl-extra-work-approval). A resource name is not an application URL or proof of deployment. Release evidence below distinguishes source, provisioning and deployed operation.

## Environments and release gate

Use the repository's pinned supported Node runtime, lockfile and Wrangler configuration. Local development, interactive preview and browser tests use separate local Workers/D1 state. A hosted preview environment is **NOT CONFIGURED**, and Worker preview URLs are disabled. Any future hosted preview must use its own D1 database and applicable secrets. Production uses one application-specific D1 binding. Never bind an untrusted PR build to production records or secrets.

Inspect existing GitHub/Cloudflare resources before creating anything with the same name. Configure only this app's resources. No paid plan upgrades, domains, unrelated DNS changes or GitHub Actions are authorized. The owner selected a scoped **manual CLI deployment** for this release. Required validation remains part of the deploy command. Native Git-connected Workers Builds are not configured because their proposed default deployment token extends into unrelated product/account-route permissions.

Before release, run the commands documented in `package.json`, verify migrations against the actual local/preview D1 runtime, test ownership/decision/retention invariants, review public staged files and history, and verify applicable secrets/protection are configured. Keep Turnstile server secrets in protected Worker configuration; do not store them in source or browser storage.

Apply migrations to the intended environment only, then deploy the gated build. Verify the actual workers.dev address and application identity. Run a bounded synthetic smoke using independent owner/customer browser contexts; retain database-derived response/export evidence without capabilities or customer material in public source.

## Migrations, rollback, and backups

Keep schema migrations versioned and reviewed. Prefer additive, backward-compatible changes. Validate new migrations against preview data and a compatible older Worker before production. Acquire an appropriate private D1 export/recovery point for a live-data migration, with access restricted and a defined deletion date. Never publish a live database export.

A code rollback selects an earlier Worker version; it does **not** undo D1 writes or roll back schema/data automatically. Stop writes or enter a documented maintenance state before a destructive recovery. Restore/reconcile data only through an authorized, reviewed procedure after checking exactly which decisions would be affected. Do not erase genuine approvals to make a rollback look clean.

Scheduled retention cleanup is bounded. API authorization/expiry remains enforced even if cron is delayed. Monitor generic failure counts and resource limits without logging customer text, bodies or bearer tokens. Public/free deployment remains subject to provider quotas.

## Release evidence

As of 2026-09-06: **deployed; synthetic production approval workflow verified**.

| Release fact | Verified value |
| --- | --- |
| Application | [cpl-extra-work-approval.astarrett.workers.dev](https://cpl-extra-work-approval.astarrett.workers.dev) |
| Deployed source | `9c5ad12498edbf23939c0b38b987a9a708f55d19` |
| Worker version | `4fea902a-cbf5-4534-b2a5-3f5d47b423d0` |
| Remote D1 migrations | PASS, `0001` and `0002`; none pending at final deployment |
| Deployment route | Owner-selected gated manual CLI upload |
| Complete local gate | PASS: lint, typechecks, 8 unit, 45 native Workers/D1, 8 browser (39.1 seconds), build and public source security scan (83 files) |
| Production workflow | PASS: real protected owner publication, independent customer approval, stranger denial, fresh owner recovery, matching exports/readbacks/reloads and complete synthetic cleanup |
| Final public checks | PASS, 9 checks on the final Worker, including invalid-owner-cookie clearing and privacy/security headers |
| Deployment readback | Final Worker receives 100% of traffic; deployment created `2026-09-06T17:39:08.994Z` |

The owner authorized the narrower manual path using a credential limited to the required Workers Scripts Edit and D1 Edit permissions. Production configuration, both migrations and the upload completed. No token value belongs in this document or source. App implementation and testing have no AI-funding dependency.

After deployment, the temporary scoped deployment token was deleted with Cloudflare UI readback. Temporary credential files and transient raw credential values were cleared; the Worker Turnstile secret remains configured and hidden. No persistent deployment token or native Git build was configured. A future manual release requires a fresh appropriately scoped deployment credential. The release owner also verified the exact temporary credentials were absent from the complete Git patch history.

Earlier local gate failures were resolved by starting a fresh Wrangler process on port 4174 with separate local browser-state storage; the final gate passed. A remote D1 parser failure then required a syntax-only parentheses correction around existing migration `CASE … END` expressions. All 42 native cases passed again, both remote migrations succeeded, and the deployment command resumed successfully.

The four-context production workflow passed on source `ded201fd190df2930e98055638e36ebc70cc48f9`, Worker `15196e5c-d930-4072-ad13-66d07e410563`. The initial automated first-save attempt had stopped at real Turnstile without creating a workspace; the owner subsequently completed protection interactively. Independent customer, stranger and recovered-owner checks then verified the stored response and matching exports. The owner deleted the synthetic workspace, and read-only remote D1 counts found zero rows in the six checked tables: `workspaces`, `requests`, `versions`, `decisions`, `owner_sessions` and `review_sessions`.

The final Worker above includes the subsequent invalid-owner-cookie recovery correction. Its three targeted regression tests and the complete final gate passed before the successful manual upload. Application assets did not change in this correction; the production approval was not repeated. The exact separation between workflow evidence and the final corrected deployment is retained in [QA](QA.md).

The separate live verification harness is documented in [`tests/production/README.md`](../tests/production/README.md). It accepts only an explicitly supplied verified production origin and retains safe result evidence. If a fresh automated run requires interactive Turnstile verification, report that boundary and complete it through an authorized interactive browser; do not weaken protection or substitute test keys in production.

Record the manual upload and its version/commit separately from Git hosting. Native Git-triggered deployment is **NOT CONFIGURED by the owner's selected narrower deployment path**. A Git remote, config file or successful manual deploy does not establish native Git-build integration. Any remaining permission/provisioning/protection failure must remain visible in the final handoff.
