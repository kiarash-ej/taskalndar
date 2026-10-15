import { jalaaliMonthLength } from "@taskalndar/core";
import { jalaliMonthOf, jalaliMonthRange, jalaliOf, weekdayIndex, type IsoDate } from "./dates";
import { WEEKDAY_NAMES } from "./format";
import { jalaliWeekRange } from "./scoring";

// How a task repeats, as chosen in the task forms (submitted as `kind`):
// "recurring" = every day, "weekdays" = chosen days of the Iranian week,
// "once" = only on its date. Stored as tasks.is_recurring + tasks.weekdays.
export type TaskKind = "recurring" | "weekdays" | "once";

export interface TaskSchedule {
  is_recurring: boolean;
  // 0 = Saturday … 6 = Friday (weekdayIndex); null = every day / one-time
  weekdays: number[] | null;
}

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

// Sorted, de-duplicated, in-range day indexes. Anything else is dropped.
export function normalizeWeekdays(values: unknown[]): number[] {
  const days = new Set<number>();
  for (const v of values) {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 0 && n <= 6) days.add(n);
  }
  return [...days].sort((a, b) => a - b);
}

// null when "weekdays" is chosen without any day.
export function parseSchedule(formData: FormData): TaskSchedule | null {
  const kind = formData.get("kind");
  if (kind === "once") return { is_recurring: false, weekdays: null };
  if (kind !== "weekdays") return { is_recurring: true, weekdays: null };

  const weekdays = normalizeWeekdays(formData.getAll("weekdays"));
  if (weekdays.length === 0) return null;
  // all seven days is just "every day"
  return { is_recurring: true, weekdays: weekdays.length === 7 ? null : weekdays };
}

export function taskKindOf(task: { is_recurring: boolean; weekdays: number[] | null }): TaskKind {
  if (!task.is_recurring) return "once";
  return task.weekdays && task.weekdays.length > 0 ? "weekdays" : "recurring";
}

// Short label for the task's badge: «هر روز», «یک‌بار» or the day names.
export function scheduleLabel(task: { is_recurring: boolean; weekdays: number[] | null }): string {
  const kind = taskKindOf(task);
  if (kind === "once") return "یک‌بار";
  if (kind === "recurring") return "هر روز";
  return normalizeWeekdays(task.weekdays ?? [])
    .map((d) => WEEKDAY_NAMES[d])
    .join("، ");
}

// Whether a weekday schedule includes the given calendar day.
export function scheduleIncludes(schedule: TaskSchedule, day: IsoDate): boolean {
  return schedule.weekdays === null || schedule.weekdays.includes(weekdayIndex(day));
}

export type GoalPeriod = "weekly" | "monthly";

export function parseGoalPeriod(value: unknown): GoalPeriod | null {
  return value === "weekly" || value === "monthly" ? value : null;
}

// Old rows and anything unexpected count as monthly (spec v1).
export function goalPeriodOf(goal: { period: string }): GoalPeriod {
  return goal.period === "weekly" ? "weekly" : "monthly";
}

export interface GoalPeriodWindow {
  start: IsoDate;
  end: IsoDate;
  // today's position in the period (1-based) and the period's length in days
  dayOfPeriod: number;
  length: number;
}

// The current Jalali week (Saturday–Friday) or month around `today`.
export function goalPeriodWindow(period: GoalPeriod, today: IsoDate): GoalPeriodWindow {
  if (period === "weekly") {
    const { start, end } = jalaliWeekRange(today);
    return { start, end, dayOfPeriod: weekdayIndex(today) + 1, length: 7 };
  }
  const month = jalaliMonthOf(today);
  const { start, end } = jalaliMonthRange(month);
  return { start, end, dayOfPeriod: jalaliOf(today).jd, length: jalaaliMonthLength(month.jy, month.jm) };
}

export const GOAL_PERIOD_TEXT: Record<GoalPeriod, { per: string; current: string }> = {
  weekly: { per: "در هفته", current: "این هفته" },
  monthly: { per: "در ماه", current: "این ماه" },
};
