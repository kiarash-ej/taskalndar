import { clockOf, MINUTES_PER_DAY } from "./blocks";
import { calendarDateOf, type IsoDate } from "./dates";
import { nightOf, type SleepSuggestion } from "./sleep";

// Suggests when to do the day's tasks: each one, in list order, goes into the
// earliest free stretch of the waking day long enough for it. Nothing here
// writes anything; the planner shows the result and saves only what the user
// accepts. Times are minutes since the day's Tehran midnight.

export interface Interval {
  start: number;
  end: number;
}

export interface ArrangeTask {
  id: string;
  title: string;
  // how long it needs
  minutes: number;
}

export interface Placement extends Interval {
  id: string;
  title: string;
}

// Starts land on multiples of this many minutes.
const STEP = 5;
// The waking day when there is no sleep to go by.
export const DEFAULT_WINDOW: Interval = { start: 8 * 60, end: 23 * 60 };

const roundUp = (minutes: number) => Math.ceil(minutes / STEP) * STEP;

// The parts of `window` not covered by any of `busy`, in order.
export function freeIntervals(window: Interval, busy: Interval[]): Interval[] {
  const free: Interval[] = [];
  let cursor = window.start;
  for (const b of [...busy].sort((x, y) => x.start - y.start)) {
    if (b.end <= cursor) continue;
    if (b.start >= window.end) break;
    if (b.start > cursor) free.push({ start: cursor, end: Math.min(b.start, window.end) });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < window.end) free.push({ start: cursor, end: window.end });
  return free;
}

// Places each task at the earliest rounded start where it fits, keeping
// `gap` minutes after anything busy or already placed.
export function arrangeTasks(
  tasks: ArrangeTask[],
  window: Interval,
  busy: Interval[],
  gap = 0,
): { placed: Placement[]; unplaced: ArrangeTask[] } {
  const taken = busy.map((b) => ({ start: b.start, end: b.end + gap }));
  const placed: Placement[] = [];
  const unplaced: ArrangeTask[] = [];
  for (const task of tasks) {
    const slot = freeIntervals(window, taken)
      .map((f) => ({ start: roundUp(f.start), end: f.end }))
      .find((f) => f.end - f.start >= task.minutes);
    if (!slot) {
      unplaced.push(task);
      continue;
    }
    const p = { id: task.id, title: task.title, start: slot.start, end: slot.start + task.minutes };
    placed.push(p);
    taken.push({ start: p.start, end: p.end + gap });
  }
  placed.sort((a, b) => a.start - b.start);
  return { placed, unplaced };
}

export interface DayBlockTimes {
  start_at: string;
  end_at: string;
  source: string;
}

// The part of `day` left to arrange: from waking (the end of the previous
// night's sleep) to bedtime (the start of this night's), counting both
// accepted sleep blocks and the schedule's suggestions, and on today from
// now. Other blocks are busy. Null for a day already over.
export function arrangeWindow(
  day: IsoDate,
  blocks: DayBlockTimes[],
  sleepSuggestions: SleepSuggestion[],
  now: Date,
): { window: Interval; busy: Interval[] } | null {
  const today = calendarDateOf(now);
  if (day < today) return null;
  const clip = (start: string, end: string): Interval => ({
    start: Math.max(0, clockOf(day, start)),
    end: Math.min(MINUTES_PER_DAY, clockOf(day, end)),
  });

  const sleeps = [
    ...blocks.filter((b) => b.source === "sleep").map((b) => ({ night: nightOf(new Date(b.start_at)), ...clip(b.start_at, b.end_at) })),
    ...sleepSuggestions.map((s) => ({ night: s.night, ...clip(s.bedAt, s.wakeAt) })),
  ].filter((s) => s.end > s.start);
  const morning = sleeps.filter((s) => s.night < day);
  const evening = sleeps.filter((s) => s.night === day);
  const window = {
    start: morning.length ? Math.max(...morning.map((s) => s.end)) : DEFAULT_WINDOW.start,
    end: evening.length ? Math.min(...evening.map((s) => s.start)) : DEFAULT_WINDOW.end,
  };
  if (day === today) window.start = Math.max(window.start, roundUp(clockOf(day, now.toISOString())));

  const busy = blocks.filter((b) => b.source !== "sleep").map((b) => clip(b.start_at, b.end_at));
  return { window, busy };
}
