# Extra Work Approval

**Agree on the extra work before it starts.** By Cyber Pirate Labs.

A focused tool for a contractor's “while you're here” request: write the extra scope, additional price and timing, publish a private customer-review link, record the response to that exact version, and export the record. The first visit opens a blank composer. No account signup or AI key is needed.

Current release state: **deployed; synthetic production approval workflow verified**. [Open Extra Work Approval](https://cpl-extra-work-approval.astarrett.workers.dev) · [Public source repository](https://github.com/AaronStarrett/cpl-extra-work-approval). The final local gate passed: 8 domain tests, 45 native Workers/D1 cases, 8 browser tests, lint, typechecks, build and source security scan. Production verification covered real protected publication, independent customer approval, stranger denial, owner recovery, matching exports, reload persistence and deletion of all synthetic records. [Deployment](docs/DEPLOYMENT.md) and [QA](docs/QA.md) distinguish the workflow-tested version from the subsequent session-cookie correction and its final release gate.

## The workflow

1. Enter the business, intended customer, job, additional scope, line items, and timing declaration.
2. Save a draft. Keep the separately labeled **PRIVATE management/recovery link** somewhere secure; it grants control of the workspace.
3. Preview the customer document, then publish an immutable numbered version.
4. Copy the customer link into your existing conversation. This app does not send email or text messages.
5. The link holder can approve, request changes, or decline. Approval requires an unchecked acknowledgment, a typed name, and a confirmation step.
6. Refresh the private ledger and export the stored response. **Print / Save as PDF** opens the browser's print flow; the app cannot prove a file was saved.

## Privacy and limits

Management links and customer links have different powers. Anyone holding a bearer link may forward it; the app records a declaration, not a verified identity. There is no identity-based recovery without an active owner session or the management link. Customer exports exclude private owner notes.

The default hosted record window is 90 days from creation. Customer links default to seven days and cannot extend past the record's retention date. Export and retain your own copy. This is not proof of payment, certified e-signature software, or a guarantee of contractual enforceability. Review your business terms before contractual reliance.

The v1 price is USD only, calculated in integer cents. Tax is an explicit owner-entered amount. Negative change orders, credits, document/photo uploads, billing, delivery integrations, and AI are outside this product.

## Development and release

Use the pinned Node runtime and package lock. Install dependencies with `npm ci`; inspect `package.json` for development, lint, typecheck, unit, integration, browser, preview, and gated deployment scripts. Cloudflare Worker and D1 configuration belongs to this app only. Local and preview data must stay separate from production.

Release facts are recorded in [QA](docs/QA.md) and [Deployment](docs/DEPLOYMENT.md). The owner selected gated manual CLI deployment; native Git-triggered deployment is not configured. Deployment and completed production workflow verification are recorded separately.

## Documentation

- [Project instructions](AGENTS.md) and [CPL product standards](docs/CPL-PRODUCT-STANDARDS.md)
- [Architecture](docs/ARCHITECTURE.md) and [API contract](docs/API-CONTRACT.md)
- [Security and access](docs/SECURITY-ACCESS.md) and [Retention and deletion](docs/DATA-RETENTION.md)
- [Deployment](docs/DEPLOYMENT.md) and [QA](docs/QA.md)
- [Design rationale](docs/DESIGN-RATIONALE.md) and [Sales demonstration](docs/SALES-DEMO.md)
- [Portfolio integration handoff](portfolio-handoff/README.md)

The portfolio is a separate explanation and walkthrough. This build does not modify or publish the shared portfolio. Third-party license notices must be retained; no broad license for CPL's application source is granted by this README.
