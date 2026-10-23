import { describe, expect, it } from "vitest";
import { hourRange, layoutColumns, moveTo, resizeTo, snap } from "./timeline";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

describe("layoutColumns", () => {
  it("gives separate blocks the full width", () => {
    const placed = layoutColumns([
      { id: "a", start: h(9), end: h(10) },
      { id: "b", start: h(10), end: h(11) },
    ]);
    expect(placed.map((p) => [p.id, p.column, p.columns])).toEqual([["a", 0, 1], ["b", 0, 1]]);
  });

  it("puts overlapping blocks side by side, reusing a freed column", () => {
    const placed = layoutColumns([
      { id: "a", start: h(9), end: h(12) },
      { id: "b", start: h(9, 30), end: h(10) },
      { id: "c", start: h(10), end: h(11) },
      { id: "d", start: h(13), end: h(14) },
    ]);
    expect(Object.fromEntries(placed.map((p) => [p.id, [p.column, p.columns]]))).toEqual({
      a: [0, 2],
      b: [1, 2],
      c: [1, 2],
      d: [0, 1],
    });
  });
});

describe("dragging", () => {
  it("snaps to quarter hours", () => {
    expect(snap(h(16, 7))).toBe(h(16));
    expect(snap(h(16, 8))).toBe(h(16, 15));
  });

  it("moves a block whole and keeps it inside the day", () => {
    expect(moveTo({ start: h(16), end: h(17, 30) }, h(18, 20))).toEqual({ start: h(18, 15), end: h(19, 45) });
    expect(moveTo({ start: h(16), end: h(17) }, h(23, 40))).toEqual({ start: h(23), end: h(24) });
    expect(moveTo({ start: h(1), end: h(2) }, -30)).toEqual({ start: 0, end: h(1) });
  });

  it("stretches the end, never shorter than a quarter hour or past midnight", () => {
    expect(resizeTo({ start: h(16), end: h(17) }, h(18, 10))).toEqual({ start: h(16), end: h(18, 15) });
    expect(resizeTo({ start: h(16), end: h(17) }, h(15))).toEqual({ start: h(16), end: h(16, 15) });
    expect(resizeTo({ start: h(23), end: h(23, 30) }, h(25))).toEqual({ start: h(23), end: h(24) });
  });
});

describe("hourRange", () => {
  it("shows the waking day, widened to fit early or late blocks", () => {
    expect(hourRange([])).toEqual({ first: 7, last: 23 });
    expect(hourRange([{ id: "a", start: h(5, 30), end: h(24) }])).toEqual({ first: 5, last: 24 });
  });
});
