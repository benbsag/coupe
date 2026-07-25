import { z } from "zod";

export const proposeResolutionSchema = z.object({
  outcome: z.enum(["YES", "NO", "VOID"]),
  evidenceUrl: z
    .string()
    .trim()
    .url("That doesn't look like a valid URL.")
    .optional()
    .or(z.literal("")),
  evidenceNote: z.string().trim().max(1000).optional(),
});

export type ProposeResolutionInput = z.infer<typeof proposeResolutionSchema>;
