export type Tone = "dry" | "rowdy";

export type NotificationKind =
  | "THRESHOLD"
  | "DEADLINE_REACHED"
  | "NUDGE"
  | "RESOLUTION_WINNER"
  | "RESOLUTION_LOSER"
  | "RESOLUTION_VOID"
  | "AMENDMENT_PROPOSED"
  | "AMENDMENT_APPROVED"
  | "AMENDMENT_REJECTED"
  | "OUTCOME_PROPOSED"
  | "OUTCOME_DISPUTED";

interface PoolEntry {
  template: string;
  /**
   * Some given lines hardcode a specific lead time ("48 hours...", "Three
   * months out...") rather than using {days} generically — those can only
   * be selected when the actual days-remaining matches, otherwise a 90-day
   * notification could falsely claim "48 hours" is all that's left.
   */
  matchDays?: number;
}

// §4.3: pools of variants keyed by event type, picked pseudo-randomly
// seeded on bet_id so a given bet doesn't shuffle its voice between sends.
// The rowdy lines are the spec's own copy verbatim; dry is a flatter
// counterpart authored to match — the spec only fully writes out rowdy.
const POOLS: Record<NotificationKind, Record<Tone, PoolEntry[]>> = {
  RESOLUTION_WINNER: {
    rowdy: [
      { template: "Get ready to drink some good shit. {loser} owes you {bottles}." },
      { template: "You called it. {loser} is buying. Choose expensively." },
      { template: "{bet} — resolved in your favour. Cellar incoming." },
      { template: "Correct, and insufferable about it. {bottles} from {loser}." },
    ],
    dry: [
      { template: "{bet} resolved in your favour. {loser} owes you {bottles}." },
      { template: "You were right. {bottles} owed by {loser}." },
      { template: "Outcome confirmed: you win. {bottles} from {loser}." },
      { template: "{bet} settled in your favour. {loser} owes {bottles}." },
    ],
  },
  RESOLUTION_LOSER: {
    rowdy: [
      { template: "Get your wallet out — {winner} is thirsty for champagne." },
      { template: "{bet} did not go your way. You owe {bottles}. No grocery-store fizz." },
      { template: "Wrong, and now poorer. {winner} is waiting." },
      { template: "Time to visit a wine shop and think about your choices." },
    ],
    dry: [
      { template: "{bet} did not resolve in your favour. You owe {winner} {bottles}." },
      { template: "Outcome confirmed: you lose. {bottles} owed to {winner}." },
      { template: "{bet} settled against you. {bottles} due to {winner}." },
      { template: "You owe {winner} {bottles} on {bet}." },
    ],
  },
  RESOLUTION_VOID: {
    rowdy: [{ template: "{bet} voided. No harm, no bottles, no bragging rights." }],
    dry: [{ template: "{bet} resolved VOID. No settlement was created." }],
  },
  THRESHOLD: {
    rowdy: [
      { template: "{days} days until {bet} settles. Feeling confident?" },
      { template: "48 hours. {bet}. Last chance to quietly hope.", matchDays: 2 },
      {
        template: "Three months out on {bet}. Just so you can't claim you were ambushed.",
        matchDays: 90,
      },
    ],
    dry: [
      { template: "{days} days until {bet} is due to resolve." },
      { template: "{bet} resolves in {days} days." },
      { template: "Reminder: {bet} is due in {days} days." },
    ],
  },
  DEADLINE_REACHED: {
    rowdy: [{ template: "Time's up. Someone call it. {bet}" }],
    dry: [{ template: "{bet} has passed its resolution date. Awaiting a call." }],
  },
  NUDGE: {
    rowdy: [
      { template: "{bet} passed its date {days} days ago and nobody's been brave enough to call it." },
    ],
    dry: [{ template: "{bet} passed its resolution date {days} days ago. Still uncalled." }],
  },
  AMENDMENT_PROPOSED: {
    rowdy: [{ template: "{proposer} wants to tweak the terms of {bet}. Go weigh in." }],
    dry: [{ template: "{proposer} proposed an amendment to {bet}." }],
  },
  AMENDMENT_APPROVED: {
    rowdy: [{ template: "The amendment to {bet} went through. Terms updated." }],
    dry: [{ template: "The amendment to {bet} was approved. Terms updated." }],
  },
  AMENDMENT_REJECTED: {
    rowdy: [{ template: "The amendment to {bet} got voted down." }],
    dry: [{ template: "The amendment to {bet} was rejected." }],
  },
  OUTCOME_PROPOSED: {
    rowdy: [{ template: "{proposer} just called {bet}. Confirm or dispute." }],
    dry: [{ template: "{proposer} proposed an outcome for {bet}." }],
  },
  OUTCOME_DISPUTED: {
    rowdy: [{ template: "{bet} is being disputed. No arbitration here — sort it out yourselves." }],
    dry: [{ template: "The proposed outcome for {bet} was disputed." }],
  },
};

function seededIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

export function bottleLabel(count: number): string {
  return count === 1 ? "a bottle" : `${count} bottles`;
}

export interface CopyPlaceholders {
  winner?: string;
  loser?: string;
  proposer?: string;
  bet: string;
  bottles?: string;
  days?: string;
  date?: string;
}

function renderTemplate(template: string, placeholders: CopyPlaceholders): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = (placeholders as unknown as Record<string, string | undefined>)[key];
    return value ?? match;
  });
}

/**
 * Picks a variant for (kind, tone) deterministically from betId — same bet
 * always reads the same voice for a given moment — then substitutes
 * placeholders. Variants hardcoding a specific lead time are only
 * eligible when placeholders.days actually matches, so a 90-day-out
 * notification can never claim "48 hours" is all that's left.
 */
export function renderNotificationCopy(
  kind: NotificationKind,
  tone: Tone,
  betId: string,
  placeholders: CopyPlaceholders
): string {
  const pool = POOLS[kind][tone];
  const daysNum = placeholders.days !== undefined ? Number(placeholders.days) : undefined;
  const eligible = pool.filter(
    (e) => e.matchDays === undefined || e.matchDays === daysNum
  );
  const variants = eligible.length > 0 ? eligible : pool.filter((e) => e.matchDays === undefined);
  const entry = variants[seededIndex(`${betId}:${kind}`, variants.length)];
  return renderTemplate(entry.template, placeholders);
}
