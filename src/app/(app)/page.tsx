import type { Metadata } from "next";
import Link from "next/link";
import { ApplyDayTemplate } from "@/components/apply-day-template";
import { DayRing } from "@/components/day-ring";
import { NowNext } from "@/components/now-next";
import { MonthlyChangeBadge, ScoreSummary } from "@/components/progress-widgets";
import { TaskChecklist } from "@/components/task-checklist";
import { WeekBars } from "@/components/week-bars";
import { buttonClass, Card, CardHeader, PageHeader } from "@/components/ui";
import { WeekPlan } from "@/components/week-plan";
import { requireUser } from "@/lib/auth";
import { loadProgressData, loadTemplates, loadTimeBlocks } from "@/lib/data";
import { eachDay, jalaliMonthOf, shiftJalaliMonth, todayIso, weekdayIndex } from "@/lib/dates";
import { formatDayMonth, formatLongDate, formatPercent, JALALI_MONTH_NAMES, WEEKDAY_NAMES } from "@/lib/format";
import {
  compareWithPreviousMonth,
  jalaliWeekRange,
  scorePeriod,
  scoringWindowStart,
  tasksForDay,
} from "@/lib/scoring";
import { templateForWeekday } from "@/lib/week-plan";

export const metadata: Metadata = { title: "داشبورد" };

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayIso();
  const week = jalaliWeekRange(today);

  const [data, weekBlocks, templates] = await Promise.all([
    loadProgressData(user.id, scoringWindowStart(today, 1, 2), today),
    loadTimeBlocks(user.id, week.start, week.end),
    loadTemplates(user.id),
  ]);
  const todayBlocks = weekBlocks.filter((b) => b.day === today);
  // offered when today is still empty: the template named after this weekday
  const todayTemplate = templateForWeekday(templates, weekdayIndex(today));
  const weekScore = scorePeriod(data, week.start, week.end, today);
  const { current, previous, change } = compareWithPreviousMonth(data, today);

  const todayTasks = tasksForDay(data.tasks, today);
  const doneToday = data.completions.filter((c) => c.done && c.date === today).map((c) => c.task_id);
  const doneTodayCount = todayTasks.filter((t) => doneToday.includes(t.id)).length;
  const weekDays = eachDay(week.start, week.end).map((day) => ({
    day,
    future: day > today,
    percent: day > today ? null : scorePeriod(data, day, day, today).taskPercent,
  }));

  const thisMonth = jalaliMonthOf(today);
  const thisMonthName = JALALI_MONTH_NAMES[thisMonth.jm - 1];
  const lastMonthName = JALALI_MONTH_NAMES[shiftJalaliMonth(thisMonth, -1).jm - 1];

  return (
    <div>
      <PageHeader title="داشبورد" subtitle={`امروز ${formatLongDate(today)}`} />

      <div className="mb-4 space-y-4">
        <Card>
          <CardHeader
            title={`امروز، ${WEEKDAY_NAMES[weekdayIndex(today)]}`}
            aside={
              <Link href={`/planner?date=${today}`} className="text-sm font-semibold text-accent hover:underline">
                برنامهٔ کامل امروز ←
              </Link>
            }
          />
          {todayBlocks.length > 0 ? (
            <NowNext blocks={todayBlocks} />
          ) : (
            <div className="space-y-4 py-2 text-center">
              <p className="font-semibold">برای امروز هنوز برنامه‌ای نچیده‌اید</p>
              <div className="flex flex-wrap justify-center gap-2">
                {todayTemplate && todayTemplate.blocks.length > 0 && (
                  <ApplyDayTemplate templateId={todayTemplate.id} name={todayTemplate.name} day={today} />
                )}
                <Link href={`/planner?date=${today}`} className={buttonClass.secondary}>
                  + چیدن برنامه
                </Link>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="این هفته" subtitle={`${formatDayMonth(week.start)} تا ${formatDayMonth(week.end)}`} />
          <WeekPlan
            days={eachDay(week.start, week.end)}
            blocks={weekBlocks}
            tasks={data.tasks}
            completions={data.completions}
            today={today}
          />
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader
            title="پیشرفت این هفته"
            subtitle={`${formatDayMonth(week.start)} تا ${formatDayMonth(week.end)}`}
          />
          <ScoreSummary score={weekScore} label="امتیاز پیشرفت این هفته" />
          <div className="mt-4 border-t border-line pt-4">
            <WeekBars days={weekDays} today={today} />
          </div>
        </Card>

        <Card>
          <CardHeader title="نسبت به ماه قبل" subtitle={`${thisMonthName} در برابر ${lastMonthName}`} />
          <div className="space-y-3">
            <MonthlyChangeBadge change={change} large />
            <p className="text-sm text-muted">
              {change.kind === "fresh-start"
                ? `${lastMonthName} امتیازی ثبت نشده؛ این ماه نقطهٔ شروع شماست.`
                : `امتیاز ${lastMonthName}: ${formatPercent(previous.score)}`}
            </p>
            <p className="text-sm text-muted">
              امتیاز {thisMonthName} تا امروز: {formatPercent(current.score)}
            </p>
            <Link href="/stats" className="inline-block text-sm font-semibold text-accent hover:underline">
              نمودارها و آمار بیشتر ←
            </Link>
          </div>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader
            title="کارهای امروز"
            aside={
              <Link
                href={`/planner?date=${today}`}
                className="text-sm font-semibold text-accent hover:underline"
              >
                مدیریت کارها ←
              </Link>
            }
          />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {todayTasks.length > 0 && <DayRing done={doneTodayCount} total={todayTasks.length} />}
            <div className="min-w-0 flex-1">
              <TaskChecklist
                day={today}
                today={today}
                tasks={todayTasks}
                doneIds={doneToday}
                empty={
                  <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">
                    برای امروز کاری ندارید.{" "}
                    <Link href={`/planner?date=${today}`} className="font-semibold text-accent hover:underline">
                      کار تازه‌ای اضافه کنید
                    </Link>
                  </p>
                }
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
