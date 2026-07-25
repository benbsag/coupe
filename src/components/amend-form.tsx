"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { proposeAmendment } from "@/lib/actions/amendments";
import { formatZurich } from "@/lib/dates";

interface AmendFormProps {
  betId: string;
  slug: string;
  current: {
    kind: "FIXED_DATE" | "EVENT_TRIGGERED" | "CONTINGENT";
    statement: string;
    terms: string;
    resolutionCriteria: string;
    resolutionDate: Date | null;
    longStopDate: Date | null;
    stakeNote: string | null;
  };
}

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  // Dates are stored as 23:59:59 Europe/Zurich → UTC; format back to the
  // Zurich calendar day so the date input round-trips to the same day.
  return formatZurichIso(date);
}

function formatZurichIso(date: Date): string {
  const zurich = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return zurich;
}

export function AmendForm({ betId, slug, current }: AmendFormProps) {
  const [kind, setKind] = useState(current.kind);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    setErrors([]);
    startTransition(async () => {
      const result = await proposeAmendment(betId, {
        kind: formData.get("kind"),
        statement: formData.get("statement"),
        terms: formData.get("terms"),
        resolutionCriteria: formData.get("resolutionCriteria"),
        resolutionDateInput: formData.get("resolutionDateInput") || undefined,
        longStopDateInput: formData.get("longStopDateInput") || undefined,
        stakeNote: formData.get("stakeNote") || undefined,
        reason: formData.get("reason"),
      });
      if (!result.ok) {
        setErrors(result.errors ?? ["Couldn't propose this amendment."]);
        return;
      }
      router.push(`/bets/${slug}`);
      router.refresh();
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-6 pb-16">
      <section className="flex flex-col gap-2">
        <label className="text-sm text-lees">Statement</label>
        <textarea
          name="statement"
          required
          rows={2}
          defaultValue={current.statement}
          className="bg-rack border border-craie/15 rounded-sm px-4 py-3 text-craie focus:outline-none focus:ring-1 focus:ring-verre resize-none"
        />
      </section>

      <section className="flex flex-col gap-2">
        <label className="text-sm text-lees">Kind</label>
        <div className="flex flex-col gap-2">
          {(
            [
              ["FIXED_DATE", "Fixed date"],
              ["EVENT_TRIGGERED", "Event-triggered"],
              ["CONTINGENT", "Contingent"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex items-center gap-3 rounded-sm px-4 py-3 border cursor-pointer ${
                kind === value ? "border-verre bg-rack" : "border-craie/10 bg-rack/50"
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
              />
              <span className="text-craie text-sm">{label}</span>
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
          defaultValue={current.terms}
          className="bg-rack border border-craie/15 rounded-sm px-4 py-3 text-craie focus:outline-none focus:ring-1 focus:ring-verre resize-none"
        />
      </section>

      {kind === "FIXED_DATE" && (
        <section className="flex flex-col gap-2">
          <label className="text-sm text-lees">Resolution date (23:59 Europe/Zurich)</label>
          <input
            type="date"
            name="resolutionDateInput"
            required
            defaultValue={toDateInputValue(current.resolutionDate)}
            className="font-utility bg-rack border border-craie/15 rounded-sm px-4 py-3 text-craie focus:outline-none focus:ring-1 focus:ring-verre"
          />
        </section>
      )}

      {(kind === "EVENT_TRIGGERED" || kind === "CONTINGENT") && (
        <section className="flex flex-col gap-2">
          <label className="text-sm text-lees">
            Long-stop date {kind === "CONTINGENT" ? "(required)" : "(optional)"}
          </label>
          <input
            type="date"
            name="longStopDateInput"
            required={kind === "CONTINGENT"}
            defaultValue={toDateInputValue(current.longStopDate)}
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
          defaultValue={current.resolutionCriteria}
          className="bg-rack border border-craie/15 rounded-sm px-4 py-3 text-craie focus:outline-none focus:ring-1 focus:ring-verre resize-none"
        />
      </section>

      <section className="flex flex-col gap-2">
        <label className="text-sm text-lees">Stake note (optional)</label>
        <input
          type="text"
          name="stakeNote"
          defaultValue={current.stakeNote ?? ""}
          className="bg-rack border border-craie/15 rounded-sm px-4 py-3 text-craie focus:outline-none focus:ring-1 focus:ring-verre"
        />
      </section>

      <section className="flex flex-col gap-2">
        <label className="text-sm text-lees">
          Why are you amending this? (required — everyone will see this)
        </label>
        <textarea
          name="reason"
          required
          minLength={10}
          rows={2}
          placeholder="The trigger fired but Apple shipped two configurations — clarifying which one this bet refers to."
          className="bg-rack border border-craie/15 rounded-sm px-4 py-3 text-craie placeholder:text-lees/60 focus:outline-none focus:ring-1 focus:ring-verre resize-none"
        />
      </section>

      <aside className="bg-rack/50 border border-craie/10 rounded-sm px-4 py-3 text-lees text-xs">
        Every other participant has to explicitly approve this — silence
        doesn&apos;t count, and any single rejection kills it. Your own
        approval is recorded automatically since you&apos;re proposing it.
      </aside>

      {errors.length > 0 && (
        <div className="bg-marc/10 border border-marc/40 rounded-sm px-4 py-3">
          <ul className="text-marc text-sm flex flex-col gap-1">
            {errors.map((e) => (
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
        {pending ? "Proposing…" : "Propose amendment"}
      </button>
    </form>
  );
}
