import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { listBets } from "@/lib/queries/bets";
import { Header } from "@/components/header";
import { BookTabs } from "@/components/book-tabs";
import { segmentFor, visibleToUser, type BookSegment } from "@/lib/bet-display";

export default async function BookHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const allBets = await listBets();
  const visible = allBets.filter((bet) => visibleToUser(bet, user.id));

  const segments: Record<BookSegment, typeof visible> = {
    live: [],
    awaiting: [],
    settled: [],
    void: [],
  };
  for (const bet of visible) {
    segments[segmentFor(bet.status)].push(bet);
  }

  return (
    <div className="flex flex-col flex-1">
      <Header userName={user.name} />
      <main className="flex-1 px-4 py-4 max-w-2xl w-full mx-auto">
        <BookTabs segments={segments} currentUserId={user.id} />
      </main>
    </div>
  );
}
