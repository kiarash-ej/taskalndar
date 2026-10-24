import { describe, expect, it } from "vitest";
import type { BlockRow } from "./report";
import type { TaskRow } from "./scoring";
import { dayTasks, daySummary, formatDuration, nowAndNext, templateForWeekday } from "./week-plan";

let next = 0;
// 2026-10-22 is a Thursday; Tehran is UTC+03:30.
function block(start: string, end: string, over: Partial<BlockRow> = {}): BlockRow {
  return {
    id: `b${next++}`,
    day: "2026-10-22",
    start_at: `2026-10-22T${start}:00+03:30`,
    end_at: end === "24:00" ? "2026-10-23T00:00:00+03:30" : `2026-10-22T${end}:00+03:30`,
    title: "مطالعه",
    description: "",
    tags: [],
    amount: null,
    unit: null,
    cost: null,
    done: false,
    ...over,
  } as BlockRow;
}

const at = (clock: string) => Date.parse(`2026-10-22T${clock}:00+03:30`);

describe("nowAndNext", () => {
  const day = [
    block("08:00", "08:25"),
    block("08:30", "08:55"),
    block("13:00", "18:00", { title: "دانشگاه" }),
  ];

  it("finds the block under way and the one after it", () => {
    const { current, next } = nowAndNext(day, at("08:10"));
    expect(current?.start_at).toBe(day[0].start_at);
    expect(next?.start_at).toBe(day[1].start_at);
  });

  it("has no current block in a gap, only the next one, however far ahead", () => {
    const { current, next } = nowAndNext(day, at("09:00"));
    expect(current).toBeNull();
    expect(next?.title).toBe("دانشگاه");
  });

  it("treats a block's end as the moment it stops", () => {
    expect(nowAndNext(day, at("08:25")).current).toBeNull();
    expect(nowAndNext(day, at("08:30")).current?.start_at).toBe(day[1].start_at);
  });

  it("skips sleep blocks, and finished blocks for what comes next", () => {
    const blocks = [
      block("08:00", "09:00", { source: "sleep" }),
      block("09:00", "10:00", { done: true }),
      block("10:00", "11:00", { title: "باشگاه" }),
    ];
    const { current, next } = nowAndNext(blocks, at("08:30"));
    expect(current).toBeNull();
    expect(next?.title).toBe("باشگاه");
  });

  it("is empty once the day's blocks are over, in any input order", () => {
    expect(nowAndNext([...day].reverse(), at("19:00"))).toEqual({ current: null, next: null });
  });
});

describe("formatDuration", () => {
  it("reads hours and minutes in Persian", () => {
    expect(formatDuration(250)).toBe("۴ ساعت و ۱۰ دقیقه");
    expect(formatDuration(120)).toBe("۲ ساعت");
    expect(formatDuration(50)).toBe("۵۰ دقیقه");
  });
});

describe("daySummary", () => {
  it("shows long single blocks with their times and repeated ones as a total, in time order", () => {
    const blocks = [
      block("06:00", "07:30", { title: "باشگاه" }),
      ...["08:00", "08:30", "09:00", "09:30", "10:00"].map((s) =>
        block(s, `${s.slice(0, 2)}:${s.endsWith("00") ? "25" : "55"}`),
      ),
      block("13:00", "18:00", { title: "دانشگاه" }),
    ];
    expect(daySummary(blocks)).toEqual({
      items: ["باشگاه ۶:۰۰–۷:۳۰", "مطالعه ۲ ساعت و ۵ دقیقه", "دانشگاه ۱۳:۰۰–۱۸:۰۰"],
      more: 0,
    });
  });

  it("leaves out free time, sleep and anything under an hour in total", () => {
    const blocks = [
      block("05:30", "06:00", { title: "بیداری" }),
      block("07:30", "08:00", { title: "آزاد", tags: ["آزاد"] }),
      block("21:00", "24:00", { title: "آزاد" }),
      block("00:00", "07:00", { title: "خواب", source: "sleep" }),
      block("20:00", "20:25", { title: "مرور" }),
      block("20:30", "20:55", { title: "مرور" }),
      block("13:00", "15:00", { title: "دانشگاه" }),
    ];
    expect(daySummary(blocks)).toEqual({ items: ["دانشگاه ۱۳:۰۰–۱۵:۰۰"], more: 0 });
  });

  it("keeps at most four items and counts the rest", () => {
    const blocks = ["الف", "ب", "پ", "ت", "ث", "ج"].map((title, i) =>
      block(`${String(8 + i * 2).padStart(2, "0")}:00`, `${String(9 + i * 2).padStart(2, "0")}:00`, { title }),
    );
    const summary = daySummary(blocks);
    expect(summary.items).toHaveLength(4);
    expect(summary.more).toBe(2);
  });

  it("shows a block that ends at midnight as 24:00", () => {
    expect(daySummary([block("22:00", "24:00", { title: "مطالعهٔ شب" })]).items).toEqual(["مطالعهٔ شب ۲۲:۰۰–۲۴:۰۰"]);
  });

  it("is empty for a day without blocks", () => {
    expect(daySummary([])).toEqual({ items: [], more: 0 });
  });
});

describe("templateForWeekday", () => {
  const templates = [
    { id: "sat", name: "برنامهٔ شنبه" },
    { id: "sun", name: "برنامهٔ یکشنبه" },
    { id: "tue", name: "برنامهٔ سه‌شنبه" },
    { id: "thu", name: "برنامه پنج‌شنبه" },
    { id: "work", name: "روز کاری" },
  ];

  it("picks the template named after the weekday, as a whole word", () => {
    expect(templateForWeekday(templates, 0)?.id).toBe("sat"); // شنبه, not یکشنبه
    expect(templateForWeekday(templates, 1)?.id).toBe("sun");
    expect(templateForWeekday(templates, 3)?.id).toBe("tue");
  });

  it("ignores zero-width non-joiners in either name", () => {
    expect(templateForWeekday(templates, 5)?.id).toBe("thu");
  });

  it("finds nothing when no template names the day", () => {
    expect(templateForWeekday(templates, 6)).toBeNull();
  });
});

describe("dayTasks", () => {
  const task = (over: Partial<TaskRow>): TaskRow => ({
    id: "t",
    title: "Gym",
    is_recurring: true,
    date: "2026-10-24",
    weekdays: [0, 2, 4],
    archived_at: null,
    ...over,
  });
  const tasks = [
    task({ id: "gym" }),
    task({ id: "buy", title: "خرید", is_recurring: false, date: "2026-10-27", weekdays: null }),
  ];

  it("lists a recurring task on each of its weekdays and a one-time task on its date", () => {
    // 2026-10-24 is a Saturday
    const week = ["2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28"].map((day) =>
      dayTasks(tasks, [], day).map((t) => t.title),
    );
    expect(week).toEqual([["Gym"], [], ["Gym"], ["خرید"], ["Gym"]]);
  });

  it("marks what was ticked off that day only", () => {
    const completions = [{ task_id: "gym", date: "2026-10-24", done: true }];
    expect(dayTasks(tasks, completions, "2026-10-24")).toEqual([{ id: "gym", title: "Gym", done: true }]);
    expect(dayTasks(tasks, completions, "2026-10-26")[0].done).toBe(false);
  });

  it("leaves out days before a recurring task was made", () => {
    expect(dayTasks(tasks, [], "2026-10-19")).toEqual([]);
  });
});
