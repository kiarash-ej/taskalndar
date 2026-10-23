"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { faDigits } from "@/lib/format";
import { encodeShare, shareLink, type SharePack } from "@/lib/share";
import { scheduleLabel } from "@/lib/schedule";
import { buttonClass, cx, inputClass } from "./ui";

const noSubscribe = () => () => {};
// the site's own address, known only in the browser
function useOrigin(): string {
  return useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <div className="flex gap-2">
        <input
          readOnly
          dir="ltr"
          value={value}
          aria-label={label}
          onFocus={(e) => e.target.select()}
          className={cx(inputClass, "min-w-0 font-mono text-xs")}
        />
        <button
          type="button"
          onClick={() =>
            navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            })
          }
          className={cx(buttonClass.secondary, "shrink-0")}
        >
          {copied ? "کپی شد" : "کپی"}
        </button>
      </div>
    </div>
  );
}

// A link and a code for what's being shared. Whoever opens it sees the
// contents and decides what to add to their own account.
export function SharePanel({ pack, title }: { pack: SharePack; title: string }) {
  const origin = useOrigin();
  const code = useMemo(() => encodeShare(pack), [pack]);
  const link = origin ? shareLink(origin, code) : "";
  const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);

  return (
    <div className="space-y-3 rounded-xl border border-accent/40 bg-accent-soft/40 p-3">
      {link && <CopyRow label="لینک اشتراک" value={link} />}
      <CopyRow label="یا این کد (در صفحهٔ «دریافت» وارد می‌شود)" value={code} />
      {canShare && link && (
        <button
          type="button"
          onClick={() => navigator.share({ title, text: `«${title}» در تسکلندر`, url: link }).catch(() => {})}
          className={buttonClass.primary}
        >
          ارسال با برنامه‌های گوشی
        </button>
      )}
      <p className="text-xs leading-6 text-muted">
        همهٔ محتوا داخل خود لینک و کد است و جایی روی سرور منتشر نمی‌شود. یادداشت‌ها، تیک‌های انجام و هدف‌ها
        هیچ‌وقت در آن نیستند.
      </p>
    </div>
  );
}

// "Share" under one template.
export function ShareTemplateButton({ pack, name }: { pack: SharePack; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-sm font-semibold text-accent hover:underline">
        {open ? "بستن اشتراک‌گذاری" : "اشتراک‌گذاری این تمپلیت"}
      </button>
      {open && <SharePanel pack={pack} title={name} />}
    </div>
  );
}

// Settings: share the whole setup, or any part of it.
export function ShareProfile({ pack }: { pack: SharePack }) {
  const [templates, setTemplates] = useState(() => new Set(pack.templates.map((_, i) => i)));
  const [tasks, setTasks] = useState(() => new Set(pack.tasks.map((_, i) => i)));
  const [sleep, setSleep] = useState(pack.sleep.length > 0);
  const [made, setMade] = useState(false);

  const selected = useMemo<SharePack>(
    () => ({
      v: 1,
      templates: pack.templates.filter((_, i) => templates.has(i)),
      sleep: sleep ? pack.sleep : [],
      tasks: pack.tasks.filter((_, i) => tasks.has(i)),
    }),
    [pack, templates, tasks, sleep],
  );
  const count = selected.templates.length + selected.tasks.length + (selected.sleep.length > 0 ? 1 : 0);

  if (pack.templates.length + pack.tasks.length + pack.sleep.length === 0) {
    return (
      <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">
        هنوز تمپلیت، برنامهٔ خواب یا کار تکراری‌ای ندارید که به اشتراک بگذارید.
      </p>
    );
  }

  const toggle = (set: Set<number>, update: (s: Set<number>) => void, i: number) => {
    const next = new Set(set);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    update(next);
    setMade(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">چیزهایی را که می‌خواهید در لینک باشد انتخاب کنید:</p>
      {pack.templates.length > 0 && (
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-sm font-bold">تمپلیت‌ها</legend>
          {pack.templates.map((t, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={templates.has(i)} onChange={() => toggle(templates, setTemplates, i)} className="size-4 accent-accent" />
              {t.name}
              <span className="text-xs text-muted">({faDigits(t.blocks.length)} جعبه)</span>
            </label>
          ))}
        </fieldset>
      )}
      {pack.sleep.length > 0 && (
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={sleep} onChange={(e) => { setSleep(e.target.checked); setMade(false); }} className="size-4 accent-accent" />
          برنامهٔ خواب هفتگی
          <span className="text-xs font-normal text-muted">({faDigits(pack.sleep.length)} شب)</span>
        </label>
      )}
      {pack.tasks.length > 0 && (
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-sm font-bold">کارهای تکراری</legend>
          {pack.tasks.map((t, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={tasks.has(i)} onChange={() => toggle(tasks, setTasks, i)} className="size-4 accent-accent" />
              {t.title}
              <span className="text-xs text-muted">({scheduleLabel({ is_recurring: true, weekdays: t.weekdays })})</span>
            </label>
          ))}
        </fieldset>
      )}
      {made && count > 0 ? (
        <SharePanel pack={selected} title="برنامهٔ من" />
      ) : (
        <button type="button" disabled={count === 0} onClick={() => setMade(true)} className={buttonClass.primary}>
          ساختن لینک اشتراک ({faDigits(count)} مورد)
        </button>
      )}
    </div>
  );
}
