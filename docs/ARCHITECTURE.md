# Architecture

React and TypeScript render a blank work-order composer, the owner ledger, settings, and the scoped customer decision document. Vite produces static assets served alongside a same-origin Cloudflare Worker API. One application-specific D1 database holds durable records. There is no AI runtime, R2, external database, communication provider, or customer file-storage subsystem.

`shared/domain.ts` defines the strict draft/settings/decision schemas, integer-cent pricing, publication checks, and customer snapshot shape. The server parses inputs again and recomputes prices; the browser cannot supply authoritative totals or workspace IDs. Draft completeness is checked at publication. Line count, quantities, amounts, and text are bounded.

The first explicit save initializes an owner workspace and returns a management capability once. A Secure, HttpOnly, SameSite cookie maintains the owner session. Customer capability exchange creates a different session limited to one published version. Full endpoint and cookie semantics are in [API contract](API-CONTRACT.md).

Publishing freezes a numbered snapshot with the declared business identity, scope, price, timing, terms, server timestamp, expiry, and content hash. Updating business settings does not rewrite an earlier snapshot. Subsequent revisions preserve historical versions and decisions; approved scope is changed through a separate linked request.

D1 is authoritative for workspace access, drafts, immutable versions, capabilities/session hashes, responses, and event metadata. Decision/state preconditions and the durable evidence write must commit atomically. Idempotency identifies a retry of the same operation; it never permits applying a stale response to a different version. Optimistic revisions reject stale owner writes. Expiry is enforced during reads and writes, not solely by the scheduled purge.

The ledger uses bounded refresh while visible and an explicit manual refresh with a server refresh time. A fetch does not imply a customer read receipt. A decision seal appears only when the server returns the committed response. Browser previews are read-only; print/export derive from the stored version and its response.

Use [Security and access](SECURITY-ACCESS.md) for the threat model, [Data retention](DATA-RETENTION.md) for deletion semantics, and [QA](QA.md) for evidence required before release. A design description is not a claim that a deployed environment has passed those checks.
