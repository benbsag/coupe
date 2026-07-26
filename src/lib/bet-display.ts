import type { BetListItem } from "@/lib/queries/bets";

export function gaugeTarget(bet: {
  resolutionDate: Date | null;
  expectedResolutionDate: Date | null;
  longStopDate: Date | null;
}): Date | null {
  return bet.resolutionDate ?? bet.expectedResolutionDate ?? bet.longStopDate ?? null;
}

export function statusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "PROPOSED":
      return "Proposed";
    case "ACTIVE":
      return "Live";
    case "AWAITING_RESOLUTION":
      return "Awaiting call";
    case "DISPUTED":
      return "Disputed";
    case "RESOLVED":
      return "Settled";
    case "VOID":
      return "Void";
    case "LAPSED":
      return "Lapsed";
    default:
      return status;
  }
}

export function statusColorClass(status: string): string {
  switch (status) {
    case "ACTIVE":
    case "PROPOSED":
    case "DRAFT":
      return "text-verre";
    case "AWAITING_RESOLUTION":
      return "text-capsule";
    case "DISPUTED":
      return "text-marc";
    case "RESOLVED":
      return "text-capsule";
    case "VOID":
    case "LAPSED":
      return "text-lees";
    default:
      return "text-lees";
  }
}

export type BookSegment = "awaiting" | "live" | "settled";

// Display order on the book: bets needing a call first, live bets next,
// then settled. Void/lapsed bets are not shown at all.
export const SEGMENT_ORDER: BookSegment[] = ["awaiting", "live", "settled"];

export const SEGMENT_LABELS: Record<BookSegment, string> = {
  awaiting: "Awaiting call",
  live: "Live",
  settled: "Settled",
};

export function segmentFor(status: string): BookSegment | null {
  switch (status) {
    case "AWAITING_RESOLUTION":
    case "DISPUTED":
      return "awaiting";
    case "DRAFT":
    case "PROPOSED":
    case "ACTIVE":
      return "live";
    case "RESOLVED":
      return "settled";
    default:
      return null; // VOID / LAPSED — not tracked on the book
  }
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function visibleToUser(bet: BetListItem, userId: string): boolean {
  if (bet.status === "DRAFT") return bet.createdBy === userId;
  return true;
}
