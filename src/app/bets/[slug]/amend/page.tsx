import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getBetBySlug } from "@/lib/queries/bets";
import { Header } from "@/components/header";
import { AmendForm } from "@/components/amend-form";

const AMENDABLE_STATUSES = ["ACTIVE", "AWAITING_RESOLUTION", "DISPUTED"];

export default async function AmendBetPage({
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
  if (!hasPosition || !AMENDABLE_STATUSES.includes(bet.status)) {
    redirect(`/bets/${slug}`);
  }
  if (bet.amendments.some((a) => a.status === "OPEN")) {
    redirect(`/bets/${slug}`);
  }

  return (
    <div className="flex flex-col flex-1">
      <Header />
      <main className="flex-1 px-4 py-6 max-w-2xl w-full mx-auto">
        <h1 className="font-display text-2xl text-craie mb-2">Propose an amendment</h1>
        <p className="text-lees text-sm mb-6">{bet.statement}</p>
        <AmendForm
          betId={bet.id}
          slug={bet.slug}
          current={{
            kind: bet.kind,
            statement: bet.statement,
            terms: bet.terms,
            resolutionCriteria: bet.resolutionCriteria,
            resolutionDate: bet.resolutionDate,
            longStopDate: bet.longStopDate,
            stakeNote: bet.stakeNote,
          }}
        />
      </main>
    </div>
  );
}
