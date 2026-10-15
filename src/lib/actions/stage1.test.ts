import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  client: vi.fn(),
  upsert: vi.fn(),
  maybeSingle: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("../supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
import { saveDailyNote } from "./notes";
import { saveBackground } from "./profile";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "owner" });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.maybeSingle.mockResolvedValue({ data: null });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: mocks.maybeSingle, upsert: mocks.upsert };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mocks.client.mockResolvedValue({
    from: vi.fn().mockReturnValue(query),
    storage: { from: vi.fn().mockReturnValue({ upload: mocks.upload, remove: mocks.remove }) },
  });
});

function form(fields: Record<string, string | Blob>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("saveDailyNote", () => {
  it("upserts one row per user and day", async () => {
    expect(await saveDailyNote("2026-10-10", "hello")).toEqual({});
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "owner", date: "2026-10-10", body: "hello" }),
      { onConflict: "user_id,date" },
    );
  });

  it("rejects signed-out users, bad dates and oversized notes", async () => {
    expect((await saveDailyNote("2026-10-10", "x".repeat(20001))).error).toBeDefined();
    expect((await saveDailyNote("not-a-date", "x")).error).toBeDefined();
    mocks.user.mockResolvedValue(null);
    expect((await saveDailyNote("2026-10-10", "x")).error).toBeDefined();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

describe("saveBackground", () => {
  it("saves a valid color and rejects a malformed one", async () => {
    expect((await saveBackground({}, form({ kind: "color", color: "#ABCDEF" }))).message).toBeDefined();
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ background_kind: "color", background_value: "#abcdef" }),
      { onConflict: "user_id" },
    );
    mocks.upsert.mockClear();
    expect((await saveBackground({}, form({ kind: "color", color: "red" }))).error).toBeDefined();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("rejects unknown gradients", async () => {
    expect((await saveBackground({}, form({ kind: "gradient", gradient: "nope" }))).error).toBeDefined();
  });

  it("rejects non-image and oversized uploads before touching storage", async () => {
    const text = new File(["hi"], "a.txt", { type: "text/plain" });
    expect((await saveBackground({}, form({ kind: "image", image: text }))).error).toBeDefined();
    const big = new File([new Uint8Array(3 * 1024 * 1024 + 1)], "a.png", { type: "image/png" });
    expect((await saveBackground({}, form({ kind: "image", image: big }))).error).toBeDefined();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("uploads under the owner's folder and removes the previous image", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { background_kind: "image", background_value: "owner/old.png" } });
    const png = new File(["x"], "a.png", { type: "image/png" });
    expect((await saveBackground({}, form({ kind: "image", image: png }))).message).toBeDefined();
    expect(mocks.upload.mock.calls[0][0]).toMatch(/^owner\/.+\.png$/);
    expect(mocks.remove).toHaveBeenCalledWith(["owner/old.png"]);
  });

  it("removes a fresh upload if saving the profile fails", async () => {
    mocks.upsert.mockResolvedValue({ error: { message: "boom" } });
    const png = new File(["x"], "a.png", { type: "image/png" });
    expect((await saveBackground({}, form({ kind: "image", image: png }))).error).toBeDefined();
    expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0][0]]);
  });
});
