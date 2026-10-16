import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), client: vi.fn(), single: vi.fn(), update: vi.fn(), rpc: vi.fn(), insert: vi.fn() }));
vi.mock("../auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("../supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
import { createTask, deleteTask, updateTask } from "./tasks";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "owner" });
  mocks.rpc.mockResolvedValue({ data: "new-id", error: null });
  mocks.insert.mockResolvedValue({ error: null });
  const query = { select: vi.fn(), eq: vi.fn(), single: mocks.single, update: mocks.update, insert: mocks.insert };
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
      p_task_id: "task", p_title: "updated", p_is_recurring: false, p_weekdays: undefined, p_effective_date: "2026-10-01",
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

describe("weekday schedules", () => {
  function taskForm(kind: string, weekdays: string[], date = "2026-10-10") {
    const form = new FormData();
    form.set("title", "gym");
    form.set("kind", kind);
    form.set("date", date);
    form.set("day", date);
    for (const d of weekdays) form.append("weekdays", d);
    return form;
  }

  it("stores the chosen weekdays on a new task", async () => {
    // 2026-10-10 is a Saturday (index 0), so the task is on this day's list
    const result = await createTask({}, taskForm("weekdays", ["2", "0"]));
    expect(result.error).toBeUndefined();
    expect(result.message).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ is_recurring: true, weekdays: [0, 2], date: "2026-10-10" }),
    );
  });

  it("explains where a task went when it skips the planned day", async () => {
    const result = await createTask({}, taskForm("weekdays", ["3"]));
    expect(result.message).toBeDefined();
  });

  it("rejects a weekday schedule without days, on create and on edit", async () => {
    expect((await createTask({}, taskForm("weekdays", []))).error).toBeTruthy();
    expect((await updateTask("task", {}, taskForm("weekdays", []))).error).toBeTruthy();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("passes weekdays to the schedule RPC", async () => {
    await updateTask("task", {}, taskForm("weekdays", ["5", "1"]));
    expect(mocks.rpc).toHaveBeenCalledWith("update_task_schedule", expect.objectContaining({
      p_is_recurring: true, p_weekdays: [1, 5],
    }));
  });
});
