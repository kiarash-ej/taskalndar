import { describe, expect, it } from "vitest";
import { faDigits, parseLocalizedNumber, formatDayMonth, formatLongDate, formatMonthYear, formatPercent, formatShortDate } from "./format";

describe("format", () => {
  it("writes Jalali dates in Persian", () => {
    expect(formatLongDate("2026-10-01")).toBe("پنجشنبه ۹ مهر ۱۴۰۵");
    expect(formatDayMonth("2026-03-21")).toBe("۱ فروردین");
    expect(formatShortDate("2026-10-01")).toBe("۱۴۰۵/۰۷/۰۹");
    expect(formatMonthYear({ jy: 1405, jm: 12 })).toBe("اسفند ۱۴۰۵");
  });

  it("uses Persian digits without grouping for years and rounds percents", () => {
    expect(faDigits(1405)).toBe("۱۴۰۵");
    expect(formatPercent(67.5)).toBe("۶۸٪");
    expect(formatPercent(0)).toBe("۰٪");
  });
});

describe("parseLocalizedNumber", () => {
  it("reads Persian, Arabic-Indic and Western digits", () => {
    expect(parseLocalizedNumber("۱۲٫۵")).toBe(12.5);
    expect(parseLocalizedNumber("١٢")).toBe(12);
    expect(parseLocalizedNumber(" 3.25 ")).toBe(3.25);
  });

  it("rejects empty or non-numeric input", () => {
    expect(parseLocalizedNumber("")).toBeNaN();
    expect(parseLocalizedNumber("ده")).toBeNaN();
    // "," is ambiguous (thousands or decimal), so it is rejected rather than guessed
    expect(parseLocalizedNumber("1,000")).toBeNaN();
  });
});
