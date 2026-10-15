"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { connectChannel, disconnectChannel, saveChannelSettings } from "@/lib/actions/channels";
import { BOT_NAMES, SEND_TIME_OPTIONS, startCommand, type ChannelRow, type ChannelState } from "@/lib/channels";
import { initialFormState } from "@/lib/form-state";
import { faDigits, formatLongDate } from "@/lib/format";
import { telegramLinkUrl, type BotKind } from "@/lib/messaging/bots";
import { SubmitButton } from "./submit-button";
import { buttonClass, cx, FormMessage, inputClass } from "./ui";

const POLL_MS = 5000;

export interface ChannelView {
  kind: BotKind;
  // the bot's public username, if configured
  username?: string;
  channel: ChannelRow | null;
  state: ChannelState | null;
  // while pending: whole minutes until the code expires
  minutesLeft: number;
}

// One messenger's panel: connect → send the code to the bot → settings.
export function ChannelPanel({ view }: { view: ChannelView }) {
  const { kind, channel, state } = view;
  const name = BOT_NAMES[kind];
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
    <section className={cx("space-y-3 rounded-xl border border-line p-4", pending && "opacity-60")}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="font-bold">{name}</h3>
        <StatusBadge state={state} enabled={channel?.enabled ?? false} />
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-down-soft px-3 py-2 text-sm text-down">
          {error}
        </p>
      )}

      {!channel && (
        <div className="space-y-2">
          <p className="text-sm text-muted">هر شب خلاصهٔ برنامهٔ روزتان را در {name} بگیرید.</p>
          <button type="button" onClick={() => run(() => connectChannel(kind))} className={buttonClass.primary}>
            اتصال به {name}
          </button>
        </div>
      )}

      {channel && state === "pending" && channel.link_code && (
        <PendingSteps view={view} code={channel.link_code} onCancel={() => run(() => disconnectChannel(channel.id))} />
      )}

      {channel && state === "expired" && (
        <div className="space-y-2">
          <p className="text-sm text-muted">کد اتصال منقضی شد. یک کد تازه بسازید و دوباره امتحان کنید.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => run(() => connectChannel(kind, true))} className={buttonClass.primary}>
              ساختن کد تازه
            </button>
            <button type="button" onClick={() => run(() => disconnectChannel(channel.id))} className={buttonClass.ghost}>
              انصراف
            </button>
          </div>
        </div>
      )}

      {channel && state === "linked" && (
        <>
          <SettingsForm channel={channel} />
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`اتصال فعلی ${name} حذف و کد تازه‌ای برای گفت‌وگوی دیگر ساخته شود؟`)) {
                  run(() => connectChannel(kind, true));
                }
              }}
              className={buttonClass.ghost}
            >
              اتصال به گفت‌وگوی دیگر
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`اتصال ${name} قطع شود؟ دیگر خلاصه‌ای فرستاده نمی‌شود.`)) {
                  run(() => disconnectChannel(channel.id));
                }
              }}
              className={cx(buttonClass.ghost, "hover:text-down")}
            >
              قطع اتصال
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function StatusBadge({ state, enabled }: { state: ChannelState | null; enabled: boolean }) {
  if (state === "linked") {
    return (
      <span className={cx("rounded-full px-2 py-0.5 text-xs", enabled ? "bg-up-soft text-up" : "bg-surface-2 text-muted")}>
        {enabled ? "✓ متصل" : "متصل، خاموش"}
      </span>
    );
  }
  if (state === "pending") return <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">در انتظار تأیید</span>;
  return <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">وصل نیست</span>;
}

function PendingSteps({ view, code, onCancel }: { view: ChannelView; code: string; onCancel: () => void }) {
  const router = useRouter();
  const name = BOT_NAMES[view.kind];
  const command = startCommand(code);
  const bot = view.username ? `@${view.username}` : `بات ${name}`;

  // The bot links the chat on its side; re-read until the page shows it.
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="space-y-3 text-sm">
      <ol className="list-inside list-[persian] space-y-2">
        <li>
          {view.kind === "telegram" && view.username ? (
            <a
              href={telegramLinkUrl(view.username, code)}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-accent hover:underline"
            >
              {bot} را در تلگرام باز کنید
            </a>
          ) : (
            <>
              در {name}، <span dir="ltr" className="font-semibold">{bot}</span> را پیدا و باز کنید.
            </>
          )}
        </li>
        <li className="space-y-1.5">
          <span>این پیام را برایش بفرستید:</span>
          <div className="flex items-center gap-2">
            <code dir="ltr" className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-2 py-1.5 text-xs">
              {command}
            </code>
            <CopyButton text={command} />
          </div>
        </li>
        <li>همین‌جا بمانید؛ بعد از تأیید، این بخش خودش به‌روز می‌شود.</li>
      </ol>
      <p className="text-xs text-muted">
        کد تا {faDigits(view.minutesLeft)} دقیقهٔ دیگر معتبر است و فقط یک بار کار می‌کند.
      </p>
      <button type="button" onClick={onCancel} className={buttonClass.ghost}>
        انصراف
      </button>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // clipboard blocked: the command is still visible to copy by hand
        }
      }}
      className={cx(buttonClass.secondary, "shrink-0 px-3 py-1.5")}
    >
      {copied ? "کپی شد" : "کپی"}
    </button>
  );
}

function SettingsForm({ channel }: { channel: ChannelRow }) {
  const [state, action] = useActionState(saveChannelSettings.bind(null, channel.id), initialFormState);
  const sendTime = channel.send_time.slice(0, 5);
  const check = "flex cursor-pointer items-center gap-2 text-sm";

  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <label className={cx(check, "font-medium")}>
        <input type="checkbox" name="enabled" defaultChecked={channel.enabled} className="size-4 accent-accent" />
        ارسال خلاصهٔ روزانه روشن باشد
      </label>
      <label className="flex flex-wrap items-center gap-2 text-sm">
        ساعت ارسال (به وقت تهران)
        <select name="send_time" defaultValue={sendTime} dir="ltr" className={cx(inputClass, "w-auto")}>
          {SEND_TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {faDigits(t)}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-sm font-medium">در پیام بیاید:</legend>
        <label className={check}>
          <input type="checkbox" name="include_tasks" defaultChecked={channel.include_tasks} className="size-4 accent-accent" />
          کارهای روز و وضعیت انجامشان
        </label>
        <label className={check}>
          <input type="checkbox" name="include_blocks" defaultChecked={channel.include_blocks} className="size-4 accent-accent" />
          جعبه‌های زمانی
        </label>
        <label className={check}>
          <input type="checkbox" name="include_note" defaultChecked={channel.include_note} className="size-4 accent-accent" />
          یادداشت روزانه
        </label>
      </fieldset>
      {channel.last_sent_on && (
        <p className="text-xs text-muted">آخرین ارسال: {formatLongDate(channel.last_sent_on)}</p>
      )}
      <SubmitButton pendingText="در حال ذخیره…" variant="secondary">
        ذخیرهٔ تنظیمات
      </SubmitButton>
    </form>
  );
}
