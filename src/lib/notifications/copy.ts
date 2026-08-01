export type Tone = "dry" | "rowdy";

// The four notification events the app sends, plus a neutral void notice.
// Anything not listed here no longer generates email (see the notifications
// rework: proposal → counterparty, 1-month fixed-date reminder → both,
// amendment proposed → counterparty, winner announced → both).
export type NotificationKind =
  | "BET_PROPOSED"
  | "THRESHOLD"
  | "AMENDMENT_PROPOSED"
  | "RESOLUTION_ANNOUNCED"
  | "RESOLUTION_VOID";

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
  // 1. A bet is proposed → sent to the counterparty.
  BET_PROPOSED: {
    rowdy: [
      { template: "{proposer} just threw down: {bet} Pick a side." },
      { template: "New wager from {proposer}: {bet} You in?" },
    ],
    dry: [
      { template: "{proposer} proposed a bet: {bet} Take a side to lock it in." },
      { template: "{proposer} wants to bet you on: {bet}" },
    ],
  },
  // 2. Fixed-date bets → a single reminder one month before the deadline,
  //    sent to both parties. Copy is month-oriented rather than {days}-generic
  //    since this only ever fires at the one-month mark now.
  THRESHOLD: {
    rowdy: [
      { template: "One month to pour: {bet} settles in about four weeks." },
      { template: "Champagne clock: {bet} is due to resolve in a month." },
    ],
    dry: [
      { template: "One month until {bet} is due to resolve." },
      { template: "Reminder: {bet} resolves in about a month." },
    ],
  },
  // 3. An amendment is proposed → sent to the other party to respond.
  AMENDMENT_PROPOSED: {
    rowdy: [{ template: "{proposer} wants to tweak the terms of {bet}. Go weigh in." }],
    dry: [{ template: "{proposer} proposed an amendment to {bet}. Approve or reject it." }],
  },
  // 4. A bet closes with a winner → sent to both parties.
  RESOLUTION_ANNOUNCED: {
    rowdy: [
      { template: "Time to pour some champagne for {winner}. {bet}" },
      { template: "Time to pour some champagne for {winner} — they called {bet} right." },
    ],
    dry: [
      { template: "Time to pour some champagne for {winner}. {bet} is settled." },
      { template: "{bet} is settled — {winner} won. Time to pour some champagne." },
    ],
  },
  // A bet closes with no winner (void) → neutral note to both parties.
  RESOLUTION_VOID: {
    rowdy: [{ template: "{bet} closed void. No winner, no champagne this time." }],
    dry: [{ template: "{bet} resolved void. No winner and no settlement." }],
  },
};

function seededIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

export interface CopyPlaceholders {
  winner?: string;
  proposer?: string;
  bet: string;
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
 * placeholders. Unknown kinds (e.g. a stale queued row from a since-removed
 * notification type) fall back to the bare bet statement rather than
 * throwing, so the cron never wedges on old data.
 */
export function renderNotificationCopy(
  kind: NotificationKind,
  tone: Tone,
  betId: string,
  placeholders: CopyPlaceholders
): string {
  const kindPool = POOLS[kind];
  if (!kindPool) return placeholders.bet;
  const pool = kindPool[tone];
  const daysNum = placeholders.days !== undefined ? Number(placeholders.days) : undefined;
  const eligible = pool.filter(
    (e) => e.matchDays === undefined || e.matchDays === daysNum
  );
  const variants = eligible.length > 0 ? eligible : pool.filter((e) => e.matchDays === undefined);
  const entry = variants[seededIndex(`${betId}:${kind}`, variants.length)];
  return renderTemplate(entry.template, placeholders);
}
