import Link from "next/link";
import type { BetListItem } from "@/lib/queries/bets";
import { PressureGauge } from "@/components/pressure-gauge";
import { gaugeTarget, initials, statusColorClass, statusLabel } from "@/lib/bet-display";
import { formatZurich } from "@/lib/dates";

export function BetRow({
  bet,
  currentUserId,
}: {
  bet: BetListItem;
  currentUserId: string;
}) {
  const target = gaugeTarget(bet);
  const needsYourCall =
    (bet.status === "DRAFT" || bet.status === "PROPOSED") &&
    !bet.positions.some((p) => p.userId === currentUserId);

  return (
    <Link
      href={needsYourCall ? `/bets/${bet.slug}/accept` : `/bets/${bet.slug}`}
      className="block bg-rack rounded-sm px-4 py-3 hover:brightness-110 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-craie leading-snug line-clamp-2 flex-1">{bet.statement}</p>
        <span className={`font-utility text-xs shrink-0 ${statusColorClass(bet.status)}`}>
          {statusLabel(bet.status)}
        </span>
      </div>

      <div className="flex items-center justify-between mt-2 gap-3">
        <div className="flex gap-1">
          {bet.positions.map((p) => (
            <span
              key={p.id}
              title={`${p.user.name} — ${p.side}`}
              className="w-6 h-6 rounded-full bg-cave border border-craie/15 text-[10px] font-utility flex items-center justify-center text-lees"
            >
              {initials(p.user.name)}
            </span>
          ))}
        </div>
        <span className="font-utility text-xs text-lees">
          {needsYourCall ? "Needs your call" : target ? formatZurich(target) : ""}
        </span>
      </div>

      {bet.lockedAt && target && (
        <div className="mt-2">
          <PressureGauge lockedAt={bet.lockedAt} targetDate={target} size="sm" />
        </div>
      )}
    </Link>
  );
}
