import { describe, expect, it } from "vitest";
import {
  calendarDateOf,
  eachDay,
  isIsoDate,
  jalaliMonthRange,
  shiftJalaliMonth,
  weekdayIndex,
} from "./dates";

describe("calendarDateOf", () => {
  it("uses Tehran's day, not UTC's", () => {
    // 20:00 UTC is 23:30 in Tehran; 21:00 UTC is already 00:30 the next day.
    expect(calendarDateOf("2026-09-30T20:00:00Z")).toBe("2026-09-30");
    expect(calendarDateOf("2026-09-30T21:00:00Z")).toBe("2026-10-01");
  });
});

describe("isIsoDate", () => {
  it("accepts real calendar days only", () => {
    expect(isIsoDate("2026-10-01")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("1405/07/09")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});

describe("jalali months", () => {
  it("shifts across the year boundary in both directions", () => {
    expect(shiftJalaliMonth({ jy: 1405, jm: 1 }, -1)).toEqual({ jy: 1404, jm: 12 });
    expect(shiftJalaliMonth({ jy: 1404, jm: 12 }, 1)).toEqual({ jy: 1405, jm: 1 });
    expect(shiftJalaliMonth({ jy: 1405, jm: 7 }, -18)).toEqual({ jy: 1404, jm: 1 });
  });

  it("gives a month's first and last Gregorian day", () => {
    // Mehr 1405 has 30 days: 2026-09-23 .. 2026-10-22
    expect(jalaliMonthRange({ jy: 1405, jm: 7 })).toEqual({
      start: "2026-09-23",
      end: "2026-10-22",
    });
  });
});

describe("eachDay / weekdayIndex", () => {
  it("lists days inclusively", () => {
    expect(eachDay("2026-09-29", "2026-10-02")).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
    expect(eachDay("2026-10-02", "2026-10-01")).toEqual([]);
  });

  it("counts the week from Saturday", () => {
    expect(weekdayIndex("2026-09-26")).toBe(0); // Saturday
    expect(weekdayIndex("2026-10-02")).toBe(6); // Friday
  });
});
