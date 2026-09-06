# Security and access

## Threat model

Protect private job/customer details, owner notes, immutable approvals, and management authority from unauthenticated visitors, guessed record IDs, another workspace, an unrelated recipient, cross-site requests, malicious input, replay, stale submissions, and concurrent state changes. Treat capability possession as authority within the capability's exact scope. The service operator and authorized Cloudflare account administrators remain infrastructure trust boundaries.

Bearer links are intentionally transferable. A typed name or contact field is a declaration; no identity, email ownership, signature certification, payment, or legal enforceability is verified. A customer can forward a review link. A stolen management link grants management authority until rotated; a stolen active session remains useful until expiry/revocation. Browser or device compromise is outside the protection of a bearer-link model.

## Capabilities and sessions

Use Web Crypto cryptographic randomness with at least 32 bytes of entropy, and store only hashes of bearer secrets. Hashing high-entropy tokens does not need a user-password workflow or home-grown encryption. Management and customer entry links carry secrets in fragments. Same-origin POST exchanges create scoped HttpOnly sessions; the frontend removes the fragment. No exchange records a decision and ordinary link preview does not consume a one-use approval.

Management and customer cookies have different names/scopes; a review tab must never replace the owner's session or grant authority over another version. Owner sessions last at most seven days; recipient sessions at most 24 hours and never beyond the review capability/record boundary. Rotation invalidates the prior management link. Session revocation invalidates owner sessions while retaining recovery capability for a fresh login. Every owner read, mutation, list, export, revision and delete uses server-resolved workspace scope.

The management link is displayed once and clearly separated from customer-link controls. Copy/download means the owner deliberately saves that secret. No recovery email or identity-based account recovery exists in v1. Keep recovery downloads private and out of this public repository.

## Requests, persistence, and browser boundary

Mutations require the exact same-origin `Origin`, JSON content type, and `X-CPL-Request: 1`; SameSite cookies add defense in depth. Reject untrusted origins, absent authority, stale revisions, expired/revoked/superseded links, invalid fields, and unsupported transitions on the server. Use parameterized SQL, constraints, explicit ownership filters, bounded queries, and atomic compare-and-set evidence writes. Generic unauthorized/not-found responses avoid exposing another workspace's data.

Each published version can have at most one final decision. Same-key, same-payload retries may recover an already committed receipt; different payloads or competing decisions must fail. A zero-eligible-row state update cannot authorize an orphan response. Test actual D1 constraint and affected-row behavior.

Do not use unsafe HTML rendering. CSP, no-store responses, no-referrer policy, noindex directives and same-origin resource loading limit incidental exposure. Robots/noindex directives are not access control. Never put tokens in query strings, HTTP path segments, analytics, third-party previews, customer exports, or logs. Never log customer prose, request bodies or session secrets. Do not persist bearer tokens in localStorage/sessionStorage. Allow only documented Turnstile protection resources where required; review pages must not load tracking or unnecessary remote resources.

Public creation and publishing require server-enforced protection where configured. Traffic and workspace/request limits are enforced server-side. Protection/storage failures return an error and do not create pretend records or share links. Free hosting does not mean unlimited capacity.

## Release gate and incident handling

Access-boundary failures block real-data release. See [QA](QA.md) for test evidence; do not relabel a failed release as example mode. If a capability is exposed, revoke or rotate its scope from an authorized owner session, revoke sessions when needed, and export retained evidence before deleting affected records. Do not post live capabilities in issues or public reproduction instructions.

Provider secrets and private database backups stay outside source. Preview/test databases must be separate from production; untrusted pull requests receive no production binding or secret. Retention, deletion and backup limits are documented separately in [Data retention](DATA-RETENTION.md).
