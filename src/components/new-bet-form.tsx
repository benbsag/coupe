"use client";

import { useActionState, useState } from "react";
import { createAndSendBet, type ActionResult } from "@/lib/actions/bets";

const initialState: ActionResult = { ok: true };

const CHECKLIST = [
  "What exactly counts as YES? What's the edge case you'd argue about?",
  "Who or what is the source of truth at resolution?",
  "What if it half-happens — a prototype, a pilot, an announcement without a ship date?",
  "Is the deadline the announcement, the release, or availability where it matters to you?",
];

export function NewBetForm({ userId }: { userId: string }) {
  const [kind, setKind] = useState<"FIXED_DATE" | "EVENT_TRIGGERED" | "CONTINGENT">(
    "FIXED_DATE"
  );

  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult, formData: FormData): Promise<ActionResult> => {
      return createAndSendBet({
        kind: formData.get("kind"),
        statement: formData.get("statement"),
        terms: formData.get("terms"),
        resolutionCriteria: formData.get("resolutionCriteria"),
        resolutionDateInput: formData.get("resolutionDateInput") || undefined,
        expectedResolutionDateInput:
          formData.get("expectedResolutionDateInput") || undefined,
        longStopDateInput: formData.get("longStopDateInput") || undefined,
        stakeNote: formData.get("stakeNote") || undefined,
        side: formData.get("side"),
      });
    },
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-6 pb-16">
      <input type="hidden" name="userId" value={userId} />

      <section className="flex flex-col gap-2">
        <label className="text-sm text-lees">Statement</label>
        <textarea
          name="statement"
          required
          rows={2}
          placeholder="Level 4 autonomous driving will be permitted in Basel by 31 December 2028"
          className="bg-rack border border-craie/15 rounded-sm px-4 py-3 text-craie placeholder:text-lees/60 focus:outline-none focus:ring-1 focus:ring-verre resize-none"
        />
      </section>

      <section className="flex flex-col gap-2">
        <label className="text-sm text-lees">Kind</label>
        <div className="flex flex-col gap-2">
          {(
            [
              ["FIXED_DATE", "Fixed date", "Resolves NO if it hasn't happened by a deadline."],
              ["EVENT_TRIGGERED", "Event-triggered", "Only resolvable once some trigger fires; date unknown."],
              ["CONTINGENT", "Contingent", "May never resolve — requires a long-stop date."],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className={`flex items-start gap-3 rounded-sm px-4 py-3 border cursor-pointer ${
                kind === value ? "border-verre bg-rack" : "border-craie/10 bg-rack/50"
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="mt-1"
              />
              <span>
                <span className="block text-craie text-sm font-medium">{label}</span>
                <span className="block text-lees text-xs">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <label className="text-sm text-lees">Terms</label>
        <textarea
          name="terms"
          required
          rows={3}
          placeholder="Must be a Starlink product — Starlink's own handset hardware, not a Starlink-enabled third-party phone."
          className="bg-rack border border-craie/15 rounded-sm px-4 py-3 text-craie placeholder:text-lees/60 focus:outline-none focus:ring-1 focus:ring-verre resize-none"
        />
      </section>

      {kind === "FIXED_DATE" && (
        <section className="flex flex-col gap-2">
          <label className="text-sm text-lees">Resolution date (23:59 Europe/Zurich)</label>
          <input
            type="date"
            name="resolutionDateInput"
            required
            className="font-utility bg-rack border border-craie/15 rounded-sm px-4 py-3 text-craie focus:outline-none focus:ring-1 focus:ring-verre"
          />
        </section>
      )}

      {kind === "EVENT_TRIGGERED" && (
        <>
          <section className="flex flex-col gap-2">
            <label className="text-sm text-lees">Expected resolution date (soft — editable later)</label>
            <input
              type="date"
              name="expectedResolutionDateInput"
              className="font-utility bg-rack border border-craie/15 rounded-sm px-4 py-3 text-craie focus:outline-none focus:ring-1 focus:ring-verre"
            />
          </section>
          <section className="flex flex-col gap-2">
            <label className="text-sm text-lees">Long-stop date (optional — hard VOID if trigger never fires)</label>
            <input
              type="date"
              name="longStopDateInput"
              className="font-utility bg-rack border border-craie/15 rounded-sm px-4 py-3 text-craie focus:outline-none focus:ring-1 focus:ring-verre"
            />
          </section>
        </>
      )}

      {kind === "CONTINGENT" && (
        <section className="flex flex-col gap-2">
          <label className="text-sm text-lees">Long-stop date (required — lapses VOID after this)</label>
          <input
            type="date"
            name="longStopDateInput"
            required
            className="font-utility bg-rack border border-craie/15 rounded-sm px-4 py-3 text-craie focus:outline-none focus:ring-1 focus:ring-verre"
          />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <label className="text-sm text-lees">
          What counts as YES? (resolution criteria, min. 40 characters)
        </label>
        <textarea
          name="resolutionCriteria"
          required
          minLength={40}
          rows={3}
          placeholder="Cheapest configuration at Swiss launch, Apple's own retail price, VAT inclusive. Strictly greater than CHF 2,000."
          className="bg-rack border border-craie/15 rounded-sm px-4 py-3 text-craie placeholder:text-lees/60 focus:outline-none focus:ring-1 focus:ring-verre resize-none"
        />
      </section>

      <section className="flex flex-col gap-2">
        <label className="text-sm text-lees">Stake note (optional)</label>
        <input
          type="text"
          name="stakeNote"
          placeholder="Grower only, no Moët"
          className="bg-rack border border-craie/15 rounded-sm px-4 py-3 text-craie placeholder:text-lees/60 focus:outline-none focus:ring-1 focus:ring-verre"
        />
      </section>

      <section className="flex flex-col gap-2">
        <label className="text-sm text-lees">Your side</label>
        <div className="flex gap-3">
          <label className="flex-1 flex items-center justify-center gap-2 rounded-sm px-4 py-3 border border-craie/15 bg-rack cursor-pointer has-[:checked]:border-verre">
            <input type="radio" name="side" value="YES" required /> YES
          </label>
          <label className="flex-1 flex items-center justify-center gap-2 rounded-sm px-4 py-3 border border-craie/15 bg-rack cursor-pointer has-[:checked]:border-marc">
            <input type="radio" name="side" value="NO" required /> NO
          </label>
        </div>
      </section>

      <aside className="bg-rack/50 border border-craie/10 rounded-sm px-4 py-3">
        <p className="text-lees text-xs mb-2 font-medium">Before you send it</p>
        <ul className="text-lees text-xs list-disc pl-4 flex flex-col gap-1">
          {CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </aside>

      {state?.errors && state.errors.length > 0 && (
        <div className="bg-marc/10 border border-marc/40 rounded-sm px-4 py-3">
          <ul className="text-marc text-sm flex flex-col gap-1">
            {state.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-verre text-cave font-medium rounded-sm px-4 py-3 hover:brightness-110 transition-colors disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send it"}
      </button>
    </form>
  );
}
