import { goalProgressPercent } from "@taskalndar/core";
import type { Metadata } from "next";
import { ArchiveGoalButton, GoalLogList, LogProgressForm, NewGoalForm } from "@/components/goal-forms";
import { Card, CardHeader, PageHeader, ProgressBar } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { loadProgressData } from "@/lib/data";
import { eachDay, jalaliMonthOf, todayIso } from "@/lib/dates";
import { faNumber, formatDayMonth, formatMonthYear, formatPercent } from "@/lib/format";
import { GOAL_PERIOD_TEXT, goalPeriodOf, goalPeriodWindow } from "@/lib/schedule";
import { goalDailyTarget } from "@/lib/scoring";

export const metadata: Metadata = { title: "هدف‌ها" };

export default async function GoalsPage() {
  const user = await requireUser();
  const today = todayIso();
  const windows = { weekly: goalPeriodWindow("weekly", today), monthly: goalPeriodWindow("monthly", today) };
  // the current week can start in the previous month
  const from = windows.weekly.start < windows.monthly.start ? windows.weekly.start : windows.monthly.start;

  const data = await loadProgressData(user.id, from, today);
  const goals = data.goals.filter((g) => g.archived_at === null);
  const month = jalaliMonthOf(today);

  return (
    <div>
      <PageHeader
        title="هدف‌ها"
        subtitle={`${formatMonthYear(month)} (روز ${faNumber(windows.monthly.dayOfPeriod)} از ${faNumber(windows.monthly.length)}) · این هفته: ${formatDayMonth(windows.weekly.start)} تا ${formatDayMonth(windows.weekly.end)}`}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-4">
          {goals.length === 0 && (
            <Card className="py-10 text-center">
              <p className="font-semibold">هنوز هدفی تعریف نکرده‌اید.</p>
              <p className="mt-1 text-sm text-muted">
                یک هدف عددی هفتگی یا ماهانه بسازید، مثلاً «۱۵ کیلومتر دویدن در هفته» یا «۴۰۰ صفحه مطالعه در ماه».
              </p>
            </Card>
          )}

          {goals.map((goal) => {
            const period = goalPeriodOf(goal);
            const range = windows[period];
            const text = GOAL_PERIOD_TEXT[period];
            const logs = data.goalLogs.filter(
              (log) => log.goal_id === goal.id && log.date >= range.start && log.date <= range.end,
            );
            const amount = logs.reduce((sum, log) => sum + log.amount, 0);
            const percent = goalProgressPercent(amount, goal.target_value);
            // the same per-day share of the target that scoring uses
            const expectedSoFar = eachDay(range.start, today).reduce((sum, d) => sum + goalDailyTarget(goal, d), 0);
            const onTrack = amount >= expectedSoFar;

            return (
              <Card key={goal.id}>
                <CardHeader
                  title={goal.title}
                  subtitle={`هدف: ${faNumber(goal.target_value)} ${goal.unit} ${text.per}`}
                  aside={<ArchiveGoalButton goalId={goal.id} title={goal.title} />}
                />
                <div className="mb-4 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span>
                      <span className="text-xl font-extrabold">{faNumber(amount)}</span>{" "}
                      <span className="text-sm text-muted">
                        از {faNumber(goal.target_value)} {goal.unit}
                      </span>
                    </span>
                    <span className="font-bold">{formatPercent(percent)}</span>
                  </div>
                  <ProgressBar value={percent} label={`پیشرفت ${goal.title}`} />
                  <p className={onTrack ? "text-sm text-up" : "text-sm text-muted"}>
                    {percent >= 100
                      ? `هدف ${text.current} کامل شد.`
                      : onTrack
                        ? "طبق برنامه پیش می‌روید."
                        : `برای ماندن در برنامه تا امروز به ${faNumber(Math.ceil(expectedSoFar * 10) / 10)} ${goal.unit} نیاز دارید.`}
                  </p>
                </div>
                <div className="space-y-3">
                  <LogProgressForm goalId={goal.id} unit={goal.unit} today={today} startDate={goal.start_date} />
                  <GoalLogList logs={logs} unit={goal.unit} period={period} />
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="lg:sticky lg:top-32">
          <CardHeader title="هدف جدید" subtitle="مقدار هدف برای هر هفته یا ماه شمسی" />
          <NewGoalForm />
        </Card>
      </div>
    </div>
  );
}
