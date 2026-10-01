"use client";

import { useActionState, useState, useTransition } from "react";
import { archiveGoal, createGoal, deleteGoalLog, logGoalProgress } from "@/lib/actions/goals";
import { addDays, type IsoDate } from "@/lib/dates";
import { initialFormState } from "@/lib/form-state";
import { faNumber, formatDayMonth, formatLongDate } from "@/lib/format";
import type { GoalLogRow } from "@/lib/scoring";
import { Archive, Trash } from "./icons";
import { SubmitButton } from "./submit-button";
import { cx, Field, FormMessage, iconButtonClass, inputClass } from "./ui";

export function NewGoalForm() {
  const [state, action] = useActionState(createGoal, initialFormState);
  const values = state.error ? state.values : undefined;
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <Field label="عنوان" htmlFor="goal-title">
        <input
          id="goal-title"
          name="title"
          required
          maxLength={200}
          placeholder="مثلاً دویدن"
          defaultValue={values?.title}
          className={inputClass}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="مقدار هدف در ماه" htmlFor="goal-target">
          <input
            id="goal-target"
            name="target_value"
            inputMode="decimal"
            required
            placeholder="۵۰"
            defaultValue={values?.target_value}
            className={inputClass}
          />
        </Field>
        <Field label="واحد" htmlFor="goal-unit">
          <input
            id="goal-unit"
            name="unit"
            required
            maxLength={40}
            placeholder="کیلومتر"
            defaultValue={values?.unit}
            className={inputClass}
          />
        </Field>
      </div>
      <SubmitButton pendingText="در حال ثبت…" className="w-full">
        تعریف هدف
      </SubmitButton>
    </form>
  );
}

// Today and the 30 days before it, labelled in the Jalali calendar.
function recentDays(today: IsoDate, startDate: IsoDate): { value: IsoDate; label: string }[] {
  return Array.from({ length: 31 }, (_, i) => {
    const value = addDays(today, -i);
    const prefix = i === 0 ? "امروز — " : i === 1 ? "دیروز — " : "";
    return { value, label: prefix + formatLongDate(value) };
  }).filter((day) => day.value >= startDate);
}

export function LogProgressForm({
  goalId,
  unit,
  today,
  startDate,
}: {
  goalId: string;
  unit: string;
  today: IsoDate;
  startDate: IsoDate;
}) {
  const [state, action] = useActionState(logGoalProgress.bind(null, goalId), initialFormState);
  return (
    <form action={action} className="space-y-2">
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-28 flex-1">
          <input
            name="amount"
            inputMode="decimal"
            required
            aria-label={`مقدار (${unit})`}
            placeholder="مقدار"
            defaultValue={state.error ? state.values?.amount : undefined}
            className={cx(inputClass, "pe-16")}
          />
          <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted">
            {unit}
          </span>
        </div>
        <select
          name="date"
          aria-label="تاریخ"
          defaultValue={state.values?.date ?? today}
          className={cx(inputClass, "w-auto flex-1")}
        >
          {recentDays(today, startDate).map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <SubmitButton pendingText="…" variant="secondary">
          ثبت پیشرفت
        </SubmitButton>
      </div>
    </form>
  );
}

export function GoalLogList({ logs, unit }: { logs: GoalLogRow[]; unit: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (logs.length === 0) return null;
  return (
    <details className="group text-sm">
      <summary className="cursor-pointer select-none text-muted hover:text-fg">
        ثبت‌های این ماه ({faNumber(logs.length)})
      </summary>
      {error && (
        <p role="alert" className="mt-2 text-down">
          {error}
        </p>
      )}
      <ul className={cx("mt-2 divide-y divide-line", pending && "opacity-60")}>
        {logs.map((log) => (
          <li key={log.id} className="flex items-center justify-between py-1.5">
            <span className="text-muted">{formatDayMonth(log.date)}</span>
            <span className="flex items-center gap-2">
              <span className="font-medium">
                {faNumber(log.amount)} {unit}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await deleteGoalLog(log.id);
                    if (result.error) setError(result.error);
                  })
                }
                className={cx(iconButtonClass, "size-7 hover:text-down")}
                aria-label={`حذف ثبت ${formatDayMonth(log.date)}`}
              >
                <Trash width={15} height={15} />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ArchiveGoalButton({ goalId, title }: { goalId: string; title: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`هدف «${title}» بایگانی شود؟ پیشرفت‌های ثبت‌شده در آمار باقی می‌مانند.`)) {
          return;
        }
        startTransition(async () => {
          const result = await archiveGoal(goalId);
          if (result.error) window.alert(result.error);
        });
      }}
      className={iconButtonClass}
      aria-label={`بایگانی هدف «${title}»`}
      title="بایگانی"
    >
      <Archive />
    </button>
  );
}
