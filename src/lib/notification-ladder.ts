/**
 * §4.1 dynamic lead-time ladder. Returns day-thresholds (descending) before
 * a bet's resolution/expected-resolution date, given how long the bet runs
 * from lock to that date. Used now to draw the pressure gauge's ticks
 * (§10); the same thresholds drive the notification scheduler in a later
 * build step.
 */
export function ladderThresholds(durationDays: number): number[] {
  if (durationDays > 18 * 30) return [90, 30, 7, 2];
  if (durationDays > 6 * 30) return [45, 14, 2];
  if (durationDays > 3 * 30) return [21, 7, 2];
  if (durationDays > 30) return [7, 2];
  if (durationDays > 2) return [2];
  return [0];
}
