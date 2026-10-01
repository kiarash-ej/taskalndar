import { describe, expect, it } from "vitest";
import {
  compareWithPreviousMonth,
  isTaskActiveOn,
  scorePeriod,
  scoringWindowStart,
  weekStarts,
  type GoalRow,
  type ProgressData,
  type TaskRow,
} from "./scoring";

const task = (over: Partial<TaskRow>): TaskRow => ({
  id: "t",
  title: "task",
  is_recurring: true,
  date: "2026-09-26",
  archived_at: null,
  ...over,
});

const goal = (over: Partial<GoalRow>): GoalRow => ({
  id: "g",
  title: "goal",
  target_value: 30,
  unit: "km",
  created_at: "2026-09-01T08:00:00Z",
  archived_at: null,
  ...over,
});

const empty: ProgressData = { tasks: [], completions: [], goals: [], goalLogs: [] };

// The Jalali week of Sat 2026-09-26 .. Fri 2026-10-02 lies inside Mehr 1405 (30 days).
const WEEK = { start: "2026-09-26", end: "2026-10-02" };

describe("isTaskActiveOn", () => {
  it("repeats a recurring task from its date on", () => {
    const t = task({ date: "2026-09-28" });
    expect(isTaskActiveOn(t, "2026-09-27")).toBe(false);
    expect(isTaskActiveOn(t, "2026-09-28")).toBe(true);
    expect(isTaskActiveOn(t, "2026-12-01")).toBe(true);
  });

  it("shows a one-time task on its date only", () => {
    const t = task({ is_recurring: false, date: "2026-09-28" });
    expect(isTaskActiveOn(t, "2026-09-28")).toBe(true);
    expect(isTaskActiveOn(t, "2026-09-29")).toBe(false);
  });

  it("stops on the (Tehran) day it was archived", () => {
    // 2026-09-29T21:00Z is 00:30 on 2026-09-30 in Tehran
    const t = task({ archived_at: "2026-09-29T21:00:00Z" });
    expect(isTaskActiveOn(t, "2026-09-29")).toBe(true);
    expect(isTaskActiveOn(t, "2026-09-30")).toBe(false);
  });
});

describe("scorePeriod", () => {
  it("scores only the days up to today", () => {
    const data: ProgressData = {
      ...empty,
      tasks: [task({ id: "a" }), task({ id: "b" })],
      completions: [
        { task_id: "a", date: "2026-09-26", done: true },
        { task_id: "b", date: "2026-09-27", done: true },
        { task_id: "a", date: "2026-09-28", done: true },
        { task_id: "b", date: "2026-09-28", done: false },
      ],
    };
    // Sat..Mon = 3 days x 2 tasks = 6 expected, 3 done
    const s = scorePeriod(data, WEEK.start, WEEK.end, "2026-09-28");
    expect(s.expectedTasks).toBe(6);
    expect(s.doneTasks).toBe(3);
    expect(s.taskPercent).toBe(50);
    expect(s.score).toBe(50);
    expect(s.goalPercent).toBeNull();
  });

  it("prorates a monthly goal over the days scored", () => {
    // target 30 over a 30-day month = 1/day; a full week expects 7
    const data: ProgressData = {
      ...empty,
      goals: [goal({})],
      goalLogs: [
        { id: "l1", goal_id: "g", date: "2026-09-27", amount: 2 },
        { id: "l2", goal_id: "g", date: "2026-10-01", amount: 1.5 },
        { id: "l3", goal_id: "g", date: "2026-09-25", amount: 100 }, // before the week
      ],
    };
    const s = scorePeriod(data, WEEK.start, WEEK.end, "2026-10-10");
    expect(s.goalPercents).toEqual([50]);
    expect(s.taskPercent).toBeNull();
    expect(s.score).toBe(50); // goals alone
  });

  it("caps each goal at 100% and averages it 50/50 with tasks", () => {
    const data: ProgressData = {
      tasks: [task({ id: "a" })],
      completions: [{ task_id: "a", date: "2026-09-26", done: true }],
      goals: [goal({})],
      goalLogs: [{ id: "l", goal_id: "g", date: "2026-09-26", amount: 50 }],
    };
    // one day: tasks 1/1 = 100%, goal 50/1 -> capped 100%
    const s = scorePeriod(data, "2026-09-26", "2026-09-26", "2026-09-26");
    expect(s.score).toBe(100);

    const twoDays = scorePeriod(
      { ...data, goalLogs: [] },
      "2026-09-26",
      "2026-09-27",
      "2026-09-27",
    );
    // tasks 1/2 = 50%, goal 0% -> (50 + 0) / 2
    expect(twoDays.score).toBe(25);
  });

  it("ignores goals outside their active days", () => {
    const data: ProgressData = {
      ...empty,
      goals: [
        goal({ id: "late", created_at: "2026-10-05T08:00:00Z" }),
        goal({ id: "gone", archived_at: "2026-09-20T08:00:00Z" }),
      ],
    };
    const s = scorePeriod(data, WEEK.start, WEEK.end, "2026-10-10");
    expect(s.goalPercents).toEqual([]);
    expect(s.hasData).toBe(false);
    expect(s.score).toBe(0);
  });
});

describe("weeks and months", () => {
  it("lists week starts oldest first, ending with the current week", () => {
    const starts = weekStarts("2026-10-01", 8);
    expect(starts).toHaveLength(8);
    expect(starts[7]).toBe("2026-09-26");
    expect(starts[0]).toBe("2026-08-08");
  });

  it("reaches back far enough for both weeks and months", () => {
    // 8 weeks back: 2026-08-08; the 6 months ending with Mehr 1405 start at
    // Ordibehesht 1405 = 2026-04-21
    expect(scoringWindowStart("2026-10-01", 8, 6)).toBe("2026-04-21");
    expect(scoringWindowStart("2026-10-01", 8, 1)).toBe("2026-08-08");
  });

  it("reports a fresh start when the previous month scored 0", () => {
    const data: ProgressData = {
      ...empty,
      tasks: [task({ date: "2026-09-23" })],
      completions: [{ task_id: "t", date: "2026-09-23", done: true }],
    };
    const { change, current, previous } = compareWithPreviousMonth(data, "2026-09-24");
    expect(previous.hasData).toBe(false);
    expect(current.score).toBe(50);
    expect(change).toEqual({ kind: "fresh-start" });
  });

  it("computes the change against last month's score", () => {
    // task since Shahrivar 1405 (2026-08-23 .. 2026-09-22): done every day there,
    // then half of Mehr's first 4 days
    const shahrivar = Array.from({ length: 31 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 7, 23 + i)).toISOString().slice(0, 10);
      return { task_id: "t", date: d, done: true };
    });
    const data: ProgressData = {
      ...empty,
      tasks: [task({ date: "2026-08-23" })],
      completions: [
        ...shahrivar,
        { task_id: "t", date: "2026-09-23", done: true },
        { task_id: "t", date: "2026-09-25", done: true },
      ],
    };
    const { change } = compareWithPreviousMonth(data, "2026-09-26");
    expect(change).toEqual({ kind: "change", percent: -50 });
  });
});
