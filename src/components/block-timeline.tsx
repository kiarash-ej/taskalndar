"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent, type PointerEvent } from "react";
import { moveBlock } from "@/lib/actions/blocks";
import { clockOf, formatClockRange, MINUTES_PER_DAY } from "@/lib/blocks";
import type { IsoDate } from "@/lib/dates";
import type { BlockRow } from "@/lib/report";
import { hourRange, layoutColumns, moveTo, resizeTo, SNAP_MINUTES } from "@/lib/timeline";
import { faDigits } from "@/lib/format";
import { Moon } from "./icons";
import { buttonClass, cx } from "./ui";

const PX_PER_HOUR = 56;
const LABEL_WIDTH = "3rem";

interface Times {
  start: number;
  end: number;
}

// The day's blocks by time of day. A block can be dragged to another time,
// or stretched from its bottom edge, in quarter-hour steps (arrow keys do the
// same: ↑↓ moves, Shift+↑↓ changes the end). Nothing is saved until the user
// answers the question that follows.
export function BlockTimeline({
  day,
  blocks,
  onError,
}: {
  day: IsoDate;
  blocks: BlockRow[];
  onError: (error: string | null) => void;
}) {
  const times = new Map<string, Times>(
    blocks.map((b) => [
      b.id,
      { start: Math.max(0, clockOf(day, b.start_at)), end: Math.min(MINUTES_PER_DAY, clockOf(day, b.end_at)) },
    ]),
  );
  // the block being moved and where it is now; kept until the user answers
  const [draft, setDraft] = useState<({ id: string } & Times) | null>(null);
  const [asking, setAsking] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const drag = useRef<{ id: string; mode: "move" | "resize"; y: number; from: Times } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const items = blocks.map((b) => ({ id: b.id, ...(draft?.id === b.id ? draft : times.get(b.id)!) }));
  const { first, last } = hourRange(items);
  const top = (minutes: number) => ((minutes - first * 60) / 60) * PX_PER_HOUR;
  const placed = new Map(layoutColumns(items).map((p) => [p.id, p]));

  // open at the first block of the day
  useEffect(() => {
    const earliest = Math.min(...blocks.map((b) => times.get(b.id)!.start), 8 * 60);
    if (scroller.current) scroller.current.scrollTop = Math.max(0, top(earliest) - 24);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const movable = (b: BlockRow) => b.source !== "sleep" && !saving && (!asking || draft?.id === b.id);

  function onPointerDown(e: PointerEvent<HTMLDivElement>, b: BlockRow) {
    if (!movable(b) || e.button !== 0) return;
    const from = draft?.id === b.id ? draft : times.get(b.id)!;
    const mode = (e.target as HTMLElement).dataset.grip ? "resize" : "move";
    drag.current = { id: b.id, mode, y: e.clientY, from };
    setDragging(b.id);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const minutes = ((e.clientY - d.y) / PX_PER_HOUR) * 60;
    const next = d.mode === "move" ? moveTo(d.from, d.from.start + minutes) : resizeTo(d.from, d.from.end + minutes);
    setDraft({ id: d.id, ...next });
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    setDragging(null);
    if (!d || !draft || draft.id !== d.id) return;
    const original = times.get(d.id)!;
    if (draft.start === original.start && draft.end === original.end) {
      setDraft(null);
      setAsking(false);
    } else {
      setAsking(true);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>, b: BlockRow) {
    if (!movable(b) || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    const from = draft?.id === b.id ? draft : times.get(b.id)!;
    const step = e.key === "ArrowUp" ? -SNAP_MINUTES : SNAP_MINUTES;
    const next = e.shiftKey ? resizeTo(from, from.end + step) : moveTo(from, from.start + step);
    setDraft({ id: b.id, ...next });
    setAsking(true);
  }

  function undo() {
    setDraft(null);
    setAsking(false);
  }

  function save() {
    if (!draft) return;
    onError(null);
    startSaving(async () => {
      const result = await moveBlock(draft.id, day, draft.start, draft.end);
      if (result.error) onError(result.error);
      else undo();
    });
  }

  const asked = asking && draft ? blocks.find((b) => b.id === draft.id) : undefined;

  return (
    <div className="space-y-2">
      {asked && draft ? (
        <div role="alertdialog" aria-live="polite" className="anim-enter flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-3">
          <p className="min-w-0 flex-1 text-sm">
            «{asked.title}» از <bdi className="font-semibold text-accent tabular-nums">{formatClockRange(draft.start, draft.end)}</bdi>{" "}
            شود؟
          </p>
          <button type="button" onClick={save} disabled={saving} className={cx(buttonClass.primary, "px-3 py-1")}>
            {saving ? "در حال ذخیره…" : "بله، ذخیره شود"}
          </button>
          <button type="button" onClick={undo} disabled={saving} className={cx(buttonClass.ghost, "px-3 py-1")}>
            نه، برگردد
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted">
          جعبه را بکشید تا ساعتش عوض شود، یا لبهٔ پایینش را بکشید تا بلندتر شود. با کیبورد: ↑↓ جابه‌جا می‌کند و Shift+↑↓
          پایانش را.
        </p>
      )}

      <div ref={scroller} className="max-h-[28rem] overflow-y-auto rounded-xl bg-surface-2">
        <div className="relative" style={{ height: (last - first) * PX_PER_HOUR }}>
          {Array.from({ length: last - first + 1 }, (_, i) => first + i).map((hour) => (
            <div
              key={hour}
              aria-hidden
              className="absolute inset-x-0 border-t border-dashed border-line"
              style={{ top: (hour - first) * PX_PER_HOUR }}
            >
              <span className="absolute -top-2.5 start-1 bg-surface-2 px-1 text-[0.7rem] text-muted tabular-nums">
                {faDigits(`${String(hour).padStart(2, "0")}:۰۰`)}
              </span>
            </div>
          ))}

          {blocks.map((b) => {
            const p = placed.get(b.id)!;
            const isDraft = draft?.id === b.id;
            const isSleep = b.source === "sleep";
            const height = Math.max(18, top(p.end) - top(p.start));
            return (
              <div
                key={b.id}
                role={isSleep ? undefined : "button"}
                tabIndex={isSleep ? undefined : 0}
                aria-label={`${b.title}، ${formatClockRange(p.start, p.end)}${isSleep ? "" : "؛ برای جابه‌جایی بکشید"}`}
                onPointerDown={(e) => onPointerDown(e, b)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={(e) => onKeyDown(e, b)}
                className={cx(
                  "absolute overflow-hidden rounded-lg border px-2 py-0.5 text-xs leading-5 select-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                  isSleep
                    ? "border-line bg-surface text-muted"
                    : "touch-none border-accent/60 bg-accent-soft text-fg",
                  movable(b) ? "cursor-grab active:cursor-grabbing" : !isSleep && "opacity-60",
                  isDraft && "z-10 border-accent shadow-lg ring-2 ring-accent/30",
                  b.done && "opacity-70",
                )}
                style={{
                  top: top(p.start),
                  height,
                  insetInlineStart: `calc(${LABEL_WIDTH} + (100% - ${LABEL_WIDTH} - 0.25rem) * ${p.column / p.columns})`,
                  width: `calc((100% - ${LABEL_WIDTH} - 0.25rem) / ${p.columns} - 0.25rem)`,
                  transition: dragging === b.id ? "none" : "top 0.2s, height 0.2s",
                }}
              >
                <span className="font-semibold text-accent tabular-nums">
                  <bdi>{formatClockRange(p.start, p.end)}</bdi>
                </span>{" "}
                {isSleep && <Moon width={12} height={12} className="inline-block align-[-2px] text-accent" />}{" "}
                <span className={cx(b.done && "line-through")}>{b.title}</span>
                {!isSleep && movable(b) && (
                  <span
                    data-grip="true"
                    aria-hidden
                    className="absolute inset-x-1/4 bottom-0.5 h-1.5 cursor-ns-resize rounded-full bg-accent/50"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
