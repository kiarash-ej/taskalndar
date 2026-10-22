"use client";

import Link from "next/link";
import { useActionState, useOptimistic, useState, useTransition } from "react";
import { acceptSleepSuggestion, skipSleepSuggestion } from "@/lib/actions/sleep";
import {
  applyTemplate,
  createBlock,
  deleteBlock,
  saveDayAsTemplate,
  setBlockDone,
  updateBlock,
} from "@/lib/actions/blocks";
import { clockOf, formatClock, formatClockRange, MINUTES_PER_DAY } from "@/lib/blocks";
import { calendarDateOf, weekdayIndex, type IsoDate } from "@/lib/dates";
import { initialFormState } from "@/lib/form-state";
import { faNumber, WEEKDAY_NAMES } from "@/lib/format";
import { formatLead } from "@/lib/reminders";
import { formatInstantClock, type SleepSuggestion } from "@/lib/sleep";
import type { BlockRow } from "@/lib/report";
import { BlockForm } from "./block-form";
import { BlockTimeline } from "./block-timeline";
import { Bell, Moon, Pencil, Trash } from "./icons";
import { SubmitButton } from "./submit-button";
import { buttonClass, cx, FormMessage, iconButtonClass, inputClass } from "./ui";

export interface TemplateOption {
  id: string;
  name: string;
  blockCount: number;
}

// The day's time blocks ("16:00–18:00 study") with their details, a form to
// add one, and the day templates.
export function DayBlocks({
  day,
  blocks,
  suggestions,
  templates,
  defaultLead,
  sleepSuggestions,
}: {
  day: IsoDate;
  // in start order
  blocks: BlockRow[];
  // nights the sleep schedule suggests, not on the planner yet
  sleepSuggestions: SleepSuggestion[];
  suggestions: string[];
  templates: TemplateOption[];
  // the user's default reminder lead time; null while reminders are off
  defaultLead: number | null;
}) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // blocks already here when the page opened don't animate; new ones pop in
  const [initialIds] = useState(() => new Set(blocks.map((b) => b.id)));
  const [view, setView] = useState<"list" | "timeline">("list");

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-xl bg-down-soft px-3 py-2 text-sm text-down">
          {error}
        </p>
      )}

      {sleepSuggestions.length > 0 && (
        <ul className="space-y-2">
          {sleepSuggestions.map((s) => (
            <SleepSuggestionItem key={`${s.night}-${s.from}`} suggestion={s} onError={setError} />
          ))}
        </ul>
      )}

      {blocks.length > 0 && (
        <div role="radiogroup" aria-label="نمایش جعبه‌ها" className="flex gap-1 rounded-xl bg-surface-2 p-1 text-sm">
          {(
            [
              ["list", "فهرست"],
              ["timeline", "نمای زمانی"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={view === value}
              onClick={() => setView(value)}
              className={cx(
                "flex-1 rounded-lg px-3 py-1 font-medium transition-colors",
                view === value ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {blocks.length > 0 && view === "timeline" ? (
        <BlockTimeline day={day} blocks={blocks} onError={setError} />
      ) : blocks.length === 0 ? (
        sleepSuggestions.length === 0 && <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">
          برای این روز جعبه‌ای نیست. یک بازهٔ زمانی اضافه کنید یا تمپلیتی را اعمال کنید.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {blocks.map((block) => (
            <BlockItem
              key={block.id}
              fresh={!initialIds.has(block.id)}
              day={day}
              block={block}
              suggestions={suggestions}
              defaultLead={defaultLead}
              onError={setError}
            />
          ))}
        </ul>
      )}

      {adding ? (
        <div className="rounded-xl border border-line p-3">
          <BlockForm
            idPrefix="new-block"
            action={createBlock.bind(null, day)}
            suggestions={suggestions}
            submitLabel="افزودن جعبه"
            defaultLead={defaultLead}
          />
          <button type="button" onClick={() => setAdding(false)} className={cx(buttonClass.ghost, "mt-2")}>
            بستن
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={cx(buttonClass.secondary, "w-full")}>
          + افزودن جعبهٔ زمانی
        </button>
      )}

      <TemplateControls day={day} hasBlocks={blocks.length > 0} templates={templates} onError={setError} />

      {!sleepSuggestions.some((s) => s.night === day) && <OwnSleep day={day} onError={setError} />}

      <p className="text-xs text-muted">
        پیشنهادهای خواب از{" "}
        <Link href="/settings#sleep" className="font-semibold text-accent hover:underline">
          برنامهٔ خواب
        </Link>{" "}
        و لینک گوشی می‌آیند و تا جواب «بله» ندهید چیزی ذخیره نمی‌شود.
      </p>
    </div>
  );
}

// "Saturday night 23:00 to 07:00, save it?" Nothing is saved until the user
// says yes, with these times or ones they type; "no" drops the question.
function SleepSuggestionItem({
  suggestion,
  onError,
}: {
  suggestion: SleepSuggestion;
  onError: (error: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  // the answer's animation plays first: "yes" flies into the plan, "no" folds away
  const [leaving, setLeaving] = useState<"fly" | "fold" | null>(null);
  const nightName = `${WEEKDAY_NAMES[weekdayIndex(suggestion.night)]} شب`;
  const span = `${formatInstantClock(new Date(suggestion.bedAt))} تا ${formatInstantClock(new Date(suggestion.wakeAt))}`;

  function run(task: () => Promise<{ error?: string }>, exit: "fly" | "fold") {
    onError(null);
    setLeaving(exit);
    startTransition(async () => {
      const [result] = await Promise.all([task(), new Promise((r) => setTimeout(r, 420))]);
      if (result.error) {
        setLeaving(null);
        onError(result.error);
      }
    });
  }

  return (
    <li
      className={cx(
        "space-y-2 rounded-xl border border-dashed border-accent/50 bg-accent-soft/40 px-3 py-2.5",
        leaving === "fly" ? "anim-fly" : leaving === "fold" ? "anim-fold" : "anim-enter",
        pending && !leaving && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <Moon className="mt-0.5 shrink-0 text-accent" />
        <p className="min-w-0 flex-1 text-sm leading-7">
          {suggestion.from === "phone" ? "گوشی برای " : "طبق برنامهٔ خواب، "}
          <strong>{nightName}</strong> از <bdi className="font-semibold text-accent tabular-nums">{span}</bdi>
          {suggestion.from === "phone" ? " را فرستاده. " : " می‌خوابید. "}
          ثبت شود؟
        </p>
      </div>
      {editing ? (
        <SleepTimesForm
          defaultBed={clockOfInstant(suggestion.bedAt)}
          defaultWake={clockOfInstant(suggestion.wakeAt)}
          pending={pending}
          onCancel={() => setEditing(false)}
          onSubmit={(times) => run(() => acceptSleepSuggestion(suggestion.night, times), "fly")}
        />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => acceptSleepSuggestion(suggestion.night), "fly")}
            className={cx(buttonClass.primary, "px-3 py-1")}
          >
            بله، ثبت شود
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setEditing(true)}
            className={cx(buttonClass.secondary, "px-3 py-1")}
          >
            ساعت دیگر
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => skipSleepSuggestion(suggestion.night, suggestion.from), "fold")}
            className={cx(buttonClass.ghost, "px-3 py-1")}
          >
            نه
          </button>
        </div>
      )}
    </li>
  );
}

// "HH:MM" of an instant in Tehran, for <input type="time">
function clockOfInstant(instant: string): string {
  return formatClock(clockOf(calendarDateOf(instant), instant));
}

// Bedtime and wake time typed by the user, for a night the app suggested or
// one of their own.
function SleepTimesForm({
  defaultBed,
  defaultWake,
  pending,
  onSubmit,
  onCancel,
}: {
  defaultBed: string;
  defaultWake: string;
  pending: boolean;
  onSubmit: (times: { bed: string; wake: string }) => void;
  onCancel: () => void;
}) {
  const [bed, setBed] = useState(defaultBed);
  const [wake, setWake] = useState(defaultWake);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-sm text-muted">
        خواب
        <input type="time" dir="ltr" value={bed} onChange={(e) => setBed(e.target.value)} className={cx(inputClass, "w-32! py-1")} />
      </label>
      <label className="flex items-center gap-1.5 text-sm text-muted">
        بیداری
        <input type="time" dir="ltr" value={wake} onChange={(e) => setWake(e.target.value)} className={cx(inputClass, "w-32! py-1")} />
      </label>
      <button
        type="button"
        disabled={pending || !bed || !wake}
        onClick={() => onSubmit({ bed, wake })}
        className={cx(buttonClass.primary, "px-3 py-1")}
      >
        ثبت
      </button>
      <button type="button" disabled={pending} onClick={onCancel} className={cx(buttonClass.ghost, "px-3 py-1")}>
        انصراف
      </button>
    </div>
  );
}

// The user's own night, when the app has nothing to ask about (or they want
// a different one): the night starting this day's evening.
function OwnSleep({ day, onError }: { day: IsoDate; onError: (error: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-accent hover:underline">
        + ثبت خواب {WEEKDAY_NAMES[weekdayIndex(day)]} شب با ساعت دلخواه
      </button>
    );
  }
  return (
    <div className={cx("rounded-xl border border-line p-3", pending && "opacity-60")}>
      <SleepTimesForm
        defaultBed="23:00"
        defaultWake="07:00"
        pending={pending}
        onCancel={() => setOpen(false)}
        onSubmit={(times) => {
          onError(null);
          startTransition(async () => {
            const result = await acceptSleepSuggestion(day, times);
            if (result.error) onError(result.error);
            else setOpen(false);
          });
        }}
      />
    </div>
  );
}

function BlockItem({
  fresh,
  day,
  block,
  suggestions,
  defaultLead,
  onError,
}: {
  fresh: boolean;
  day: IsoDate;
  block: BlockRow;
  suggestions: string[];
  defaultLead: number | null;
  onError: (error: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [done, setOptimisticDone] = useOptimistic(block.done);
  const start = clockOf(day, block.start_at);
  const end = clockOf(day, block.end_at);
  const checkboxId = `block-${block.id}`;
  // only a block's own lead time is shown; the default would be on every block
  const reminderLabel = !block.remind ? "بدون یادآوری" : block.reminder_minutes !== null ? formatLead(block.reminder_minutes) : null;

  if (editing) {
    return (
      <li className="py-3">
        <BlockForm
          idPrefix={`edit-${block.id}`}
          action={updateBlock.bind(null, block.id, day)}
          suggestions={suggestions}
          submitLabel="ذخیره"
          onDone={() => setEditing(false)}
          defaultLead={defaultLead}
          defaults={{
            reminder: !block.remind ? "off" : block.reminder_minutes === null ? "default" : "custom",
            reminderMinutes: block.reminder_minutes === null ? "" : String(block.reminder_minutes),
            title: block.title,
            start: formatClock(start),
            // <input type="time"> has no 24:00; 00:00 after the start means midnight
            end: formatClock(end === MINUTES_PER_DAY ? 0 : end),
            tags: block.tags,
            description: block.description,
            amount: block.amount === null ? "" : String(block.amount),
            unit: block.unit ?? "",
            cost: block.cost === null ? "" : String(block.cost),
          }}
        />
      </li>
    );
  }

  function run(task: () => Promise<{ error?: string }>) {
    onError(null);
    startTransition(async () => {
      const result = await task();
      if (result.error) onError(result.error);
    });
  }

  return (
    <li className={cx("flex gap-3 py-3", fresh && "anim-pop", pending && "opacity-60")}>
      <input
        id={checkboxId}
        type="checkbox"
        checked={done}
        disabled={pending}
        onChange={(e) => {
          const value = e.target.checked;
          run(async () => {
            setOptimisticDone(value);
            return setBlockDone(block.id, value);
          });
        }}
        className="mt-1 size-5 shrink-0 cursor-pointer accent-accent"
        aria-label={`انجام شد: ${block.title}`}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="shrink-0 text-sm font-semibold text-accent tabular-nums">
            {formatClockRange(start, end)}
          </span>
          <label
            htmlFor={checkboxId}
            className={cx("min-w-0 break-words font-medium", done && "text-muted line-through decoration-muted/60")}
          >
            {block.source === "sleep" && (
              <Moon className="me-1 inline-block align-[-3px] text-accent" />
            )}
            {block.title}
          </label>
        </div>
        {(block.tags.length > 0 || block.amount !== null || block.cost !== null || reminderLabel) && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {reminderLabel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-muted">
                <Bell width={12} height={12} />
                {reminderLabel}
              </span>
            )}
            {block.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">
                #{tag}
              </span>
            ))}
            {block.amount !== null && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
                {faNumber(block.amount)} {block.unit}
              </span>
            )}
            {block.cost !== null && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">{faNumber(block.cost)} تومان</span>
            )}
          </div>
        )}
        {block.description && (
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-muted">{block.description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-start">
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={pending}
          className={iconButtonClass}
          aria-label={`ویرایش «${block.title}»`}
        >
          <Pencil />
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`جعبهٔ «${block.title}» حذف شود؟`)) run(() => deleteBlock(block.id));
          }}
          disabled={pending}
          className={cx(iconButtonClass, "hover:text-down")}
          aria-label={`حذف «${block.title}»`}
        >
          <Trash />
        </button>
      </div>
    </li>
  );
}

function TemplateControls({
  day,
  hasBlocks,
  templates,
  onError,
}: {
  day: IsoDate;
  hasBlocks: boolean;
  templates: TemplateOption[];
  onError: (error: string | null) => void;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [applying, startApply] = useTransition();
  const [saveState, saveAction] = useActionState(saveDayAsTemplate.bind(null, day), initialFormState);
  const selected = templates.find((t) => t.id === templateId) ?? templates[0];

  function apply() {
    if (!selected) return;
    const question = hasBlocks
      ? `این روز جعبه دارد. جعبه‌های تمپلیت «${selected.name}» هم کنارشان اضافه شوند؟`
      : `تمپلیت «${selected.name}» روی این روز اعمال شود؟`;
    if (!window.confirm(question)) return;
    onError(null);
    startApply(async () => {
      const result = await applyTemplate(selected.id, day);
      if (result.error) onError(result.error);
    });
  }

  return (
    <div className="space-y-3 rounded-xl bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">تمپلیت روز</h3>
        <Link href="/templates" className="text-sm font-semibold text-accent hover:underline">
          مدیریت تمپلیت‌ها ←
        </Link>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-muted">
          هنوز تمپلیتی ندارید. چینش جعبه‌های یک روز را ذخیره کنید تا روزهای دیگر با یک کلیک بچینید.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="انتخاب تمپلیت"
            value={selected?.id}
            onChange={(e) => setTemplateId(e.target.value)}
            className={cx(inputClass, "w-auto min-w-40 flex-1")}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({faNumber(t.blockCount)} جعبه)
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={apply}
            disabled={applying || !selected || selected.blockCount === 0}
            className={buttonClass.primary}
          >
            {applying ? "در حال اعمال…" : "اعمال روی این روز"}
          </button>
        </div>
      )}

      {hasBlocks && (
        <form action={saveAction} className="space-y-2">
          <FormMessage state={saveState} />
          <div className="flex flex-wrap gap-2">
            <input
              name="name"
              required
              maxLength={100}
              aria-label="نام تمپلیت جدید"
              placeholder="ذخیرهٔ این روز به‌عنوان تمپلیت، مثلاً «روز درس»"
              defaultValue={saveState.error ? saveState.values?.name : undefined}
              className={cx(inputClass, "min-w-40 flex-1")}
            />
            <SubmitButton pendingText="…" variant="secondary">
              ذخیره به‌عنوان تمپلیت
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
