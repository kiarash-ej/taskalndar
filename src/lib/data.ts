import type { ChannelRow } from "./channels";
import type { Tables } from "./database.types";
import type { IsoDate } from "./dates";
import type { BlockRow } from "./report";
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
      .select("id, title, is_recurring, date, weekdays, archived_at")
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
      .select("id, title, target_value, unit, period, start_date, created_at, archived_at")
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

// The user's note for one day: "" when none was written yet, null when the
// read failed. Callers must not autosave over a failed read, or the empty
// editor would replace the stored note.
export async function loadDailyNote(userId: string, day: IsoDate): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_notes")
    .select("body")
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle();
  if (error) return null;
  return data?.body ?? "";
}

// The user's time blocks on the days from..to (both inclusive), in time order:
// the input of the monthly report (filterBlocks).
export async function loadTimeBlocks(userId: string, from: IsoDate, to: IsoDate): Promise<BlockRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_blocks")
    .select("id, day, start_at, end_at, title, description, tags, amount, unit, cost, done")
    .eq("user_id", userId)
    .gte("day", from)
    .lte("day", to)
    .order("start_at");
  if (error) throw new Error(error.message);
  return data;
}

export type TemplateBlockRow = Pick<
  Tables<"day_template_blocks">,
  "id" | "template_id" | "start_time" | "end_time" | "title" | "tags"
>;

export interface DayTemplate {
  id: string;
  name: string;
  // by start time
  blocks: TemplateBlockRow[];
}

// The user's day templates by name, each with its blocks.
export async function loadTemplates(userId: string): Promise<DayTemplate[]> {
  const supabase = await createClient();
  const [templates, blocks] = await Promise.all([
    supabase.from("day_templates").select("id, name").eq("user_id", userId).order("name"),
    supabase
      .from("day_template_blocks")
      .select("id, template_id, start_time, end_time, title, tags")
      .eq("user_id", userId)
      .order("start_time"),
  ]);
  if (templates.error) throw new Error(templates.error.message);
  if (blocks.error) throw new Error(blocks.error.message);
  return templates.data.map((t) => ({
    ...t,
    blocks: blocks.data.filter((b) => b.template_id === t.id),
  }));
}

// The user's tags, most used first, for autocomplete. Suggestions are a
// convenience, so a failed read just means none.
export async function loadUserTags(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("user_tags");
  return (data ?? []).map((row) => row.tag);
}

// The user's daily-summary channels; null when the read failed, so the
// settings page can say so instead of offering to connect again.
export async function loadChannels(userId: string): Promise<ChannelRow[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_channels")
    .select(
      "id, kind, link_code, link_code_expires_at, linked_at, enabled, send_time, include_tasks, include_blocks, include_note, last_sent_on",
    )
    .eq("user_id", userId)
    .order("kind");
  return error ? null : data;
}
