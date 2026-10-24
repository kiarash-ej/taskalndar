import { clockOf, formatClock } from "./blocks";
import type { IsoDate } from "./dates";
import { faDigits, WEEKDAY_NAMES } from "./format";
import type { BlockRow } from "./report";
import { tasksForDay, type CompletionRow, type TaskRow } from "./scoring";

// The home page: what is on now and next today, and one short line per day
// of the week, read from the time blocks the user has arranged and the tasks
// expected on that day.

type PlanBlock = Pick<BlockRow, "day" | "start_at" | "end_at" | "title" | "tags" | "done" | "source">;

// Free time is a gap in the plan, not an item worth listing.
const FREE = "آزاد";
const MIN_SUMMARY_MINUTES = 60;
const MAX_SUMMARY_ITEMS = 4;

const byStart = <T extends PlanBlock>(a: T, b: T) => Date.parse(a.start_at) - Date.parse(b.start_at);

// The block under way and the next one to start today, skipping sleep and
// blocks already ticked off. Either is null when there is none.
export function nowAndNext<T extends PlanBlock>(blocks: T[], now: number): { current: T | null; next: T | null } {
  const live = blocks.filter((b) => b.source !== "sleep" && !b.done).sort(byStart);
  const current = live.find((b) => Date.parse(b.start_at) <= now && now < Date.parse(b.end_at)) ?? null;
  const next = live.find((b) => Date.parse(b.start_at) > now) ?? null;
  return { current, next };
}

// "۴ ساعت و ۱۰ دقیقه", "۲ ساعت", "۵۰ دقیقه"
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${faDigits(m)} دقیقه`;
  return m === 0 ? `${faDigits(h)} ساعت` : `${faDigits(h)} ساعت و ${faDigits(m)} دقیقه`;
}

// "۶:۰۰" rather than "۰۶:۰۰"
export function shortClock(minutes: number): string {
  return faDigits(formatClock(minutes).replace(/^0(\d)/, "$1"));
}

// One day as a few readable items: blocks are grouped by title; a title that
// appears once is shown with its times ("دانشگاه ۱۳:۰۰–۱۸:۰۰"), one repeated
// across the day with its total ("مطالعه ۴ ساعت و ۱۰ دقیقه"). Free time, sleep
// and anything under an hour in total are left out to keep the line short.
export function daySummary(blocks: PlanBlock[]): { items: string[]; more: number } {
  const groups = new Map<string, { first: number; minutes: number; ranges: [number, number][] }>();
  for (const block of [...blocks].sort(byStart)) {
    const title = block.title.trim();
    if (block.source === "sleep" || title === FREE || block.tags.includes(FREE)) continue;
    const start = clockOf(block.day, block.start_at);
    const end = clockOf(block.day, block.end_at);
    const group = groups.get(title) ?? { first: start, minutes: 0, ranges: [] };
    group.minutes += end - start;
    group.ranges.push([start, end]);
    groups.set(title, group);
  }

  const items = [...groups]
    .filter(([, g]) => g.minutes >= MIN_SUMMARY_MINUTES)
    .sort(([, a], [, b]) => a.first - b.first)
    .map(([title, g]) =>
      g.ranges.length === 1
        ? `${title} ${shortClock(g.ranges[0][0])}–${shortClock(g.ranges[0][1])}`
        : `${title} ${formatDuration(g.minutes)}`,
    );
  return { items: items.slice(0, MAX_SUMMARY_ITEMS), more: Math.max(0, items.length - MAX_SUMMARY_ITEMS) };
}

// The tasks expected on `day` (a recurring one on its weekdays, a one-time one
// on its date), in the order they were made, each marked if ticked off.
export function dayTasks(
  tasks: TaskRow[],
  completions: CompletionRow[],
  day: IsoDate,
): { id: string; title: string; done: boolean }[] {
  const done = new Set(completions.filter((c) => c.done && c.date === day).map((c) => c.task_id));
  return tasksForDay(tasks, day).map((t) => ({ id: t.id, title: t.title, done: done.has(t.id) }));
}

const words = (text: string) => text.replace(/\u200c/g, "").split(/[\s،,.\-–_()]+/).filter(Boolean);

// The template named after this weekday (0 = Saturday), e.g. «برنامهٔ پنجشنبه»,
// to offer on a day with nothing arranged. Whole words only, so «شنبه» never
// matches «یکشنبه».
export function templateForWeekday<T extends { name: string }>(templates: T[], weekday: number): T | null {
  const day = WEEKDAY_NAMES[weekday].replace(/\u200c/g, "");
  return templates.find((t) => words(t.name).includes(day)) ?? null;
}
