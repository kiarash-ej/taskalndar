// Percent of expected daily tasks actually completed in a period.
export function taskCompletionPercent(expected: number, done: number): number {
  if (expected <= 0) return 0;
  return Math.min(100, (done / expected) * 100);
}

// Percent of one goal's target reached, capped at 100.
export function goalProgressPercent(amount: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, (amount / target) * 100);
}

// spec.md: the combined score is the simple average of task-completion % and
// the average goal-progress %; with no active goals, the score is task-completion % alone.
export function combinedProgressScore(taskPercent: number, goalPercents: number[]): number {
  if (goalPercents.length === 0) return taskPercent;
  const goalAverage = goalPercents.reduce((sum, p) => sum + p, 0) / goalPercents.length;
  return (taskPercent + goalAverage) / 2;
}

export type MonthlyChange =
  | { kind: 'change'; percent: number }
  | { kind: 'fresh-start' };

// spec.md: a zero-score previous month reads as "fresh start", not a
// divide-by-zero or an infinite percentage.
export function monthlyChangePercent(current: number, previous: number): MonthlyChange {
  if (previous === 0) return { kind: 'fresh-start' };
  return { kind: 'change', percent: ((current - previous) / previous) * 100 };
}
