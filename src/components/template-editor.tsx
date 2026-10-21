"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addTemplateBlock,
  createTemplate,
  deleteTemplate,
  deleteTemplateBlock,
  renameTemplate,
} from "@/lib/actions/templates";
import { formatClock, formatClockRange, minutesOfTime } from "@/lib/blocks";
import type { DayTemplate } from "@/lib/data";
import { initialFormState, type FormState } from "@/lib/form-state";
import type { SharePack } from "@/lib/share";
import { Pencil, Trash } from "./icons";
import { ShareTemplateButton } from "./share-panel";
import { SubmitButton } from "./submit-button";
import { TagInput } from "./tag-input";
import { buttonClass, Card, CardHeader, cx, Field, FormMessage, iconButtonClass, inputClass } from "./ui";

// One template as a share code (src/lib/share.ts).
function templatePack(template: DayTemplate): SharePack {
  return {
    v: 1,
    templates: [
      {
        name: template.name,
        blocks: template.blocks.map((b) => ({
          start: formatClock(minutesOfTime(b.start_time)),
          end: formatClock(minutesOfTime(b.end_time)),
          title: b.title,
          tags: b.tags,
        })),
      },
    ],
    sleep: [],
    tasks: [],
  };
}

export function NewTemplateForm() {
  const [state, action] = useActionState(createTemplate, initialFormState);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <div className="flex gap-2">
        <input
          name="name"
          required
          maxLength={100}
          aria-label="نام تمپلیت"
          placeholder="مثلاً «روز کاری»"
          defaultValue={state.error ? state.values?.name : undefined}
          className={inputClass}
        />
        <SubmitButton pendingText="…" className="shrink-0">
          ساختن
        </SubmitButton>
      </div>
    </form>
  );
}

export function TemplateCard({ template, suggestions }: { template: DayTemplate; suggestions: string[] }) {
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(task: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await task();
      if (result.error) setError(result.error);
    });
  }

  return (
    <Card className={cx(pending && "opacity-60")}>
      {renaming ? (
        <RenameForm template={template} onDone={() => setRenaming(false)} />
      ) : (
        <CardHeader
          title={template.name}
          subtitle={template.blocks.length === 0 ? "هنوز جعبه‌ای ندارد" : undefined}
          aside={
            <div className="flex shrink-0">
              <button
                type="button"
                onClick={() => setRenaming(true)}
                className={iconButtonClass}
                aria-label={`تغییر نام «${template.name}»`}
              >
                <Pencil />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`تمپلیت «${template.name}» حذف شود؟ روزهایی که با آن چیده شده‌اند تغییری نمی‌کنند.`)) {
                    run(() => deleteTemplate(template.id));
                  }
                }}
                className={cx(iconButtonClass, "hover:text-down")}
                aria-label={`حذف «${template.name}»`}
              >
                <Trash />
              </button>
            </div>
          }
        />
      )}

      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-down-soft px-3 py-2 text-sm text-down">
          {error}
        </p>
      )}

      {template.blocks.length > 0 && (
        <ul className="mb-4 divide-y divide-line">
          {template.blocks.map((block) => (
            <li key={block.id} className="flex items-center gap-3 py-2">
              <span className="shrink-0 text-sm font-semibold text-accent tabular-nums">
                {formatClockRange(minutesOfTime(block.start_time), minutesOfTime(block.end_time))}
              </span>
              <span className="min-w-0 flex-1 break-words">
                {block.title}
                {block.tags.map((tag) => (
                  <span key={tag} className="ms-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                    #{tag}
                  </span>
                ))}
              </span>
              <button
                type="button"
                onClick={() => run(() => deleteTemplateBlock(block.id))}
                className={cx(iconButtonClass, "hover:text-down")}
                aria-label={`حذف «${block.title}» از تمپلیت`}
              >
                <Trash />
              </button>
            </li>
          ))}
        </ul>
      )}

      <details className="group">
        <summary className="cursor-pointer select-none text-sm font-semibold text-accent">+ افزودن جعبه به تمپلیت</summary>
        <div className="mt-3">
          <TemplateBlockForm templateId={template.id} suggestions={suggestions} />
        </div>
      </details>

      {template.blocks.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <ShareTemplateButton pack={templatePack(template)} name={template.name} />
        </div>
      )}
    </Card>
  );
}

function RenameForm({ template, onDone }: { template: DayTemplate; onDone: () => void }) {
  const [state, action] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await renameTemplate(template.id, prev, formData);
    if (!result.error) onDone();
    return result;
  }, initialFormState);
  return (
    <form action={action} className="mb-4 space-y-2">
      <FormMessage state={state} />
      <div className="flex gap-2">
        <input
          name="name"
          required
          maxLength={100}
          autoFocus
          aria-label="نام تازهٔ تمپلیت"
          defaultValue={state.values?.name ?? template.name}
          className={inputClass}
        />
        <SubmitButton pendingText="…">ذخیره</SubmitButton>
        <button type="button" onClick={onDone} className={buttonClass.ghost}>
          انصراف
        </button>
      </div>
    </form>
  );
}

function TemplateBlockForm({ templateId, suggestions }: { templateId: string; suggestions: string[] }) {
  const [resetKey, setResetKey] = useState(0);
  const [state, action] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await addTemplateBlock(templateId, prev, formData);
    if (!result.error) setResetKey((k) => k + 1);
    return result;
  }, initialFormState);
  const v = state.error ? state.values : undefined;
  const id = (name: string) => `tpl-${templateId}-${name}`;

  return (
    <form key={resetKey} action={action} className="space-y-3">
      <FormMessage state={state} />
      <Field label="عنوان" htmlFor={id("title")}>
        <input
          id={id("title")}
          name="title"
          required
          maxLength={200}
          defaultValue={v?.title}
          className={inputClass}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="از ساعت" htmlFor={id("start")}>
          <input id={id("start")} name="start" type="time" required dir="ltr" defaultValue={v?.start} className={inputClass} />
        </Field>
        <Field label="تا ساعت" htmlFor={id("end")}>
          <input id={id("end")} name="end" type="time" required dir="ltr" defaultValue={v?.end} className={inputClass} />
        </Field>
      </div>
      <p className="-mt-1 text-xs text-muted">برای «تا نیمه‌شب» ساعت پایان را ۰۰:۰۰ بگذارید.</p>
      <Field label="برچسب‌ها" htmlFor={id("tags")}>
        <TagInput
          id={id("tags")}
          defaultTags={v?.tags ? v.tags.split(",").filter(Boolean) : []}
          suggestions={suggestions}
        />
      </Field>
      <SubmitButton pendingText="در حال افزودن…" variant="secondary">
        افزودن جعبه
      </SubmitButton>
    </form>
  );
}
