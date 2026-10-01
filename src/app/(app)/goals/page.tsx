import { goalProgressPercent, jalaaliMonthLength } from "@taskalndar/core";
import type { Metadata } from "next";
import { ArchiveGoalButton, GoalLogList, LogProgressForm, NewGoalForm } from "@/components/goal-forms";
import { Card, CardHeader, PageHeader, ProgressBar } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { loadProgressData } from "@/lib/data";
import { jalaliMonthOf, jalaliMonthRange, jalaliOf, todayIso } from "@/lib/dates";
import { faNumber, formatMonthYear, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "هدف‌ها" };

export default async function GoalsPage() {
  const user = await requireUser();
  const today = todayIso();
  const month = jalaliMonthOf(today);
  const { start } = jalaliMonthRange(month);

  const data = await loadProgressData(user.id, start, today);
  const goals = data.goals.filter((g) => g.archived_at === null);

  // How far into the month we are, for the "on track" hint.
  const dayOfMonth = jalaliOf(today).jd;
  const monthLength = jalaaliMonthLength(month.jy, month.jm);

  return (
    <div>
      <PageHeader
        title="هدف‌ها"
        subtitle={`هدف‌های ماهانه — ${formatMonthYear(month)} (روز ${faNumber(dayOfMonth)} از ${faNumber(monthLength)})`}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-4">
          {goals.length === 0 && (
            <Card className="py-10 text-center">
              <p className="font-semibold">هنوز هدفی تعریف نکرده‌اید.</p>
              <p className="mt-1 text-sm text-muted">
                یک هدف عددی ماهانه بسازید، مثلاً «۵۰ کیلومتر دویدن» یا «۴۰۰ صفحه مطالعه».
              </p>
            </Card>
          )}

          {goals.map((goal) => {
            const logs = data.goalLogs.filter((log) => log.goal_id === goal.id);
            const amount = logs.reduce((sum, log) => sum + log.amount, 0);
            const percent = goalProgressPercent(amount, goal.target_value);
            const expectedSoFar = (goal.target_value * dayOfMonth) / monthLength;
            const onTrack = amount >= expectedSoFar;

            return (
              <Card key={goal.id}>
                <CardHeader
                  title={goal.title}
                  subtitle={`هدف: ${faNumber(goal.target_value)} ${goal.unit} در ماه`}
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
                      ? "هدف این ماه کامل شد."
                      : onTrack
                        ? "طبق برنامه پیش می‌روید."
                        : `برای ماندن در برنامه تا امروز به ${faNumber(Math.ceil(expectedSoFar * 10) / 10)} ${goal.unit} نیاز دارید.`}
                  </p>
                </div>
                <div className="space-y-3">
                  <LogProgressForm goalId={goal.id} unit={goal.unit} today={today} />
                  <GoalLogList logs={logs} unit={goal.unit} />
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="lg:sticky lg:top-32">
          <CardHeader title="هدف جدید" subtitle="مقدار هدف برای هر ماه شمسی" />
          <NewGoalForm />
        </Card>
      </div>
    </div>
  );
}
