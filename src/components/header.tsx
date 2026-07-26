import Link from "next/link";
import { signOut } from "@/auth";

export function Header() {
  return (
    <header className="border-b border-craie/10 px-4 py-5 flex flex-col items-center gap-3">
      <Link
        href="/"
        className="font-display text-4xl sm:text-5xl text-craie tracking-tight leading-none"
      >
        Coupe
      </Link>
      <div className="flex items-center gap-5">
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
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
