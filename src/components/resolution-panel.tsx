"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { proposeResolution, voteOnResolution } from "@/lib/actions/resolutions";
import { formatZurich } from "@/lib/dates";

interface Vote {
  userId: string;
  agree: boolean;
  comment: string | null;
  user: { name: string };
}

interface Resolution {
  id: string;
  proposedOutcome: "YES" | "NO" | "VOID";
  proposedBy: string;
  proposer: { name: string };
  evidenceUrl: string | null;
  evidenceNote: string | null;
  status: "PROPOSED" | "CONFIRMED" | "DISPUTED";
  confirmedAt: Date | null;
  createdAt: Date;
  votes: Vote[];
}

const RESOLVABLE_STATUSES = ["ACTIVE", "AWAITING_RESOLUTION", "DISPUTED"];
const OUTCOME_COLOR: Record<string, string> = {
  YES: "text-verre",
  NO: "text-marc",
  VOID: "text-lees",
};

function ResolutionCard({
  resolution,
  positionUserIds,
  currentUserId,
}: {
  resolution: Resolution;
  positionUserIds: string[];
  currentUserId: string;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const myVote = resolution.votes.find((v) => v.userId === currentUserId);
  const isProposer = resolution.proposedBy === currentUserId;
  const confirmedCount = resolution.votes.filter((v) => v.agree).length;

  function vote(agree: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await voteOnResolution(resolution.id, agree, comment || undefined);
      if (!result.ok) {
        setError(result.errors?.[0] ?? "Couldn't record your vote.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="bg-rack border border-craie/15 rounded-sm px-4 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className={`font-utility text-sm font-medium ${OUTCOME_COLOR[resolution.proposedOutcome]}`}>
          {resolution.proposedOutcome}
        </span>
        <span className="font-utility text-xs text-lees">
          {resolution.status === "PROPOSED"
            ? `${confirmedCount} of ${positionUserIds.length} confirmed`
            : resolution.status === "CONFIRMED"
              ? `Confirmed ${formatZurich(resolution.confirmedAt)}`
              : "Disputed"}
        </span>
      </div>

      <p className="text-lees text-xs">Called by {resolution.proposer.name}</p>

      {resolution.evidenceUrl && (
        <a
          href={resolution.evidenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-verre text-sm hover:underline break-all"
        >
          {resolution.evidenceUrl}
        </a>
      )}
      {resolution.evidenceNote && (
        <p className="text-craie text-sm">{resolution.evidenceNote}</p>
      )}

      {resolution.votes.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-craie/10 pt-2">
          {resolution.votes.map((v) => (
            <div key={v.userId} className="text-xs">
              <span className={v.agree ? "text-verre" : "text-marc"}>
                {v.user.name} {v.agree ? "confirmed" : "disputed"}
              </span>
              {v.comment && <span className="text-lees"> — {v.comment}</span>}
            </div>
          ))}
        </div>
      )}

      {resolution.status === "PROPOSED" && !isProposer && !myVote && (
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
              onClick={() => vote(false)}
              className="flex-1 border border-marc/50 text-marc rounded-sm px-4 py-2 text-sm hover:bg-marc/10 transition-colors disabled:opacity-50"
            >
              Dispute
            </button>
            <button
              disabled={pending}
              onClick={() => vote(true)}
              className="flex-1 bg-verre text-cave rounded-sm px-4 py-2 text-sm font-medium hover:brightness-110 transition-colors disabled:opacity-50"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {resolution.status === "PROPOSED" && isProposer && (
        <p className="font-utility text-xs text-lees">Waiting on the others to confirm.</p>
      )}

      {error && <p className="text-marc text-xs">{error}</p>}
    </div>
  );
}

export function ResolutionPanel({
  betId,
  slug,
  betStatus,
  resolutions,
  positionUserIds,
  currentUserId,
}: {
  betId: string;
  slug: string;
  betStatus: string;
  resolutions: Resolution[];
  positionUserIds: string[];
  currentUserId: string;
}) {
  const latest = resolutions[0];
  const hasOpenProposal = latest?.status === "PROPOSED";
  const isParticipant = positionUserIds.includes(currentUserId);
  const canPropose =
    !hasOpenProposal && RESOLVABLE_STATUSES.includes(betStatus) && isParticipant;

  const [expanded, setExpanded] = useState(false);
  const [outcome, setOutcome] = useState<"YES" | "NO" | "VOID" | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!outcome) return;
    setErrors([]);
    startTransition(async () => {
      const result = await proposeResolution(betId, {
        outcome,
        evidenceUrl: evidenceUrl || undefined,
        evidenceNote: evidenceNote || undefined,
      });
      if (!result.ok) {
        setErrors(result.errors ?? ["Couldn't call this bet."]);
        return;
      }
      setExpanded(false);
      router.push(`/bets/${slug}`);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm text-lees">Resolution</h2>

      {latest && (
        <ResolutionCard
          resolution={latest}
          positionUserIds={positionUserIds}
          currentUserId={currentUserId}
        />
      )}

      {canPropose && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-verre text-sm hover:underline self-start"
        >
          Call it
        </button>
      )}

      {canPropose && expanded && (
        <div className="bg-rack border border-craie/15 rounded-sm px-4 py-4 flex flex-col gap-3">
          <div className="flex gap-3">
            {(["YES", "NO", "VOID"] as const).map((o) => (
              <button
                key={o}
                onClick={() => setOutcome(o)}
                className={`flex-1 rounded-sm px-3 py-2 border text-sm font-medium transition-colors ${
                  outcome === o
                    ? "border-verre bg-verre/10 text-verre"
                    : "border-craie/15 bg-cave text-craie"
                }`}
              >
                {o}
              </button>
            ))}
          </div>
          <input
            type="url"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="Evidence URL (strongly encouraged)"
            className="bg-cave border border-craie/15 rounded-sm px-3 py-2 text-craie text-sm placeholder:text-lees/60 focus:outline-none focus:ring-1 focus:ring-verre"
          />
          <textarea
            value={evidenceNote}
            onChange={(e) => setEvidenceNote(e.target.value)}
            placeholder="Note (optional)"
            rows={2}
            className="bg-cave border border-craie/15 rounded-sm px-3 py-2 text-craie text-sm placeholder:text-lees/60 focus:outline-none focus:ring-1 focus:ring-verre resize-none"
          />
          {errors.length > 0 && (
            <ul className="text-marc text-xs flex flex-col gap-1">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setExpanded(false)}
              className="flex-1 text-lees text-sm py-2"
            >
              Cancel
            </button>
            <button
              disabled={!outcome || pending}
              onClick={submit}
              className="flex-1 bg-verre text-cave rounded-sm px-4 py-2 text-sm font-medium hover:brightness-110 transition-colors disabled:opacity-40"
            >
              {pending ? "Calling…" : "Submit call"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
