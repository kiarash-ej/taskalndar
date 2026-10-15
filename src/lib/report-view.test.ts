import { describe, expect, it } from "vitest";
import type { ReportSummary } from "./report";
import { formatDuration, monthParam, parseMonthParam, parseReportQuery, tagShares } from "./report-view";

// 2026-10-15 is 23 Mehr 1405; Mehr 1405 runs 2026-09-23 .. 2026-10-22
const TODAY = "2026-10-15";

describe("parseReportQuery", () => {
  it("defaults to the current Jalali month with no filters", () => {
    const q = parseReportQuery({}, TODAY);
    expect(q.month).toEqual({ jy: 1405, jm: 7 });
    expect(q.filter).toEqual({ from: "2026-09-23", to: "2026-10-22" });
    expect(q.warning).toBeNull();
  });

  it("reads month, weekdays, tags, text and a time window", () => {
    const q = parseReportQuery(
      { month: "1405-6", wd: ["4", "0", "9"], tag: ["درس", "كار"], q: "  کتاب ", from: "16:00", to: "18:00" },
      TODAY,
    );
    expect(q.filter).toEqual({
      from: "2026-08-23",
      to: "2026-09-22",
      weekdays: [0, 4],
      tags: ["درس", "کار"],
      text: "کتاب",
      timeFrom: "16:00",
      timeTo: "18:00",
    });
  });

  it("ignores empty fields from a submitted form and all seven weekdays", () => {
    const q = parseReportQuery({ from: "", to: "", q: "", wd: ["0", "1", "2", "3", "4", "5", "6"] }, TODAY);
    expect(q.filter).toEqual({ from: "2026-09-23", to: "2026-10-22" });
  });

  it("reads an end of 00:00 after a start as midnight, and fills an open-ended window", () => {
    expect(parseReportQuery({ from: "22:00", to: "00:00" }, TODAY).filter).toMatchObject({ timeFrom: "22:00", timeTo: "24:00" });
    expect(parseReportQuery({ to: "09:00" }, TODAY).filter).toMatchObject({ timeFrom: "00:00", timeTo: "09:00" });
  });

  it("drops a backwards or malformed window with a warning instead of failing", () => {
    const backwards = parseReportQuery({ from: "18:00", to: "16:00" }, TODAY);
    expect(backwards.filter.timeFrom).toBeUndefined();
    expect(backwards.warning).not.toBeNull();
    expect(parseReportQuery({ from: "25:00" }, TODAY).warning).not.toBeNull();
  });

  it("falls back to the current month for a bad month", () => {
    expect(parseReportQuery({ month: "1405-13" }, TODAY).month).toEqual({ jy: 1405, jm: 7 });
    expect(parseMonthParam("abc")).toBeNull();
    expect(monthParam({ jy: 1405, jm: 7 })).toBe("1405-7");
  });
});

describe("formatDuration", () => {
  it("writes hours and minutes in Persian", () => {
    expect(formatDuration(0)).toBe("۰ دقیقه");
    expect(formatDuration(45)).toBe("۴۵ دقیقه");
    expect(formatDuration(180)).toBe("۳ ساعت");
    expect(formatDuration(135.4)).toBe("۲ ساعت و ۱۵ دقیقه");
  });
});

describe("tagShares", () => {
  const summary = (over: Partial<ReportSummary>): ReportSummary => ({
    totalMinutes: 120,
    minutesByTag: [],
    untaggedMinutes: 0,
    amountByUnit: [],
    totalCost: 0,
    blockCount: 0,
    dayCount: 0,
    ...over,
  });

  it("shares each tag of the overlap-free total, untagged time last", () => {
    expect(
      tagShares(summary({ minutesByTag: [{ tag: "درس", minutes: 120 }, { tag: "دانشگاه", minutes: 60 }], untaggedMinutes: 30 })),
    ).toEqual([
      { tag: "درس", minutes: 120, percent: 100 },
      { tag: "دانشگاه", minutes: 60, percent: 50 },
      { tag: "", minutes: 30, percent: 25 },
    ]);
  });

  it("doesn't divide by zero", () => {
    expect(tagShares(summary({ totalMinutes: 0, minutesByTag: [{ tag: "x", minutes: 0 }] }))[0].percent).toBe(0);
  });
});
