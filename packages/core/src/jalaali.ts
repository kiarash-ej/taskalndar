import jalaali from 'jalaali-js';

export interface JalaaliDate {
  jy: number;
  jm: number;
  jd: number;
}

// Dates are handled at UTC midnight throughout this package: a "day" is a
// calendar date, not a timestamp, and task_completions/goal_logs store
// `date` columns with no time component.
export function toJalaali(date: Date): JalaaliDate {
  return jalaali.toJalaali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function toGregorian(j: JalaaliDate): Date {
  const { gy, gm, gd } = jalaali.toGregorian(j.jy, j.jm, j.jd);
  return new Date(Date.UTC(gy, gm - 1, gd));
}

export function jalaaliMonthLength(jy: number, jm: number): number {
  return jalaali.jalaaliMonthLength(jy, jm);
}

export function formatJalaali(date: Date): string {
  const { jy, jm, jd } = toJalaali(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}
