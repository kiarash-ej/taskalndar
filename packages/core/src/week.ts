import { toJalaali, toGregorian, jalaaliMonthLength } from './jalaali';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The Iranian week starts on Saturday. JS Date#getUTCDay() is 0=Sunday..6=Saturday,
// so the offset back to the most recent Saturday is (day + 1) % 7.
export function startOfJalaaliWeek(date: Date): Date {
  const offset = (date.getUTCDay() + 1) % 7;
  return new Date(date.getTime() - offset * MS_PER_DAY);
}

export function endOfJalaaliWeek(date: Date): Date {
  return new Date(startOfJalaaliWeek(date).getTime() + 6 * MS_PER_DAY);
}

export function startOfJalaaliMonth(date: Date): Date {
  const { jy, jm } = toJalaali(date);
  return toGregorian({ jy, jm, jd: 1 });
}

export function endOfJalaaliMonth(date: Date): Date {
  const { jy, jm } = toJalaali(date);
  return toGregorian({ jy, jm, jd: jalaaliMonthLength(jy, jm) });
}

// The Jalaali month right before the one `date` falls in, as a (jy, jm) pair
// rather than a Date — callers use it to compute that month's own boundaries.
export function previousJalaaliMonth(date: Date): { jy: number; jm: number } {
  const { jy, jm } = toJalaali(date);
  return jm === 1 ? { jy: jy - 1, jm: 12 } : { jy, jm: jm - 1 };
}
