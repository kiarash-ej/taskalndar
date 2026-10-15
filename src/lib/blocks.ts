import { startOfDayIn } from "@taskalndar/core";
import { APP_TIME_ZONE, type IsoDate } from "./dates";
import { faDigits, parseLocalizedNumber } from "./format";
import { normalizeTags } from "./tags";

// Time blocks on the day page: Tehran wall-clock times ("16:00") against the
// timestamps stored in time_blocks.start_at / end_at, and the block form.

const MS_PER_MINUTE = 60_000;
export const MINUTES_PER_DAY = 24 * 60;
export const MAX_DESCRIPTION = 10000;
const MAX_TITLE = 200;
const MAX_UNIT = 30;

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/;

// "HH:MM" (or "24:00") -> minutes since midnight; null when malformed.
export function parseClock(value: unknown): number | null {
  if (typeof value !== "string" || !CLOCK.test(value)) return null;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

// minutes since midnight -> "HH:MM" (1440 -> "24:00"), the format of
// <input type="time"> and of Postgres `time` values.
export function formatClock(minutes: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

// "۱۶:۰۰ تا ۱۸:۰۰"
export function formatClockRange(start: number, end: number): string {
  return faDigits(`${formatClock(start)} تا ${formatClock(end)}`);
}

// The instant `minutes` past `day`'s Tehran midnight, as stored in timestamptz.
export function clockToInstant(day: IsoDate, minutes: number): string {
  return new Date(startOfDayIn(day, APP_TIME_ZONE).getTime() + minutes * MS_PER_MINUTE).toISOString();
}

// Minutes from `day`'s Tehran midnight to `instant` (the next midnight is 1440).
export function clockOf(day: IsoDate, instant: string): number {
  return Math.round((Date.parse(instant) - startOfDayIn(day, APP_TIME_ZONE).getTime()) / MS_PER_MINUTE);
}

// Postgres `time` ("16:00:00") -> minutes.
export function minutesOfTime(time: string): number {
  return parseClock(time.slice(0, 5)) ?? 0;
}

// An optional non-negative number typed with Persian or Western digits and
// optional thousands separators ("۱۲۰٬۰۰۰"). undefined = not given, null = invalid.
export function parseOptionalAmount(value: FormDataEntryValue | null): number | null | undefined {
  const text = String(value ?? "").replace(/[,٬\s]/g, "");
  if (text === "") return undefined;
  const n = parseLocalizedNumber(text);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// The tag chips (one `tags` value each) plus whatever is still typed in the
// tag box, comma-separated, normalized the way the database expects.
export function parseTagFields(formData: FormData): string[] {
  const chips = formData.getAll("tags").map(String);
  const draft = String(formData.get("tag_draft") ?? "");
  return normalizeTags([...chips, ...draft.split(/[,،]/)]);
}

// The start/end pair of a block or template block. An end of "00:00" after a
// later start means midnight (24:00), since <input type="time"> can't show 24:00.
export function parseClockRange(
  formData: FormData,
): { start: number; end: number } | { error: string } {
  const start = parseClock(formData.get("start"));
  let end = parseClock(formData.get("end"));
  if (start === null || end === null) return { error: "ساعت شروع و پایان را وارد کنید." };
  if (end === 0 && start > 0) end = MINUTES_PER_DAY;
  if (start >= MINUTES_PER_DAY || end <= start) {
    return { error: "ساعت پایان باید بعد از ساعت شروع باشد (حداکثر تا نیمه‌شب)." };
  }
  return { start, end };
}

export function parseTitle(formData: FormData): string | null {
  const title = String(formData.get("title") ?? "").trim();
  return title.length > 0 && title.length <= MAX_TITLE ? title : null;
}

export interface BlockFields {
  title: string;
  start: number;
  end: number;
  tags: string[];
  description: string;
  amount: number | null;
  unit: string | null;
  cost: number | null;
}

export function parseBlockForm(formData: FormData): BlockFields | { error: string } {
  const title = parseTitle(formData);
  if (!title) return { error: "عنوان جعبه را بنویسید (حداکثر ۲۰۰ نویسه)." };

  const range = parseClockRange(formData);
  if ("error" in range) return range;

  const description = String(formData.get("description") ?? "");
  if (description.length > MAX_DESCRIPTION) return { error: "توضیحات بیش از حد طولانی است." };

  const amount = parseOptionalAmount(formData.get("amount"));
  const cost = parseOptionalAmount(formData.get("cost"));
  if (amount === null) return { error: "مقدار باید عددی صفر یا بیشتر باشد." };
  if (cost === null) return { error: "هزینه باید عددی صفر یا بیشتر باشد (به تومان)." };

  const unit = String(formData.get("unit") ?? "").trim();
  if (unit && amount === undefined) return { error: "برای واحد، مقدار را هم بنویسید." };
  if (unit.length > MAX_UNIT) return { error: "واحد حداکثر ۳۰ نویسه است." };

  return {
    title,
    ...range,
    tags: parseTagFields(formData),
    description,
    amount: amount ?? null,
    unit: unit || null,
    cost: cost ?? null,
  };
}
