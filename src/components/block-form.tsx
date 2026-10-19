"use client";

import { useActionState, useState } from "react";
import { MAX_DESCRIPTION } from "@/lib/blocks";
import { initialFormState, type FormState } from "@/lib/form-state";
import { faDigits } from "@/lib/format";
import { formatLead, LEAD_PRESETS, MAX_LEAD_MINUTES } from "@/lib/reminders";
import { SubmitButton } from "./submit-button";
import { TagInput } from "./tag-input";
import { buttonClass, cx, Field, FormMessage, inputClass } from "./ui";

export interface BlockDefaults {
  title?: string;
  start?: string;
  end?: string;
  tags?: string[];
  description?: string;
  amount?: string;
  unit?: string;
  cost?: string;
  // "default", "off" or "custom" (minutes in reminderMinutes)
  reminder?: string;
  reminderMinutes?: string;
}

// Create or edit one time block. `action` is a bound server action; on
// success the form either closes (edit) or clears itself for the next block.
export function BlockForm({
  idPrefix,
  action,
  defaults = {},
  suggestions,
  submitLabel,
  onDone,
  defaultLead,
}: {
  idPrefix: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: BlockDefaults;
  suggestions: string[];
  submitLabel: string;
  // called after a successful save; without it the form resets instead
  onDone?: () => void;
  // the user's default reminder lead time; null while reminders are off
  defaultLead: number | null;
}) {
  const [resetKey, setResetKey] = useState(0);
  const [state, formAction] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result.error) {
      if (onDone) onDone();
      else setResetKey((k) => k + 1);
    }
    return result;
  }, initialFormState);

  // after a failed submit, show what was typed rather than the defaults
  const v = state.error ? state.values : undefined;
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <form key={resetKey} action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <Field label="عنوان" htmlFor={id("title")}>
        <input
          id={id("title")}
          name="title"
          required
          maxLength={200}
          placeholder="مثلاً درس ریاضی"
          defaultValue={v?.title ?? defaults.title}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="از ساعت" htmlFor={id("start")}>
          <input
            id={id("start")}
            name="start"
            type="time"
            required
            dir="ltr"
            defaultValue={v?.start ?? defaults.start}
            className={inputClass}
          />
        </Field>
        <Field label="تا ساعت" htmlFor={id("end")}>
          <input
            id={id("end")}
            name="end"
            type="time"
            required
            dir="ltr"
            defaultValue={v?.end ?? defaults.end}
            aria-describedby={id("end-hint")}
            className={inputClass}
          />
        </Field>
      </div>
      <p id={id("end-hint")} className="-mt-1 text-xs text-muted">
        برای «تا نیمه‌شب» ساعت پایان را ۰۰:۰۰ بگذارید.
      </p>

      <Field label="برچسب‌ها" htmlFor={id("tags")}>
        <TagInput
          id={id("tags")}
          defaultTags={v?.tags ? v.tags.split(",").filter(Boolean) : (defaults.tags ?? [])}
          suggestions={suggestions}
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="مقدار" htmlFor={id("amount")}>
          <input
            id={id("amount")}
            name="amount"
            inputMode="decimal"
            placeholder="۲۰"
            defaultValue={v?.amount ?? defaults.amount}
            className={inputClass}
          />
        </Field>
        <Field label="واحد" htmlFor={id("unit")}>
          <input
            id={id("unit")}
            name="unit"
            maxLength={30}
            placeholder="صفحه"
            defaultValue={v?.unit ?? defaults.unit}
            className={inputClass}
          />
        </Field>
        <Field label="هزینه (تومان)" htmlFor={id("cost")}>
          <input
            id={id("cost")}
            name="cost"
            inputMode="numeric"
            placeholder="۰"
            defaultValue={v?.cost ?? defaults.cost}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="توضیحات" htmlFor={id("description")}>
        <textarea
          id={id("description")}
          name="description"
          rows={3}
          maxLength={MAX_DESCRIPTION}
          placeholder="جزئیات این بازه: چه کردید، کجا، با چه کسی…"
          defaultValue={v?.description ?? defaults.description}
          className={cx(inputClass, "resize-y leading-7")}
        />
      </Field>

      <ReminderField
        id={id("reminder")}
        defaultLead={defaultLead}
        initialChoice={v?.reminder ?? defaults.reminder ?? "default"}
        initialMinutes={v?.reminder_minutes ?? defaults.reminderMinutes ?? ""}
      />

      <div className="flex gap-2">
        <SubmitButton pendingText="در حال ذخیره…">{submitLabel}</SubmitButton>
        {onDone && (
          <button type="button" onClick={onDone} className={buttonClass.ghost}>
            انصراف
          </button>
        )}
      </div>
    </form>
  );
}

// When to be reminded of this block: the default lead time, none, or any
// number of minutes before (with quick picks).
function ReminderField({
  id,
  defaultLead,
  initialChoice,
  initialMinutes,
}: {
  id: string;
  defaultLead: number | null;
  initialChoice: string;
  initialMinutes: string;
}) {
  const [choice, setChoice] = useState(initialChoice);
  const [minutes, setMinutes] = useState(initialMinutes);

  return (
    <div className="space-y-2">
      <Field label="یادآوری" htmlFor={id}>
        <select id={id} name="reminder" value={choice} onChange={(e) => setChoice(e.target.value)} className={inputClass}>
          <option value="default">
            {defaultLead === null ? "پیش‌فرض (یادآوری‌ها خاموش است)" : `پیش‌فرض: ${formatLead(defaultLead)}`}
          </option>
          <option value="custom">زمان دلخواه برای این جعبه</option>
          <option value="off">بدون یادآوری</option>
        </select>
      </Field>
      {choice === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            name="reminder_minutes"
            inputMode="numeric"
            required
            aria-label="چند دقیقه قبل"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="۱۰"
            className={cx(inputClass, "w-24!")}
          />
          <span className="text-sm text-muted">دقیقه قبل (تا {faDigits(MAX_LEAD_MINUTES)})</span>
          {LEAD_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setMinutes(String(preset))}
              className={cx(
                "rounded-full border px-2.5 py-0.5 text-xs",
                minutes === String(preset) ? "border-accent bg-accent-soft text-accent" : "border-line text-muted",
              )}
            >
              {preset === 0 ? "سر وقت" : faDigits(preset)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
