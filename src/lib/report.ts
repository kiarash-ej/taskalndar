import { startOfDayIn } from "@taskalndar/core";
import type { Tables } from "./database.types";
import { APP_TIME_ZONE, weekdayIndex, type IsoDate } from "./dates";
import { normalizeTag, normalizeTags } from "./tags";

// The monthly report: which time blocks match a filter ("Tuesdays of this
// month between 16 and 18", "tagged درس", "mentions کتابخانه") and what they
// add up to ("how much did I study").

// source: manual, timer or sleep (from the sleep schedule or the phone link)
export type BlockRow = Pick<
  Tables<"time_blocks">,
  "id" | "day" | "start_at" | "end_at" | "title" | "description" | "tags" | "amount" | "unit" | "cost" | "done" | "source"
>;

export interface ReportFilter {
  // inclusive day range, e.g. jalaliMonthRange() of the month reported
  from: IsoDate;
  to: IsoDate;
  // 0 = Saturday .. 6 = Friday; any of them
  weekdays?: number[];
  // "HH:MM" Tehran wall clock, [timeFrom, timeTo); timeTo may be "24:00"
  timeFrom?: string;
  timeTo?: string;
  // any of them
  tags?: string[];
  // in the title, description or tags
  text?: string;
}

// A matching block and the part of it inside the time window (all of it
// when the filter has none).
export interface ReportItem {
  block: BlockRow;
  start: Date;
  end: Date;
  minutes: number;
}

export interface ReportSummary {
  // time covered by at least one block: overlapping blocks count once
  totalMinutes: number;
  // the same per tag, most first; a block counts for each of its tags
  minutesByTag: { tag: string; minutes: number }[];
  untaggedMinutes: number;
  // amounts are whole-block values, not cut to the time window
  amountByUnit: { unit: string; amount: number }[];
  totalCost: number;
  blockCount: number;
  dayCount: number;
}

const MS_PER_MINUTE = 60_000;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/;

function minutesOfDay(time: string): number {
  if (!TIME.test(time)) throw new RangeError(`Invalid time of day: ${time}`);
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// For case- and letter-insensitive search: the tag normalization (Arabic ي/ك,
// spacing) plus lower case for Latin text.
function searchable(text: string): string {
  return normalizeTag(text).toLowerCase();
}

export function filterBlocks(blocks: BlockRow[], filter: ReportFilter): ReportItem[] {
  const windowStart = minutesOfDay(filter.timeFrom ?? "00:00");
  const windowEnd = minutesOfDay(filter.timeTo ?? "24:00");
  if (windowEnd <= windowStart) throw new RangeError("The time window must end after it starts");

  const tags = filter.tags ? normalizeTags(filter.tags) : [];
  const text = filter.text ? searchable(filter.text) : "";

  const items: ReportItem[] = [];
  for (const block of blocks) {
    if (block.day < filter.from || block.day > filter.to) continue;
    if (filter.weekdays && !filter.weekdays.includes(weekdayIndex(block.day))) continue;
    if (tags.length > 0 && !block.tags.some((t) => tags.includes(t))) continue;
    if (text && !searchable([block.title, block.description, ...block.tags].join(" ")).includes(text)) continue;

    const midnight = startOfDayIn(block.day, APP_TIME_ZONE).getTime();
    const start = Math.max(Date.parse(block.start_at), midnight + windowStart * MS_PER_MINUTE);
    const end = Math.min(Date.parse(block.end_at), midnight + windowEnd * MS_PER_MINUTE);
    if (end <= start) continue;
    items.push({ block, start: new Date(start), end: new Date(end), minutes: (end - start) / MS_PER_MINUTE });
  }
  return items.sort((a, b) => a.start.getTime() - b.start.getTime());
}

// Minutes covered by the union of the intervals.
function coveredMinutes(items: ReportItem[]): number {
  const sorted = [...items].sort((a, b) => a.start.getTime() - b.start.getTime());
  let total = 0;
  let runStart = 0;
  let runEnd = -Infinity;
  for (const { start, end } of sorted) {
    if (start.getTime() > runEnd) {
      if (runEnd > runStart) total += runEnd - runStart;
      runStart = start.getTime();
      runEnd = end.getTime();
    } else {
      runEnd = Math.max(runEnd, end.getTime());
    }
  }
  if (runEnd > runStart) total += runEnd - runStart;
  return total / MS_PER_MINUTE;
}

export function summarizeReport(items: ReportItem[]): ReportSummary {
  const byTag = new Map<string, ReportItem[]>();
  const amounts = new Map<string, number>();
  let totalCost = 0;
  for (const item of items) {
    for (const tag of item.block.tags) byTag.set(tag, [...(byTag.get(tag) ?? []), item]);
    const { amount, unit, cost } = item.block;
    if (amount !== null) amounts.set(unit ?? "", (amounts.get(unit ?? "") ?? 0) + amount);
    if (cost !== null) totalCost += cost;
  }

  return {
    totalMinutes: coveredMinutes(items),
    minutesByTag: [...byTag]
      .map(([tag, tagged]) => ({ tag, minutes: coveredMinutes(tagged) }))
      .sort((a, b) => b.minutes - a.minutes || a.tag.localeCompare(b.tag, "fa")),
    untaggedMinutes: coveredMinutes(items.filter((item) => item.block.tags.length === 0)),
    amountByUnit: [...amounts].map(([unit, amount]) => ({ unit, amount })),
    totalCost,
    blockCount: items.length,
    dayCount: new Set(items.map((item) => item.block.day)).size,
  };
}
