import { z } from "zod";
import { betKindSchema } from "./bet";

// Mirrors the frozen fields from §3 rule 1 (statement, terms, kind,
// resolution_date, long_stop_date, resolution_criteria, stake_note) — the
// only fields an amendment can touch. expected_resolution_date is
// deliberately excluded: it's soft, editable metadata, not a frozen term.
export const proposeAmendmentSchema = z.object({
  kind: betKindSchema,
  statement: z.string().trim().min(1, "Say what you're betting on.").max(500),
  terms: z.string().trim().min(1, "Terms are required."),
  resolutionCriteria: z
    .string()
    .trim()
    .min(40, "Spell out what counts as YES — at least 40 characters."),
  resolutionDateInput: z.string().optional(),
  longStopDateInput: z.string().optional(),
  stakeNote: z.string().trim().max(280).optional(),
  reason: z
    .string()
    .trim()
    .min(10, "Say why you're amending this — at least 10 characters."),
});

export type ProposeAmendmentInput = z.infer<typeof proposeAmendmentSchema>;
