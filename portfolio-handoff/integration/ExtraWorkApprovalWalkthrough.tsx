import { useState } from "react";
import StoryPlayer from "./StoryPlayer";
import "./extra-work-approval-walkthrough.css";

const branches = [
  { key: "extra-work-approval", label: "Approved example" },
  { key: "extra-work-approval-declined", label: "Declined example" },
  { key: "extra-work-approval-changes", label: "Changes requested example" },
] as const;

export default function ExtraWorkApprovalWalkthrough() {
  const [branch, setBranch] = useState<string>(branches[0].key);
  return (
    <section className="ewa-walkthrough" aria-label="Fictional Extra Work Approval walkthrough">
      <p className="ewa-sample-note">
        Fictional fencing example · $350 additional · one additional working day.
        Illustrative playback makes no live customer decision and sends no message.
      </p>
      <div className="ewa-branches" role="group" aria-label="Choose a fictional response branch">
        {branches.map((item) => (
          <button key={item.key} type="button" aria-pressed={branch === item.key} onClick={() => setBranch(item.key)}>
            {item.label}
          </button>
        ))}
      </div>
      <StoryPlayer key={branch} kind={branch} />
    </section>
  );
}
