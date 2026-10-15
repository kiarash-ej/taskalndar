import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(), createClient: vi.fn(), refresh: vi.fn(),
  single: vi.fn(), insert: vi.fn(),
}));
vi.mock("../auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("../supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
import { createGoal, logGoalProgress } from "./goals";

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
  mocks.getCurrentUser.mockResolvedValue({ id: "user" });
  const query = { select: vi.fn(), eq: vi.fn(), single: mocks.single, insert: mocks.insert };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query) });
  mocks.single.mockResolvedValue({ data: { start_date: "2026-10-01", archived_at: null }, error: null });
  mocks.insert.mockResolvedValue({ error: null });
});

afterEach(() => { vi.useRealTimers(); });

function form(date: string) {
  const values = new FormData();
  values.set("date", date);
  values.set("amount", "۳");
  return values;
}

describe("goal log dates", () => {
  it("rejects a log before the goal starts without saving it", async () => {
    const result = await logGoalProgress("goal", {}, form("2026-09-21"));
    expect(result.error).toBeTruthy();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("accepts the first active day and localized amounts", async () => {
    expect((await logGoalProgress("goal", {}, form("2026-10-01"))).error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith({ goal_id: "goal", user_id: "user", date: "2026-10-01", amount: 3 });
  });

  it("accepts a valid backdated log for an older goal", async () => {
    mocks.single.mockResolvedValue({ data: { start_date: "2026-09-01", archived_at: null }, error: null });
    expect((await logGoalProgress("goal", {}, form("2026-09-21"))).error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledOnce();
  });

  it("rejects archived or inaccessible goals", async () => {
    mocks.single.mockResolvedValue({ data: { start_date: "2026-09-01", archived_at: "2026-09-30T08:00:00Z" }, error: null });
    expect((await logGoalProgress("goal", {}, form("2026-09-21"))).error).toBeTruthy();
    mocks.single.mockResolvedValue({ data: null, error: { message: "not found" } });
    expect((await logGoalProgress("goal", {}, form("2026-10-01"))).error).toBeTruthy();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe("createGoal period", () => {
  function goalForm(period?: string) {
    const values = new FormData();
    values.set("title", "run");
    values.set("target_value", "۱۵");
    values.set("unit", "km");
    if (period !== undefined) values.set("period", period);
    return values;
  }

  it("stores weekly and monthly goals", async () => {
    expect(await createGoal({}, goalForm("weekly"))).toEqual({});
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ period: "weekly", target_value: 15 }));
  });

  it("rejects a missing or unknown period", async () => {
    expect((await createGoal({}, goalForm())).error).toBeTruthy();
    expect((await createGoal({}, goalForm("daily"))).error).toBeTruthy();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
