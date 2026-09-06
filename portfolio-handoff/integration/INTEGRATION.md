# Focused integration against the verified portfolio baseline

Baseline: `6978d7fa1cfcbd52b1b85b54256f7feea979f6ae`. These are **instructions, not an automatically applied patch**; the shared repository is read-only in the current run. Rebase the edits on current main and preserve concurrent additions.

## 1. Register standard story configurations

Copy `extra-work-approval-stories.ts` to `src/data/`. It imports the existing `Scene` and `Story` types only. In `src/data/stories.ts`, add:

```ts
import { extraWorkApprovalStories } from "./extra-work-approval-stories";
```

Inside the existing `stories` object, append:

```ts
...extraWorkApprovalStories,
```

No `Story`/`Scene` fields or renderer values are added. Each branch uses the supported `process` renderer with `title`, `caption`, `duration` and optional `nodes`. The small branch component changes the story key; it contains no server/API calls, capabilities or live approval behavior.

## 2. Mount the branch selector for this project only

Copy `ExtraWorkApprovalWalkthrough.tsx` and `extra-work-approval-walkthrough.css` to `src/components/`. Add this import to `src/pages/projects/[slug].astro`:

```ts
import ExtraWorkApprovalWalkthrough from "../../components/ExtraWorkApprovalWalkthrough";
```

Extend the existing story render conditional with a branch after the workforce branch and before the generic `StoryPlayer` branch:

```astro
) : p.story === "extra-work-approval" ? (
  <ExtraWorkApprovalWalkthrough client:load />
) : (
```

Keep existing dedicated renderers unchanged. The existing player owns progress, pause/play, captions and scene timing. The wrapper resets playback when the user switches fictional branches. Verify current player lifecycle, offscreen/hidden pause, keyboard and reduced motion in the integrated build.

## 3. Keep Watch walkthrough and Open Extra Work Approval separate

The current `primaryAction()` already gives an `animated-story` entry a local walkthrough link, even when `deployedUrl` is present. Preserve that behavior and keep `deployedUrl` distinct from `repositoryUrl`.

In `src/pages/projects/[slug].astro`, broaden **only the first external-project section condition** from `p.presentation === "external-live-app"` to:

```ts
p.presentation === "external-live-app" ||
  (p.slug === "extra-work-approval" && p.deployedUrl && p.access === "public")
```

Use a product-specific button label inside that section:

```astro
{p.slug === "extra-work-approval" ? "Open Extra Work Approval" : action.label} ↗
```

The URL stays `p.deployedUrl`, `target="_blank"` and `rel="noopener noreferrer"`. Do not change the separate embed condition or enable framing. Do not label the live-product button `Watch walkthrough` merely because `action.label` describes the animated primary action.

In `src/components/ProjectCard.astro`, add an extra anchor beside the existing primary action/case-study actions only when the same Extra Work Approval slug has a verified public `deployedUrl`:

```astro
{p.slug === "extra-work-approval" && p.deployedUrl && p.access === "public" && (
  <a href={p.deployedUrl} target="_blank" rel="noopener noreferrer">
    Open Extra Work Approval ↗
  </a>
)}
```

This uses existing schema fields and does not change another project's launch behavior. The staged entry intentionally lacks `deployedUrl` while deployment is pending; do not insert an invented address just to render a button.

## 4. Screenshot copy must describe its source accurately

The current detail page assumes animated stories use original workflow diagrams. For this slug only, change its gallery eyebrow to **“FICTIONAL EXAMPLE IN THE APPLICATION”** and its explanatory paragraph to **“Original application captures using a fictional fencing request. Captions distinguish local verification from deployed verification; no real customer data or active links are shown.”** Retain the existing wording for other projects.

Populate screenshots only after assets are cleared. Local UI captures must not inherit copy saying they were captured from the deployed application. Branch configuration is illustrative playback; a screenshot of an actual synthetic D1 decision may support that specific test only.

## 5. Validation and public review

Add focused checks for a local walkthrough href, a separate HTTPS product href, a distinct public repository href, three valid story keys, no missing assets, and no accidental modification to other entries. Run the existing portfolio commands and browser checks listed in the handoff README. Do not add CI, globally restyle the site, or publish functional bearer links.
