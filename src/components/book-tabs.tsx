"use client";

import { useState } from "react";
import type { BetListItem } from "@/lib/queries/bets";
import { BetRow } from "@/components/bet-row";
import type { BookSegment } from "@/lib/bet-display";

const TABS: { key: BookSegment; label: string }[] = [
  { key: "live", label: "Live" },
  { key: "awaiting", label: "Awaiting call" },
  { key: "settled", label: "Settled" },
  { key: "void", label: "Void" },
];

export function BookTabs({
  segments,
  currentUserId,
}: {
  segments: Record<BookSegment, BetListItem[]>;
  currentUserId: string;
}) {
  const [active, setActive] = useState<BookSegment>("live");
  const bets = segments[active];

  return (
    <div>
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-3 py-1.5 rounded-sm text-sm font-medium whitespace-nowrap transition-colors ${
              active === tab.key
                ? "bg-verre text-cave"
                : "bg-rack text-lees hover:text-craie"
            }`}
          >
            {tab.label} ({segments[tab.key].length})
          </button>
        ))}
      </div>

      {bets.length === 0 ? (
        <p className="text-lees text-sm py-12 text-center">
          {active === "live" ? "Nothing at stake. Suspicious." : "Nothing here."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {bets.map((bet) => (
            <BetRow key={bet.id} bet={bet} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  );
}
