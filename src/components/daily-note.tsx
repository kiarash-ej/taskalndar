"use client";

import { useEffect, useRef, useState } from "react";
import { saveDailyNote } from "@/lib/actions/notes";
import type { IsoDate } from "@/lib/dates";
import { inputClass } from "./ui";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const AUTOSAVE_DELAY_MS = 800;
const RETRY_DELAY_MS = 3000;
const MAX_NOTE_LENGTH = 10000;

const STATUS_TEXT: Record<SaveState, string> = {
  idle: "",
  dirty: "در حال نوشتن…",
  saving: "در حال ذخیره…",
  saved: "ذخیره شد",
  error: "ذخیره نشد؛ دوباره تلاش می‌کنیم",
};

// Free-form note for one day, saved automatically shortly after typing stops.
// The parent keys this by day, so switching days remounts with that day's text.
export function DailyNote({ day, initialBody }: { day: IsoDate; initialBody: string }) {
  const [body, setBody] = useState(initialBody);
  const [status, setStatus] = useState<SaveState>("idle");
  const latest = useRef(initialBody);
  const lastSaved = useRef(initialBody);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const mounted = useRef(true);

  async function flush() {
    if (saving.current || !mounted.current) return;
    saving.current = true;
    try {
      // loop so edits made while a save was in flight are saved too
      while (latest.current !== lastSaved.current) {
        const text = latest.current;
        setStatus("saving");
        const { error } = await saveDailyNote(day, text);
        if (error) {
          setStatus("error");
          // the unmount cleanup has already run; don't re-arm behind its back
          if (mounted.current) timer.current = setTimeout(flush, RETRY_DELAY_MS);
          return;
        }
        lastSaved.current = text;
      }
      setStatus("saved");
    } finally {
      saving.current = false;
    }
  }

  function onChange(value: string) {
    setBody(value);
    latest.current = value;
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_DELAY_MS);
  }

  // Save pending text when leaving the page or switching days.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (latest.current !== lastSaved.current) void saveDailyNote(day, latest.current);
    };
  }, [day]);

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => onChange(e.target.value)}
        aria-label="یادداشت روزانه"
        placeholder="هر چه امروز در ذهنتان است بنویسید…"
        rows={6}
        maxLength={MAX_NOTE_LENGTH}
        className={`${inputClass} resize-y leading-7`}
      />
      <p role="status" aria-live="polite" className="h-5 text-xs text-muted">
        {STATUS_TEXT[status]}
      </p>
    </div>
  );
}
