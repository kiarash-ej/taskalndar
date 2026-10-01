import {
  jalaaliMonthLength,
  toGregorian,
  toJalaali,
  type JalaaliDate,
} from "@taskalndar/core";

// A calendar day as "YYYY-MM-DD" — the format of every `date` column in the
// database. ISO strings of the same length compare correctly as strings.
export type IsoDate = string;

export interface JalaliMonth {
  jy: number;
  jm: number;
}

// The calendar the app's "today" and day boundaries follow. The server runs
// in UTC, so without this the day would flip at 03:30 Tehran time.
export const APP_TIME_ZONE = "Asia/Tehran";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const dayInAppZone = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// packages/core works on Dates at UTC midnight; these convert to and from that.
export function isoToDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function dateToIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(value: unknown): value is IsoDate {
  return (
    typeof value === "string" &&
    ISO_DATE.test(value) &&
    dateToIso(isoToDate(value)) === value
  );
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return dateToIso(new Date(isoToDate(iso).getTime() + days * MS_PER_DAY));
}

// Every day from start to end, both inclusive.
export function eachDay(start: IsoDate, end: IsoDate): IsoDate[] {
  const days: IsoDate[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

// The calendar day an instant (e.g. a timestamptz column) falls on in APP_TIME_ZONE.
export function calendarDateOf(instant: Date | string): IsoDate {
  const parts = dayInAppZone.formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function todayIso(now: Date = new Date()): IsoDate {
  return calendarDateOf(now);
}

export function jalaliOf(iso: IsoDate): JalaaliDate {
  return toJalaali(isoToDate(iso));
}

export function isoFromJalali(date: JalaaliDate): IsoDate {
  return dateToIso(toGregorian(date));
}

export function jalaliMonthOf(iso: IsoDate): JalaliMonth {
  const { jy, jm } = jalaliOf(iso);
  return { jy, jm };
}

export function shiftJalaliMonth({ jy, jm }: JalaliMonth, delta: number): JalaliMonth {
  const index = jy * 12 + (jm - 1) + delta;
  return { jy: Math.floor(index / 12), jm: (index % 12) + 1 };
}

export function jalaliMonthRange({ jy, jm }: JalaliMonth): { start: IsoDate; end: IsoDate } {
  return {
    start: isoFromJalali({ jy, jm, jd: 1 }),
    end: isoFromJalali({ jy, jm, jd: jalaaliMonthLength(jy, jm) }),
  };
}

// Position in the Iranian week: 0 = Saturday ... 6 = Friday.
export function weekdayIndex(iso: IsoDate): number {
  return (isoToDate(iso).getUTCDay() + 1) % 7;
}
