import { describe, expect, it } from "vitest";
import {
  goalPeriodOf,
  goalPeriodWindow,
  normalizeWeekdays,
  parseGoalPeriod,
  parseSchedule,
  scheduleIncludes,
  scheduleLabel,
  taskKindOf,
} from "./schedule";

function form(kind: string, weekdays: string[] = []) {
  const f = new FormData();
  f.set("kind", kind);
  for (const d of weekdays) f.append("weekdays", d);
  return f;
}

describe("parseSchedule", () => {
  it("maps every day and one-time to is_recurring without weekdays", () => {
    expect(parseSchedule(form("recurring"))).toEqual({ is_recurring: true, weekdays: null });
    expect(parseSchedule(form("once", ["1"]))).toEqual({ is_recurring: false, weekdays: null });
  });

  it("keeps chosen weekdays sorted and de-duplicated, dropping junk", () => {
    expect(parseSchedule(form("weekdays", ["4", "0", "4", "9", "x", "-1", "2.5"]))).toEqual({
      is_recurring: true,
      weekdays: [0, 4],
    });
  });

  it("rejects weekdays with no day and folds all seven into every day", () => {
    expect(parseSchedule(form("weekdays"))).toBeNull();
    expect(parseSchedule(form("weekdays", ["0", "1", "2", "3", "4", "5", "6"]))).toEqual({
      is_recurring: true,
      weekdays: null,
    });
  });
});

describe("task schedule display", () => {
  it("derives the kind and label from the row", () => {
    expect(taskKindOf({ is_recurring: false, weekdays: null })).toBe("once");
    expect(taskKindOf({ is_recurring: true, weekdays: [] })).toBe("recurring");
    expect(scheduleLabel({ is_recurring: true, weekdays: null })).toBe("هر روز");
    expect(scheduleLabel({ is_recurring: true, weekdays: [6, 0] })).toBe("شنبه، جمعه");
  });

  it("knows which calendar days a schedule includes", () => {
    // 2026-10-10 is a Saturday, 2026-10-16 a Friday
    expect(scheduleIncludes({ is_recurring: true, weekdays: [0] }, "2026-10-10")).toBe(true);
    expect(scheduleIncludes({ is_recurring: true, weekdays: [0] }, "2026-10-16")).toBe(false);
    expect(scheduleIncludes({ is_recurring: true, weekdays: null }, "2026-10-16")).toBe(true);
  });

  it("normalizes weekday arrays", () => {
    expect(normalizeWeekdays([3, "1", 3, 7])).toEqual([1, 3]);
  });
});

describe("goal periods", () => {
  it("parses only weekly and monthly, treating stored unknowns as monthly", () => {
    expect(parseGoalPeriod("weekly")).toBe("weekly");
    expect(parseGoalPeriod("daily")).toBeNull();
    expect(goalPeriodOf({ period: "weekly" })).toBe("weekly");
    expect(goalPeriodOf({ period: "yearly" })).toBe("monthly");
  });

  it("spans the Saturday–Friday week, including one that crosses a month", () => {
    // Thursday 2026-10-15; that week runs Sat 10 Oct to Fri 16 Oct
    expect(goalPeriodWindow("weekly", "2026-10-15")).toEqual({
      start: "2026-10-10",
      end: "2026-10-16",
      dayOfPeriod: 6,
      length: 7,
    });
    // 1 Mehr 1405 is Wed 2026-09-23; its week started in Shahrivar
    expect(goalPeriodWindow("weekly", "2026-09-23").start).toBe("2026-09-19");
  });

  it("spans the Jalali month for monthly goals", () => {
    // 2026-10-15 is 23 Mehr 1405 (a 30-day month)
    expect(goalPeriodWindow("monthly", "2026-10-15")).toEqual({
      start: "2026-09-23",
      end: "2026-10-22",
      dayOfPeriod: 23,
      length: 30,
    });
  });
});
