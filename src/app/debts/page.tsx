import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getOpenDebts } from "@/lib/queries/leaderboard";
import { Header } from "@/components/header";
import { SettlementsList } from "@/components/settlements-list";

export default async function DebtsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const debts = await getOpenDebts();

  return (
    <div className="flex flex-col flex-1">
      <Header userName={user.name} />
      <main className="flex-1 px-4 py-6 max-w-2xl w-full mx-auto flex flex-col gap-4">
        <h1 className="font-display text-2xl text-craie">Debts</h1>
        <SettlementsList
          settlements={debts.map((d) => ({
            id: d.id,
            debtorId: d.debtorId,
            creditorId: d.creditorId,
            debtor: { name: d.debtor.name },
            creditor: { name: d.creditor.name },
            status: d.status,
            paidAt: d.paidAt,
            paidNote: d.paidNote,
            bet: { slug: d.bet.slug, statement: d.bet.statement },
          }))}
          currentUserId={user.id}
          title=""
          emptyLabel="Nothing owed. Suspiciously tidy."
        />
      </main>
    </div>
  );
}
