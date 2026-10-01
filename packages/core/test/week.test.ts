import { describe, expect, it } from 'vitest';
import {
  startOfJalaaliWeek,
  endOfJalaaliWeek,
  startOfJalaaliMonth,
  endOfJalaaliMonth,
  previousJalaaliMonth,
} from '../src/week';
import { toJalaali } from '../src/jalaali';

describe('jalaali week boundaries', () => {
  it('starts the week on Saturday', () => {
    // 2026-09-30 is a Wednesday
    const wednesday = new Date(Date.UTC(2026, 8, 30));
    const start = startOfJalaaliWeek(wednesday);
    expect(start.getUTCDay()).toBe(6); // Saturday
    expect(start <= wednesday).toBe(true);
  });

  it('ends the week on Friday, 6 days after the start', () => {
    const anyDay = new Date(Date.UTC(2026, 8, 30));
    const start = startOfJalaaliWeek(anyDay);
    const end = endOfJalaaliWeek(anyDay);
    expect(end.getUTCDay()).toBe(5); // Friday
    expect((end.getTime() - start.getTime()) / 86400000).toBe(6);
  });

  it('keeps a Saturday as its own week start', () => {
    const saturday = new Date(Date.UTC(2026, 8, 26)); // a Saturday
    expect(saturday.getUTCDay()).toBe(6);
    expect(startOfJalaaliWeek(saturday).getTime()).toBe(saturday.getTime());
  });
});

describe('jalaali month boundaries', () => {
  it('start and end of month fall on day 1 and the month length', () => {
    const someDay = new Date(Date.UTC(2026, 8, 30));
    const { jy, jm } = toJalaali(someDay);
    expect(toJalaali(startOfJalaaliMonth(someDay))).toEqual({ jy, jm, jd: 1 });
    const end = toJalaali(endOfJalaaliMonth(someDay));
    expect(end.jy).toBe(jy);
    expect(end.jm).toBe(jm);
  });

  it('wraps from month 1 to month 12 of the previous year', () => {
    expect(previousJalaaliMonth(new Date(Date.UTC(2026, 2, 25)))).toEqual({
      jy: 1404,
      jm: 12,
    });
  });
});
