import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { callbackUrl } = await searchParams;

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl text-craie mb-1">Coupe</h1>
        <p className="text-lees text-sm mb-8">
          A private wager book, settled in champagne.
        </p>

        <form
          action={async (formData: FormData) => {
            "use server";
            const email = String(formData.get("email") ?? "");
            await signIn("resend", {
              email,
              redirectTo: callbackUrl && callbackUrl !== "/sign-in" ? callbackUrl : "/",
            });
          }}
          className="flex flex-col gap-3"
        >
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="bg-rack border border-craie/15 rounded-sm px-4 py-3 text-craie placeholder:text-lees focus:outline-none focus:ring-1 focus:ring-verre"
          />
          <button
            type="submit"
            className="bg-verre text-cave font-medium rounded-sm px-4 py-3 hover:brightness-110 transition-colors"
          >
            Send magic link
          </button>
        </form>

        <p className="text-lees text-xs mt-6">
          Invite-only. If your email isn&apos;t already on the list, this
          won&apos;t work — ask whoever runs the book.
        </p>
      </div>
    </main>
  );
}
