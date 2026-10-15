import { describe, expect, it } from "vitest";
import { buildDailySummary, MAX_MESSAGE_LENGTH } from "./summary";

const day = "2026-10-13"; // سه‌شنبه ۲۱ مهر ۱۴۰۵

describe("buildDailySummary", () => {
  it("lists tasks, time blocks and the note in Persian", () => {
    const text = buildDailySummary({
      day,
      tasks: [{ title: "ورزش", done: true }, { title: "خرید", done: false }],
      blocks: [{
        start_at: "2026-10-13T16:00:00+03:30", end_at: "2026-10-13T18:00:00+03:30",
        title: "درس", description: "فصل ۳", tags: ["درس"], cost: 50_000,
      }],
      note: "روز خوبی بود",
    });
    expect(text).toBe([
      "📅 سه‌شنبه ۲۱ مهر ۱۴۰۵",
      "",
      "✅ کارها (۱ از ۲)",
      "✔️ ورزش",
      "⬜ خرید",
      "",
      "🕒 برنامهٔ زمانی",
      "۱۶:۰۰–۱۸:۰۰ درس #درس — ۵۰٬۰۰۰ تومان",
      "   فصل ۳",
      "",
      "📝 یادداشت",
      "روز خوبی بود",
    ].join("\n"));
  });

  it("leaves out sections that are turned off or empty", () => {
    const text = buildDailySummary({
      day,
      tasks: [{ title: "ورزش", done: true }],
      blocks: [],
      note: null,
      include: { tasks: false, blocks: true, note: true },
    });
    expect(text).toBe(["📅 سه‌شنبه ۲۱ مهر ۱۴۰۵", "", "برای امروز چیزی ثبت نشده."].join("\n"));
  });

  it("stays within the messenger's length limit", () => {
    const text = buildDailySummary({ day, tasks: [], blocks: [], note: "x".repeat(10_000) });
    expect(text.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
    expect(text.endsWith("…")).toBe(true);
  });
});
