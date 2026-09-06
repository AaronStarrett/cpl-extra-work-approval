# Same-origin API contract

All times are server UTC ISO strings. API JSON responses are no-store. Mutating requests require an exact same-origin `Origin`, `Content-Type: application/json`, and `X-CPL-Request: 1` (including exchanges). Cookies are HttpOnly, Secure, SameSite=Strict. Errors are `{error: string, code: string}` with 400 validation, 401 no access, 404 absent/not owned, 409 stale/conflict, 429 limit, 503 storage/protection unavailable.

- `GET /api/config` → `{turnstileSiteKey: string|null, protectionRequired: boolean, retentionDays: number, defaultExpiryDays: 7}`. Test protection is only available with explicit nonproduction test settings.
- `GET /api/session` → `{workspace: {id,createdAt,settings}, csrf: '1'}` or 401. `settings` is `{businessName,businessContact,defaultExpiryDays}`.
- `POST /api/workspaces` `{turnstileToken?:string}` → 201 `{workspace, managementLink}` and owner cookie. Explicit action only. Link is `${origin}/recover#${token}`; the raw management token is returned once. A retry with an already valid owner cookie reuses that workspace and reissues its recovery link.
- `POST /api/recover` `{token}` → `{workspace}` and a new owner cookie. Does not change customer sessions.
- `PUT /api/settings` `{businessName,businessContact,defaultExpiryDays}` → `{workspace}`.
- `POST /api/recovery/rotate` `{}` → `{managementLink}` (invalidates old recovery link).
- `POST /api/sessions/revoke` `{}` → `{ok:true}` (revokes all owner sessions including this one; recovery link remains valid).
- `GET /api/requests` → `{requests: RequestSummary[], refreshedAt}`.
- `POST /api/requests` `{draft: DraftInput, idempotencyKey: UUID}` → 201 `{request: OwnerRequest}`.
- `GET /api/requests/:id` → `{request: OwnerRequest}`.
- `PUT /api/requests/:id` `{draft: DraftInput, revision: number}` → `{request: OwnerRequest}`. Optimistic revision required; edits after publication prepare the next version while preserving the visible prior response. Approved records cannot be edited; create separate request with `linkedRequestId`.
- `POST /api/requests/:id/publish` `{revision:number,expiryDays:number,idempotencyKey:UUID,turnstileToken?:string}` → `{request:OwnerRequest,customerLink:string}`. Link `${origin}/review/:versionId#${token}`. Snapshot immutable. Retries return the same version and a freshly rotated customer link only while awaiting response. `retainUntil` already visible on draft.
- `POST /api/requests/:id/revoke` `{revision:number}` → `{request:OwnerRequest}`. Revokes access to all current/historical review links without erasing recorded decisions.
- `POST /api/requests/:id/link/rotate` `{revision:number}` → `{request:OwnerRequest,customerLink}`. Reissues access to the current awaiting version, invalidating the previous review token and its sessions. Increments owner revision; copy the newly returned link.
- `DELETE /api/requests/:id` `{revision:number}` → `{ok:true}`.
- `GET /api/requests/:id/export` → owner JSON export containing request/versions/decisions, never token/session hashes.
- `GET /api/workspace/export` → owner JSON export of workspace records.
- `DELETE /api/workspace` `{confirmation:'DELETE'}` → `{ok:true}` and clear session.
- `POST /api/review/:versionId/exchange` `{token}` → `{review:ReviewRecord}` and a cookie scoped to `/api/review/:versionId`. Fragment removed by browser after exchange. Exchange is read-only for decisions.
- `GET /api/review/:versionId` → `{review:ReviewRecord}`.
- `POST /api/review/:versionId/decision` `{action:'approved'|'declined'|'changes_requested',respondentName:string,comment:string,acknowledged:boolean,idempotencyKey:UUID}` → `{review:ReviewRecord,receipt:Decision}`. Approval requires acknowledgment; changes require useful comment (10+ chars). Duplicate same idempotency key and exact payload returns original receipt even after finalization; conflicting attempt returns 409.
- `GET /api/review/:versionId/export` → customer JSON export, no owner notes/tokens. Browser Print / Save as PDF implemented by UI.

`DraftInput`, `Snapshot`, `OwnerRequest`, `RequestSummary`, `ReviewRecord`, `Decision` are exported from `shared/domain.ts`. Draft numeric values are actual integer cents/quantities; blank text fields and empty lines are allowed to save, strict completeness checked at publication. There is no client total or workspace ID field.

Request status: `draft | awaiting | approved | declined | changes_requested | revoked | expired`. Older published versions may be `superseded`. Request `revision` is a CAS value changed by owner edits, publishing, customer decisions, and revocation. Clients refetch on 409; do not silently retry stale writes. Poll only while document visible at >=15-second intervals.

Ledger summaries use the current published snapshot's title, customer, and amount whenever a version exists. `OwnerRequest.draft` separately holds the latest editable proposal. `PublishedVersion.accessRevoked` preserves access history independently of its response status: an approval remains approved after its review access is revoked.

Sessions last at most 7 days for owners, 24 hours for review, always bounded by capability/record expiry. Retention is normally 90 days from request creation. Expiration state is computed at read time and enforced again in atomic decision writes. Configurable hard limits apply server-side.

## Persistence invariants

One SQL statement inserts a published version. SQLite triggers validate its expected request revision, supersede old awaiting versions, advance the request, and write its event atomically. One SQL statement inserts a decision; triggers revalidate the exact session hash, current capability hash, session/link/record expiry, current version, and awaiting state before advancing state and inserting evidence. The version primary key on decisions prevents a second final response. Trigger failure rolls back the whole statement, including state and evidence. A batch with zero affected rows is checked explicitly and never presented as success.

Workspace and first session creation are a single D1 batch. Request insertion extends workspace availability to the newest retain-until date in a trigger. Revoking a review link changes access independently of an existing decision. API serialization uses explicit allowlisted fields; database authorization hashes never appear in exports. SHA-256 content hashes cover the exact serialized customer snapshot.

Every owner mutation uses a D1 batch that first inserts a short-lived authorization guard. Its trigger requires the exact owner session and workspace to remain unexpired at SQLite server time. The batch performs the mutation and deletes the guard atomically. Session revocation therefore prevents stalled requests from later rotating recovery links, publishing, editing, deleting, or reviving expired workspace retention. Insecure HTTP API requests are rejected before token handling in production; static HTTP navigation redirects to HTTPS without carrying its query string.

All random capabilities and sessions use 32 cryptographically random bytes; only SHA-256 hashes are stored. Session cookies are validated before database lookup. Request body size is capped at 64 KB, cookie headers at 16 KB, and one JSON export at 5 MB. Default server ceilings are 1,000 workspaces, 20 requests per workspace, 20 versions per request, 180 API requests per IP per minute, 5 public workspace creations per IP per hour, and 30 publications per workspace per hour. Smaller limits can be configured; storage errors fail closed. Rate keys store IP hashes rather than raw addresses and are purged after their rate window.
