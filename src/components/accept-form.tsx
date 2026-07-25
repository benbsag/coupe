"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptPosition } from "@/lib/actions/bets";

interface Position {
  id: string;
  side: "YES" | "NO";
  userName: string;
}

export function AcceptForm({
  betId,
  slug,
  positions,
}: {
  betId: string;
  slug: string;
  positions: Position[];
}) {
  const [side, setSide] = useState<"YES" | "NO" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const totalAfterJoining = positions.length + 1;
  const exposure = side ? positions.filter((p) => p.side !== side).length : 0;
  const showExposure = totalAfterJoining > 2 && side;

  function submit() {
    if (!side) return;
    setError(null);
    startTransition(async () => {
      const result = await acceptPosition(betId, side);
      if (!result.ok) {
        setError(result.errors?.[0] ?? "Couldn't record your position.");
        setConfirming(false);
        return;
      }
      router.push(`/bets/${slug}`);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-3">
        <button
          onClick={() => setSide("YES")}
          className={`flex-1 rounded-sm px-4 py-4 border text-lg font-medium transition-colors ${
            side === "YES" ? "border-verre bg-verre/10 text-verre" : "border-craie/15 bg-rack text-craie"
          }`}
        >
          YES
        </button>
        <button
          onClick={() => setSide("NO")}
          className={`flex-1 rounded-sm px-4 py-4 border text-lg font-medium transition-colors ${
            side === "NO" ? "border-marc bg-marc/10 text-marc" : "border-craie/15 bg-rack text-craie"
          }`}
        >
          NO
        </button>
      </div>

      {showExposure && (
        <p className="text-capsule text-sm">
          If you&apos;re wrong, you&apos;re buying {exposure} {exposure === 1 ? "bottle" : "bottles"}.
        </p>
      )}

      {!confirming ? (
        <button
          disabled={!side}
          onClick={() => setConfirming(true)}
          className="bg-verre text-cave font-medium rounded-sm px-4 py-3 hover:brightness-110 transition-colors disabled:opacity-40"
        >
          Take this side
        </button>
      ) : (
        <div className="bg-rack border border-craie/15 rounded-sm px-4 py-4 flex flex-col gap-3">
          <p className="text-craie text-sm">
            This locks now. Drunk bets are your own fault. No undo, no grace window.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 text-lees text-sm py-2"
            >
              Back
            </button>
            <button
              disabled={pending}
              onClick={submit}
              className="flex-1 bg-verre text-cave font-medium rounded-sm px-4 py-2 hover:brightness-110 transition-colors disabled:opacity-50"
            >
              {pending ? "Locking…" : "Confirm"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-marc text-sm">{error}</p>}
    </div>
  );
}
