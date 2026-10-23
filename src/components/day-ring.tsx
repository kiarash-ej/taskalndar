"use client";

import { useEffect, useRef, useState } from "react";
import { faDigits } from "@/lib/format";

const RADIUS = 50;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Today's tasks as a ring that fills, with the percentage counting up. When
// a tick changes the numbers, it moves from the old value to the new one.
export function DayRing({ done, total }: { done: number; total: number }) {
  const target = total === 0 ? 0 : (done / total) * 100;
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = from.current;
    // with reduced motion the first frame jumps straight to the value
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900;
    const t0 = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const p = duration === 0 ? 1 : Math.min(1, (now - t0) / duration);
      const value = start + (target - start) * (1 - Math.pow(1 - p, 3));
      from.current = value;
      setShown(value);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <div
      role="img"
      aria-label={`${faDigits(done)} از ${faDigits(total)} کار امروز انجام شد`}
      className="relative size-28 shrink-0"
    >
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="12" className="stroke-surface-2" />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          className="stroke-accent"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - shown / 100)}
          // an empty ring shows no round cap dot
          opacity={shown < 0.5 ? 0 : 1}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center" aria-hidden>
        <span className="text-2xl font-extrabold tabular-nums">{faDigits(Math.round(shown))}٪</span>
        <span className="text-xs text-muted">
          {faDigits(done)} از {faDigits(total)}
        </span>
      </div>
    </div>
  );
}
