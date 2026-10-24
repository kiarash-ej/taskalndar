import Link from "next/link";
import { weekdayIndex, type IsoDate } from "@/lib/dates";
import { faDigits, formatDayMonth, WEEKDAY_NAMES } from "@/lib/format";
import type { BlockRow } from "@/lib/report";
import { daySummary } from "@/lib/week-plan";
import { cx } from "./ui";

// The week as one short line per day, from the blocks arranged on it; each
// line opens that day in the planner.
export function WeekPlan({ days, blocks, today }: { days: IsoDate[]; blocks: BlockRow[]; today: IsoDate }) {
  return (
    <ul className="divide-y divide-line">
      {days.map((day) => {
        const { items, more } = daySummary(blocks.filter((b) => b.day === day));
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
              <span className={cx("min-w-0 flex-1 leading-7", !isToday && "text-muted")}>
                {items.length > 0
                  ? items.join(" · ") + (more > 0 ? ` · و ${faDigits(more)} مورد دیگر` : "")
                  : "برنامه‌ای چیده نشده"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
