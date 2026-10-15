"use client";

import Link from "next/link";
import { useActionState, useOptimistic, useState, useTransition } from "react";
import {
  applyTemplate,
  createBlock,
  deleteBlock,
  saveDayAsTemplate,
  setBlockDone,
  updateBlock,
} from "@/lib/actions/blocks";
import { clockOf, formatClock, formatClockRange, MINUTES_PER_DAY } from "@/lib/blocks";
import type { IsoDate } from "@/lib/dates";
import { initialFormState } from "@/lib/form-state";
import { faNumber } from "@/lib/format";
import type { BlockRow } from "@/lib/report";
import { BlockForm } from "./block-form";
import { Pencil, Trash } from "./icons";
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
}: {
  day: IsoDate;
  // in start order
  blocks: BlockRow[];
  suggestions: string[];
  templates: TemplateOption[];
}) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-xl bg-down-soft px-3 py-2 text-sm text-down">
          {error}
        </p>
      )}

      {blocks.length === 0 ? (
        <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">
          برای این روز جعبه‌ای نیست. یک بازهٔ زمانی اضافه کنید یا تمپلیتی را اعمال کنید.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {blocks.map((block) => (
            <BlockItem key={block.id} day={day} block={block} suggestions={suggestions} onError={setError} />
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
    </div>
  );
}

function BlockItem({
  day,
  block,
  suggestions,
  onError,
}: {
  day: IsoDate;
  block: BlockRow;
  suggestions: string[];
  onError: (error: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [done, setOptimisticDone] = useOptimistic(block.done);
  const start = clockOf(day, block.start_at);
  const end = clockOf(day, block.end_at);
  const checkboxId = `block-${block.id}`;

  if (editing) {
    return (
      <li className="py-3">
        <BlockForm
          idPrefix={`edit-${block.id}`}
          action={updateBlock.bind(null, block.id, day)}
          suggestions={suggestions}
          submitLabel="ذخیره"
          onDone={() => setEditing(false)}
          defaults={{
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
    <li className={cx("flex gap-3 py-3", pending && "opacity-60")}>
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
            {block.title}
          </label>
        </div>
        {(block.tags.length > 0 || block.amount !== null || block.cost !== null) && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
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
