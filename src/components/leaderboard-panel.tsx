import { initials } from "@/lib/bet-display";
import { formatZurich } from "@/lib/dates";
import type { LeaderboardEntry } from "@/lib/queries/leaderboard";

function netClass(n: number): string {
  if (n > 0) return "text-capsule";
  if (n < 0) return "text-marc";
  return "text-lees";
}

function formatNet(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

interface PouredItem {
  id: string;
  paidAt: Date | null;
  paidNote: string | null;
  debtor: { name: string };
  creditor: { name: string };
  bet: { statement: string };
}

export function LeaderboardPanel({
  entries,
  grid,
  recentlyPoured,
  currentUserId,
}: {
  entries: LeaderboardEntry[];
  grid: Record<string, Record<string, number>>;
  recentlyPoured: PouredItem[];
  currentUserId: string;
}) {
  const hasActivity = entries.some(
    (e) => e.wins + e.losses + e.bottlesWon + e.bottlesOwed > 0
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-craie">The Cellar</h2>

        {!hasActivity ? (
          <p className="text-lees text-sm">No bottles poured yet. Early days.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((e) => (
              <div
                key={e.userId}
                className="bg-rack rounded-sm px-4 py-3 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm ${
                      e.userId === currentUserId ? "text-craie font-medium" : "text-craie"
                    }`}
                  >
                    {e.name}
                    {e.userId === currentUserId && (
                      <span className="text-lees text-xs"> (you)</span>
                    )}
                  </span>
                  <span className={`font-utility text-lg font-medium ${netClass(e.netBalance)}`}>
                    {formatNet(e.netBalance)}
                  </span>
                </div>
                <div className="flex items-center gap-3 font-utility text-xs text-lees">
                  <span>
                    {e.wins}–{e.losses}
                  </span>
                  {e.voids > 0 && <span>{e.voids} void</span>}
                  {e.streakType && (
                    <span>
                      {e.streakType}
                      {e.streakCount}
                    </span>
                  )}
                  {e.outstandingDebtsCount > 0 && (
                    <span className="text-marc">
                      owes {e.outstandingDebtsCount} ({e.oldestOutstandingDebtDays}d)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {entries.length > 2 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm text-lees">Head-to-head</h3>
          <div className="overflow-x-auto">
            <table className="border-collapse font-utility text-xs">
              <thead>
                <tr>
                  <th className="p-1.5" />
                  {entries.map((e) => (
                    <th key={e.userId} className="p-1.5 text-lees font-normal">
                      {initials(e.name)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={row.userId}>
                    <td className="p-1.5 text-lees">{initials(row.name)}</td>
                    {entries.map((col) => {
                      const v = grid[row.userId]?.[col.userId] ?? 0;
                      return (
                        <td
                          key={col.userId}
                          className={`p-1.5 text-center ${
                            row.userId === col.userId ? "text-lees/40" : netClass(v)
                          }`}
                        >
                          {row.userId === col.userId ? "—" : formatNet(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {recentlyPoured.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm text-lees">Recently poured</h3>
          <div className="flex flex-col gap-2">
            {recentlyPoured.map((s) => (
              <div key={s.id} className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-craie">
                    {s.debtor.name} → {s.creditor.name}
                  </span>
                  <span className="font-utility text-lees">{formatZurich(s.paidAt)}</span>
                </div>
                {s.paidNote && <p className="text-capsule italic mt-0.5">{s.paidNote}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
