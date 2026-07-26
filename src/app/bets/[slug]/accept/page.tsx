import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getBetBySlug } from "@/lib/queries/bets";
import { Header } from "@/components/header";
import { AcceptForm } from "@/components/accept-form";

export default async function AcceptPage({
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
  if (hasPosition || (bet.status !== "DRAFT" && bet.status !== "PROPOSED")) {
    redirect(`/bets/${slug}`);
  }

  return (
    <div className="flex flex-col flex-1">
      <Header />
      <main className="flex-1 px-4 py-6 max-w-2xl w-full mx-auto flex flex-col gap-6">
        <div>
          <span className="font-utility text-xs text-lees">
            {bet.creator.name} proposed
          </span>
          <h1 className="font-display text-2xl text-craie leading-tight mt-1">
            {bet.statement}
          </h1>
        </div>

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

        <AcceptForm
          betId={bet.id}
          slug={bet.slug}
          positions={bet.positions.map((p) => ({
            id: p.id,
            side: p.side,
            userName: p.user.name,
          }))}
        />
      </main>
    </div>
  );
}
