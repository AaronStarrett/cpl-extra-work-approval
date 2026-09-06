# Extra Work Approval project instructions

Read [CPL Product Standards](docs/CPL-PRODUCT-STANDARDS.md) before making changes. Those owner instructions supersede earlier generic demo-first requirements. Read [API contract](docs/API-CONTRACT.md), [Security and access](docs/SECURITY-ACCESS.md), and [QA](docs/QA.md) when changing the workflow or persistence boundary.

## Authorized scope

This is the dedicated `cpl-extra-work-approval` application. Keep the other CPL products separate. The shared `AaronStarrett/cpl-portfolio` is **read-only during this build**: prepare changes in `portfolio-handoff/` and leave integration, commits, pushes, and Pages deployment to the portfolio integration owner. Do not overwrite adjacent material, nest repositories, reset unrelated branches, force-push, change another repository's visibility, or add billable GitHub Actions.

## Product invariants

- The homepage is a blank, real composer. A GET does not create a workspace. Explicit Save starts private persistence. Fictional examples live in tests and the handoff only.
- This app requires no AI. Do not add AI keys, model calls, email/SMS delivery, payments, uploads, drawn signatures, or integrations.
- Owner and customer authority are separate, scoped, server checked, and revocable. Record IDs are never authorization. Keep raw capabilities out of source, logs, ordinary URL paths/query strings, exported records, and screenshots.
- Published versions are immutable. Server time, server-computed integer-cent totals, atomic one-decision writes, stale revision checks, and private-note exclusion are release requirements. Approved work changes through a separate linked request.
- A copied link is not a delivered message. A viewed page is not a response. Only a successful database commit establishes a decision. Typed names are declarations, not verified identity.
- Retention and link expiry are different. Show the exact retention boundary and provide export and deletion. Never promise indefinite hosting or instant removal from provider backups.
- Use safe text rendering, same-origin APIs, no-store/no-referrer protections, no third-party tracking, and bounded inputs/traffic/storage. Fail closed when persistence or required protection is unavailable.

## Design and accessibility

Preserve the warm paper, graphite, copper, and restrained moss work-order notebook. Use centered documents, numbered sections, line-item rows, and a tidy private ledger. Preserve keyboard focus, labels, an unchecked acknowledgment, readable print output, visible decline/change choices, and reduced-motion support. Do not introduce a dashboard/card reskin or success animation before server confirmation.

## Work and validation

Use the Node version pinned by this repository and the lockfile. Inspect `package.json` for the authoritative commands. Run lint, typecheck, deterministic unit tests, actual Workers/D1 integration tests, browser tests, and the build gate before deployment. Run the supported preview for browser verification. Local hooks are part of the gate; do not bypass them or suppress failures. When a task changes an access or state invariant, exercise the corresponding cross-context and race tests.

Use separate local/preview/production D1 data. Do not give untrusted previews production secrets. Never commit `.dev.vars`, `.env`, live database exports, browser session state, bearer links, or private evidence. Inspect staged files and Git history before publishing public source; preserve third-party notices. Public source does not authorize adding a broad license grant.

Report **implemented**, **tested**, **deployed**, and **portfolio integrated** separately. Mark unexecuted checks NOT RUN and infrastructure limitations BLOCKED. A manual upload is not proof of a Git-triggered build. Recheck current resources before creating duplicates. Do not upgrade paid plans, buy domains, or change unrelated DNS.
