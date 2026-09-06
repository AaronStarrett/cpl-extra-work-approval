# Hosted retention, export, and deletion

The default target is **90 days of hosted availability from request creation**, including drafts. The server supplies the exact `retainUntil` timestamp. Show it on owner records and before publication. Editing, responding, or publishing a new version does not silently restart that record's retention clock.

Review links default to **seven days**, configurable only up to the record's remaining retention period. Link expiry prevents further review/decision access. It is different from removing the stored request and history. Revoking access preserves an already recorded genuine decision until explicit deletion or retention expiry.

Owner exports contain the workspace/request data and retained versions/responses. Customer exports contain only the exact visible published version and its response, with no private owner notes or management/session material. Both include server UTC evidence; browser displays may show the viewer's local timezone. A content hash identifies the stored snapshot; it is not an identity certification or independent notarization.

Use **Export record**, **Export workspace**, and **Print / Save as PDF** before the retention boundary. Browser printing opens a user-controlled dialog; previewing/closing it is not proof of a saved PDF. The hosted copy is not a substitute for the contractor retaining their own decision record.

An authorized owner may explicitly delete a request or the entire workspace. Deletion removes application-accessible data through the database's related-record cleanup. A bounded scheduled purge removes eligible expired data in batches. Reads and decisions enforce retention boundaries even if a scheduled purge has not yet run. Configure retention and resource limits explicitly for any future contracted deployment.

Deletion from the live application does not promise instant erasure from provider recovery systems or private release backups. Cloudflare's applicable backup/recovery retention depends on the account/product configuration; inspect current settings before making a customer promise. Operator exports must be stored privately with a documented owner, purpose and deletion date. Never commit a live database, recovery secret, or customer export to public GitHub.
