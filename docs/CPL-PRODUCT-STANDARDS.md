# CPL Product Standards

Create docs/CPL-PRODUCT-STANDARDS.md and reference it from AGENTS.md. These owner instructions supersede earlier generic demo-first requirements:

- Standalone application URL = usable product, opening directly into the actual workflow. Portfolio project page = separate explanation/walkthrough with an Open Product link.
- Public GitHub repository by default; Cloudflare deployment; no secrets or customer data in source. Keep application URL and repository URL distinct. Public source and free hosting do not mean unlimited resources.
- Each product has a genuinely distinct visual style and interaction design. Do not reskin an earlier project's card/dashboard template.
- When an AI feature actually requires paid tokens, build Settings → AI Connections so the user connects their OWN key. No key means clearly labeled, prefilled fictional example mode for the AI-dependent feature. A validated connection enables real processing. Do not block the build waiting for Aaron's funded API key.
- User-supplied keys must be scoped to that user/workspace, securely handled by the backend, never stored in browser storage or source, and replaceable/disconnectable. Use an encrypted server-side secret vault or protected single-owner deployment configuration, with proper authorization and expiry/deletion. Never make one visitor's key a global credential for everyone. Explain provider billing and preserve usage controls.
- A connection is not permission to run arbitrary billable requests automatically. No canned response masquerades as live AI; do not silently substitute fixtures after a live error. Test with mocks until authorized real-provider verification is possible, and report those states separately.
- Non-AI workflows remain real without any AI key. THIS APP IS NON-AI: build working approvals now and do not add a pointless AI connector or key-gated sample mode. Future optional AI must not gate the approval workflow.
- Public product access does not mean public access to everyone's private records. Use appropriate scoped access even when visitors do not create accounts.
- Build/test/deploy independent products in parallel, but coordinate shared portfolio writes through one integration owner.
