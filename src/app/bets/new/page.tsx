import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { Header } from "@/components/header";
import { NewBetForm } from "@/components/new-bet-form";

export default async function NewBetPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="flex flex-col flex-1">
      <Header userName={user.name} />
      <main className="flex-1 px-4 py-4 max-w-2xl w-full mx-auto">
        <h1 className="font-display text-2xl text-craie mb-6">New bet</h1>
        <NewBetForm userId={user.id} />
      </main>
    </div>
  );
}
