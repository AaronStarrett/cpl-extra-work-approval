# Fictional fencing walkthrough storyboard

All people, business details, identifiers and amounts below are fictional. **$350 is an illustrative additional amount, not a recommended market rate.** The declared schedule impact is **one additional working day**. There is no invented completion date, original-contract total or collected revenue.

The staged draft is in `staging/fictional-fencing-request.json`. It has no active capability. Do not auto-load it on the product homepage. Use a fresh test workspace for actual UI captures, and keep the management link outside the capture area.

| Beat | View / exact content | Suggested public caption | Proposed cleared capture filename |
| --- | --- | --- | --- |
| 1 | Composer: Juniper Fence Co. (fictional), Morgan Example (fictional), job FENCE-104, one matching timber side gate | “Fictional work order FENCE-104 records the extra side-gate scope before work starts.” | `extra-work-approval-composer.png` |
| 2 | Line item: quantity 1 × $350; subtotal $350; entered tax $0; total additional $350; one additional working day | “Sample pricing: $350 additional and one additional working day. Figures are fictional.” | `extra-work-approval-price.png` |
| 3 | Read-only customer preview with included work, exclusions and timing | “The customer-facing preview keeps scope, exclusions, additional amount and declared timing together.” | `extra-work-approval-preview.png` |
| 4 | Published version and successful copy confirmation, with no raw link/control exposing a secret | “A customer review link is copied after publication. Copying does not send a message.” | `extra-work-approval-copy.png` |
| 5 | Independent phone customer view with exact version, amount and all three response choices | “A private, single-column decision document gives the customer clear approval, change-request and decline choices.” | `extra-work-approval-customer-phone.png` |
| 6 | Approval acknowledgment and final confirmation before submission | “Approval requires an initially unchecked acknowledgment, a typed name and a final confirmation.” | `extra-work-approval-confirm.png` |
| 7A | Real synthetic server receipt, only if actually captured after committed response | “Synthetic verification: a server-recorded response stays attached to the exact published version.” | `extra-work-approval-receipt.png` |
| 8A | Owner ledger refreshed from database; record export controls | “The contractor sees the stored response and can export the versioned record.” | `extra-work-approval-ledger.png` |
| 7B | Separate declined branch: “We will leave the gate out for now.” | “Fictional declined branch: the record shows Declined and does not authorize extra work.” | `extra-work-approval-declined.png` |
| 7C | Separate requested-change branch: “Please use a latch that can be opened from both sides.” | “Fictional changes-requested branch: the comment needs review; a revised version needs a fresh decision.” | `extra-work-approval-changes.png` |
| 9 | Printable exact-version receipt, version, total, server UTC/local timezone labeling and retention | “Browser Print / Save as PDF prepares a readable record. The contractor controls saving and retention of their copy.” | `extra-work-approval-print.png` |

These filenames are **capture targets**, not claims that files exist. Register only actual cleared files listed in `assets/README.md` and verified in the final entry.

The standard story configuration shows eight approved-branch scenes and seven scenes in each other branch. Each scene explicitly labels illustration/fictional data; all decisions are playback unless captions refer to an actually executed synthetic test. Declined and changes-requested branches stop at their own outcome. They never automatically continue to approval.

Names and contact details are declarations, not verified identities. No story or caption should claim legal enforceability, certified signature, payment, delivery, business results or actual customer consent. Capture server-confirmed receipts only; client animation, print dialog closure, or a page fetch is not evidence of those outcomes.
