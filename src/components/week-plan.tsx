import Link from "next/link";
import { weekdayIndex, type IsoDate } from "@/lib/dates";
import { faDigits, formatDayMonth, WEEKDAY_NAMES } from "@/lib/format";
import type { BlockRow } from "@/lib/report";
import type { CompletionRow, TaskRow } from "@/lib/scoring";
import { dayTasks, daySummary } from "@/lib/week-plan";
import { cx } from "./ui";

// The week as one short line per day, from the blocks arranged on it, with
// the tasks expected that day beneath; each line opens that day in the planner.
export function WeekPlan({
  days,
  blocks,
  tasks,
  completions,
  today,
}: {
  days: IsoDate[];
  blocks: BlockRow[];
  tasks: TaskRow[];
  completions: CompletionRow[];
  today: IsoDate;
}) {
  return (
    <ul className="divide-y divide-line">
      {days.map((day) => {
        const { items, more } = daySummary(blocks.filter((b) => b.day === day));
        const expected = dayTasks(tasks, completions, day);
        const isToday = day === today;
        return (
          <li key={day}>
            <Link
              href={`/planner?date=${day}`}
              aria-current={isToday ? "date" : undefined}
              className={cx(
                "-mx-2 flex gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-surface-2",
                isToday && "font-bold text-accent",
              )}
            >
              <span className="w-20 shrink-0">
                {WEEKDAY_NAMES[weekdayIndex(day)]}
                <span className={cx("block text-xs font-normal", isToday ? "text-accent/80" : "text-muted")}>
                  {formatDayMonth(day)}
                </span>
              </span>
              <span className="min-w-0 flex-1 space-y-1.5">
                {(items.length > 0 || expected.length === 0) && (
                  <span className={cx("block leading-7", !isToday && "text-muted")}>
                    {items.length > 0
                      ? items.join(" · ") + (more > 0 ? ` · و ${faDigits(more)} مورد دیگر` : "")
                      : "برنامه‌ای چیده نشده"}
                  </span>
                )}
                {expected.length > 0 && (
                  <span className="flex flex-wrap gap-1.5 py-0.5" aria-label="کارهای این روز">
                    {expected.map((task) => (
                      <span
                        key={task.id}
                        className={cx(
                          "rounded-lg px-2 py-0.5 text-xs font-medium",
                          task.done ? "bg-up-soft text-up line-through" : "bg-accent-soft text-accent",
                        )}
                      >
                        {task.done && <span className="sr-only">انجام شد: </span>}
                        {task.title}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
