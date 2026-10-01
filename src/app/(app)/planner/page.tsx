import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { JalaliCalendar } from "@/components/jalali-calendar";
import { NewTaskForm } from "@/components/new-task-form";
import { TaskChecklist } from "@/components/task-checklist";
import { Card, CardHeader, iconButtonClass, ProgressBar } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { loadProgressData } from "@/lib/data";
import { addDays, isIsoDate, todayIso } from "@/lib/dates";
import { faDigits, formatLongDate, formatPercent } from "@/lib/format";
import { scorePeriod, tasksForDay } from "@/lib/scoring";

export const metadata: Metadata = { title: "برنامهٔ روزانه" };

export default async function PlannerPage({ searchParams }: PageProps<"/planner">) {
  const user = await requireUser();
  const today = todayIso();
  const { date } = await searchParams;
  const day = isIsoDate(date) ? date : today;

  const data = await loadProgressData(user.id, day, day);
  const tasks = tasksForDay(data.tasks, day);
  const doneIds = data.completions.filter((c) => c.done && c.date === day).map((c) => c.task_id);
  const { expectedTasks, doneTasks, taskPercent } = scorePeriod(data, day, day, today);

  const dayLabel =
    day === today ? "امروز" : day === addDays(today, -1) ? "دیروز" : day === addDays(today, 1) ? "فردا" : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr] lg:items-start">
      <Card className="lg:sticky lg:top-32">
        <JalaliCalendar key={day} selected={day} today={today} />
      </Card>

      <div className="space-y-4">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-2">
            <Link
              href={`/planner?date=${addDays(day, -1)}`}
              className={iconButtonClass}
              aria-label="روز قبل"
            >
              <ChevronRight />
            </Link>
            <div className="text-center">
              <h1 className="text-lg font-extrabold">{formatLongDate(day)}</h1>
              {dayLabel && <p className="text-sm text-accent">{dayLabel}</p>}
            </div>
            <Link
              href={`/planner?date=${addDays(day, 1)}`}
              className={iconButtonClass}
              aria-label="روز بعد"
            >
              <ChevronLeft />
            </Link>
          </div>

          {taskPercent !== null && (
            <div className="mb-4 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted">
                  {faDigits(doneTasks)} از {faDigits(expectedTasks)} کار انجام شد
                </span>
                <span className="font-bold">{formatPercent(taskPercent)}</span>
              </div>
              <ProgressBar value={taskPercent} label="پیشرفت کارهای این روز" />
            </div>
          )}

          <TaskChecklist
            day={day}
            today={today}
            tasks={tasks}
            doneIds={doneIds}
            editable
            empty={
              <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">
                برای این روز کاری ثبت نشده. از فرم پایین اولین کار را اضافه کنید.
              </p>
            }
          />
        </Card>

        <Card>
          <CardHeader title="افزودن کار" subtitle={`برای ${formatLongDate(day)}`} />
          <NewTaskForm day={day} />
        </Card>
      </div>
    </div>
  );
}
