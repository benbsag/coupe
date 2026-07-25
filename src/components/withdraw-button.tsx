"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { withdrawBet } from "@/lib/actions/bets";

export function WithdrawButton({ betId }: { betId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div>
      <button
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await withdrawBet(betId);
            if (!result.ok) {
              setError(result.errors?.[0] ?? "Couldn't withdraw this bet.");
              return;
            }
            router.refresh();
          });
        }}
        className="text-marc text-sm hover:underline disabled:opacity-50"
      >
        {pending ? "Withdrawing…" : "Withdraw bet"}
      </button>
      {error && <p className="text-marc text-xs mt-1">{error}</p>}
    </div>
  );
}
