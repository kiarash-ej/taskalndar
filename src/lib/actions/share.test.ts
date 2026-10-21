import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), insert: vi.fn(), rpc: vi.fn(), deleteEq: vi.fn() }));
vi.mock("../auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("../supabase/server", () => ({
  createClient: async () => ({
    rpc: mocks.rpc,
    from: (table: string) => ({
      insert: (rows: unknown) => {
        const result = mocks.insert(table, rows);
        return Object.assign(Promise.resolve(result), {
          select: () => ({ single: () => Promise.resolve({ data: { id: "tpl-1" }, error: null }) }),
        });
      },
      delete: () => ({ eq: mocks.deleteEq }),
    }),
  }),
}));
vi.mock("../dates", async (original) => ({ ...(await original<typeof import("../dates")>()), todayIso: () => "2026-10-21" }));
import { CODE_PREFIX, encodeShare, type SharePack } from "../share";
import { importShared } from "./share";

const pack: SharePack = {
  v: 1,
  templates: [{ name: "روز دانشگاه", blocks: [{ start: "08:00", end: "10:00", title: "کلاس", tags: ["دانشگاه"] }] }],
  sleep: [{ weekday: 0, bed: "23:00", wake: "07:00" }],
  tasks: [{ title: "ورزش", weekdays: [0, 2] }, { title: "کتاب", weekdays: null }],
};
const code = encodeShare(pack);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "me" });
  mocks.insert.mockReturnValue({ error: null });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.deleteEq.mockResolvedValue({ error: null });
});

describe("importShared", () => {
  it("adds only what was ticked, to the user's own account", async () => {
    const result = await importShared(code, { templates: [{ index: 0, name: " ترم پاییز " }], sleep: false, tasks: [1] });
    expect(result).toEqual({ added: { templates: 1, sleep: false, tasks: 1 } });
    expect(mocks.insert).toHaveBeenCalledWith("day_templates", { user_id: "me", name: "ترم پاییز" });
    expect(mocks.insert).toHaveBeenCalledWith("day_template_blocks", [
      { template_id: "tpl-1", user_id: "me", start_time: "08:00", end_time: "10:00", title: "کلاس", tags: ["دانشگاه"] },
    ]);
    expect(mocks.insert).toHaveBeenCalledWith("tasks", [
      { user_id: "me", title: "کتاب", is_recurring: true, weekdays: null, date: "2026-10-21" },
    ]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("replaces the sleep schedule only when asked", async () => {
    await importShared(code, { templates: [], sleep: true, tasks: [] });
    expect(mocks.rpc).toHaveBeenCalledWith("save_sleep_schedule", {
      p_weekdays: [0],
      p_bedtimes: ["23:00"],
      p_wake_times: ["07:00"],
    });
  });

  it("checks the code itself, not the page's preview", async () => {
    const forged = CODE_PREFIX + Buffer.from(JSON.stringify({ ...pack, tasks: [{ title: "", weekdays: null }] })).toString("base64url");
    expect((await importShared(forged, { templates: [], sleep: false, tasks: [0] })).error).toBeDefined();
    expect((await importShared(code, { templates: [{ index: 5, name: "x" }], sleep: false, tasks: [] })).error).toBeDefined();
    expect((await importShared(code, { templates: [], sleep: false, tasks: [] })).error).toBe("چیزی برای افزودن انتخاب نشده.");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("removes a template whose blocks failed to save", async () => {
    mocks.insert.mockImplementation((table: string) => ({ error: table === "day_template_blocks" ? { message: "x" } : null }));
    expect((await importShared(code, { templates: [{ index: 0, name: "t" }], sleep: false, tasks: [] })).error).toBeDefined();
    expect(mocks.deleteEq).toHaveBeenCalledWith("id", "tpl-1");
  });

  it("needs a signed-in user", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await importShared(code, { templates: [], sleep: true, tasks: [] })).error).toBeDefined();
  });
});
