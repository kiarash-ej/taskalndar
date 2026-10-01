"use client";

import Link from "next/link";
import { useState } from "react";
import { jalaaliMonthLength } from "@taskalndar/core";
import {
  isoFromJalali,
  jalaliMonthOf,
  jalaliMonthRange,
  shiftJalaliMonth,
  weekdayIndex,
  type IsoDate,
} from "@/lib/dates";
import { faDigits, formatLongDate, formatMonthYear, WEEKDAY_INITIALS, WEEKDAY_NAMES } from "@/lib/format";
import { ChevronLeft, ChevronRight } from "./icons";
import { cx, iconButtonClass } from "./ui";

// Month grid of the Jalali calendar, weeks starting on Saturday. Each day links
// to `${basePath}?date=YYYY-MM-DD`. Give it key={selected} so it jumps to the
// selected day's month when the selection changes.
export function JalaliCalendar({
  selected,
  today,
  basePath = "/planner",
}: {
  selected: IsoDate;
  today: IsoDate;
  basePath?: string;
}) {
  const [month, setMonth] = useState(() => jalaliMonthOf(selected));
  const { start } = jalaliMonthRange(month);
  const leadingBlanks = weekdayIndex(start);
  const days = Array.from({ length: jalaaliMonthLength(month.jy, month.jm) }, (_, i) =>
    isoFromJalali({ ...month, jd: i + 1 }),
  );
  const todayMonth = jalaliMonthOf(today);
  const showingToday = month.jy === todayMonth.jy && month.jm === todayMonth.jm;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((m) => shiftJalaliMonth(m, -1))}
          className={iconButtonClass}
          aria-label="ماه قبل"
        >
          <ChevronRight />
        </button>
        <h2 className="font-bold" aria-live="polite">
          {formatMonthYear(month)}
        </h2>
        <button
          type="button"
          onClick={() => setMonth((m) => shiftJalaliMonth(m, 1))}
          className={iconButtonClass}
          aria-label="ماه بعد"
        >
          <ChevronLeft />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_INITIALS.map((initial, i) => (
          <abbr
            key={initial}
            title={WEEKDAY_NAMES[i]}
            className="pb-1 text-xs font-medium text-muted no-underline"
          >
            {initial}
          </abbr>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((day, i) => {
          const isSelected = day === selected;
          const isToday = day === today;
          return (
            <Link
              key={day}
              href={`${basePath}?date=${day}`}
              aria-label={formatLongDate(day)}
              aria-current={isSelected ? "date" : undefined}
              className={cx(
                "flex aspect-square items-center justify-center rounded-xl text-sm transition-colors",
                isSelected
                  ? "bg-accent font-bold text-accent-fg"
                  : "hover:bg-surface-2",
                !isSelected && isToday && "font-bold text-accent ring-1 ring-accent",
                !isSelected && weekdayIndex(day) === 6 && !isToday && "text-down",
              )}
            >
              {faDigits(i + 1)}
            </Link>
          );
        })}
      </div>

      {(!showingToday || selected !== today) && (
        <div className="mt-3 text-center">
          <Link
            href={`${basePath}?date=${today}`}
            onClick={() => setMonth(todayMonth)}
            className="text-sm font-semibold text-accent hover:underline"
          >
            برو به امروز
          </Link>
        </div>
      )}
    </div>
  );
}
