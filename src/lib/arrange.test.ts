import { describe, expect, it } from "vitest";
import { arrangeTasks, arrangeWindow, DEFAULT_WINDOW, freeIntervals } from "./arrange";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
// Tehran is UTC+03:30.
const at = (local: string) => `${local}+03:30`;

describe("freeIntervals", () => {
  it("leaves the gaps between busy stretches, overlapping or not", () => {
    expect(
      freeIntervals({ start: h(8), end: h(20) }, [
        { start: h(10), end: h(11) },
        { start: h(10, 30), end: h(12) },
        { start: h(19), end: h(21) },
        { start: h(6), end: h(7) },
      ]),
    ).toEqual([
      { start: h(8), end: h(10) },
      { start: h(12), end: h(19) },
    ]);
  });
});

describe("arrangeTasks", () => {
  const window = { start: h(9), end: h(13) };

  it("puts each task in the earliest stretch it fits, in list order", () => {
    const result = arrangeTasks(
      [
        { id: "a", title: "ورزش", minutes: 90 },
        { id: "b", title: "خرید", minutes: 30 },
        { id: "c", title: "درس", minutes: 60 },
      ],
      window,
      [{ start: h(10), end: h(11) }],
    );
    expect(result.placed.map((p) => [p.id, p.start, p.end])).toEqual([
      ["b", h(9), h(9, 30)],
      ["a", h(11), h(12, 30)],
    ]);
    // the hour before 10:00 is down to 30 minutes, and after 12:30 only 30 are left
    expect(result.unplaced.map((t) => t.id)).toEqual(["c"]);
  });

  it("keeps a gap and rounds starts to 5 minutes", () => {
    const result = arrangeTasks(
      [
        { id: "a", title: "a", minutes: 30 },
        { id: "b", title: "b", minutes: 30 },
      ],
      { start: h(9, 2), end: h(13) },
      [],
      10,
    );
    expect(result.placed.map((p) => [p.start, p.end])).toEqual([
      [h(9, 5), h(9, 35)],
      [h(9, 45), h(10, 15)],
    ]);
  });
});

describe("arrangeWindow", () => {
  const sleepBlock = (start: string, end: string) => ({ start_at: at(start), end_at: at(end), source: "sleep" });

  it("runs from waking to bedtime, from blocks or suggestions", () => {
    const result = arrangeWindow(
      "2026-10-14",
      [
        sleepBlock("2026-10-14T00:00:00", "2026-10-14T07:00:00"),
        { start_at: at("2026-10-14T16:00:00"), end_at: at("2026-10-14T18:00:00"), source: "manual" },
      ],
      [{ night: "2026-10-14", bedAt: new Date(at("2026-10-14T23:30:00")).toISOString(), wakeAt: new Date(at("2026-10-15T07:00:00")).toISOString() }],
      new Date(at("2026-10-13T12:00:00")),
    );
    expect(result).toEqual({ window: { start: h(7), end: h(23, 30) }, busy: [{ start: h(16), end: h(18) }] });
  });

  it("starts from now today, uses defaults without sleep, and skips past days", () => {
    const now = new Date(at("2026-10-14T10:12:00"));
    expect(arrangeWindow("2026-10-14", [], [], now)?.window).toEqual({ start: h(10, 15), end: DEFAULT_WINDOW.end });
    expect(arrangeWindow("2026-10-15", [], [], now)?.window).toEqual(DEFAULT_WINDOW);
    expect(arrangeWindow("2026-10-13", [], [], now)).toBeNull();
  });
});
