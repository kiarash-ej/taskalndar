"use client";

import { useSyncExternalStore } from "react";
import { clockOf } from "@/lib/blocks";
import type { BlockRow } from "@/lib/report";
import { nowAndNext, shortClock } from "@/lib/week-plan";

const TICK_MS = 15_000;

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, TICK_MS);
  return () => clearInterval(id);
}
// rounded to the tick so the value is stable between renders
const snapshot = () => Math.floor(Date.now() / TICK_MS) * TICK_MS;
// the server doesn't know the viewer's "now"; the card fills in in the browser
const serverSnapshot = () => null;

const clock = (block: BlockRow, instant: string) => shortClock(clockOf(block.day, instant));

// Today's block under way ("الان") and the one after it ("بعدی").
export function NowNext({ blocks }: { blocks: BlockRow[] }) {
  const now = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  if (now === null) return <div className="h-28" aria-hidden />;

  const { current, next } = nowAndNext(blocks, now);
  if (!current && !next) {
    return <p className="py-6 text-center text-muted">برنامهٔ امروز تمام شد.</p>;
  }

  return (
    <div role="status" className="space-y-4">
      {current && (
        <div>
          <p className="text-sm font-semibold text-accent">الان</p>
          <p className="text-2xl font-extrabold leading-tight">{current.title}</p>
          <p className="text-muted tabular-nums">تا {clock(current, current.end_at)}</p>
        </div>
      )}
      {current && next && <div className="border-t border-line" />}
      {next && (
        <div>
          <p className="text-sm text-muted">{current ? "بعدی" : "بعدی، از ساعت " + clock(next, next.start_at)}</p>
          <p className={current ? "text-lg font-bold" : "text-2xl font-extrabold leading-tight"}>
            {next.title}
            {current && <span className="ms-2 text-base font-normal text-muted tabular-nums">· {clock(next, next.start_at)}</span>}
          </p>
        </div>
      )}
    </div>
  );
}
