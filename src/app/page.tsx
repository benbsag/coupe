import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { listBets, type BetListItem } from "@/lib/queries/bets";
import {
  getHeadToHead,
  getLeaderboard,
  getRecentlyPoured,
} from "@/lib/queries/leaderboard";
import { Header } from "@/components/header";
import { BetRow } from "@/components/bet-row";
import { LeaderboardPanel } from "@/components/leaderboard-panel";
import {
  SEGMENT_LABELS,
  SEGMENT_ORDER,
  segmentFor,
  visibleToUser,
  type BookSegment,
} from "@/lib/bet-display";

export default async function BookHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [allBets, leaderboard, recentlyPoured] = await Promise.all([
    listBets(),
    getLeaderboard(),
    getRecentlyPoured(),
  ]);
  const grid = await getHeadToHead(leaderboard.map((e) => e.userId));

  const visible = allBets.filter((bet) => visibleToUser(bet, user.id));
  const segments: Record<BookSegment, BetListItem[]> = {
    awaiting: [],
    live: [],
    settled: [],
  };
  for (const bet of visible) {
    const seg = segmentFor(bet.status);
    if (seg) segments[seg].push(bet);
  }
  const totalShown =
    segments.awaiting.length + segments.live.length + segments.settled.length;

  return (
    <div className="flex flex-col flex-1">
      <Header />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-10">
          <div className="flex-1 flex flex-col gap-8 min-w-0">
            {totalShown === 0 ? (
              <p className="text-lees text-sm py-12 text-center">
                Nothing at stake. Suspicious.
              </p>
            ) : (
              SEGMENT_ORDER.filter((seg) => segments[seg].length > 0).map((seg) => (
                <section key={seg} className="flex flex-col gap-2">
                  <h2 className="text-sm text-lees">{SEGMENT_LABELS[seg]}</h2>
                  <div className="flex flex-col gap-2">
                    {segments[seg].map((bet) => (
                      <BetRow key={bet.id} bet={bet} currentUserId={user.id} />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>

          <aside className="lg:w-72 shrink-0">
            <LeaderboardPanel
              entries={leaderboard}
              grid={grid}
              recentlyPoured={recentlyPoured}
              currentUserId={user.id}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
