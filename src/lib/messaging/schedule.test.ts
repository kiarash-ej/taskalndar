import { describe, expect, it } from "vitest";
import { isDue } from "./schedule";

// 2026-10-15T17:40Z is 21:10 in Tehran.
const now = new Date("2026-10-15T17:40:00Z");

describe("isDue", () => {
  it("is due once the Tehran send time has passed today", () => {
    expect(isDue({ send_time: "21:00:00", last_sent_on: null }, now)).toBe(true);
    expect(isDue({ send_time: "21:00:00", last_sent_on: "2026-10-14" }, now)).toBe(true);
  });

  it("waits for the send time", () => {
    expect(isDue({ send_time: "21:15:00", last_sent_on: null }, now)).toBe(false);
  });

  it("sends at most once per Tehran day", () => {
    expect(isDue({ send_time: "21:00:00", last_sent_on: "2026-10-15" }, now)).toBe(false);
  });

  it("uses the Tehran day, not the UTC one", () => {
    // 2026-10-15T21:00Z is already 00:30 on the 16th in Tehran
    expect(isDue({ send_time: "00:15:00", last_sent_on: "2026-10-15" }, new Date("2026-10-15T21:00:00Z"))).toBe(true);
  });
});
