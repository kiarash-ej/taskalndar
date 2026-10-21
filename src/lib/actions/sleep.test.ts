import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  rpc: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("../auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("../supabase/server", () => ({
  createClient: async () => ({
    rpc: mocks.rpc,
    from: () => {
      const chain = { delete: () => chain, eq: () => chain, then: (r: (v: unknown) => unknown) => r({ error: null }) };
      return { upsert: mocks.upsert, delete: chain.delete };
    },
  }),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
import { hashHookToken } from "../sleep-hook";
import { acceptSleepSuggestion, createSleepPhoneLink, saveSleepSchedule } from "./sleep";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "owner" });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
});

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

describe("saveSleepSchedule", () => {
  it("sends the checked nights to the RPC", async () => {
    const result = await saveSleepSchedule(
      {},
      form({ on_0: "on", bed_0: "23:30", wake_0: "07:00", on_5: "on", bed_5: "01:00", wake_5: "09:30" }),
    );
    expect(result.message).toBeDefined();
    expect(mocks.rpc).toHaveBeenCalledWith("save_sleep_schedule", {
      p_weekdays: [0, 5],
      p_bedtimes: ["23:30", "01:00"],
      p_wake_times: ["07:00", "09:30"],
    });
  });

  it("turns the schedule off with no nights checked", async () => {
    expect((await saveSleepSchedule({}, form({}))).message).toBe("برنامهٔ خواب خاموش شد.");
    expect(mocks.rpc).toHaveBeenCalledWith("save_sleep_schedule", { p_weekdays: [], p_bedtimes: [], p_wake_times: [] });
  });

  it("doesn't save an invalid night", async () => {
    expect((await saveSleepSchedule({}, form({ on_1: "on", bed_1: "23:00", wake_1: "23:15" }))).error).toBeDefined();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("createSleepPhoneLink", () => {
  it("stores only the hash of a fresh secret", async () => {
    const { token } = await createSleepPhoneLink();
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(mocks.upsert).toHaveBeenCalledWith(
      { user_id: "owner", hook_token_hash: hashHookToken(token!) },
      { onConflict: "user_id" },
    );
  });

  it("needs a signed-in user", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await createSleepPhoneLink()).error).toBeDefined();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

describe("acceptSleepSuggestion", () => {
  it("saves the night with the times the user typed", async () => {
    expect(await acceptSleepSuggestion("2026-10-13", { bed: "00:30", wake: "08:00" })).toEqual({});
    expect(mocks.rpc).toHaveBeenCalledWith("set_sleep_night", {
      p_user: "owner",
      p_night: "2026-10-13",
      // a bedtime before noon is after the night's midnight
      p_bed_at: new Date("2026-10-14T00:30:00+03:30").toISOString(),
      p_wake_at: new Date("2026-10-14T08:00:00+03:30").toISOString(),
    });
  });

  it("refuses typed times outside 1 to 16 hours", async () => {
    expect((await acceptSleepSuggestion("2026-10-13", { bed: "23:00", wake: "23:20" })).error).toBeDefined();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
