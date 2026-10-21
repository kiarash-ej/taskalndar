"use client";

import { useActionState, useState, useTransition } from "react";
import { createSleepPhoneLink, deleteSleepPhoneLink, saveSleepSchedule } from "@/lib/actions/sleep";
import { formatClock, parseClock } from "@/lib/blocks";
import { initialFormState } from "@/lib/form-state";
import { faDigits, WEEKDAY_NAMES } from "@/lib/format";
import { formatSleepLength, MAX_SLEEP_MINUTES, MIN_SLEEP_MINUTES, sleepMinutes, type SleepPlan } from "@/lib/sleep";
import { SubmitButton } from "./submit-button";
import { buttonClass, cx, FormMessage, inputClass } from "./ui";

const NOON = 12 * 60;
const DEFAULT_BED = "23:00";
const DEFAULT_WAKE = "07:00";

interface Row {
  on: boolean;
  bed: string;
  wake: string;
}

// "شنبه ۲۳:۰۰ تا یکشنبه ۰۷:۰۰"
function nightSpan(weekday: number, bedtime: number, wake: number): string {
  const bedDay = (weekday + (bedtime >= NOON ? 0 : 1)) % 7;
  const wakeDay = (bedDay + (wake > bedtime ? 0 : 1)) % 7;
  return faDigits(
    `${WEEKDAY_NAMES[bedDay]} ${formatClock(bedtime)} تا ${WEEKDAY_NAMES[wakeDay]} ${formatClock(wake)}`,
  );
}

// The weekly sleep schedule: a bedtime and wake time per night, which the
// planner offers as "خواب" suggestions to accept.
export function SleepScheduleForm({ plans }: { plans: SleepPlan[] }) {
  const [state, action] = useActionState(saveSleepSchedule, initialFormState);
  // nothing saved yet: every night checked, so the first save is one click
  const [rows, setRows] = useState<Row[]>(() =>
    WEEKDAY_NAMES.map((_, weekday) => {
      const plan = plans.find((p) => p.weekday === weekday);
      return plan
        ? { on: true, bed: formatClock(plan.bedtime), wake: formatClock(plan.wake) }
        : { on: plans.length === 0, bed: DEFAULT_BED, wake: DEFAULT_WAKE };
    }),
  );

  function update(weekday: number, change: Partial<Row>) {
    setRows((current) => current.map((row, i) => (i === weekday ? { ...row, ...change } : row)));
  }

  const first = rows.find((r) => r.on) ?? rows[0];

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <ul className="divide-y divide-line">
        {rows.map((row, weekday) => {
          const bed = parseClock(row.bed);
          const wake = parseClock(row.wake);
          const length = bed !== null && wake !== null ? sleepMinutes(bed, wake) : null;
          const valid = length !== null && length >= MIN_SLEEP_MINUTES && length <= MAX_SLEEP_MINUTES;
          return (
            <li key={weekday} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <label className="flex w-32 shrink-0 items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  name={`on_${weekday}`}
                  checked={row.on}
                  onChange={(e) => update(weekday, { on: e.target.checked })}
                  className="size-5 cursor-pointer accent-accent"
                />
                {WEEKDAY_NAMES[weekday]} شب
              </label>
              <label className="flex items-center gap-1.5 text-sm text-muted">
                خواب
                <input
                  type="time"
                  dir="ltr"
                  name={`bed_${weekday}`}
                  value={row.bed}
                  disabled={!row.on}
                  required={row.on}
                  onChange={(e) => update(weekday, { bed: e.target.value })}
                  className={cx(inputClass, "w-32!")}
                />
              </label>
              <label className="flex items-center gap-1.5 text-sm text-muted">
                بیداری
                <input
                  type="time"
                  dir="ltr"
                  name={`wake_${weekday}`}
                  value={row.wake}
                  disabled={!row.on}
                  required={row.on}
                  onChange={(e) => update(weekday, { wake: e.target.value })}
                  className={cx(inputClass, "w-32!")}
                />
              </label>
              {row.on && bed !== null && wake !== null && (
                <span className={cx("text-xs", valid ? "text-muted" : "text-down")}>
                  {valid ? (
                    // isolated, or the digits pull the parts out of order
                    <>
                      <bdi>{nightSpan(weekday, bed, wake)}</bdi> · <bdi>{formatSleepLength(length)}</bdi>
                    </>
                  ) : (
                    "باید بین ۱ تا ۱۶ ساعت باشد"
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs leading-6 text-muted">
        «شنبه شب» یعنی شبی که عصر شنبه شروع می‌شود؛ ساعت خواب قبل از ظهر (مثلاً ۰۱:۰۰) بعد از نیمه‌شب حساب
        می‌شود. هر شب در برنامهٔ روزانه به‌صورت پیشنهاد «خواب» نشان داده می‌شود و فقط وقتی «ثبت» را بزنید
        جعبهٔ خواب با برچسب #خواب ساخته می‌شود (و در گزارش ماهانه جمع زده می‌شود).
      </p>
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingText="در حال ذخیره…">ذخیرهٔ برنامهٔ خواب</SubmitButton>
        <button
          type="button"
          onClick={() => setRows((current) => current.map(() => ({ ...first, on: true })))}
          className={buttonClass.secondary}
        >
          همهٔ شب‌ها مثل {faDigits(first.bed)} تا {faDigits(first.wake)}
        </button>
      </div>
    </form>
  );
}

// The personal link a phone automation calls when an alarm is set.
export function SleepPhoneLink({ hasLink, available }: { hasLink: boolean; available: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!available) {
    return (
      <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">
        اتصال گوشی هنوز روی این سرور راه‌اندازی نشده است.
      </p>
    );
  }

  const url = token ? `${window.location.origin}/api/sleep?token=${token}` : null;

  function create() {
    if (hasLink && !window.confirm("لینک تازه ساخته شود؟ لینک قبلی دیگر کار نمی‌کند.")) return;
    setError(null);
    startTransition(async () => {
      const result = await createSleepPhoneLink();
      if (result.error) setError(result.error);
      else if (result.token) setToken(result.token);
    });
  }

  function remove() {
    if (!window.confirm("لینک گوشی حذف شود؟ اتوماسیون‌های گوشی دیگر کار نمی‌کنند.")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteSleepPhoneLink();
      if (result.error) setError(result.error);
      else setToken(null);
    });
  }

  return (
    <div className={cx("space-y-3", pending && "opacity-60")}>
      {error && (
        <p role="alert" className="rounded-xl bg-down-soft px-3 py-2 text-sm text-down">
          {error}
        </p>
      )}

      {url ? (
        <div className="space-y-2 rounded-xl border border-accent/40 bg-accent-soft p-3">
          <p className="text-sm font-semibold">لینک شما (فقط همین یک بار نمایش داده می‌شود):</p>
          <div className="flex gap-2">
            <input readOnly dir="ltr" value={url} aria-label="لینک گوشی" className={cx(inputClass, "font-mono text-xs")} />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}
              className={buttonClass.secondary}
            >
              {copied ? "کپی شد" : "کپی"}
            </button>
          </div>
          <p className="text-xs text-muted">این لینک مثل رمز است؛ آن را به کسی ندهید.</p>
        </div>
      ) : (
        <p className="text-sm text-muted">
          {hasLink
            ? "لینک گوشی ساخته شده است. اگر آن را گم کرده‌اید، لینک تازه بسازید."
            : "با یک لینک شخصی، گوشی هر وقت زنگ ساعت را تنظیم کردید یا خوابیدید، ساعت خواب و بیداری را خودش در تسکلندر ثبت می‌کند."}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={create} disabled={pending} className={buttonClass.primary}>
          {hasLink ? "ساختن لینک تازه" : "ساختن لینک گوشی"}
        </button>
        {hasLink && (
          <button type="button" onClick={remove} disabled={pending} className={buttonClass.ghost}>
            حذف لینک
          </button>
        )}
      </div>

      <details className="rounded-xl bg-surface-2 p-3 text-sm leading-7">
        <summary className="cursor-pointer font-semibold">راهنمای تنظیم روی گوشی</summary>
        <div className="mt-2 space-y-3 text-muted">
          <p>
            گوشی باید یک درخواست <span dir="ltr">POST</span> به لینک بالا بفرستد و یکی از این‌ها را به
            انتهایش اضافه کند (ساعت‌ها به وقت تهران):
          </p>
          <ul className="list-disc space-y-1 ps-5" dir="ltr">
            <li>&amp;wake=07:00</li>
            <li>&amp;bed=23:30&amp;wake=07:00</li>
            <li>&amp;bed=now</li>
            <li>&amp;wake=now</li>
          </ul>
          <p>
            <strong className="text-fg">آیفون (Shortcuts):</strong> در بخش Automation یک اتوماسیون شخصی با
            «Alarm» یا «Sleep → Bedtime begins / Waking up» بسازید، کار «Get Contents of URL» را اضافه
            کنید، لینک را با <span dir="ltr">&amp;bed=now</span> یا <span dir="ltr">&amp;wake=now</span>{" "}
            بدهید و Method را POST بگذارید.
          </p>
          <p>
            <strong className="text-fg">اندروید (Tasker یا MacroDroid):</strong> با رویداد تغییر زنگ ساعت
            بعدی (Next Alarm Changed) یک «HTTP Request» با روش POST بفرستید و ساعت زنگ را در{" "}
            <span dir="ltr">wake</span> بگذارید.
          </p>
          <p>
            اگر فقط ساعت بیداری را بفرستید، ساعت خواب از برنامهٔ هفتگی بالا برداشته می‌شود و برعکس.
          </p>
        </div>
      </details>
    </div>
  );
}
