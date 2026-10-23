import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { ArrangeSuggestions } from "@/components/arrange-suggestions";
import { DailyNote } from "@/components/daily-note";
import { JalaliCalendar } from "@/components/jalali-calendar";
import { NextBlock } from "@/components/next-block";
import { NewTaskForm } from "@/components/new-task-form";
import { TaskChecklist } from "@/components/task-checklist";
import { DayBlocks } from "@/components/time-blocks";
import { Card, CardHeader, iconButtonClass, ProgressBar } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  loadDailyNote,
  loadProgressData,
  loadReminderSettings,
  loadSleepSuggestions,
  loadTemplates,
  loadTimeBlocks,
  loadUserTags,
} from "@/lib/data";
import { addDays, isIsoDate, todayIso } from "@/lib/dates";
import { faDigits, formatLongDate, formatPercent } from "@/lib/format";
import { arrangeWindow } from "@/lib/arrange";
import { scorePeriod, tasksForDay } from "@/lib/scoring";

export const metadata: Metadata = { title: "برنامهٔ روزانه" };

export default async function PlannerPage({ searchParams }: PageProps<"/planner">) {
  const user = await requireUser();
  const today = todayIso();
  const { date } = await searchParams;
  const day = isIsoDate(date) ? date : today;

  const [data, noteBody, blocks, templates, tagSuggestions, reminders, sleepSuggestions] = await Promise.all([
    loadProgressData(user.id, day, day),
    loadDailyNote(user.id, day),
    loadTimeBlocks(user.id, day, day),
    loadTemplates(user.id),
    loadUserTags(),
    loadReminderSettings(user.id),
    loadSleepSuggestions(user.id, day),
  ]);
  const tasks = tasksForDay(data.tasks, day);
  const doneIds = data.completions.filter((c) => c.done && c.date === day).map((c) => c.task_id);
  const { expectedTasks, doneTasks, taskPercent } = scorePeriod(data, day, day, today);
  // tasks still to do that have no block of the same name on this day
  const planned = new Set(blocks.map((b) => b.title.trim()));
  const arrangeable = tasks
    .filter((t) => !doneIds.includes(t.id) && !planned.has(t.title.trim()))
    .map((t) => ({ id: t.id, title: t.title }));
  const arrange = arrangeWindow(day, blocks, sleepSuggestions, new Date());

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

          {day === today && (
            <div className="mb-4 empty:hidden">
              <NextBlock blocks={blocks} />
            </div>
          )}

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

        <Card>
          <CardHeader title="برنامهٔ زمانی" subtitle="بازه‌های روز با توضیحات، برچسب، مقدار و هزینه" />
          <DayBlocks
            key={day}
            day={day}
            blocks={blocks}
            suggestions={tagSuggestions}
            templates={templates.map((t) => ({ id: t.id, name: t.name, blockCount: t.blocks.length }))}
            defaultLead={reminders?.enabled ? reminders.leadMinutes : null}
            sleepSuggestions={sleepSuggestions}
          />
        </Card>

        {arrange && (
          <Card>
            <CardHeader
              title="پیشنهاد چیدن کارها"
              subtitle="زمان پیشنهادی برای کارهای این روز در وقت خالی؛ تا ثبت نکنید چیزی تغییر نمی‌کند"
            />
            <ArrangeSuggestions day={day} tasks={arrangeable} window={arrange.window} busy={arrange.busy} />
          </Card>
        )}

        <Card>
          <CardHeader title="یادداشت روزانه" subtitle={`برای ${formatLongDate(day)}`} />
          {noteBody === null ? (
            <p role="alert" className="rounded-xl bg-down-soft px-3 py-2 text-sm text-down">
              یادداشت این روز بارگذاری نشد. صفحه را دوباره باز کنید.
            </p>
          ) : (
            <DailyNote key={day} day={day} initialBody={noteBody} />
          )}
        </Card>
      </div>
    </div>
  );
}
