# A premium work-order notebook

Extra Work Approval has one central object: the document the contractor and customer need to understand. Warm paper (`#F5F1E8`), graphite (`#242A2E`), burnt copper (`#9C4226`) and restrained moss (`#365B44`) make the product feel like a carefully prepared work order. Hairlines and generous margins organize numbered sections and clean item rows. The additional amount is a compact document total, never a revenue metric.

The layout uses a thin notebook navigation strip, centered composer and a tidy ledger with reference, job, date, added amount and response state. There is no sidebar/KPI dashboard composition. The customer's phone receives a single-column decision document; contractor identity, scope, exclusions, amount and declared timing precede response controls.

Editorial headings use the licensed typefaces included by the implementation or the declared local fallbacks. Amounts use tabular numerals. Preserve bundled font notices and use no unnecessary remote font services on private pages. CPL ownership stays in the supplied name/wordmark treatment; this theme does not redesign the shared portfolio or adjacent apps.

Approve, Request changes and Decline remain easy to find. Approval acknowledgment starts unchecked. Confirmation repeats the actual scope/version, additional amount and timing. Error messages preserve recoverable input and explain stale state. A server-confirmed response can receive a restrained seal; there is no confetti or implied booked revenue.

Transitions should last roughly 180–280 ms and explain real changes such as adding an item or resolving a save. Clipboard confirmation follows successful clipboard access. Reduced-motion users receive the same information without motion. Keyboard focus, sufficient contrast for every actual text/control pairing, long text, narrow screens and selectable print records are release checks, not assumptions based on a palette.

See [QA](QA.md) for executed visual/contrast/print verification. Palette values alone do not establish accessible implementation.

## Source-based contrast review — 2026-09-06

Reviewed actual authored CSS foreground/background pairs shared by the composer, ledger, settings, customer document, response controls, errors and receipts. Ratios below use the WCAG sRGB relative-luminance calculation; they are source measurements, not a claim that every browser state has received an accessibility audit.

| Pair | Contrast |
| --- | ---: |
| Graphite text / paper | 12.89:1 |
| Muted text / paper | 5.65:1 |
| Muted text / copper-pale (lowest assessed muted pairing) | 5.21:1 |
| Placeholder text / input sheet | 5.17:1 |
| Copper text or focus border / paper | 5.78:1 |
| Copper focus border / selected copper-pale | 5.33:1 |
| Primary button label / copper | 6.37:1 |
| Primary button label / hover copper | 8.15:1 |
| Approval button label / moss | 7.67:1 |
| Danger button label / red | 7.69:1 |
| Lowest assessed status/receipt text pairing | 5.74:1 |
| Error text / error background | 8.21:1 |
| Control border `#8B7E6D` / paper | 3.51:1 |
| Control border `#8B7E6D` / soft hover surface | 3.27:1 |
| Approval-option border `#617C59` / paper | 4.11:1 |

The assessed semantic text combinations exceed 4.5:1. Form fields, secondary buttons, schedule choices and decision choices use a separate darker control border; the former decorative hairline color reached only 1.93:1 against paper. Decorative notebook rules, nonessential seal outlines and disabled controls are excluded from the control-boundary claim. Focus uses a solid copper border/outline; the translucent supplemental halo is not relied on for contrast.

This source review does not certify platform-native checkbox/radio rendering, the third-party Turnstile widget, or unvisited browser states. See QA for the separately executed customer-page Axe scan, keyboard, mobile and print checks.