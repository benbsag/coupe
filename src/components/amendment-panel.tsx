"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { voteOnAmendment, withdrawAmendment } from "@/lib/actions/amendments";
import { formatZurich } from "@/lib/dates";

interface AmendmentPanelProps {
  slug: string;
  amendment: {
    id: string;
    reason: string;
    proposedBy: string;
    proposer: { name: string };
    proposedPayload: {
      kind: string;
      statement: string;
      terms: string;
      resolutionCriteria: string;
      resolutionDate: string | null;
      longStopDate: string | null;
      stakeNote: string | null;
    };
    votes: { userId: string; decision: "APPROVE" | "REJECT"; user: { name: string } }[];
  };
  currentBet: {
    kind: string;
    statement: string;
    terms: string;
    resolutionCriteria: string;
    resolutionDate: Date | null;
    longStopDate: Date | null;
    stakeNote: string | null;
  };
  positionUserIds: string[];
  currentUserId: string;
}

const KIND_LABEL: Record<string, string> = {
  FIXED_DATE: "Fixed date",
  EVENT_TRIGGERED: "Event-triggered",
  CONTINGENT: "Contingent",
};

function fieldRows(
  current: AmendmentPanelProps["currentBet"],
  proposed: AmendmentPanelProps["amendment"]["proposedPayload"]
) {
  const rows: { label: string; from: string; to: string }[] = [];
  const push = (label: string, from: string, to: string) => {
    if (from !== to) rows.push({ label, from, to });
  };

  push("Statement", current.statement, proposed.statement);
  push("Kind", KIND_LABEL[current.kind], KIND_LABEL[proposed.kind]);
  push("Terms", current.terms, proposed.terms);
  push("What counts as YES", current.resolutionCriteria, proposed.resolutionCriteria);
  push(
    "Resolution date",
    formatZurich(current.resolutionDate),
    formatZurich(proposed.resolutionDate ? new Date(proposed.resolutionDate) : null)
  );
  push(
    "Long-stop date",
    formatZurich(current.longStopDate),
    formatZurich(proposed.longStopDate ? new Date(proposed.longStopDate) : null)
  );
  push("Stake note", current.stakeNote ?? "—", proposed.stakeNote ?? "—");

  return rows;
}

export function AmendmentPanel({
  slug,
  amendment,
  currentBet,
  positionUserIds,
  currentUserId,
}: AmendmentPanelProps) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const rows = fieldRows(currentBet, amendment.proposedPayload);
  const approvedCount = amendment.votes.filter((v) => v.decision === "APPROVE").length;
  const myVote = amendment.votes.find((v) => v.userId === currentUserId);
  const isProposer = amendment.proposedBy === currentUserId;

  function vote(decision: "APPROVE" | "REJECT") {
    setError(null);
    startTransition(async () => {
      const result = await voteOnAmendment(amendment.id, decision, comment || undefined);
      if (!result.ok) {
        setError(result.errors?.[0] ?? "Couldn't record your vote.");
        return;
      }
      router.refresh();
    });
  }

  function withdraw() {
    setError(null);
    startTransition(async () => {
      const result = await withdrawAmendment(amendment.id);
      if (!result.ok) {
        setError(result.errors?.[0] ?? "Couldn't withdraw this amendment.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="bg-rack border border-verre/40 rounded-sm px-4 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-verre font-medium">
          Pending amendment — proposed by {amendment.proposer.name}
        </h2>
        <span className="font-utility text-xs text-lees">
          {approvedCount} of {positionUserIds.length} approved
        </span>
      </div>

      <p className="text-craie text-sm">{amendment.reason}</p>

      {rows.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-craie/10 pt-3">
          {rows.map((row) => (
            <div key={row.label} className="text-sm">
              <div className="text-lees text-xs mb-0.5">{row.label}</div>
              <div className="text-marc line-through decoration-marc/50">{row.from}</div>
              <div className="text-capsule">{row.to}</div>
            </div>
          ))}
        </div>
      )}

      {isProposer ? (
        <button
          disabled={pending}
          onClick={withdraw}
          className="text-marc text-sm hover:underline self-start disabled:opacity-50"
        >
          {pending ? "Withdrawing…" : "Withdraw amendment"}
        </button>
      ) : myVote ? (
        <p className="font-utility text-xs text-lees">
          You {myVote.decision === "APPROVE" ? "approved" : "rejected"} this.
        </p>
      ) : (
        <div className="flex flex-col gap-2 border-t border-craie/10 pt-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment"
            rows={2}
            className="bg-cave border border-craie/15 rounded-sm px-3 py-2 text-craie text-sm placeholder:text-lees/60 focus:outline-none focus:ring-1 focus:ring-verre resize-none"
          />
          <div className="flex gap-3">
            <button
              disabled={pending}
              onClick={() => vote("REJECT")}
              className="flex-1 border border-marc/50 text-marc rounded-sm px-4 py-2 text-sm hover:bg-marc/10 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
            <button
              disabled={pending}
              onClick={() => vote("APPROVE")}
              className="flex-1 bg-verre text-cave rounded-sm px-4 py-2 text-sm font-medium hover:brightness-110 transition-colors disabled:opacity-50"
            >
              Approve
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-marc text-xs">{error}</p>}
    </section>
  );
}
