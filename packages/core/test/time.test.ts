import { describe, expect, it } from 'vitest';
import { calendarDayIn, splitAtMidnights, startOfDayIn } from '../src/time';

const TEHRAN = 'Asia/Tehran';
const at = (iso: string) => new Date(iso);

describe('calendarDayIn / startOfDayIn', () => {
  it('reads the calendar day in the given zone', () => {
    // 21:00 UTC is already 00:30 the next day in Tehran
    expect(calendarDayIn(at('2026-10-13T21:00:00Z'), TEHRAN)).toBe('2026-10-14');
    expect(calendarDayIn(at('2026-10-13T20:00:00Z'), TEHRAN)).toBe('2026-10-13');
  });

  it('finds the instant a day starts', () => {
    expect(startOfDayIn('2026-10-14', TEHRAN).toISOString()).toBe('2026-10-13T20:30:00.000Z');
  });

  it('handles daylight saving zones', () => {
    // Berlin switches to UTC+2 at 02:00 on 2026-03-29; midnight is still UTC+1.
    expect(startOfDayIn('2026-03-29', 'Europe/Berlin').toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(startOfDayIn('2026-03-30', 'Europe/Berlin').toISOString()).toBe('2026-03-29T22:00:00.000Z');
  });
});

describe('splitAtMidnights', () => {
  it('keeps a span inside one day whole', () => {
    expect(splitAtMidnights(at('2026-10-13T16:00:00+03:30'), at('2026-10-13T18:00:00+03:30'), TEHRAN))
      .toEqual([{ day: '2026-10-13', start: at('2026-10-13T16:00:00+03:30'), end: at('2026-10-13T18:00:00+03:30') }]);
  });

  it('does not create an empty segment for a span ending exactly at midnight', () => {
    expect(splitAtMidnights(at('2026-10-13T22:00:00+03:30'), at('2026-10-14T00:00:00+03:30'), TEHRAN)).toHaveLength(1);
  });

  it('cuts a span at each Tehran midnight it crosses', () => {
    const segments = splitAtMidnights(at('2026-10-13T23:00:00+03:30'), at('2026-10-15T01:30:00+03:30'), TEHRAN);
    expect(segments).toEqual([
      { day: '2026-10-13', start: at('2026-10-13T23:00:00+03:30'), end: at('2026-10-14T00:00:00+03:30') },
      { day: '2026-10-14', start: at('2026-10-14T00:00:00+03:30'), end: at('2026-10-15T00:00:00+03:30') },
      { day: '2026-10-15', start: at('2026-10-15T00:00:00+03:30'), end: at('2026-10-15T01:30:00+03:30') },
    ]);
  });

  it('rejects an empty or reversed span', () => {
    const t = at('2026-10-13T16:00:00+03:30');
    expect(() => splitAtMidnights(t, t, TEHRAN)).toThrow(RangeError);
    expect(() => splitAtMidnights(t, at('2026-10-13T15:00:00+03:30'), TEHRAN)).toThrow(RangeError);
  });
});
