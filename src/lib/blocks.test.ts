import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clockOf,
  clockToInstant,
  formatClock,
  formatClockRange,
  minutesOfTime,
  parseBlockForm,
  parseClock,
  parseClockRange,
  parseOptionalAmount,
  type BlockFields,
} from "./blocks";
import { asUser, migratedDb, OWNER } from "./test-db";

function form(fields: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const value of Array.isArray(v) ? v : [v]) f.append(k, value);
  }
  return f;
}

describe("clock times", () => {
  it("parses HH:MM and 24:00, rejecting anything else", () => {
    expect(parseClock("16:30")).toBe(990);
    expect(parseClock("24:00")).toBe(1440);
    expect(parseClock("24:30")).toBeNull();
    expect(parseClock("7:30")).toBeNull();
    expect(parseClock(null)).toBeNull();
  });

  it("formats minutes for inputs and in Persian digits", () => {
    expect(formatClock(990)).toBe("16:30");
    expect(formatClock(1440)).toBe("24:00");
    expect(formatClockRange(960, 1080)).toBe("۱۶:۰۰ تا ۱۸:۰۰");
    expect(minutesOfTime("08:15:00")).toBe(495);
  });

  it("converts Tehran wall clock to instants and back (UTC+03:30)", () => {
    expect(clockToInstant("2026-10-15", 960)).toBe("2026-10-15T12:30:00.000Z");
    expect(clockToInstant("2026-10-15", 1440)).toBe("2026-10-15T20:30:00.000Z");
    expect(clockOf("2026-10-15", "2026-10-15T12:30:00Z")).toBe(960);
    expect(clockOf("2026-10-15", "2026-10-15T20:30:00+00:00")).toBe(1440);
  });

  it("reads an end of 00:00 after a later start as midnight", () => {
    expect(parseClockRange(form({ start: "22:00", end: "00:00" }))).toEqual({ start: 1320, end: 1440 });
    expect(parseClockRange(form({ start: "00:00", end: "00:00" }))).toHaveProperty("error");
    expect(parseClockRange(form({ start: "18:00", end: "16:00" }))).toHaveProperty("error");
    expect(parseClockRange(form({ start: "", end: "16:00" }))).toHaveProperty("error");
  });
});

describe("parseBlockForm", () => {
  it("reads a full block, folding typed tags into the chips", () => {
    const fields = parseBlockForm(
      form({
        title: "  درس ریاضی ",
        start: "16:00",
        end: "18:00",
        tags: ["درس"],
        tag_draft: "دانشگاه، درس, #كتابخانه",
        description: "فصل ۳",
        amount: "۳۰",
        unit: "صفحه",
        cost: "۱۲۰٬۰۰۰",
      }),
    );
    expect(fields).toEqual({
      title: "درس ریاضی",
      start: 960,
      end: 1080,
      tags: ["درس", "دانشگاه", "کتابخانه"],
      description: "فصل ۳",
      amount: 30,
      unit: "صفحه",
      cost: 120000,
    });
  });

  it("leaves amount, unit and cost empty when not given", () => {
    const fields = parseBlockForm(form({ title: "x", start: "08:00", end: "09:00" })) as BlockFields;
    expect([fields.amount, fields.unit, fields.cost, fields.tags]).toEqual([null, null, null, []]);
  });

  it("rejects a unit without an amount, negative numbers and a missing title", () => {
    const base = { title: "x", start: "08:00", end: "09:00" };
    expect(parseBlockForm(form({ ...base, unit: "صفحه" }))).toHaveProperty("error");
    expect(parseBlockForm(form({ ...base, amount: "-1" }))).toHaveProperty("error");
    expect(parseBlockForm(form({ ...base, cost: "abc" }))).toHaveProperty("error");
    expect(parseBlockForm(form({ ...base, title: "  " }))).toHaveProperty("error");
  });

  it("treats blank amounts as not given", () => {
    expect(parseOptionalAmount("  ")).toBeUndefined();
    expect(parseOptionalAmount("1,500")).toBe(1500);
  });
});

// The rows the block and template actions build must pass Person A's
// constraints (within-day check, canonical tags, template times).
describe("against the migrated schema", () => {
  let db: PGlite;
  beforeAll(async () => { db = await migratedDb(); }, 30_000);
  afterAll(async () => { await db?.close(); });

  const day = "2026-10-13";

  it("accepts blocks built by the form, including one that runs to midnight", async () => {
    await asUser(db, OWNER, async () => {
      for (const [start, end] of [["16:00", "18:00"], ["22:00", "00:00"]]) {
        const fields = parseBlockForm(form({ title: "درس", start, end, tag_draft: "درس، يادگيري" })) as BlockFields;
        await db.query(
          `insert into public.time_blocks (user_id, day, start_at, end_at, title, tags) values ($1, $2, $3, $4, $5, $6)`,
          [OWNER, day, clockToInstant(day, fields.start), clockToInstant(day, fields.end), fields.title, fields.tags],
        );
      }
      const { rows } = await db.query<{ start_at: Date; end_at: Date; tags: string[] }>(
        `select start_at, end_at, tags from public.time_blocks order by start_at`,
      );
      expect(rows.map((r) => [clockOf(day, r.start_at.toISOString()), clockOf(day, r.end_at.toISOString())]))
        .toEqual([[960, 1080], [1320, 1440]]);
      expect(rows[0].tags).toEqual(["درس", "یادگیری"]);
    });
  });

  it("round-trips template times, 24:00 included, through apply_day_template", async () => {
    await asUser(db, OWNER, async () => {
      const { rows: [tpl] } = await db.query<{ id: string }>(
        `insert into public.day_templates (user_id, name) values ($1, 'روز درس') returning id`,
        [OWNER],
      );
      await db.query(
        `insert into public.day_template_blocks (template_id, user_id, start_time, end_time, title, tags)
         values ($1, $2, $3, $4, 'خواب', '{}')`,
        [tpl.id, OWNER, formatClock(1380), formatClock(1440)],
      );
      const { rows: [tplBlock] } = await db.query<{ start_time: string; end_time: string }>(
        `select start_time::text, end_time::text from public.day_template_blocks`,
      );
      expect([minutesOfTime(tplBlock.start_time), minutesOfTime(tplBlock.end_time)]).toEqual([1380, 1440]);

      const { rows } = await db.query<{ start_at: Date; end_at: Date }>(
        `select start_at, end_at from public.apply_day_template($1, $2)`,
        [tpl.id, day],
      );
      expect([clockOf(day, rows[0].start_at.toISOString()), clockOf(day, rows[0].end_at.toISOString())])
        .toEqual([1380, 1440]);
    });
  });
});
