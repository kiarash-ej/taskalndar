"use client";

import { useMemo, useState, useTransition } from "react";
import { addSuggestedBlocks } from "@/lib/actions/blocks";
import { arrangeTasks, type Interval } from "@/lib/arrange";
import { formatClock, parseClock } from "@/lib/blocks";
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

// Asks the user when to do the day's tasks: it suggests times in the free
// stretches between sleep and the blocks already planned, and the user can
// change any time, leave items out, or add items of their own. Nothing is
// saved until they answer yes.
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
  const [own, setOwn] = useState<ArrangeableTask[]>([]);
  const [draft, setDraft] = useState("");
  const [minutes, setMinutes] = useState<Record<string, number>>({});
  // starts the user typed, by item
  const [pinned, setPinned] = useState<Record<string, number>>({});
  const [left, setLeft] = useState<Set<string>>(new Set());
  const [gap, setGap] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const items = useMemo(() => [...tasks, ...own], [tasks, own]);
  const { placed, unplaced } = useMemo(
    () =>
      arrangeTasks(
        items
          .filter((t) => !left.has(t.id))
          .map((t) => ({ ...t, minutes: minutes[t.id] ?? DEFAULT_MINUTES, start: pinned[t.id] })),
        window,
        busy,
        gap,
      ),
    [items, left, minutes, pinned, window, busy, gap],
  );

  if (!open) {
    return (
      <div className="space-y-2">
        {saved && (
          <p role="status" className="rounded-xl bg-up-soft px-3 py-2 text-sm text-up">
            موارد تأییدشده به برنامهٔ زمانی اضافه شدند.
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
          {tasks.length > 0 ? `پیشنهاد زمان برای ${faDigits(tasks.length)} کار` : "چیدن برنامهٔ این روز"}
        </button>
      </div>
    );
  }

  function addOwn() {
    const title = draft.trim();
    if (!title || title.length > 200) return;
    setOwn((current) => [...current, { id: `own-${crypto.randomUUID()}`, title }]);
    setDraft("");
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
        setOwn([]);
        setPinned({});
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
        این زمان‌ها فقط پیشنهادند. هر ساعتی را می‌توانید عوض کنید، موردی را بردارید یا مورد خودتان را اضافه کنید.
      </p>

      {items.length > 0 && (
        <ul className="divide-y divide-line">
          {items.map((item) => {
            const placement = placed.find((p) => p.id === item.id);
            const excluded = left.has(item.id);
            const isOwn = item.id.startsWith("own-");
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                <div className="flex min-w-48 flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  checked={!excluded}
                  onChange={(e) =>
                    setLeft((current) => {
                      const next = new Set(current);
                      if (e.target.checked) next.delete(item.id);
                      else next.add(item.id);
                      return next;
                    })
                  }
                  className="size-5 cursor-pointer accent-accent"
                  aria-label={`در برنامه باشد: ${item.title}`}
                />
                <span className={cx("min-w-0 flex-1 break-words font-medium", excluded && "text-muted line-through")}>
                  {item.title}
                  {isOwn && <span className="ms-1.5 text-xs font-normal text-muted">(مورد شما)</span>}
                </span>
                </div>
                <div className="flex items-center gap-2">
                <select
                  value={minutes[item.id] ?? DEFAULT_MINUTES}
                  disabled={excluded}
                  onChange={(e) => setMinutes((current) => ({ ...current, [item.id]: Number(e.target.value) }))}
                  aria-label={`مدت ${item.title}`}
                  className={cx(inputClass, "w-28! py-1 text-sm")}
                >
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {faDigits(d)} دقیقه
                    </option>
                  ))}
                </select>
                {excluded ? (
                  <span className="w-32 text-sm text-muted">—</span>
                ) : (
                  <span className="flex items-center gap-1">
                    <input
                      type="time"
                      dir="ltr"
                      value={placement ? formatClock(placement.start) : ""}
                      onChange={(e) => {
                        const start = parseClock(e.target.value);
                        if (start !== null) setPinned((current) => ({ ...current, [item.id]: start }));
                      }}
                      aria-label={`ساعت شروع ${item.title}`}
                      className={cx(
                        inputClass,
                        "w-32! py-1 text-sm",
                        pinned[item.id] === undefined && "border-dashed text-accent",
                      )}
                    />
                    {pinned[item.id] !== undefined && (
                      <button
                        type="button"
                        onClick={() =>
                          setPinned((current) => {
                            const next = { ...current };
                            delete next[item.id];
                            return next;
                          })
                        }
                        className="text-xs text-muted hover:text-fg"
                        aria-label={`ساعت پیشنهادی برای ${item.title}`}
                      >
                        پیشنهاد
                      </button>
                    )}
                    {!placement && <span className="text-xs text-down">جا نشد</span>}
                  </span>
                )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          value={draft}
          maxLength={200}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOwn();
            }
          }}
          placeholder="مورد دیگری که می‌خواهید اضافه کنید، مثلاً «تماس با مامان»"
          aria-label="افزودن مورد دلخواه"
          className={cx(inputClass, "min-w-0 flex-1")}
        />
        <button type="button" onClick={addOwn} disabled={!draft.trim()} className={buttonClass.secondary}>
          افزودن
        </button>
      </div>

      {unplaced.length > 0 && (
        <p className="text-xs text-down">
          {faDigits(unplaced.length)} مورد در وقت خالی جا نشد. مدتش را کمتر کنید یا ساعتش را خودتان بگذارید.
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

      <div className="space-y-2 rounded-xl bg-surface-2 p-3">
        <p className="text-sm font-semibold">
          {placed.length > 0 ? `این ${faDigits(placed.length)} مورد به برنامهٔ زمانی اضافه شود؟` : "موردی برای ثبت نیست."}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={accept} disabled={pending || placed.length === 0} className={buttonClass.primary}>
            {pending ? "در حال ثبت…" : "بله، ثبت شود"}
          </button>
          <button type="button" onClick={() => setOpen(false)} disabled={pending} className={buttonClass.ghost}>
            نه، فعلاً نه
          </button>
        </div>
      </div>
    </div>
  );
}
