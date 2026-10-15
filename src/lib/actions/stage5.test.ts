import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  client: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  deleteKind: vi.fn(),
  calls: [] as string[],
}));
vi.mock("../auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("../supabase/server", () => ({ createClient: mocks.client }));
vi.mock("../messaging/config", () => ({ botTokens: () => ({ telegram: "token" }) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
import { connectChannel, saveChannelSettings } from "./channels";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.calls.length = 0;
  mocks.user.mockResolvedValue({ id: "owner" });
  mocks.insert.mockImplementation(async () => { mocks.calls.push("insert"); return { error: null }; });
  mocks.deleteKind.mockImplementation(async () => { mocks.calls.push("delete"); return { error: null }; });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({ eq: updateEq });
  mocks.client.mockResolvedValue({
    from: () => ({
      insert: mocks.insert,
      update: mocks.update,
      delete: () => ({ eq: () => ({ eq: mocks.deleteKind }) }),
    }),
  });
});

function settings(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("connectChannel", () => {
  it("creates the row for a configured messenger only", async () => {
    expect(await connectChannel("telegram")).toEqual({});
    expect(mocks.insert).toHaveBeenCalledWith({ user_id: "owner", kind: "telegram" });
    expect((await connectChannel("bale")).error).toBeDefined(); // no Bale token
    expect((await connectChannel("sms")).error).toBeDefined();
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });

  it("removes the old row before a fresh code when replacing", async () => {
    await connectChannel("telegram", true);
    expect(mocks.calls).toEqual(["delete", "insert"]);
  });
});

describe("saveChannelSettings", () => {
  it("writes only the user-editable columns", async () => {
    const result = await saveChannelSettings("c", {}, settings({ enabled: "on", send_time: "21:15", include_tasks: "on", include_note: "on" }));
    expect(result.message).toBeDefined();
    expect(mocks.update).toHaveBeenCalledWith({
      enabled: true, send_time: "21:15", include_tasks: true, include_blocks: false, include_note: true,
    });
  });

  it("rejects an off-grid time and an empty message", async () => {
    expect((await saveChannelSettings("c", {}, settings({ send_time: "21:10", include_tasks: "on" }))).error).toBeDefined();
    expect((await saveChannelSettings("c", {}, settings({ send_time: "21:00" }))).error).toBeDefined();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
