import type { IsoDate } from "./dates";
import type { ProgressData } from "./scoring";
import { createClient } from "./supabase/server";

// RLS already limits every query to the signed-in user's rows; the explicit
// user_id filters let Postgres use the (user_id, date) indexes.

// All of the user's tasks and goals (archived ones too: they still count for
// the days they were active), plus completions and goal logs between from..to.
export async function loadProgressData(
  userId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<ProgressData> {
  const supabase = await createClient();
  const [tasks, completions, goals, goalLogs] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, is_recurring, date, archived_at")
      .eq("user_id", userId)
      .order("created_at"),
    supabase
      .from("task_completions")
      .select("task_id, date, done")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", to),
    supabase
      .from("goals")
      .select("id, title, target_value, unit, start_date, created_at, archived_at")
      .eq("user_id", userId)
      .order("created_at"),
    supabase
      .from("goal_logs")
      .select("id, goal_id, date, amount")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false }),
  ]);

  for (const result of [tasks, completions, goals, goalLogs]) {
    if (result.error) throw new Error(result.error.message);
  }
  return {
    tasks: tasks.data ?? [],
    completions: completions.data ?? [],
    goals: goals.data ?? [],
    goalLogs: goalLogs.data ?? [],
  };
}
