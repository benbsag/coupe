import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { getBetBySlug } from "@/lib/queries/bets";
import { Header } from "@/components/header";
import { PressureGauge } from "@/components/pressure-gauge";
import { WithdrawButton } from "@/components/withdraw-button";
import { AmendmentPanel } from "@/components/amendment-panel";
import { ResolutionPanel } from "@/components/resolution-panel";
import { SettlementsList } from "@/components/settlements-list";
import { CommentsSection } from "@/components/comments-section";
import { shortHash } from "@/lib/hash";
import { formatZurich } from "@/lib/dates";
import { gaugeTarget, initials, statusColorClass, statusLabel } from "@/lib/bet-display";

const KIND_LABEL: Record<string, string> = {
  FIXED_DATE: "Fixed date",
  EVENT_TRIGGERED: "Event-triggered",
  CONTINGENT: "Contingent",
};

const AMENDABLE_STATUSES = ["ACTIVE", "AWAITING_RESOLUTION", "DISPUTED"];

export default async function BetDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { slug } = await params;
  const bet = await getBetBySlug(slug);
  if (!bet) notFound();

  const hasPosition = bet.positions.some((p) => p.userId === user.id);
  if (!hasPosition && (bet.status === "DRAFT" || bet.status === "PROPOSED")) {
    redirect(`/bets/${slug}/accept`);
  }

  const target = gaugeTarget(bet);
  const canWithdraw =
    bet.createdBy === user.id && (bet.status === "DRAFT" || bet.status === "PROPOSED");

  const openAmendment = bet.amendments.find((a) => a.status === "OPEN");
  const canProposeAmendment =
    hasPosition && AMENDABLE_STATUSES.includes(bet.status) && !openAmendment;

  return (
    <div className="flex flex-col flex-1">
      <Header />
      <main className="flex-1 px-4 py-6 max-w-2xl w-full mx-auto flex flex-col gap-8">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-utility text-xs text-lees">{KIND_LABEL[bet.kind]}</span>
            <span className={`font-utility text-xs ${statusColorClass(bet.status)}`}>
              {statusLabel(bet.status)}
            </span>
          </div>
          <h1 className="font-display text-2xl text-craie leading-tight">{bet.statement}</h1>
        </div>

        {bet.lockedAt && target && (
          <div>
            <PressureGauge lockedAt={bet.lockedAt} targetDate={target} size="lg" />
            <div className="flex justify-between mt-1 font-utility text-xs text-lees">
              <span>Locked {formatZurich(bet.lockedAt)}</span>
              <span>{formatZurich(target)}</span>
            </div>
          </div>
        )}

        <section className="flex flex-col gap-1">
          <h2 className="text-sm text-lees">Terms</h2>
          <p className="text-craie whitespace-pre-wrap">{bet.terms}</p>
        </section>

        <section className="flex flex-col gap-1">
          <h2 className="text-sm text-lees">What counts as YES</h2>
          <p className="text-craie whitespace-pre-wrap">{bet.resolutionCriteria}</p>
        </section>

        {bet.stakeNote && (
          <section className="flex flex-col gap-1">
            <h2 className="text-sm text-lees">Stake note</h2>
            <p className="text-craie">{bet.stakeNote}</p>
          </section>
        )}

        {openAmendment && (
          <AmendmentPanel
            slug={bet.slug}
            amendment={{
              id: openAmendment.id,
              reason: openAmendment.reason,
              proposedBy: openAmendment.proposedBy,
              proposer: { name: openAmendment.proposer.name },
              proposedPayload: openAmendment.proposedPayload as {
                kind: string;
                statement: string;
                terms: string;
                resolutionCriteria: string;
                resolutionDate: string | null;
                longStopDate: string | null;
                stakeNote: string | null;
              },
              votes: openAmendment.votes.map((v) => ({
                userId: v.userId,
                decision: v.decision,
                user: { name: v.user.name },
              })),
            }}
            currentBet={{
              kind: bet.kind,
              statement: bet.statement,
              terms: bet.terms,
              resolutionCriteria: bet.resolutionCriteria,
              resolutionDate: bet.resolutionDate,
              longStopDate: bet.longStopDate,
              stakeNote: bet.stakeNote,
            }}
            positionUserIds={bet.positions.map((p) => p.userId)}
            currentUserId={user.id}
          />
        )}

        <section className="flex flex-col gap-2">
          <h2 className="text-sm text-lees">Positions</h2>
          <div className="flex flex-col gap-2">
            {bet.positions.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-rack rounded-sm px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-cave border border-craie/15 text-xs font-utility flex items-center justify-center text-craie">
                    {initials(p.user.name)}
                  </span>
                  <span className="text-craie text-sm">{p.user.name}</span>
                </div>
                <span
                  className={`font-utility text-sm ${p.side === "YES" ? "text-verre" : "text-marc"}`}
                >
                  {p.side}
                </span>
              </div>
            ))}
          </div>
        </section>

        <ResolutionPanel
          betId={bet.id}
          slug={bet.slug}
          betStatus={bet.status}
          resolutions={bet.resolutions.map((r) => ({
            id: r.id,
            proposedOutcome: r.proposedOutcome,
            proposedBy: r.proposedBy,
            proposer: { name: r.proposer.name },
            evidenceUrl: r.evidenceUrl,
            evidenceNote: r.evidenceNote,
            status: r.status,
            confirmedAt: r.confirmedAt,
            createdAt: r.createdAt,
            votes: r.votes.map((v) => ({
              userId: v.userId,
              agree: v.agree,
              comment: v.comment,
              user: { name: v.user.name },
            })),
          }))}
          positionUserIds={bet.positions.map((p) => p.userId)}
          currentUserId={user.id}
        />

        <SettlementsList settlements={bet.settlements} currentUserId={user.id} />

        {bet.versions.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm text-lees">Version history</h2>
            <div className="flex flex-col gap-2">
              {bet.versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between bg-rack rounded-sm px-4 py-3"
                >
                  <span className="text-craie text-sm">
                    v{v.version} — {v.reason ?? "—"}
                  </span>
                  <span className="font-utility text-xs text-lees">
                    {shortHash(v.contentHash)} · {formatZurich(v.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="text-sm text-lees">Activity</h2>
          <div className="flex flex-col gap-1">
            {bet.activity.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-xs">
                <span className="text-craie">
                  {a.actor?.name ?? "System"} — {a.action.toLowerCase().replace(/_/g, " ")}
                </span>
                <span className="font-utility text-lees">{formatZurich(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </section>

        <CommentsSection betId={bet.id} comments={bet.comments} />

        <div className="flex items-center gap-4">
          {canWithdraw && <WithdrawButton betId={bet.id} />}
          {canProposeAmendment && (
            <Link
              href={`/bets/${slug}/amend`}
              className="text-verre text-sm hover:underline"
            >
              Propose amendment
            </Link>
          )}
        </div>

        <Link href="/" className="text-lees text-sm hover:text-craie">
          ← Back to the book
        </Link>
      </main>
    </div>
  );
}
