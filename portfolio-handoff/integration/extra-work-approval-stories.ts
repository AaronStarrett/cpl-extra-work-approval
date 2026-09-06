import type { Story, Scene } from "./stories";

const common: Scene[] = [
  {
    title: "One extra request, written clearly",
    caption: "Fictional work order FENCE-104: Morgan Example asks Juniper Fence Co. for a side gate during the garden-fence job. The app itself always starts blank.",
    duration: 8500,
    nodes: ["FENCE-104 · fictional job", "One matching timber side gate", "Gate, hinges, latch and installation"],
  },
  {
    title: "The added amount and timing",
    caption: "$350 is a fictional additional amount, not a recommended market price or original contract total. This sample explicitly declares one additional working day; the entered tax amount is $0.",
    duration: 8500,
    nodes: ["Subtotal $350.00", "Entered tax $0.00 · total additional $350.00", "One additional working day"],
  },
  {
    title: "Review before publishing",
    caption: "The read-only preview shows the scope, included work and exclusions together. No powered opener, lock installation, painting or changes to the remaining fence are included. Private owner notes are excluded.",
    duration: 9000,
    nodes: ["Customer document preview", "Included work and exclusions", "No customer decision in preview"],
  },
  {
    title: "Publish a specific version, then copy",
    caption: "This illustrated step freezes version 1 and shows the customer-link copy action. The portfolio sends no message and contains no functional customer or management token. Copying is not delivery.",
    duration: 8500,
    nodes: ["Version 1 · published snapshot", "Customer link copied · illustration", "Private management link stays with contractor"],
  },
  {
    title: "A calm document on the customer's phone",
    caption: "The customer reviews the exact scope, $350 additional amount and one additional working day. Approve, Request changes and Decline remain visible. Playback does not submit a live response.",
    duration: 9000,
    nodes: ["Scope and exclusions", "$350 additional · one extra working day", "Approve / Request changes / Decline"],
  },
];

export const extraWorkApprovalStories: Record<string, Story> = {
  "extra-work-approval": {
    renderer: "process",
    label: "Fictional fencing walkthrough · illustrated approved branch · no live actions",
    scenes: [
      ...common,
      {
        title: "A deliberate approval",
        caption: "In this sample, Morgan Example types their name, checks an initially unselected acknowledgment of the scope, additional amount and timing, then confirms the response. A typed name is a declaration, not verified identity.",
        duration: 9500,
        nodes: ["Name entered: Morgan Example", "Specific acknowledgment selected", "Final confirmation: Approve extra work"],
      },
      {
        title: "The server response establishes the result",
        caption: "The actual product displays a receipt only after a committed server response. This illustrated receipt represents Approved for FENCE-104 version 1; it is not an actual customer's approval or a live provider event.",
        duration: 8500,
        nodes: ["FENCE-104 · version 1", "Approved · illustrated sample", "Server timestamp belongs in the real receipt"],
      },
      {
        title: "Keep the version and response together",
        caption: "The contractor refreshes the ledger, exports the stored record, and can use browser Print / Save as PDF. Hosted retention is limited; keep your own copy. An approved request is not money collected or proof of payment.",
        duration: 9000,
        nodes: ["Ledger: Approved · version 1", "Exact version and response export", "Print / Save as PDF · owner controlled"],
      },
    ],
  },
  "extra-work-approval-declined": {
    renderer: "process",
    label: "Fictional fencing walkthrough · illustrated declined branch · no live actions",
    scenes: [
      ...common,
      {
        title: "The customer declines",
        caption: "Morgan Example selects Decline and optionally explains: “We will leave the gate out for now.” Decline remains a clear choice; no approval acknowledgment is implied.",
        duration: 9000,
        nodes: ["Decline", "We will leave the gate out for now.", "Confirm the declined response"],
      },
      {
        title: "Declined is the recorded outcome",
        caption: "This sample branch ends with a declined version 1. It does not continue into an approval or permission to start the extra work. The response remains attached to that version in the export.",
        duration: 9000,
        nodes: ["FENCE-104 · version 1", "Declined · illustrated sample", "Record retained; no approval granted"],
      },
    ],
  },
  "extra-work-approval-changes": {
    renderer: "process",
    label: "Fictional fencing walkthrough · illustrated changes-requested branch · no live actions",
    scenes: [
      ...common,
      {
        title: "The customer asks for a change",
        caption: "Morgan Example selects Request changes and writes: “Please use a latch that can be opened from both sides.” A useful comment explains what needs another review.",
        duration: 9000,
        nodes: ["Request changes", "Latch opens from both sides", "Confirm the requested-change response"],
      },
      {
        title: "A fresh version needs a fresh decision",
        caption: "Changes requested is not approval. Version 1 and its comment remain in history. If the contractor revises the proposal, the next published version needs its own customer decision; this branch stops here.",
        duration: 9500,
        nodes: ["Version 1: Changes requested", "Historical response preserved", "Any revised version awaits a fresh decision"],
      },
    ],
  },
};
