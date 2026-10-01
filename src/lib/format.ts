import { jalaliOf, weekdayIndex, type IsoDate, type JalaliMonth } from "./dates";

export const JALALI_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

// Saturday first, matching weekdayIndex().
export const WEEKDAY_NAMES = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
];

export const WEEKDAY_INITIALS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

// Western digits -> Persian digits, nothing else (no grouping), e.g. for years.
export function faDigits(value: number | string): string {
  return String(value).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

// Parses a number typed with Persian (۱۲٫۵), Arabic-Indic (١٢) or Western digits.
export function parseLocalizedNumber(input: string): number {
  const western = input
    .trim()
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/٫/g, ".");
  return western === "" ? NaN : Number(western);
}

const numberFormat = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 });

// Amounts such as goal targets: Persian digits with grouping and up to 2 decimals.
export function faNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatPercent(value: number): string {
  return `${faDigits(Math.round(value))}٪`;
}

export function formatMonthYear({ jy, jm }: JalaliMonth): string {
  return `${JALALI_MONTH_NAMES[jm - 1]} ${faDigits(jy)}`;
}

// "۹ مهر"
export function formatDayMonth(iso: IsoDate): string {
  const { jm, jd } = jalaliOf(iso);
  return `${faDigits(jd)} ${JALALI_MONTH_NAMES[jm - 1]}`;
}

// "چهارشنبه ۹ مهر ۱۴۰۵"
export function formatLongDate(iso: IsoDate): string {
  const { jy } = jalaliOf(iso);
  return `${WEEKDAY_NAMES[weekdayIndex(iso)]} ${formatDayMonth(iso)} ${faDigits(jy)}`;
}

// "۱۴۰۵/۰۷/۰۹"
export function formatShortDate(iso: IsoDate): string {
  const { jy, jm, jd } = jalaliOf(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return faDigits(`${jy}/${pad(jm)}/${pad(jd)}`);
}
