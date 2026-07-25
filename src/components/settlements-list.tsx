"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markSettlementPaid } from "@/lib/actions/settlements";
import { formatZurich } from "@/lib/dates";

interface Settlement {
  id: string;
  debtorId: string;
  creditorId: string;
  debtor: { name: string };
  creditor: { name: string };
  status: "OWED" | "PAID";
  paidAt: Date | null;
  paidNote: string | null;
}

function SettlementRow({
  settlement,
  currentUserId,
}: {
  settlement: Settlement;
  currentUserId: string;
}) {
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const canMarkPaid =
    settlement.status === "OWED" &&
    (settlement.debtorId === currentUserId || settlement.creditorId === currentUserId);

  function markPaid() {
    startTransition(async () => {
      await markSettlementPaid(settlement.id, note || undefined);
      router.refresh();
    });
  }

  return (
    <div className="bg-rack rounded-sm px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-craie text-sm">
          {settlement.debtor.name} owes {settlement.creditor.name} a bottle
        </span>
        <span
          className={`font-utility text-xs ${
            settlement.status === "PAID" ? "text-capsule" : "text-marc"
          }`}
        >
          {settlement.status === "PAID"
            ? `Paid ${formatZurich(settlement.paidAt)}`
            : "Owed"}
        </span>
      </div>
      {settlement.paidNote && (
        <p className="text-lees text-xs italic">{settlement.paidNote}</p>
      )}
      {canMarkPaid && !noting && (
        <button
          onClick={() => setNoting(true)}
          className="text-verre text-xs hover:underline self-start"
        >
          Mark paid
        </button>
      )}
      {canMarkPaid && noting && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was it, delivered how (optional)"
            className="bg-cave border border-craie/15 rounded-sm px-3 py-2 text-craie text-xs placeholder:text-lees/60 focus:outline-none focus:ring-1 focus:ring-verre"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setNoting(false)}
              className="flex-1 text-lees text-xs py-1.5"
            >
              Cancel
            </button>
            <button
              disabled={pending}
              onClick={markPaid}
              className="flex-1 bg-capsule text-cave rounded-sm px-3 py-1.5 text-xs font-medium hover:brightness-110 transition-colors disabled:opacity-50"
            >
              {pending ? "Saving…" : "Confirm paid"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SettlementsList({
  settlements,
  currentUserId,
}: {
  settlements: Settlement[];
  currentUserId: string;
}) {
  if (settlements.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm text-lees">Settlements</h2>
      <div className="flex flex-col gap-2">
        {settlements.map((s) => (
          <SettlementRow key={s.id} settlement={s} currentUserId={currentUserId} />
        ))}
      </div>
    </section>
  );
}
