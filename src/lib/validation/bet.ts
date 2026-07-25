import { z } from "zod";

export const betKindSchema = z.enum([
  "FIXED_DATE",
  "EVENT_TRIGGERED",
  "CONTINGENT",
]);

// Structural shape only. The §9 hard rules that depend on more than one
// field at once (CONTINGENT needs a long-stop date, dates must be real
// calendar days) are enforced in enforceHardRules below, after the date
// strings have been parsed — Zod alone can't validate calendar validity.
export const createBetSchema = z.object({
  kind: betKindSchema,
  statement: z.string().trim().min(1, "Say what you're betting on.").max(500),
  terms: z.string().trim().min(1, "Terms are required."),
  resolutionCriteria: z
    .string()
    .trim()
    .min(40, "Spell out what counts as YES — at least 40 characters."),
  resolutionDateInput: z.string().optional(),
  expectedResolutionDateInput: z.string().optional(),
  longStopDateInput: z.string().optional(),
  stakeNote: z.string().trim().max(280).optional(),
  side: z.enum(["YES", "NO"]),
});

export type CreateBetInput = z.infer<typeof createBetSchema>;

export interface ParsedBetDates {
  resolutionDate: Date | null;
  expectedResolutionDate: Date | null;
  longStopDate: Date | null;
}

/**
 * §9 hard rules that block sending a bet. Takes already-parsed dates (or
 * null for an unparseable / missing string) so the caller controls how
 * parsing happens (see zurichEndOfDayToUtc).
 */
export function enforceHardRules(
  input: Pick<CreateBetInput, "kind">,
  dates: {
    resolutionDateRaw: string | null;
    resolutionDateParsed: Date | null;
    expectedResolutionDateRaw: string | null;
    expectedResolutionDateParsed: Date | null;
    longStopDateRaw: string | null;
    longStopDateParsed: Date | null;
  }
): string[] {
  const errors: string[] = [];

  if (dates.resolutionDateRaw && !dates.resolutionDateParsed) {
    errors.push(`"${dates.resolutionDateRaw}" is not a real date.`);
  }
  if (dates.expectedResolutionDateRaw && !dates.expectedResolutionDateParsed) {
    errors.push(`"${dates.expectedResolutionDateRaw}" is not a real date.`);
  }
  if (dates.longStopDateRaw && !dates.longStopDateParsed) {
    errors.push(`"${dates.longStopDateRaw}" is not a real date.`);
  }

  if (input.kind === "FIXED_DATE" && !dates.resolutionDateParsed) {
    errors.push("FIXED_DATE bets need a resolution date.");
  }
  if (input.kind === "CONTINGENT" && !dates.longStopDateParsed) {
    errors.push(
      "CONTINGENT bets require a long-stop date — no immortal bets."
    );
  }

  return errors;
}
