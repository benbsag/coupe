import Link from "next/link";
import { signOut } from "@/auth";

export function Header({ userName }: { userName: string }) {
  return (
    <header className="flex items-center justify-between px-4 py-4 border-b border-craie/10">
      <Link href="/" className="font-display text-xl text-craie">
        Coupe
      </Link>
      <div className="flex items-center gap-3">
        <Link
          href="/cellar"
          className="text-lees text-sm hover:text-craie transition-colors"
        >
          Cellar
        </Link>
        <Link
          href="/debts"
          className="text-lees text-sm hover:text-craie transition-colors"
        >
          Debts
        </Link>
        <Link
          href="/bets/new"
          className="bg-verre text-cave text-sm font-medium rounded-sm px-3 py-1.5 hover:brightness-110 transition-colors"
        >
          New bet
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/sign-in" });
          }}
        >
          <button
            type="submit"
            className="text-lees text-sm hover:text-craie transition-colors"
            title={userName}
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
