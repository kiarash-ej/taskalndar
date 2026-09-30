import { describe, expect, it } from 'vitest';
import { toJalaali, toGregorian, formatJalaali } from '../src/jalaali';

describe('jalaali conversion', () => {
  it('converts a known Gregorian date to Jalaali', () => {
    // 2026-03-21 is Nowruz: 1405-01-01
    const j = toJalaali(new Date(Date.UTC(2026, 2, 21)));
    expect(j).toEqual({ jy: 1405, jm: 1, jd: 1 });
  });

  it('round-trips Jalaali -> Gregorian -> Jalaali', () => {
    const original = { jy: 1405, jm: 6, jd: 15 };
    const gregorian = toGregorian(original);
    expect(toJalaali(gregorian)).toEqual(original);
  });

  it('formats as YYYY/MM/DD with zero-padding', () => {
    const date = toGregorian({ jy: 1405, jm: 1, jd: 5 });
    expect(formatJalaali(date)).toBe('1405/01/05');
  });
});
