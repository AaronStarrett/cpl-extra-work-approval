# Extra Work Approval · portfolio handoff

**Prepared for a separate integration owner. The shared portfolio was not modified, committed, pushed or deployed in this run.** Keep this package outside its published registry until release evidence and cleared captures are complete.

## Verified presentation baseline

Read-only verification on 2026-09-06 resolved `AaronStarrett/cpl-portfolio` remote `main` to **`6978d7fa1cfcbd52b1b85b54256f7feea979f6ae`**. The current schema, maintenance guide, stories, detail page, project card and package scripts were read directly at that commit. The primary local checkout was clean but older (`e8b4856cdeb114232c9253aba866981b9bba8b28`), so this handoff uses the remotely verified baseline. This is a dated snapshot; other product sessions may advance main.

Reference repository: [AaronStarrett/cpl-portfolio](https://github.com/AaronStarrett/cpl-portfolio). The previously known [portfolio origin](https://cpl-portfolio.pages.dev) is a maintenance reference; live site/browser verification is recorded separately from Git source verification. Do not infer a deployed commit from the source branch.

## Package files

| File | Purpose / eventual destination |
| --- | --- |
| `staging/project-entry.json` | Strict current-schema entry with **no unverified URLs**; insert through the current portfolio helper only after completing release fields/assets |
| `staging/fictional-fencing-request.json` | Synthetic source for the $350 gate walkthrough; never import automatically into a real workspace or public data registry |
| `integration/extra-work-approval-stories.ts` | Copy to `src/data/extra-work-approval-stories.ts`; three existing `Story`/`Scene`-compatible process configurations |
| `integration/ExtraWorkApprovalWalkthrough.tsx` | Copy to `src/components/ExtraWorkApprovalWalkthrough.tsx`; selectable fictional approval/decline/changes branches |
| `integration/extra-work-approval-walkthrough.css` | Copy to `src/components/extra-work-approval-walkthrough.css`; scoped notebook treatment only |
| `integration/INTEGRATION.md` | Focused source edits for registration, separate walkthrough/product actions and accurate screenshot copy |
| `STORYBOARD.md` | Scene/capture plan, captions, example boundaries and branch outcomes |
| `assets/README.md` | Capture/privacy requirements and cleared asset inventory |
| `verification.json` | Machine-readable dated source and release verification state; **not** a portfolio entry |

The staged entry uses only current fields. `presentation: "animated-story"` makes the primary action a local walkthrough, and `story: "extra-work-approval"` names the registered story. The existing schema separately supports `deployedUrl`, `repositoryUrl`, `repositoryPublic`, `access`, `launchMode`, `embedAllowed`, `maturity`, screenshots and verification date. It rejects unknown fields. Do not introduce `demoUrl`, `liveUrl`, custom outcome branches in the project entry, or fake URL placeholders.

## Release fields before insertion

The entry remains **staging**, with `access: "unverified"` and no invented product URL. The public repository URL is verified, and original local application captures from passing synthetic Workers/D1 browser tests are included. Maturity states local verification with deployment pending. Complete the real workers.dev `deployedUrl`, verified visitor access and deployed maturity only after release verification. Change `featuredOrder: 6` to the next appropriate free order on latest main, preserving the existing other products.

A schema-valid staging entry is not a publish-ready entry. Do not insert it just because it passes validation. If deployment remains blocked, retain this package outside the registry and state the exact infrastructure blocker. The story can describe the workflow illustratively without claiming a live release.

## Integration sequence (later, by one owner)

1. Use the current authorized portfolio checkout and inspect its clean/dirty state, branch, remote and current main. Read its latest `docs/MAINTENANCE.md`, `src/data/schema.ts`, story player and detail/card components. Reconcile this focused package with the other two sessions; do not assume one new commit means their work ended.
2. Verify this app's actual deployment identity and anonymous visitor access, and verify the distinct repository is public. Complete the fields above and retain evidence outside public content as appropriate.
3. Copy the three integration files, register all three story keys and apply the small component changes in `integration/INTEGRATION.md`. No schema extension or global theme change is required.
4. Copy only cleared captured images to `public/images/`, then add their real paths/alt text/captions to a finalized copy of `staging/project-entry.json`. Run `npm run add-project -- <absolute-path-to-finalized-entry.json>` from the portfolio root. Do not copy `verification.json` or the fictional draft into `projects.json`.
5. Run `npm run check`, `npm test`, and `npm run build`. Browser-check the index and `/projects/extra-work-approval/#walkthrough`, all three branches, Back to portfolio, keyboard focus, narrow layout, reduced motion, captions, and separate **Open Extra Work Approval** new-tab link. The product must start blank.
6. Review a focused diff and staged public files. Preserve the other projects, existing source and Pages settings. Commit/push/deploy only in the integration owner's separately authorized run using the established Cloudflare Pages workflow. Verify the resulting public route and launch destination after deployment.

Handoff validation passed against the strict schema and Story/Scene types fetched at the verified remote commit, using an ignored local copy. No shared portfolio build, browser integration check or publication is claimed; this build delivers the independent application and handoff.
