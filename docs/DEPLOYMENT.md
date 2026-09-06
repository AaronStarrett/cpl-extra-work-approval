# Deployment and operations

The authorized application resource name is `cpl-extra-work-approval`. The public repository has been created and verified at [AaronStarrett/cpl-extra-work-approval](https://github.com/AaronStarrett/cpl-extra-work-approval). A resource name is not an application URL or proof of deployment. Release evidence below distinguishes source, provisioning and deployed operation.

## Environments and release gate

Use the repository's pinned supported Node runtime, lockfile and Wrangler configuration. Local development uses local Workers/D1. Preview uses an explicit separate D1 database and separate applicable secrets. Production uses one application-specific D1 binding. Never bind an untrusted PR build to production records or secrets.

Inspect existing GitHub/Cloudflare resources before creating anything with the same name. Configure only this app's resources. No paid plan upgrades, domains, unrelated DNS changes or GitHub Actions are authorized. The owner selected a scoped **manual CLI deployment** for this release. Required validation remains part of the deploy command. Native Git-connected Workers Builds are not configured because their proposed default deployment token extends into unrelated product/account-route permissions.

Before release, run the commands documented in `package.json`, verify migrations against the actual local/preview D1 runtime, test ownership/decision/retention invariants, review public staged files and history, and verify applicable secrets/protection are configured. Keep Turnstile server secrets in protected Worker configuration; do not store them in source or browser storage.

Apply migrations to the intended environment only, then deploy the gated build. Verify the actual workers.dev address and application identity. Run a bounded synthetic smoke using independent owner/customer browser contexts; retain database-derived response/export evidence without capabilities or customer material in public source.

## Migrations, rollback, and backups

Keep schema migrations versioned and reviewed. Prefer additive, backward-compatible changes. Validate new migrations against preview data and a compatible older Worker before production. Acquire an appropriate private D1 export/recovery point for a live-data migration, with access restricted and a defined deletion date. Never publish a live database export.

A code rollback selects an earlier Worker version; it does **not** undo D1 writes or roll back schema/data automatically. Stop writes or enter a documented maintenance state before a destructive recovery. Restore/reconcile data only through an authorized, reviewed procedure after checking exactly which decisions would be affected. Do not erase genuine approvals to make a rollback look clean.

Scheduled retention cleanup is bounded. API authorization/expiry remains enforced even if cron is delayed. Monitor generic failure counts and resource limits without logging customer text, bodies or bearer tokens. Public/free deployment remains subject to provider quotas.

## Release evidence

As of 2026-09-06: **locally verified; deployment pending**. The dedicated public repository was created; app-specific D1 resources and a Turnstile widget were prepared by the release owner. Local D1 migration, build and independent-browser persistence verification passed. No workers.dev product URL, deployed commit/Worker version, manual upload success, deployed two-browser smoke, or native Git-triggered build is asserted.

The owner authorized the narrower manual path using a credential limited to the required Workers Scripts Edit and D1 Edit permissions. Production credential setup, production migrations, the manual upload and deployed independent-browser verification are still pending their actual release results. No token value belongs in this document or source. App implementation and testing have no AI-funding dependency.

The final release owner must append source commit, production/preview migration results, verified application URL and actual Worker/build identifiers when the deployment boundary is resolved. Do not promote the portfolio staging entry to deployed maturity before the independent deployed-context smoke passes.

The separate live verification harness is documented in [`tests/production/README.md`](../tests/production/README.md). It accepts only the explicitly supplied verified production origin, exercises real Turnstile without bypass, and retains only safe result evidence. Interactive protection remains a pending user/browser step rather than a reason to weaken the deployed check.

Record the manual upload and its version/commit separately from Git hosting. Native Git-triggered deployment is **NOT CONFIGURED by the owner's selected narrower deployment path**. A Git remote, config file or successful manual deploy does not establish native Git-build integration. Any remaining permission/provisioning/protection failure must remain visible in the final handoff.
