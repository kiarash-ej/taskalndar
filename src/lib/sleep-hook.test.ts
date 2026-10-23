import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The phone link route (src/app/api/sleep) against a stand-in admin client.

const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  proposal: vi.fn(),
  blocks: vi.fn(),
  plan: vi.fn(),
  upsert: vi.fn(),
  rpc: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          mocks.eq(table, column, value);
          return query;
        },
        maybeSingle: () =>
          table === "sleep_settings" ? mocks.owner() : table === "sleep_proposals" ? mocks.proposal() : mocks.plan(),
        upsert: mocks.upsert,
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
          Promise.resolve(mocks.blocks()).then(resolve, reject),
      };
      return query;
    },
  }),
}));
import { POST } from "../app/api/sleep/route";
import { bearerToken, hashHookToken, readHookParams } from "./sleep-hook";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
  vi.useFakeTimers({ toFake: ["Date"] });
  // 22:00 in Tehran
  vi.setSystemTime(new Date("2026-10-13T22:00:00+03:30"));
  mocks.owner.mockResolvedValue({ data: { user_id: "owner" }, error: null });
  mocks.blocks.mockReturnValue({ data: [], error: null });
  mocks.plan.mockResolvedValue({ data: { bedtime: "23:00:00", wake_time: "07:00:00" }, error: null });
  mocks.proposal.mockResolvedValue({ data: null, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

function post(query: string, init: RequestInit = {}) {
  // NextRequest's extras aren't used by the route
  return POST(new Request(`https://app.test/api/sleep?${query}`, { method: "POST", ...init }) as never);
}

describe("POST /api/sleep", () => {
  it("proposes tonight from an alarm's wake-up time and the schedule's bedtime, without writing blocks", async () => {
    const response = await post("token=secret&wake=06:30");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      night: "2026-10-13",
      message: "پیشنهاد خواب ۲۳:۰۰ تا ۰۶:۳۰ فرستاده شد؛ در تسکلندر تأییدش کنید.",
    });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "owner",
        night: "2026-10-13",
        bed_at: new Date("2026-10-13T23:00:00+03:30").toISOString(),
        wake_at: new Date("2026-10-14T06:30:00+03:30").toISOString(),
      }),
      { onConflict: "user_id,night" },
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("looks the user up by the secret's hash, from the header too", async () => {
    const response = await post("bed=now", { headers: { authorization: "Bearer secret" } });
    expect(response.status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith("sleep_settings", "hook_token_hash", hashHookToken("secret"));
    // going to bed now: the wake-up comes from the schedule
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      bed_at: new Date("2026-10-13T22:00:00+03:30").toISOString(),
      wake_at: new Date("2026-10-14T07:00:00+03:30").toISOString(),
    }), expect.anything());
  });

  it("keeps the other side of an earlier proposal", async () => {
    mocks.proposal.mockResolvedValue({
      data: { bed_at: "2026-10-13T23:30:00+03:30", wake_at: "2026-10-14T06:00:00+03:30" },
      error: null,
    });
    await post("token=secret&bed=now");
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      wake_at: new Date("2026-10-14T06:00:00+03:30").toISOString(),
    }), expect.anything());
  });

  it("refuses a missing or unknown secret", async () => {
    expect((await post("wake=07:00")).status).toBe(401);
    mocks.owner.mockResolvedValue({ data: null, error: null });
    expect((await post("token=wrong&wake=07:00")).status).toBe(401);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("explains unreadable or missing times", async () => {
    expect((await post("token=secret")).status).toBe(400);
    expect((await post("token=secret&wake=25:00")).status).toBe(400);
    mocks.plan.mockResolvedValue({ data: null, error: null });
    expect((await post("token=secret&wake=07:00")).status).toBe(422);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

describe("readHookParams", () => {
  it("reads a JSON body, with the query string winning", async () => {
    const request = new Request("https://app.test/api/sleep?wake=08:00", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bed: "23:00", wake: "07:00", token: "t" }),
    });
    expect(await readHookParams(request)).toEqual({ bed: "23:00", wake: "08:00", token: "t" });
  });

  it("reads a bearer token", () => {
    const request = new Request("https://app.test", { headers: { authorization: "Bearer abc" } });
    expect(bearerToken(request)).toBe("abc");
    expect(bearerToken(new Request("https://app.test"))).toBeNull();
  });
});
