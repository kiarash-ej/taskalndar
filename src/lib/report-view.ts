import { formatClock, MINUTES_PER_DAY, parseClock } from "./blocks";
import { jalaliMonthOf, jalaliMonthRange, type IsoDate, type JalaliMonth } from "./dates";
import { faDigits } from "./format";
import type { ReportFilter, ReportSummary } from "./report";
import { normalizeWeekdays } from "./schedule";
import { normalizeTags } from "./tags";

// The report page's filters live in the URL (?month=1405-7&wd=0&from=16:00…)
// so a report can be bookmarked, shared and reloaded.

export type SearchParams = Record<string, string | string[] | undefined>;

export interface ReportQuery {
  month: JalaliMonth;
  filter: ReportFilter;
  // the window as typed, for the form ("" = none)
  timeFrom: string;
  timeTo: string;
  // a filter that couldn't be used, e.g. a time window that ends before it starts
  warning: string | null;
}

const MAX_QUERY = 100;

function all(value: string | string[] | undefined): string[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function first(value: string | string[] | undefined): string {
  return all(value)[0] ?? "";
}

// "1405-7" -> { jy: 1405, jm: 7 }
export function parseMonthParam(value: string): JalaliMonth | null {
  const match = /^(\d{4})-(\d{1,2})$/.exec(value);
  if (!match) return null;
  const jy = Number(match[1]);
  const jm = Number(match[2]);
  return jy >= 1300 && jy <= 1500 && jm >= 1 && jm <= 12 ? { jy, jm } : null;
}

export function monthParam({ jy, jm }: JalaliMonth): string {
  return `${jy}-${jm}`;
}

export function parseReportQuery(params: SearchParams, today: IsoDate): ReportQuery {
  const month = parseMonthParam(first(params.month)) ?? jalaliMonthOf(today);
  const { start, end } = jalaliMonthRange(month);
  const filter: ReportFilter = { from: start, to: end };
  let warning: string | null = null;

  const weekdays = normalizeWeekdays(all(params.wd));
  if (weekdays.length > 0 && weekdays.length < 7) filter.weekdays = weekdays;

  const tags = normalizeTags(all(params.tag));
  if (tags.length > 0) filter.tags = tags;

  const text = first(params.q).trim().slice(0, MAX_QUERY);
  if (text) filter.text = text;

  // Like the block form: an end of 00:00 after a later start means midnight.
  const fromText = first(params.from);
  const toText = first(params.to);
  const from = fromText ? parseClock(fromText) : null;
  let to = toText ? parseClock(toText) : null;
  if (to === 0 && from !== null && from > 0) to = MINUTES_PER_DAY;
  if ((fromText && from === null) || (toText && to === null)) {
    warning = "ساعت واردشده معتبر نیست؛ فیلتر ساعت اعمال نشد.";
  } else if (from !== null || to !== null) {
    const windowFrom = from ?? 0;
    const windowTo = to ?? MINUTES_PER_DAY;
    if (windowTo <= windowFrom) {
      warning = "ساعت پایان باید بعد از ساعت شروع باشد؛ فیلتر ساعت اعمال نشد.";
    } else {
      filter.timeFrom = formatClock(windowFrom);
      filter.timeTo = formatClock(windowTo);
    }
  }

  return { month, filter, timeFrom: fromText, timeTo: toText, warning };
}

// "۲ ساعت و ۱۵ دقیقه", "۴۵ دقیقه", "۳ ساعت"
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${faDigits(m)} دقیقه`;
  if (m === 0) return `${faDigits(h)} ساعت`;
  return `${faDigits(h)} ساعت و ${faDigits(m)} دقیقه`;
}

export interface TagShare {
  tag: string;
  minutes: number;
  // of the report's total (overlap-free) time; tags can add up to more than 100
  percent: number;
}

export function tagShares(summary: ReportSummary): TagShare[] {
  const rows = summary.minutesByTag.map(({ tag, minutes }) => ({ tag, minutes }));
  if (summary.untaggedMinutes > 0) rows.push({ tag: "", minutes: summary.untaggedMinutes });
  return rows.map((row) => ({
    ...row,
    percent: summary.totalMinutes > 0 ? (row.minutes / summary.totalMinutes) * 100 : 0,
  }));
}
