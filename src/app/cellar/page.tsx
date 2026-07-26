import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import {
  getHeadToHead,
  getLeaderboard,
  getRecentlyPoured,
} from "@/lib/queries/leaderboard";
import { Header } from "@/components/header";
import { initials } from "@/lib/bet-display";
import { formatZurich } from "@/lib/dates";

function netClass(n: number): string {
  if (n > 0) return "text-capsule";
  if (n < 0) return "text-marc";
  return "text-lees";
}

function formatNet(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}

export default async function CellarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [leaderboard, recentlyPoured] = await Promise.all([
    getLeaderboard(),
    getRecentlyPoured(),
  ]);
  const grid = await getHeadToHead(leaderboard.map((e) => e.userId));

  return (
    <div className="flex flex-col flex-1">
      <Header />
      <main className="flex-1 px-4 py-6 max-w-2xl w-full mx-auto flex flex-col gap-8">
        <h1 className="font-display text-2xl text-craie">The Cellar</h1>

        <section className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[560px]">
            <thead>
              <tr className="text-left text-lees border-b border-craie/10">
                <th className="py-2 pr-3 font-normal">Name</th>
                <th className="py-2 px-3 font-normal">Record</th>
                <th className="py-2 px-3 font-normal">Void</th>
                <th className="py-2 px-3 font-normal">Net</th>
                <th className="py-2 px-3 font-normal">Overdue</th>
                <th className="py-2 px-3 font-normal">Open</th>
                <th className="py-2 pl-3 font-normal">Streak</th>
              </tr>
            </thead>
            <tbody className="font-utility">
              {leaderboard.map((e) => (
                <tr key={e.userId} className="border-b border-craie/5">
                  <td className="py-3 pr-3 font-body text-craie">{e.name}</td>
                  <td className="py-3 px-3 text-craie">
                    {e.wins}–{e.losses}
                  </td>
                  <td className="py-3 px-3 text-lees">{e.voids}</td>
                  <td className={`py-3 px-3 font-medium ${netClass(e.netBalance)}`}>
                    {formatNet(e.netBalance)}
                  </td>
                  <td className="py-3 px-3 text-marc">
                    {e.outstandingDebtsCount > 0
                      ? `${e.outstandingDebtsCount} (${e.oldestOutstandingDebtDays}d)`
                      : "—"}
                  </td>
                  <td className="py-3 px-3 text-verre">
                    {e.openPositionsCount > 0
                      ? `${e.openPositionsCount} bet${e.openPositionsCount === 1 ? "" : "s"}, ${e.bottlesAtRisk} at risk`
                      : "—"}
                  </td>
                  <td className="py-3 pl-3 text-lees">
                    {e.streakType ? `${e.streakType}${e.streakCount}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {leaderboard.length > 1 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm text-lees">Head-to-head (net bottles)</h2>
            <div className="overflow-x-auto">
              <table className="border-collapse font-utility text-sm">
                <thead>
                  <tr>
                    <th className="p-2" />
                    {leaderboard.map((e) => (
                      <th key={e.userId} className="p-2 text-lees font-normal">
                        {initials(e.name)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr key={row.userId}>
                      <td className="p-2 text-lees">{initials(row.name)}</td>
                      {leaderboard.map((col) => {
                        const v = grid[row.userId]?.[col.userId] ?? 0;
                        return (
                          <td
                            key={col.userId}
                            className={`p-2 text-center ${
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

        <section className="flex flex-col gap-2">
          <h2 className="text-sm text-lees">Recently poured</h2>
          {recentlyPoured.length === 0 ? (
            <p className="text-lees text-sm">Nothing poured yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentlyPoured.map((s) => (
                <div key={s.id} className="bg-rack rounded-sm px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-craie text-sm">
                      {s.debtor.name} → {s.creditor.name}
                    </span>
                    <span className="font-utility text-xs text-lees">
                      {formatZurich(s.paidAt)}
                    </span>
                  </div>
                  <p className="text-lees text-xs mt-0.5">{s.bet.statement}</p>
                  {s.paidNote && (
                    <p className="text-capsule text-xs mt-1 italic">{s.paidNote}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
