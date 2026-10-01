import {
  combinedProgressScore,
  endOfJalaaliWeek,
  goalProgressPercent,
  jalaaliMonthLength,
  monthlyChangePercent,
  startOfJalaaliWeek,
  taskCompletionPercent,
  type MonthlyChange,
} from "@taskalndar/core";
import type { Tables } from "./database.types";
import {
  calendarDateOf,
  dateToIso,
  eachDay,
  isoToDate,
  jalaliMonthOf,
  jalaliMonthRange,
  jalaliOf,
  shiftJalaliMonth,
  type IsoDate,
  type JalaliMonth,
} from "./dates";

// Turns the user's rows into the inputs of packages/core's progress formulas
// (spec.md "محاسبهٔ پیشرفت") for any range of days.

export type TaskRow = Pick<Tables<"tasks">, "id" | "title" | "is_recurring" | "date" | "archived_at">;
export type CompletionRow = Pick<Tables<"task_completions">, "task_id" | "date" | "done">;
export type GoalRow = Pick<
  Tables<"goals">,
  "id" | "title" | "target_value" | "unit" | "created_at" | "archived_at"
>;
export type GoalLogRow = Pick<Tables<"goal_logs">, "id" | "goal_id" | "date" | "amount">;

export interface ProgressData {
  tasks: TaskRow[];
  completions: CompletionRow[];
  goals: GoalRow[];
  goalLogs: GoalLogRow[];
}

export interface PeriodScore {
  start: IsoDate;
  end: IsoDate;
  expectedTasks: number;
  doneTasks: number;
  // null when no task was expected in the period
  taskPercent: number | null;
  // one entry per goal active in the period
  goalPercents: number[];
  // null when no goal was active in the period
  goalPercent: number | null;
  score: number;
  // false when there was nothing to score (no expected tasks, no active goals)
  hasData: boolean;
}

// The first day a row no longer applies, from its archived_at timestamp.
function stopDate(archivedAt: string | null): IsoDate | null {
  return archivedAt === null ? null : calendarDateOf(archivedAt);
}

// A recurring task repeats every day from `date` on; a one-time task is only
// expected on `date`. Either stops applying from the day it was archived.
export function isTaskActiveOn(task: TaskRow, day: IsoDate): boolean {
  const stop = stopDate(task.archived_at);
  if (stop !== null && day >= stop) return false;
  return task.is_recurring ? task.date <= day : task.date === day;
}

export function tasksForDay(tasks: TaskRow[], day: IsoDate): TaskRow[] {
  return tasks.filter((task) => isTaskActiveOn(task, day));
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Scores [start, end]. Days after `today` are not expected yet, so a period in
// progress is scored on its days so far rather than counted as missed.
//
// Goals have a monthly target (spec v1), so for a range that isn't a whole
// month the target is prorated per day: each active day contributes
// target / (length of its Jalali month). Over a full month that sums to the
// target itself, and a week gets roughly a quarter of it.
export function scorePeriod(
  data: ProgressData,
  start: IsoDate,
  end: IsoDate,
  today: IsoDate,
): PeriodScore {
  const last = end < today ? end : today;
  const days = start <= last ? eachDay(start, last) : [];

  const done = new Set(
    data.completions.filter((c) => c.done).map((c) => `${c.task_id}|${c.date}`),
  );
  let expectedTasks = 0;
  let doneTasks = 0;
  for (const day of days) {
    for (const task of data.tasks) {
      if (!isTaskActiveOn(task, day)) continue;
      expectedTasks += 1;
      if (done.has(`${task.id}|${day}`)) doneTasks += 1;
    }
  }

  const goalPercents: number[] = [];
  for (const goal of data.goals) {
    const from = calendarDateOf(goal.created_at);
    const stop = stopDate(goal.archived_at);
    const activeDays = days.filter((d) => d >= from && (stop === null || d < stop));
    if (activeDays.length === 0) continue;

    const target = activeDays.reduce((sum, d) => {
      const { jy, jm } = jalaliOf(d);
      return sum + goal.target_value / jalaaliMonthLength(jy, jm);
    }, 0);
    const amount = data.goalLogs
      .filter((log) => log.goal_id === goal.id && log.date >= start && log.date <= last)
      .reduce((sum, log) => sum + log.amount, 0);
    goalPercents.push(goalProgressPercent(amount, target));
  }

  const taskPercent = expectedTasks > 0 ? taskCompletionPercent(expectedTasks, doneTasks) : null;
  const goalPercent = goalPercents.length > 0 ? average(goalPercents) : null;

  // spec.md: with no goals the score is task completion alone. The mirror case
  // (goals but nothing on the checklist) likewise scores the goals alone
  // rather than averaging them with a 0%.
  let score = 0;
  if (taskPercent !== null) score = combinedProgressScore(taskPercent, goalPercents);
  else if (goalPercent !== null) score = goalPercent;

  return {
    start,
    end,
    expectedTasks,
    doneTasks,
    taskPercent,
    goalPercents,
    goalPercent,
    score,
    hasData: taskPercent !== null || goalPercent !== null,
  };
}

export function jalaliWeekRange(day: IsoDate): { start: IsoDate; end: IsoDate } {
  const date = isoToDate(day);
  return {
    start: dateToIso(startOfJalaaliWeek(date)),
    end: dateToIso(endOfJalaaliWeek(date)),
  };
}

// The `count` Jalali weeks ending with the current one, oldest first.
export function weekStarts(today: IsoDate, count: number): IsoDate[] {
  const current = isoToDate(jalaliWeekRange(today).start).getTime();
  return Array.from({ length: count }, (_, i) =>
    dateToIso(new Date(current - (count - 1 - i) * 7 * 86_400_000)),
  );
}

export function scoreWeeks(data: ProgressData, today: IsoDate, count: number): PeriodScore[] {
  return weekStarts(today, count).map((start) => {
    const { end } = jalaliWeekRange(start);
    return scorePeriod(data, start, end, today);
  });
}

// The `count` Jalali months ending with the current one, oldest first.
export function recentMonths(today: IsoDate, count: number): JalaliMonth[] {
  const current = jalaliMonthOf(today);
  return Array.from({ length: count }, (_, i) => shiftJalaliMonth(current, i - (count - 1)));
}

export function scoreMonths(
  data: ProgressData,
  today: IsoDate,
  count: number,
): (PeriodScore & { month: JalaliMonth })[] {
  return recentMonths(today, count).map((month) => {
    const { start, end } = jalaliMonthRange(month);
    return { ...scorePeriod(data, start, end, today), month };
  });
}

export interface MonthComparison {
  current: PeriodScore;
  previous: PeriodScore;
  change: MonthlyChange;
}

// spec.md "درصد تغییر ماهانه": the current Jalali month (so far) against the
// whole previous one, or "fresh start" when the previous month scored 0.
export function compareWithPreviousMonth(data: ProgressData, today: IsoDate): MonthComparison {
  const [previous, current] = scoreMonths(data, today, 2);
  return { current, previous, change: monthlyChangePercent(current.score, previous.score) };
}

// The earliest day the given number of weeks and months reach back to: how far
// back completions and goal logs need to be loaded to score them.
export function scoringWindowStart(today: IsoDate, weeks: number, months: number): IsoDate {
  const firstWeek = weekStarts(today, weeks)[0];
  const firstMonth = jalaliMonthRange(recentMonths(today, months)[0]).start;
  return firstWeek < firstMonth ? firstWeek : firstMonth;
}
