import { describe, expect, it } from "vitest";
import { filterBlocks, summarizeReport, type BlockRow, type ReportFilter } from "./report";

// Mehr 1405 = 2026-09-23 .. 2026-10-22. 2026-10-13 and 2026-10-20 are
// Tuesdays (weekday 3), 2026-10-14 a Wednesday (4).
const MONTH = { from: "2026-09-23", to: "2026-10-22" };

let next = 0;
function block(day: string, start: string, end: string, over: Partial<BlockRow> = {}): BlockRow {
  const endDay = end === "24:00" ? null : day;
  return {
    id: `b${next++}`,
    day,
    start_at: `${day}T${start}:00+03:30`,
    end_at: endDay ? `${day}T${end}:00+03:30` : new Date(Date.parse(`${day}T00:00:00+03:30`) + 86_400_000).toISOString(),
    title: "درس",
    description: "",
    tags: [],
    amount: null,
    unit: null,
    cost: null,
    done: true,
    ...over,
  };
}

const blocks: BlockRow[] = [
  block("2026-10-13", "16:00", "18:00", { tags: ["درس", "دانشگاه"], description: "کتابخانه مرکزی، فصل ۳", amount: 30, unit: "صفحه" }),
  block("2026-10-13", "17:00", "19:00", { title: "حل تمرین", tags: ["درس"], cost: 40_000 }),
  block("2026-10-14", "10:00", "11:00", { title: "باشگاه", tags: ["ورزش"], cost: 150_000 }),
  block("2026-10-20", "15:00", "17:00", { tags: ["درس"], amount: 20, unit: "صفحه" }),
  block("2026-10-20", "20:00", "21:00", { title: "قدم زدن" }),
  block("2026-10-23", "16:00", "18:00", { tags: ["درس"] }), // next month
];

const ids = (filter: ReportFilter) => filterBlocks(blocks, filter).map((item) => item.block.id);

describe("filterBlocks", () => {
  it("keeps the days of the range, in time order", () => {
    expect(ids(MONTH)).toEqual(["b0", "b1", "b2", "b3", "b4"]);
  });

  it("answers 'where was I on Tuesdays between 16 and 18'", () => {
    const items = filterBlocks(blocks, { ...MONTH, weekdays: [3], timeFrom: "16:00", timeTo: "18:00" });
    expect(items.map((i) => [i.block.id, i.minutes])).toEqual([
      ["b0", 120],
      ["b1", 60], // 17:00–19:00 clipped to 17:00–18:00
      ["b3", 60], // 15:00–17:00 clipped to 16:00–17:00
    ]);
    expect(items[0].block.description).toBe("کتابخانه مرکزی، فصل ۳");
  });

  it("matches any of the given tags, normalizing them first", () => {
    expect(ids({ ...MONTH, tags: ["ورزش"] })).toEqual(["b2"]);
    expect(ids({ ...MONTH, tags: [" دانشگاه ", "ورزش"] })).toEqual(["b0", "b2"]);
  });

  it("searches title, description and tags, folding Arabic letters", () => {
    expect(ids({ ...MONTH, text: "كتابخانه" })).toEqual(["b0"]);
    expect(ids({ ...MONTH, text: "تمرین" })).toEqual(["b1"]);
    expect(ids({ ...MONTH, text: "ورزش" })).toEqual(["b2"]);
  });

  it("handles a window that runs to midnight", () => {
    expect(ids({ ...MONTH, timeFrom: "20:00", timeTo: "24:00" })).toEqual(["b4"]);
  });

  it("rejects malformed or empty time windows", () => {
    expect(() => filterBlocks(blocks, { ...MONTH, timeFrom: "18:00", timeTo: "16:00" })).toThrow(RangeError);
    expect(() => filterBlocks(blocks, { ...MONTH, timeFrom: "7:00" })).toThrow(RangeError);
    expect(() => filterBlocks(blocks, { ...MONTH, timeTo: "24:30" })).toThrow(RangeError);
  });
});

describe("summarizeReport", () => {
  it("answers 'how much did I study this month' without double counting overlaps", () => {
    const summary = summarizeReport(filterBlocks(blocks, { ...MONTH, tags: ["درس"] }));
    // 16–18 and 17–19 overlap: 3 hours, not 4; plus 2 hours on the 20th.
    expect(summary.totalMinutes).toBe(300);
    expect(summary.minutesByTag).toEqual([
      { tag: "درس", minutes: 300 },
      { tag: "دانشگاه", minutes: 120 },
    ]);
  });

  it("totals amounts per unit, cost, blocks and days", () => {
    const summary = summarizeReport(filterBlocks(blocks, MONTH));
    expect(summary).toMatchObject({
      totalMinutes: 3 * 60 + 60 + 120 + 60,
      untaggedMinutes: 60,
      amountByUnit: [{ unit: "صفحه", amount: 50 }],
      totalCost: 190_000,
      blockCount: 5,
      dayCount: 3,
    });
  });

  it("summarizes an empty report as zeros", () => {
    expect(summarizeReport([])).toEqual({
      totalMinutes: 0,
      minutesByTag: [],
      untaggedMinutes: 0,
      amountByUnit: [],
      totalCost: 0,
      blockCount: 0,
      dayCount: 0,
    });
  });
});
