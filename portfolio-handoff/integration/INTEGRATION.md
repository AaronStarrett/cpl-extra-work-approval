# Focused integration against the verified portfolio baseline

Baseline: `575d6e373cc9d0e7544e84b750099f17c1e18881`, refreshed read-only on 2026-09-06. These are **instructions, not an automatically applied patch**; the shared repository is read-only in the current run. Rebase the edits on current main and preserve concurrent additions.

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

The refreshed baseline already implements both actions. `primaryAction()` gives this `animated-story` entry `/projects/extra-work-approval/#walkthrough`; `productAction()` gives it **Open Extra Work Approval** at its distinct verified `deployedUrl`. Both the project card and detail page already render the product action in a new tab with `rel="noopener noreferrer"`. The source repository remains a separate link.

Reuse that shared behavior. No schema, project-card or launch-section edit is needed. In particular, do not apply the older handoff's extra anchor or broaden the external-only project section: either would duplicate the product action in this baseline. Keep embedding disabled and pass no fictional data, example parameters or capabilities to the application URL.

The staged entry contains the verified application origin `https://cpl-extra-work-approval.astarrett.workers.dev`. In the integrated build, verify the local walkthrough, separate product button and separate source link resolve to their intended destinations.

## 4. Screenshot copy must describe its source accurately

The refreshed detail page already labels an animated entry with a deployed URL as **THE APPLICATION**, and explains that its screenshots use fictional data and that captions provide context. Reuse this wording; no gallery conditional edit is needed.

Copy the cleared original assets and preserve their explicit local/synthetic captions. These images were captured from local Workers/D1, even though the application is now deployed. Branch configuration is illustrative playback; a screenshot of an actual synthetic D1 decision supports that specific test only.

## 5. Validation and public review

Add focused checks for a local walkthrough href, a separate HTTPS product href, a distinct public repository href, three valid story keys, no missing assets, and no accidental modification to other entries. Run the existing portfolio commands and browser checks listed in the handoff README. Do not add CI, globally restyle the site, or publish functional bearer links.
