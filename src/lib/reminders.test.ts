import { describe, expect, it, vi } from "vitest";
import type { sendBotMessage } from "./messaging/bots";
import { sendDueReminders, type ClaimedReminder, type ReminderChat } from "./messaging/reminders";
import { buildReminderText, formatLead, parseBlockReminder, parseLeadMinutes, parseReminderSettingsForm } from "./reminders";

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

// Tehran is UTC+03:30.
const at = (local: string) => new Date(`${local}+03:30`);

describe("lead times", () => {
  it("formats minutes before", () => {
    expect(formatLead(0)).toBe("سر وقت");
    expect(formatLead(10)).toBe("۱۰ دقیقه قبل");
    expect(formatLead(60)).toBe("۱ ساعت قبل");
    expect(formatLead(90)).toBe("۱ ساعت و ۳۰ دقیقه قبل");
  });

  it("accepts any whole number of minutes up to a day, in any digits", () => {
    expect(parseLeadMinutes("7")).toBe(7);
    expect(parseLeadMinutes("۴۵")).toBe(45);
    expect(parseLeadMinutes("1440")).toBe(1440);
    expect(parseLeadMinutes("1441")).toBeNull();
    expect(parseLeadMinutes("2.5")).toBeNull();
    expect(parseLeadMinutes("")).toBeNull();
  });

  it("reads the settings form", () => {
    expect(parseReminderSettingsForm(form({ enabled: "on", lead_minutes: "25" }))).toEqual({
      enabled: true,
      leadMinutes: 25,
      includeSleep: false,
    });
    expect(parseReminderSettingsForm(form({ lead_minutes: "-5" }))).toHaveProperty("error");
  });

  it("reads a block's own reminder choice", () => {
    expect(parseBlockReminder(form({}))).toEqual({ remind: true, reminder_minutes: null });
    expect(parseBlockReminder(form({ reminder: "off" }))).toEqual({ remind: false, reminder_minutes: null });
    expect(parseBlockReminder(form({ reminder: "custom", reminder_minutes: "۳۰" }))).toEqual({
      remind: true,
      reminder_minutes: 30,
    });
    expect(parseBlockReminder(form({ reminder: "custom", reminder_minutes: "" }))).toHaveProperty("error");
  });
});

describe("buildReminderText", () => {
  const block = { title: "درس", start_at: "2026-10-13T16:00:00+03:30", end_at: "2026-10-13T18:00:00+03:30", is_sleep: false };

  it("says how long until the block and its times", () => {
    expect(buildReminderText(block, at("2026-10-13T15:50:00"))).toBe("⏰ ۱۰ دقیقه دیگر: درس\n۱۶:۰۰ تا ۱۸:۰۰");
    expect(buildReminderText(block, at("2026-10-13T14:30:00"))).toBe("⏰ ۱ ساعت و ۳۰ دقیقه دیگر: درس\n۱۶:۰۰ تا ۱۸:۰۰");
    expect(buildReminderText(block, at("2026-10-13T16:02:00"))).toBe("⏰ همین حالا: درس\n۱۶:۰۰ تا ۱۸:۰۰");
  });

  it("has its own words for bedtime", () => {
    const sleep = { title: "خواب", start_at: "2026-10-13T23:00:00+03:30", end_at: "2026-10-14T00:00:00+03:30", is_sleep: true };
    expect(buildReminderText(sleep, at("2026-10-13T22:30:00"))).toBe("🌙 ۳۰ دقیقه دیگر وقت خواب است (۲۳:۰۰). شب بخیر!");
  });
});

describe("sendDueReminders", () => {
  const reminder = (id: string, user: string): ClaimedReminder => ({
    block_id: id,
    user_id: user,
    title: "درس",
    start_at: "2026-10-13T16:00:00+03:30",
    end_at: "2026-10-13T18:00:00+03:30",
    is_sleep: false,
  });

  function source(due: ClaimedReminder[], chats: ReminderChat[]) {
    return { claimDue: vi.fn(async () => due), chatsFor: vi.fn(async () => chats), release: vi.fn(async () => {}) };
  }

  it("sends each reminder to every linked chat of its user", async () => {
    const src = source([reminder("b1", "u1")], [
      { user_id: "u1", kind: "bale", chat_id: "1" },
      { user_id: "u1", kind: "telegram", chat_id: "2" },
      { user_id: "u2", kind: "bale", chat_id: "3" },
    ]);
    const send = vi.fn<typeof sendBotMessage>(async () => {});
    const result = await sendDueReminders(src, at("2026-10-13T15:50:00"), { bale: "B", telegram: "T" }, send);
    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(send.mock.calls.map((c) => [c[0], c[2]])).toEqual([["bale", "1"], ["telegram", "2"]]);
    expect(src.release).not.toHaveBeenCalled();
  });

  it("releases reminders that reached no chat, for the next run", async () => {
    const src = source([reminder("b1", "u1"), reminder("b2", "u2")], [
      { user_id: "u1", kind: "bale", chat_id: "1" },
      { user_id: "u2", kind: "telegram", chat_id: "2" },
    ]);
    const send = vi.fn(async () => { throw new Error("down"); });
    const result = await sendDueReminders(src, new Date(), { bale: "B" }, send);
    expect(result).toEqual({ sent: 0, failed: 2 });
    expect(src.release).toHaveBeenCalledWith(["b1", "b2"]);
  });

  it("does nothing when nothing is due", async () => {
    const src = source([], []);
    expect(await sendDueReminders(src, new Date(), {})).toEqual({ sent: 0, failed: 0 });
    expect(src.chatsFor).not.toHaveBeenCalled();
  });
});
