import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectAll, type PageResult } from "./paginate";

// Issue #5: reads past Supabase's response row limit must return every row.

type Row = Record<string, unknown>;

// A stand-in PostgREST table: filters, orders and ranges like the real one,
// and like it returns at most `cap` rows per response, with the exact count.
function fakeTable(rows: Row[], cap: number) {
  const calls: { from: number; to: number }[] = [];
  function query() {
    const filters: ((r: Row) => boolean)[] = [];
    const orders: { column: string; ascending: boolean }[] = [];
    let range: [number, number] | null = null;
    const builder = {
      select: () => builder,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), builder),
      gte: (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), builder),
      lte: (c: string, v: string) => (filters.push((r) => String(r[c]) <= v), builder),
      order: (column: string, o?: { ascending?: boolean }) => (orders.push({ column, ascending: o?.ascending ?? true }), builder),
      range: (from: number, to: number) => ((range = [from, to]), calls.push({ from, to }), builder),
      then<A = PageResult<Row>, B = never>(
        resolve?: ((v: PageResult<Row>) => A | PromiseLike<A>) | null,
        reject?: ((e: unknown) => B | PromiseLike<B>) | null,
      ): Promise<A | B> {
        const matching = rows.filter((r) => filters.every((f) => f(r)));
        matching.sort((a, b) => {
          for (const { column, ascending } of orders) {
            const cmp = String(a[column]).localeCompare(String(b[column]));
            if (cmp !== 0) return ascending ? cmp : -cmp;
          }
          return 0;
        });
        const [from, to] = range ?? [0, matching.length - 1];
        const data = matching.slice(from, Math.min(to + 1, from + cap));
        return Promise.resolve<PageResult<Row>>({ data, error: null, count: matching.length }).then(resolve, reject);
      },
    };
    return builder;
  }
  return { query, calls };
}

describe("selectAll", () => {
  const page = (rows: Row[], cap: number) => {
    const table = fakeTable(rows, cap);
    return { table, read: (size: number) => selectAll((from, to) => table.query().order("id").range(from, to), size) };
  };
  const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i).padStart(4, "0") }));

  it("reads an empty table in one request", async () => {
    const { table, read } = page([], 10);
    expect(await read(10)).toEqual([]);
    expect(table.calls).toHaveLength(1);
  });

  it("reads exactly one full page without asking for more", async () => {
    const { table, read } = page(ids(10), 10);
    expect(await read(10)).toEqual(ids(10));
    expect(table.calls).toHaveLength(1);
  });

  it("reads several pages with nothing missing or repeated", async () => {
    const { table, read } = page(ids(25), 10);
    expect(await read(10)).toEqual(ids(25));
    expect(table.calls).toEqual([{ from: 0, to: 9 }, { from: 10, to: 19 }, { from: 20, to: 29 }]);
  });

  it("keeps going when the server returns less than asked (a lower project limit)", async () => {
    const { read } = page(ids(25), 4);
    expect(await read(10)).toEqual(ids(25));
  });

  it("fails the whole read if any page fails", async () => {
    let n = 0;
    const failing = (from: number, to: number) =>
      Promise.resolve<PageResult<Row>>(
        ++n === 2
          ? { data: null, error: { message: "timeout" }, count: null }
          : { data: ids(25).slice(from, to + 1), error: null, count: 25 },
      );
    await expect(selectAll(failing, 10)).rejects.toThrow("timeout");
  });

  it("without a count, reads until an empty page", async () => {
    const all = ids(7);
    const noCount = (from: number, to: number) =>
      Promise.resolve<PageResult<Row>>({ data: all.slice(from, Math.min(to + 1, from + 3)), error: null });
    expect(await selectAll(noCount, 10)).toEqual(all);
  });
});

// loadProgressData against capped tables: the scores must match the full data.
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("./supabase/server", () => ({ createClient: mocks.client }));

describe("loadProgressData past the row limit", () => {
  const USER = "u1";
  const CAP = 7;

  beforeEach(() => {
    const days = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
    // 3 daily tasks over 30 days = 90 completions, 60 of them done; another user's rows too
    const tasks = ["a", "b", "c"].map((id, i) => ({
      id, user_id: USER, title: id, is_recurring: true, date: "2026-09-01", weekdays: null, archived_at: null,
      created_at: `2026-09-01T00:00:0${i}Z`,
    }));
    const completions = tasks.flatMap((t) =>
      days.map((date, i) => ({ id: `${t.id}-${date}`, task_id: t.id, user_id: USER, date, done: i % 3 !== 0 })),
    );
    completions.push({ id: "x", task_id: "zz", user_id: "other", date: "2026-09-02", done: true });
    const goals = [{ id: "g", user_id: USER, title: "g", target_value: 30, unit: "km", period: "monthly",
      start_date: "2026-09-01", created_at: "2026-09-01T00:00:00Z", archived_at: null }];
    const goalLogs = days.map((date) => ({ id: `l-${date}`, goal_id: "g", user_id: USER, date, amount: 1 }));
    const tables: Record<string, ReturnType<typeof fakeTable>> = {
      tasks: fakeTable(tasks, CAP),
      task_completions: fakeTable(completions, CAP),
      goals: fakeTable(goals, CAP),
      goal_logs: fakeTable(goalLogs, CAP),
    };
    mocks.client.mockResolvedValue({ from: (name: string) => tables[name].query() });
  });

  it("loads every row, only the user's, and scores them all", async () => {
    const { loadProgressData } = await import("./data");
    const { scorePeriod } = await import("./scoring");
    const data = await loadProgressData(USER, "2026-09-01", "2026-09-30");
    expect(data.tasks).toHaveLength(3);
    expect(data.completions).toHaveLength(90);
    expect(new Set(data.completions.map((c) => `${c.task_id}|${c.date}`)).size).toBe(90);
    expect(data.goalLogs).toHaveLength(30);
    // newest log first, as the goals page expects
    expect(data.goalLogs[0].date).toBe("2026-09-30");
    const score = scorePeriod(data, "2026-09-01", "2026-09-30", "2026-09-30");
    expect(score.expectedTasks).toBe(90);
    expect(score.doneTasks).toBe(60);
  });
});
