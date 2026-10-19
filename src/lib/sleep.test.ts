import { describe, expect, it } from "vitest";
import {
  anchorNight,
  formatSleepLength,
  nightOf,
  nightStart,
  parseHookTime,
  parseSleepForm,
  resolveNight,
  sleepMinutes,
} from "./sleep";

// Tehran is UTC+03:30.
const at = (local: string) => new Date(`${local}+03:30`);

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

describe("sleep times", () => {
  it("measures a night across midnight", () => {
    expect(sleepMinutes(23 * 60, 7 * 60)).toBe(480);
    expect(sleepMinutes(60, 9 * 60)).toBe(480);
    expect(sleepMinutes(7 * 60, 7 * 60)).toBe(0);
  });

  it("puts a bedtime before noon after the night's midnight", () => {
    expect(nightStart("2026-10-13", 23 * 60)).toEqual(at("2026-10-13T23:00:00"));
    expect(nightStart("2026-10-13", 90)).toEqual(at("2026-10-14T01:30:00"));
  });

  it("names a night by its evening, noon to noon", () => {
    expect(nightOf(at("2026-10-13T23:30:00"))).toBe("2026-10-13");
    expect(nightOf(at("2026-10-14T07:10:00"))).toBe("2026-10-13");
    expect(nightOf(at("2026-10-14T12:00:00"))).toBe("2026-10-14");
  });

  it("formats a length in hours and minutes", () => {
    expect(formatSleepLength(480)).toBe("۸ ساعت");
    expect(formatSleepLength(450)).toBe("۷ ساعت و ۳۰ دقیقه");
    expect(formatSleepLength(45)).toBe("۴۵ دقیقه");
  });
});

describe("parseSleepForm", () => {
  it("reads only the checked nights", () => {
    expect(
      parseSleepForm(form({ on_0: "on", bed_0: "23:30", wake_0: "07:00", bed_1: "22:00", wake_1: "06:00" })),
    ).toEqual([{ weekday: 0, bedtime: 23 * 60 + 30, wake: 7 * 60 }]);
  });

  it("rejects a missing time or a night outside 1 to 16 hours", () => {
    expect(parseSleepForm(form({ on_2: "on", bed_2: "23:00", wake_2: "" }))).toHaveProperty("error");
    expect(parseSleepForm(form({ on_2: "on", bed_2: "23:00", wake_2: "23:30" }))).toEqual({
      error: "خواب دوشنبه شب باید بین ۱ تا ۱۶ ساعت باشد.",
    });
    expect(parseSleepForm(form({ on_2: "on", bed_2: "12:00", wake_2: "07:00" }))).toHaveProperty("error");
  });
});

describe("parseHookTime", () => {
  it("understands now, 24h and 12h clocks, Persian digits and ISO timestamps", () => {
    expect(parseHookTime("now")).toEqual({ kind: "now" });
    expect(parseHookTime("الان")).toEqual({ kind: "now" });
    expect(parseHookTime("07:00")).toEqual({ kind: "clock", minutes: 420 });
    expect(parseHookTime("7:05:00")).toEqual({ kind: "clock", minutes: 425 });
    expect(parseHookTime("11:30 PM")).toEqual({ kind: "clock", minutes: 23 * 60 + 30 });
    expect(parseHookTime("12:15 am")).toEqual({ kind: "clock", minutes: 15 });
    expect(parseHookTime("۰۶:۴۵")).toEqual({ kind: "clock", minutes: 405 });
    expect(parseHookTime("2026-10-14T07:00:00+03:30")).toEqual({ kind: "instant", at: at("2026-10-14T07:00:00") });
  });

  it("tells a missing value from one it can't read", () => {
    expect(parseHookTime(null)).toBeUndefined();
    expect(parseHookTime("  ")).toBeUndefined();
    expect(parseHookTime("25:00")).toBeNull();
    expect(parseHookTime("13:00 pm")).toBeNull();
    expect(parseHookTime("tomorrow")).toBeNull();
  });
});

describe("anchorNight", () => {
  const evening = at("2026-10-13T22:00:00");

  it("takes an alarm's wake-up time as the next one", () => {
    expect(anchorNight(undefined, { kind: "clock", minutes: 420 }, evening)).toEqual({
      night: "2026-10-13",
      bedAt: undefined,
      wakeAt: at("2026-10-14T07:00:00"),
    });
    // an alarm set after midnight belongs to the night already under way
    const late = at("2026-10-14T01:00:00");
    expect(anchorNight(undefined, { kind: "clock", minutes: 480 }, late).night).toBe("2026-10-13");
  });

  it("puts a bedtime clock before the wake-up, or nearest to now", () => {
    expect(anchorNight({ kind: "clock", minutes: 23 * 60 }, { kind: "clock", minutes: 420 }, evening)).toMatchObject({
      night: "2026-10-13",
      bedAt: at("2026-10-13T23:00:00"),
    });
    // sent a little late: 23:00 just passed, not tomorrow's
    const after = at("2026-10-13T23:20:00");
    expect(anchorNight({ kind: "clock", minutes: 23 * 60 }, undefined, after).bedAt).toEqual(at("2026-10-13T23:00:00"));
  });

  it("uses now for 'now'", () => {
    const morning = at("2026-10-14T07:10:00");
    expect(anchorNight(undefined, { kind: "now" }, morning)).toEqual({
      night: "2026-10-13",
      bedAt: undefined,
      wakeAt: morning,
    });
  });
});

describe("resolveNight", () => {
  const night = "2026-10-13";
  const plan = { bedtime: 23 * 60, wake: 7 * 60 };

  it("fills the missing side from the planner, then the schedule", () => {
    const existing = { bedAt: at("2026-10-13T23:30:00"), wakeAt: at("2026-10-14T07:30:00") };
    expect(resolveNight({ night, wakeAt: at("2026-10-14T06:00:00") }, { existing, plan })).toEqual({
      bedAt: existing.bedAt,
      wakeAt: at("2026-10-14T06:00:00"),
    });
    expect(resolveNight({ night, wakeAt: at("2026-10-14T06:00:00") }, { existing: null, plan })).toEqual({
      bedAt: at("2026-10-13T23:00:00"),
      wakeAt: at("2026-10-14T06:00:00"),
    });
    expect(resolveNight({ night, bedAt: at("2026-10-14T00:15:00") }, { existing: null, plan })).toEqual({
      bedAt: at("2026-10-14T00:15:00"),
      wakeAt: at("2026-10-14T07:00:00"),
    });
  });

  it("explains what is missing or wrong", () => {
    expect(resolveNight({ night, wakeAt: at("2026-10-14T06:00:00") }, { existing: null, plan: null }))
      .toHaveProperty("error");
    expect(resolveNight({ night, bedAt: at("2026-10-13T23:00:00") }, { existing: null, plan: null }))
      .toHaveProperty("error");
    expect(
      resolveNight({ night, bedAt: at("2026-10-13T08:00:00"), wakeAt: at("2026-10-14T07:00:00") }, { existing: null, plan }),
    ).toEqual({ error: "خواب بیش از ۲۰ ساعت ثبت نمی‌شود." });
  });
});
