"use client";

import { useActionState, useState } from "react";
import { saveReminderSettings } from "@/lib/actions/reminders";
import { initialFormState } from "@/lib/form-state";
import { faDigits } from "@/lib/format";
import { formatLead, LEAD_PRESETS, MAX_LEAD_MINUTES, parseLeadMinutes, type ReminderSettings } from "@/lib/reminders";
import { SubmitButton } from "./submit-button";
import { cx, FormMessage, inputClass } from "./ui";

// The default reminder before each time block: any number of minutes, with
// quick picks. Each block can still choose its own in the planner.
export function ReminderSettingsForm({ current, hasChat }: { current: ReminderSettings; hasChat: boolean }) {
  const [state, action] = useActionState(saveReminderSettings, initialFormState);
  const [enabled, setEnabled] = useState(current.enabled);
  const [lead, setLead] = useState(state.values?.lead_minutes ?? String(current.leadMinutes));
  const [includeSleep, setIncludeSleep] = useState(current.includeSleep);
  const parsed = parseLeadMinutes(lead);

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      {!hasChat && (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
          یادآوری‌ها در بله یا تلگرام فرستاده می‌شوند. اول از بخش «خلاصهٔ روزانه در پیام‌رسان» پایین، یکی را
          وصل کنید.
        </p>
      )}

      <label className="flex items-center gap-2 font-medium">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="size-5 cursor-pointer accent-accent"
        />
        یادآوری قبل از شروع جعبه‌های زمانی
      </label>

      <fieldset disabled={!enabled} className="space-y-3 disabled:opacity-60">
        <div className="space-y-2">
          <label htmlFor="lead_minutes" className="block text-sm font-medium">
            چند دقیقه زودتر؟
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="lead_minutes"
              name="lead_minutes"
              inputMode="numeric"
              required
              value={lead}
              onChange={(e) => setLead(e.target.value)}
              className={cx(inputClass, "w-24!")}
            />
            <span className="text-sm text-muted">دقیقه</span>
            {LEAD_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setLead(String(preset))}
                className={cx(
                  "rounded-full border px-3 py-1 text-sm",
                  parsed === preset ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:bg-surface-2",
                )}
              >
                {preset === 0 ? "سر وقت" : faDigits(preset)}
              </button>
            ))}
          </div>
          <p className={cx("text-xs", parsed === null ? "text-down" : "text-muted")}>
            {parsed === null
              ? `عددی صحیح بین ۰ تا ${faDigits(MAX_LEAD_MINUTES)} بنویسید.`
              : `پیام ${formatLead(parsed)} از شروع هر جعبه می‌آید. برای هر جعبه هم می‌توانید در برنامهٔ روزانه زمان جدا بگذارید یا یادآوری‌اش را خاموش کنید.`}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="include_sleep"
            checked={includeSleep}
            onChange={(e) => setIncludeSleep(e.target.checked)}
            className="size-4 cursor-pointer accent-accent"
          />
          یادآوری وقت خواب (برای جعبه‌های برنامهٔ خواب)
        </label>
      </fieldset>
      {/* a disabled fieldset doesn't submit its fields; keep what they say */}
      {!enabled && (
        <>
          <input type="hidden" name="lead_minutes" value={lead} />
          {includeSleep && <input type="hidden" name="include_sleep" value="on" />}
        </>
      )}

      <SubmitButton pendingText="در حال ذخیره…">ذخیره</SubmitButton>
    </form>
  );
}
