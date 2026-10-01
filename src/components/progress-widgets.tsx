import type { MonthlyChange } from "@taskalndar/core";
import { faDigits, formatPercent } from "@/lib/format";
import type { PeriodScore } from "@/lib/scoring";
import { cx, ProgressBar } from "./ui";

// The combined score of a period with its two ingredients (spec.md).
export function ScoreSummary({ score, label }: { score: PeriodScore; label: string }) {
  if (!score.hasData) {
    return (
      <p className="text-sm text-muted">
        هنوز چیزی برای امتیاز دادن نیست. کاری در برنامهٔ روزانه یا هدفی ماهانه اضافه کنید.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-4xl font-extrabold tracking-tight">{formatPercent(score.score)}</p>
      <ProgressBar value={score.score} label={label} />
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-surface-2 px-3 py-2">
          <dt className="text-muted">کارهای روزانه</dt>
          <dd className="font-bold">
            {score.taskPercent === null ? (
              "—"
            ) : (
              <>
                {formatPercent(score.taskPercent)}{" "}
                <span className="font-normal text-muted">
                  ({faDigits(score.doneTasks)} از {faDigits(score.expectedTasks)})
                </span>
              </>
            )}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-2 px-3 py-2">
          <dt className="text-muted">هدف‌ها</dt>
          <dd className="font-bold">
            {score.goalPercent === null ? "—" : formatPercent(score.goalPercent)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// spec.md: the change against last month, or «شروع تازه» when last month scored 0.
export function MonthlyChangeBadge({ change, large = false }: { change: MonthlyChange; large?: boolean }) {
  const size = large ? "px-4 py-2 text-xl" : "px-3 py-1 text-sm";
  if (change.kind === "fresh-start") {
    return (
      <span className={cx("inline-flex items-center rounded-full bg-accent-soft font-bold text-accent", size)}>
        شروع تازه
      </span>
    );
  }
  const rounded = Math.round(change.percent);
  const tone =
    rounded > 0 ? "bg-up-soft text-up" : rounded < 0 ? "bg-down-soft text-down" : "bg-surface-2 text-muted";
  const arrow = rounded > 0 ? "▲" : rounded < 0 ? "▼" : "●";
  const description =
    rounded > 0
      ? `${formatPercent(rounded)} بیشتر از ماه قبل`
      : rounded < 0
        ? `${formatPercent(-rounded)} کمتر از ماه قبل`
        : "بدون تغییر نسبت به ماه قبل";
  return (
    <span
      className={cx("inline-flex items-center gap-1.5 rounded-full font-bold", tone, size)}
      aria-label={description}
    >
      <span aria-hidden className="text-[0.7em]">
        {arrow}
      </span>
      {formatPercent(Math.abs(rounded))}
    </span>
  );
}
