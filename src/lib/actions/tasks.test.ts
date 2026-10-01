import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), client: vi.fn(), single: vi.fn(), update: vi.fn(), rpc: vi.fn() }));
vi.mock("../auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("../supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
import { deleteTask, updateTask } from "./tasks";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "owner" });
  mocks.rpc.mockResolvedValue({ data: "new-id", error: null });
  const query = { select: vi.fn(), eq: vi.fn(), single: mocks.single, update: mocks.update };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mocks.client.mockResolvedValue({ from: vi.fn().mockReturnValue(query), rpc: mocks.rpc });
});

describe("task schedule actions", () => {
  it("leaves an archived historical schedule’s cutoff unchanged on repeated deletion", async () => {
    mocks.single.mockResolvedValue({ data: { is_recurring: true, date: "2026-09-01", archived_at: "2026-09-20T08:00:00Z" } });
    expect(await deleteTask("old-version")).toEqual({});
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("uses the atomic schedule RPC for recurrence changes", async () => {
    const form = new FormData();
    form.set("title", "updated");
    form.set("kind", "once");
    form.set("day", "2026-10-01");
    expect(await updateTask("task", {}, form)).toEqual({});
    expect(mocks.rpc).toHaveBeenCalledWith("update_task_schedule", {
      p_task_id: "task", p_title: "updated", p_is_recurring: false, p_effective_date: "2026-10-01",
    });
  });

  it("requires authentication before editing a schedule", async () => {
    mocks.user.mockResolvedValue(null);
    const form = new FormData();
    form.set("title", "updated");
    form.set("day", "2026-10-01");
    expect((await updateTask("task", {}, form)).error).toBeTruthy();
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
