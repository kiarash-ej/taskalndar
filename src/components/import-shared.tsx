"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { importShared, type ImportResult } from "@/lib/actions/share";
import { formatClockRange, parseClock } from "@/lib/blocks";
import { faDigits, WEEKDAY_NAMES } from "@/lib/format";
import { scheduleLabel } from "@/lib/schedule";
import { CODE_PREFIX, decodeShare, encodeShare, parseBlockLines, type SharePack } from "@/lib/share";
import { buttonClass, cx, inputClass } from "./ui";

const range = (start: string, end: string) => formatClockRange(parseClock(start) ?? 0, parseClock(end) ?? 0);

// Reads what was pasted: a share code or link, or plain lines of blocks
// from another app (which become one template). Nothing is saved here.
function readInput(input: string): { pack: SharePack; code: string; note?: string } | { error: string } {
  if (input.includes(CODE_PREFIX)) {
    const decoded = decodeShare(input);
    return "error" in decoded ? decoded : { pack: decoded.pack, code: input };
  }
  const { blocks, badLines } = parseBlockLines(input);
  if (blocks.length === 0) {
    return { error: "چیزی خوانده نشد. یک کد تسکلندر وارد کنید، یا هر خط را به‌شکل «07:00-08:00 ورزش» بنویسید." };
  }
  const pack: SharePack = { v: 1, templates: [{ name: "تمپلیت واردشده", blocks }], sleep: [], tasks: [] };
  return {
    pack,
    code: encodeShare(pack),
    note: badLines.length ? `خط‌های ${faDigits(badLines.join("، "))} خوانده نشدند و کنار گذاشته شدند.` : undefined,
  };
}

// The import page: paste (or open a link), review every item, tick what to
// keep, rename templates, then answer "add these?".
export function ImportShared({ hasSleepSchedule }: { hasSleepSchedule: boolean }) {
  const [input, setInput] = useState("");
  const [read, setRead] = useState<ReturnType<typeof readInput> | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [templates, setTemplates] = useState<Set<number>>(new Set());
  const [tasks, setTasks] = useState<Set<number>>(new Set());
  const [sleep, setSleep] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  function review(text: string) {
    const r = readInput(text);
    setRead(r);
    setResult(null);
    if ("pack" in r) {
      setNames(r.pack.templates.map((t) => t.name));
      setTemplates(new Set(r.pack.templates.map((_, i) => i)));
      setTasks(new Set(r.pack.tasks.map((_, i) => i)));
      // replacing an existing schedule must be a conscious choice
      setSleep(r.pack.sleep.length > 0 && !hasSleepSchedule);
    }
  }

  // a share link opens this page with the code after "#" (also when a link
  // is opened while already here, which only changes the hash)
  useEffect(() => {
    function fromHash() {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash.startsWith(CODE_PREFIX)) return;
      setInput(hash);
      review(hash);
      history.replaceState(null, "", window.location.pathname);
    }
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pack = read && "pack" in read ? read.pack : null;
  const count = templates.size + tasks.size + (sleep ? 1 : 0);

  function add() {
    if (!read || !("pack" in read)) return;
    startTransition(async () => {
      setResult(
        await importShared(read.code, {
          templates: [...templates].map((i) => ({ index: i, name: names[i] })),
          sleep,
          tasks: [...tasks],
        }),
      );
    });
  }

  const toggle = (set: Set<number>, update: (s: Set<number>) => void, i: number) => {
    const next = new Set(set);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    update(next);
  };

  if (result?.added) {
    const { templates: t, sleep: s, tasks: k } = result.added;
    return (
      <div className="space-y-3">
        <p role="status" className="rounded-xl bg-up-soft px-3 py-2 text-sm text-up">
          اضافه شد:{" "}
          {[t && `${faDigits(t)} تمپلیت`, s && "برنامهٔ خواب", k && `${faDigits(k)} کار تکراری`].filter(Boolean).join("، ")}
        </p>
        <div className="flex flex-wrap gap-2">
          {t > 0 && <Link href="/templates" className={buttonClass.secondary}>دیدن تمپلیت‌ها</Link>}
          {(s || k > 0) && <Link href="/planner" className={buttonClass.secondary}>برنامهٔ روزانه</Link>}
          <button type="button" onClick={() => { setResult(null); setRead(null); setInput(""); }} className={buttonClass.ghost}>
            وارد کردن کد دیگر
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cx("space-y-4", pending && "opacity-60")}>
      <div className="space-y-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={5}
          aria-label="کد یا متن برای وارد کردن"
          placeholder={"کد یا لینک اشتراک را این‌جا بگذارید.\nیا از هر برنامهٔ دیگری، هر خط یک بازه:\n07:00-08:00 ورزش #سلامتی\n16:00 تا 18:00 درس ریاضی"}
          className={cx(inputClass, "resize-y font-mono text-sm leading-7")}
        />
        <button type="button" onClick={() => review(input)} disabled={!input.trim()} className={buttonClass.secondary}>
          بررسی
        </button>
      </div>

      {read && "error" in read && (
        <p role="alert" className="rounded-xl bg-down-soft px-3 py-2 text-sm text-down">{read.error}</p>
      )}
      {result?.error && (
        <p role="alert" className="rounded-xl bg-down-soft px-3 py-2 text-sm text-down">{result.error}</p>
      )}

      {pack && (
        <div className="space-y-4">
          {read && "note" in read && read.note && <p className="text-xs text-down">{read.note}</p>}

          {pack.templates.map((t, i) => (
            <fieldset key={i} className="space-y-2 rounded-xl border border-line p-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={templates.has(i)} onChange={() => toggle(templates, setTemplates, i)} className="size-5 accent-accent" />
                <span className="text-sm font-bold">تمپلیت</span>
                <input
                  value={names[i] ?? ""}
                  maxLength={100}
                  disabled={!templates.has(i)}
                  onChange={(e) => setNames((n) => n.map((v, j) => (j === i ? e.target.value : v)))}
                  aria-label="نام تمپلیت"
                  className={cx(inputClass, "min-w-0 flex-1 py-1")}
                />
              </label>
              <ul className="space-y-1 ps-7 text-sm">
                {t.blocks.map((b, j) => (
                  <li key={j}>
                    <span className="font-semibold text-accent tabular-nums">{range(b.start, b.end)}</span> {b.title}
                    {b.tags.map((tag) => (
                      <span key={tag} className="ms-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">#{tag}</span>
                    ))}
                  </li>
                ))}
              </ul>
            </fieldset>
          ))}

          {pack.sleep.length > 0 && (
            <fieldset className="space-y-2 rounded-xl border border-line p-3">
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={sleep} onChange={(e) => setSleep(e.target.checked)} className="size-5 accent-accent" />
                برنامهٔ خواب هفتگی
              </label>
              {hasSleepSchedule && (
                <p className="text-xs text-down">با انتخاب این، برنامهٔ خواب فعلی شما با این یکی جایگزین می‌شود.</p>
              )}
              <ul className="space-y-1 ps-7 text-sm">
                {pack.sleep.map((n) => (
                  <li key={n.weekday}>
                    {WEEKDAY_NAMES[n.weekday]} شب: <bdi className="tabular-nums">{faDigits(`${n.bed} تا ${n.wake}`)}</bdi>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          {pack.tasks.length > 0 && (
            <fieldset className="space-y-1.5 rounded-xl border border-line p-3">
              <legend className="px-1 text-sm font-bold">کارهای تکراری (از امروز)</legend>
              {pack.tasks.map((t, i) => (
                <label key={i} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={tasks.has(i)} onChange={() => toggle(tasks, setTasks, i)} className="size-5 accent-accent" />
                  {t.title}
                  <span className="text-xs text-muted">({scheduleLabel({ is_recurring: true, weekdays: t.weekdays })})</span>
                </label>
              ))}
            </fieldset>
          )}

          <div className="space-y-2 rounded-xl bg-surface-2 p-3">
            <p className="text-sm font-semibold">
              {count > 0 ? `این ${faDigits(count)} مورد به حساب شما اضافه شود؟` : "موردی انتخاب نشده."}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={add} disabled={pending || count === 0} className={buttonClass.primary}>
                {pending ? "در حال افزودن…" : "بله، اضافه شود"}
              </button>
              <button type="button" onClick={() => setRead(null)} disabled={pending} className={buttonClass.ghost}>
                نه
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
