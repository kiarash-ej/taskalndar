import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), update: vi.fn(), eq: vi.fn() }));
vi.mock("../auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("../supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      update: (values: unknown) => {
        mocks.update(values);
        const chain = {
          eq: (column: string, value: unknown) => {
            mocks.eq(column, value);
            return chain;
          },
          then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
        };
        return chain;
      },
    }),
  }),
}));
import { moveBlock } from "./blocks";

const DAY = "2026-10-15";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "owner" });
});

describe("moveBlock", () => {
  it("saves only the confirmed times, as Tehran instants of that day", async () => {
    expect(await moveBlock("b1", DAY, 16 * 60 + 15, 17 * 60 + 30)).toEqual({});
    expect(mocks.update).toHaveBeenCalledWith({
      start_at: "2026-10-15T12:45:00.000Z",
      end_at: "2026-10-15T14:00:00.000Z",
    });
    expect(mocks.eq).toHaveBeenCalledWith("id", "b1");
    expect(mocks.eq).toHaveBeenCalledWith("day", DAY);
  });

  it("allows until midnight and refuses times outside the day", async () => {
    expect(await moveBlock("b1", DAY, 23 * 60, 24 * 60)).toEqual({});
    for (const [start, end] of [[-15, 30], [60, 60], [23 * 60, 24 * 60 + 15], [10.5, 70]]) {
      expect((await moveBlock("b1", DAY, start, end)).error).toBeDefined();
    }
    expect((await moveBlock("b1", "not-a-day", 60, 120)).error).toBeDefined();
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it("needs a signed-in user", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await moveBlock("b1", DAY, 60, 120)).error).toBeDefined();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
