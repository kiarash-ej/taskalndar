"use client";

import { useSyncExternalStore } from "react";
import { clockOf, formatClock } from "@/lib/blocks";
import { calendarDateOf } from "@/lib/dates";
import { faDigits } from "@/lib/format";
import type { BlockRow } from "@/lib/report";
import { Bell } from "./icons";
import { cx } from "./ui";

const TICK_MS = 15_000;
// a block further ahead than this isn't shown yet
const LOOKAHEAD_MIN = 180;
// the ring counts down over the last hour before a block
const RING_WINDOW_MIN = 60;
const R = 23;
const CIRCUMFERENCE = 2 * Math.PI * R;

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, TICK_MS);
  return () => clearInterval(id);
}
// the time, rounded to the tick so the value is stable between renders
const snapshot = () => Math.floor(Date.now() / TICK_MS) * TICK_MS;
// the server doesn't know the viewer's "now"; the countdown appears in the browser
const serverSnapshot = () => null;

const clockText = (instant: string) => faDigits(formatClock(clockOf(calendarDateOf(instant), instant)));

// The block under way, or the next one coming up today, as a ring counting
// down to its start; the bell shakes as it begins.
export function NextBlock({ blocks }: { blocks: BlockRow[] }) {
  const now = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  if (now === null) return null;

  const live = blocks.filter((b) => !b.done && b.source !== "sleep");
  const current = live.find((b) => Date.parse(b.start_at) <= now && now < Date.parse(b.end_at));
  const next = live.find((b) => Date.parse(b.start_at) > now);
  const minutesToNext = next ? Math.ceil((Date.parse(next.start_at) - now) / 60_000) : null;
  const block = current ?? (minutesToNext !== null && minutesToNext <= LOOKAHEAD_MIN ? next : undefined);
  if (!block) return null;

  let fraction: number;
  let headline: string;
  if (current) {
    const start = Date.parse(current.start_at);
    fraction = (now - start) / (Date.parse(current.end_at) - start);
    headline = "در جریان";
  } else {
    fraction = Math.min(1, minutesToNext! / RING_WINDOW_MIN);
    headline = `${faDigits(minutesToNext!)} دقیقهٔ دیگر`;
  }
  // started in the last two minutes: ring the bell
  const justStarted = current !== undefined && now - Date.parse(current.start_at) < 120_000;

  return (
    <div
      role="status"
      className="anim-enter flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3"
    >
      <div className="relative size-14 shrink-0" aria-hidden>
        <svg viewBox="0 0 54 54" className="size-full -rotate-90">
          <circle cx="27" cy="27" r={R} fill="none" strokeWidth="5" className="stroke-surface-2" />
          <circle
            cx="27"
            cy="27"
            r={R}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            className="stroke-accent transition-[stroke-dashoffset] duration-700"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums">
          {current ? "الان" : faDigits(minutesToNext!)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">{current ? "جعبهٔ در جریان" : "جعبهٔ بعدی"}</p>
        <p className="truncate font-bold">{block.title}</p>
        <p className="text-xs text-muted tabular-nums">
          {headline} · {clockText(block.start_at)} تا {clockText(block.end_at)}
        </p>
      </div>
      <Bell
        width={24}
        height={24}
        className={cx("shrink-0", justStarted ? "bell-ring text-down" : "text-accent")}
      />
    </div>
  );
}
