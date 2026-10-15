import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { channelState, parseSendTime, SEND_TIME_OPTIONS, startCommand, type ChannelRow } from "./channels";
import { asUser, migratedDb, OWNER } from "./test-db";

const NOW = new Date("2026-10-15T18:00:00Z");

const channel = (over: Partial<ChannelRow>): ChannelRow => ({
  id: "c",
  kind: "telegram",
  link_code: "abc",
  link_code_expires_at: "2026-10-15T18:20:00Z",
  linked_at: null,
  enabled: true,
  send_time: "21:00:00",
  include_tasks: true,
  include_blocks: true,
  include_note: true,
  last_sent_on: null,
  ...over,
});

describe("send times", () => {
  it("offers every quarter hour of the day", () => {
    expect(SEND_TIME_OPTIONS).toHaveLength(96);
    expect([SEND_TIME_OPTIONS[0], SEND_TIME_OPTIONS[85], SEND_TIME_OPTIONS[95]]).toEqual(["00:00", "21:15", "23:45"]);
  });

  it("accepts only quarter-hour times before midnight", () => {
    expect(parseSendTime("21:15")).toBe("21:15");
    expect(parseSendTime("21:10")).toBeNull();
    expect(parseSendTime("24:00")).toBeNull();
    expect(parseSendTime(null)).toBeNull();
  });
});

describe("channelState", () => {
  it("is linked once the bot linked a chat, whatever the code", () => {
    expect(channelState(channel({ linked_at: "2026-10-15T17:00:00Z", link_code: null }), NOW)).toBe("linked");
  });

  it("is pending while the code is valid and expired after", () => {
    expect(channelState(channel({}), NOW)).toBe("pending");
    expect(channelState(channel({ link_code_expires_at: "2026-10-15T17:59:00Z" }), NOW)).toBe("expired");
    expect(channelState(channel({ link_code: null, link_code_expires_at: null }), NOW)).toBe("expired");
  });

  it("builds the bot command", () => {
    expect(startCommand("abc")).toBe("/start abc");
  });
});

// The settings page writes through A's column privileges: users may insert
// only (user_id, kind, …settings) and update only the settings.
describe("against the migrated schema", () => {
  let db: PGlite;
  beforeAll(async () => { db = await migratedDb(); }, 30_000);
  afterAll(async () => { await db?.close(); });

  it("creates a channel with a fresh 30-minute code and saves its settings", async () => {
    await asUser(db, OWNER, async () => {
      const { rows: [row] } = await db.query<{ id: string; link_code: string; minutes: number }>(
        `insert into public.notification_channels (user_id, kind) values ($1, 'telegram')
         returning id, link_code, extract(epoch from link_code_expires_at - now()) / 60 as minutes`,
        [OWNER],
      );
      expect(row.link_code).toMatch(/^[0-9a-f]{32}$/);
      expect(Math.round(row.minutes)).toBe(30);

      await db.query(
        `update public.notification_channels
         set enabled = $2, send_time = $3, include_tasks = $4, include_blocks = $5, include_note = $6 where id = $1`,
        [row.id, false, parseSendTime("06:45"), true, false, true],
      );
      const { rows: [saved] } = await db.query<{ send_time: string; enabled: boolean }>(
        `select send_time::text, enabled from public.notification_channels where id = $1`,
        [row.id],
      );
      expect(saved).toEqual({ send_time: "06:45:00", enabled: false });
    });
  });
});
