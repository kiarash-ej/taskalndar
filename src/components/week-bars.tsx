import { faDigits, formatLongDate, formatPercent, WEEKDAY_INITIALS } from "@/lib/format";
import type { IsoDate } from "@/lib/dates";
import { cx } from "./ui";

export interface WeekBarDay {
  day: IsoDate;
  // share of that day's tasks done; null for a day still to come or with no tasks
  percent: number | null;
  future: boolean;
}

const HEIGHT = 96;

// This week day by day (Saturday first), the bars growing in turn. Days
// under half done are lighter; days still to come are outlines.
export function WeekBars({ days, today }: { days: WeekBarDay[]; today: IsoDate }) {
  return (
    <ul className="flex items-end justify-between gap-2" aria-label="درصد انجام کارهای هر روز این هفته">
      {days.map((d, i) => {
        const label = `${formatLongDate(d.day)}: ${
          d.future ? "هنوز نرسیده" : d.percent === null ? "کاری نداشت" : formatPercent(d.percent)
        }`;
        const height = d.percent === null ? 6 : Math.max(6, (d.percent / 100) * HEIGHT);
        return (
          <li key={d.day} className="flex flex-1 flex-col items-center gap-1" title={label} aria-label={label}>
            <span className="text-[0.65rem] text-muted tabular-nums" aria-hidden>
              {d.percent === null ? " " : faDigits(Math.round(d.percent))}
            </span>
            <span className="flex w-full max-w-8 items-end" style={{ height: HEIGHT }} aria-hidden>
              <span
                className={cx(
                  "bar-grow block w-full rounded-t-lg rounded-b-sm",
                  d.future
                    ? "border border-dashed border-line"
                    : d.percent !== null && d.percent >= 50
                      ? "bg-accent"
                      : "bg-accent/40",
                )}
                style={{ height, ["--i" as string]: i }}
              />
            </span>
            <span
              className={cx("text-xs", d.day === today ? "font-bold text-accent" : "text-muted")}
              aria-hidden
            >
              {WEEKDAY_INITIALS[i]}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
