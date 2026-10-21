"use client";

import { useMemo, useState, useTransition } from "react";
import { addSuggestedBlocks } from "@/lib/actions/blocks";
import { arrangeTasks, type Interval } from "@/lib/arrange";
import { formatClockRange } from "@/lib/blocks";
import type { IsoDate } from "@/lib/dates";
import { faDigits } from "@/lib/format";
import { buttonClass, cx, inputClass } from "./ui";

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const GAPS = [0, 5, 10, 15];
const DEFAULT_MINUTES = 30;

export interface ArrangeableTask {
  id: string;
  title: string;
}

// Suggests a time for each of the day's tasks in the free stretches between
// sleep and the blocks already planned. Only a suggestion: nothing is saved
// until the user accepts the ones they want.
export function ArrangeSuggestions({
  day,
  tasks,
  window,
  busy,
}: {
  day: IsoDate;
  // undone tasks of the day without a block yet, in list order
  tasks: ArrangeableTask[];
  // the waking part of the day still ahead, minutes since midnight
  window: Interval;
  busy: Interval[];
}) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState<Record<string, number>>({});
  const [left, setLeft] = useState<Set<string>>(new Set());
  const [gap, setGap] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const { placed, unplaced } = useMemo(
    () =>
      arrangeTasks(
        tasks.filter((t) => !left.has(t.id)).map((t) => ({ ...t, minutes: minutes[t.id] ?? DEFAULT_MINUTES })),
        window,
        busy,
        gap,
      ),
    [tasks, left, minutes, window, busy, gap],
  );

  if (tasks.length === 0) {
    return (
      <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">
        کار انجام‌نشده‌ای بدون زمان برای این روز نمانده است.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="space-y-2">
        {saved && (
          <p role="status" className="rounded-xl bg-up-soft px-3 py-2 text-sm text-up">
            پیشنهادهای انتخاب‌شده به برنامهٔ زمانی اضافه شدند.
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setSaved(false);
          }}
          className={cx(buttonClass.secondary, "w-full")}
        >
          پیشنهاد زمان برای {faDigits(tasks.length)} کار
        </button>
      </div>
    );
  }

  function accept() {
    setError(null);
    startTransition(async () => {
      const result = await addSuggestedBlocks(
        day,
        placed.map((p) => ({ title: p.title, start: p.start, end: p.end })),
      );
      if (result.error) setError(result.error);
      else {
        setOpen(false);
        setSaved(true);
      }
    });
  }

  return (
    <div className={cx("space-y-3", pending && "opacity-60")}>
      {error && (
        <p role="alert" className="rounded-xl bg-down-soft px-3 py-2 text-sm text-down">
          {error}
        </p>
      )}
      <p className="text-sm text-muted">
        این فقط پیشنهاد است. مدت هر کار را تنظیم کنید، کارهایی را که نمی‌خواهید بردارید، و بعد ثبت کنید.
      </p>

      <ul className="divide-y divide-line">
        {tasks.map((task) => {
          const placement = placed.find((p) => p.id === task.id);
          const excluded = left.has(task.id);
          return (
            <li key={task.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <input
                type="checkbox"
                checked={!excluded}
                onChange={(e) =>
                  setLeft((current) => {
                    const next = new Set(current);
                    if (e.target.checked) next.delete(task.id);
                    else next.add(task.id);
                    return next;
                  })
                }
                className="size-5 cursor-pointer accent-accent"
                aria-label={`در پیشنهاد باشد: ${task.title}`}
              />
              <span className={cx("min-w-0 flex-1 break-words font-medium", excluded && "text-muted line-through")}>
                {task.title}
              </span>
              <select
                value={minutes[task.id] ?? DEFAULT_MINUTES}
                disabled={excluded}
                onChange={(e) => setMinutes((current) => ({ ...current, [task.id]: Number(e.target.value) }))}
                aria-label={`مدت ${task.title}`}
                className={cx(inputClass, "w-28! py-1 text-sm")}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {faDigits(d)} دقیقه
                  </option>
                ))}
              </select>
              <span
                className={cx(
                  "w-32 text-sm tabular-nums",
                  placement ? "font-semibold text-accent" : "text-muted",
                )}
              >
                {excluded ? "—" : placement ? formatClockRange(placement.start, placement.end) : "جا نشد"}
              </span>
            </li>
          );
        })}
      </ul>

      {unplaced.length > 0 && (
        <p className="text-xs text-down">
          {faDigits(unplaced.length)} کار در وقت خالی امروز جا نشد. مدتشان را کمتر کنید یا برای روز دیگری
          بگذارید.
        </p>
      )}

      <label className="flex items-center gap-2 text-sm text-muted">
        فاصله بین کارها
        <select value={gap} onChange={(e) => setGap(Number(e.target.value))} className={cx(inputClass, "w-28! py-1 text-sm")}>
          {GAPS.map((g) => (
            <option key={g} value={g}>
              {g === 0 ? "بدون فاصله" : `${faDigits(g)} دقیقه`}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={accept} disabled={pending || placed.length === 0} className={buttonClass.primary}>
          {pending ? "در حال ثبت…" : `ثبت ${faDigits(placed.length)} پیشنهاد`}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={pending} className={buttonClass.ghost}>
          بستن
        </button>
      </div>
    </div>
  );
}
