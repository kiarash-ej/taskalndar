import { describe, expect, it, vi } from "vitest";
import { sendDueSummaries, type DueChannel, type SummarySource } from "./daily";

// 21:10 in Tehran on 2026-10-15
const now = new Date("2026-10-15T17:40:00Z");

const channel = (over: Partial<DueChannel>): DueChannel => ({
  id: "c1",
  user_id: "u1",
  kind: "bale",
  chat_id: "42",
  send_time: "21:00:00",
  last_sent_on: null,
  include_tasks: true,
  include_blocks: true,
  include_note: true,
  ...over,
});

function source(channels: DueChannel[]): SummarySource & { marked: string[] } {
  const marked: string[] = [];
  return {
    marked,
    linkedChannels: async () => channels,
    dayData: async (userId) => ({
      tasks: [{ title: `کار ${userId}`, done: false }],
      blocks: [],
      note: null,
    }),
    markSent: async (id, day) => { marked.push(`${id}@${day}`); },
  };
}

describe("sendDueSummaries", () => {
  it("sends each due channel its user's summary and records the day", async () => {
    const src = source([channel({}), channel({ id: "c2", user_id: "u2", kind: "telegram", chat_id: "7" })]);
    const send = vi.fn(async () => {});
    const result = await sendDueSummaries(src, now, { bale: "B", telegram: "T" }, send);
    expect(result).toEqual({ sent: 2, failed: 0, skipped: 0 });
    expect(send.mock.calls.map((c: unknown[]) => [c[0], c[1], c[2]])).toEqual([["bale", "B", "42"], ["telegram", "T", "7"]]);
    expect((send.mock.calls[0] as unknown[])[3]).toContain("کار u1");
    expect(src.marked).toEqual(["c1@2026-10-15", "c2@2026-10-15"]);
  });

  it("skips channels that aren't due or whose bot has no token", async () => {
    const src = source([
      channel({ send_time: "22:00:00" }),
      channel({ id: "c2", last_sent_on: "2026-10-15" }),
      channel({ id: "c3", kind: "telegram" }),
    ]);
    const send = vi.fn(async () => {});
    expect(await sendDueSummaries(src, now, { bale: "B" }, send)).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps going when one channel fails and leaves it to retry on the next run", async () => {
    const src = source([channel({}), channel({ id: "c2", chat_id: "7" })]);
    const send = vi.fn(async (_k: unknown, _t: unknown, chatId: unknown) => {
      if (chatId === "42") throw new Error("chat not found");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendDueSummaries(src, now, { bale: "B" }, send)).toEqual({ sent: 1, failed: 1, skipped: 0 });
    expect(src.marked).toEqual(["c2@2026-10-15"]);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
