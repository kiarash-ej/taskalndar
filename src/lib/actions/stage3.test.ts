import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  client: vi.fn(),
  insert: vi.fn(),
  rpc: vi.fn(),
  blocks: vi.fn(),
  deleteEq: vi.fn(),
  neq: vi.fn(),
}));
vi.mock("../auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("../supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
import { addSuggestedBlocks, applyTemplate, createBlock, saveDayAsTemplate } from "./blocks";
import { addTemplateBlock } from "./templates";

const DAY = "2026-10-15";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "owner" });
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  mocks.blocks.mockResolvedValue({ data: [], error: null });
  mocks.deleteEq.mockResolvedValue({ error: null });
  // insert(...) resolves for plain inserts and offers .select().single() for the template insert
  mocks.insert.mockImplementation(() => {
    const done = Promise.resolve({ error: null });
    return Object.assign(done, {
      select: () => ({ single: () => Promise.resolve({ data: { id: "tpl" }, error: null }) }),
    });
  });
  const read = { select: vi.fn(), eq: vi.fn(), neq: mocks.neq, order: mocks.blocks };
  read.select.mockReturnValue(read);
  read.eq.mockReturnValue(read);
  read.neq.mockReturnValue(read);
  mocks.client.mockResolvedValue({
    from: vi.fn(() => ({ ...read, insert: mocks.insert, delete: () => ({
      eq: (...args: unknown[]) =>
        Object.assign(Promise.resolve(mocks.deleteEq(...args)), {
          select: () => Promise.resolve({ data: [], error: null }),
        }),
    }) })),
    rpc: mocks.rpc,
  });
});

function form(fields: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const value of Array.isArray(v) ? v : [v]) f.append(k, value);
  }
  return f;
}

describe("createBlock", () => {
  it("stores Tehran times as instants with normalized tags", async () => {
    const result = await createBlock(DAY, {}, form({ title: "درس", start: "16:00", end: "00:00", tags: ["درس"], tag_draft: "كار" }));
    expect(result).toEqual({});
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: "owner",
      remind: true,
      reminder_minutes: null,
      day: DAY,
      start_at: "2026-10-15T12:30:00.000Z",
      end_at: "2026-10-15T20:30:00.000Z",
      title: "درس",
      description: "",
      tags: ["درس", "کار"],
      amount: null,
      unit: null,
      cost: null,
    });
  });

  it("stores a block's own reminder time", async () => {
    await createBlock(DAY, {}, form({ title: "درس", start: "16:00", end: "18:00", reminder: "custom", reminder_minutes: "۲۵" }));
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ remind: true, reminder_minutes: 25 }));
  });

  it("keeps what was typed on a validation error", async () => {
    const result = await createBlock(DAY, {}, form({ title: "درس", start: "18:00", end: "16:00", tags: ["a", "b"] }));
    expect(result.error).toBeDefined();
    expect(result.values).toMatchObject({ title: "درس", start: "18:00", tags: "a,b" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe("templates", () => {
  it("applies a template through the RPC", async () => {
    expect(await applyTemplate("tpl", DAY)).toEqual({});
    expect(mocks.rpc).toHaveBeenCalledWith("apply_day_template", { p_template_id: "tpl", p_day: DAY });
  });

  it("saves the day's blocks as template times, midnight as 24:00", async () => {
    mocks.blocks.mockResolvedValue({
      data: [{ start_at: "2026-10-15T18:30:00Z", end_at: "2026-10-15T20:30:00Z", title: "خواب", tags: [] }],
      error: null,
    });
    const result = await saveDayAsTemplate(DAY, {}, form({ name: "شب" }));
    expect(result.message).toBeDefined();
    expect(mocks.insert).toHaveBeenLastCalledWith([
      { template_id: "tpl", user_id: "owner", start_time: "22:00", end_time: "24:00", title: "خواب", tags: [] },
    ]);
    // the sleep schedule's own blocks stay out of templates
    expect(mocks.neq).toHaveBeenCalledWith("source", "sleep");
  });

  it("refuses to save an empty day as a template", async () => {
    expect((await saveDayAsTemplate(DAY, {}, form({ name: "خالی" }))).error).toBeDefined();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("removes the new template when its blocks fail to save", async () => {
    mocks.blocks.mockResolvedValue({
      data: [{ start_at: "2026-10-15T05:30:00Z", end_at: "2026-10-15T06:30:00Z", title: "x", tags: [] }],
      error: null,
    });
    mocks.insert
      .mockImplementationOnce(() => ({ select: () => ({ single: () => Promise.resolve({ data: { id: "tpl" }, error: null }) }) }))
      .mockImplementationOnce(() => Promise.resolve({ error: { message: "boom" } }));
    expect((await saveDayAsTemplate(DAY, {}, form({ name: "x" }))).error).toBeDefined();
    expect(mocks.deleteEq).toHaveBeenCalledWith("id", "tpl");
  });

  it("adds a template block with HH:MM times", async () => {
    expect(await addTemplateBlock("tpl", {}, form({ title: "ورزش", start: "06:00", end: "07:00", tag_draft: "ورزش" }))).toEqual({});
    expect(mocks.insert).toHaveBeenCalledWith({
      template_id: "tpl", user_id: "owner", start_time: "06:00", end_time: "07:00", title: "ورزش", tags: ["ورزش"],
    });
  });
});

describe("addSuggestedBlocks", () => {
  it("saves the accepted suggestions as blocks", async () => {
    expect(await addSuggestedBlocks(DAY, [{ title: " خرید ", start: 9 * 60, end: 9 * 60 + 30 }])).toEqual({});
    expect(mocks.insert).toHaveBeenCalledWith([
      {
        user_id: "owner",
        day: DAY,
        start_at: "2026-10-15T05:30:00.000Z",
        end_at: "2026-10-15T06:00:00.000Z",
        title: "خرید",
      },
    ]);
  });

  it("refuses anything that isn't a block of that day", async () => {
    for (const items of [[], [{ title: "", start: 0, end: 30 }], [{ title: "x", start: 1400, end: 1500 }], [{ title: "x", start: 30, end: 30 }]]) {
      expect((await addSuggestedBlocks(DAY, items)).error).toBeDefined();
    }
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
