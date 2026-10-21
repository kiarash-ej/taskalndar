import { formatClock, minutesOfTime } from "./blocks";
import type { ChannelRow } from "./channels";
import type { Tables } from "./database.types";
import { addDays, type IsoDate } from "./dates";
import { DEFAULT_REMINDER_SETTINGS, type ReminderSettings } from "./reminders";
import { selectAll } from "./paginate";
import type { BlockRow } from "./report";
import type { ProgressData } from "./scoring";
import type { SharePack } from "./share";
import { sleepSuggestionsFor, type SleepPlan, type SleepSuggestion } from "./sleep";
import { createClient } from "./supabase/server";

// RLS already limits every query to the signed-in user's rows; the explicit
// user_id filters let Postgres use the (user_id, date) indexes.

// All of the user's tasks and goals (archived ones too: they still count for
// the days they were active), plus completions and goal logs between from..to.
// Every query is read in full (selectAll); each order ends in the unique id.
export async function loadProgressData(
  userId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<ProgressData> {
  const supabase = await createClient();
  const [tasks, completions, goals, goalLogs] = await Promise.all([
    selectAll((start, end) =>
      supabase
        .from("tasks")
        .select("id, title, is_recurring, date, weekdays, archived_at", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at")
        .order("id")
        .range(start, end),
    ),
    selectAll((start, end) =>
      supabase
        .from("task_completions")
        .select("task_id, date, done", { count: "exact" })
        .eq("user_id", userId)
        .gte("date", from)
        .lte("date", to)
        .order("date")
        .order("id")
        .range(start, end),
    ),
    selectAll((start, end) =>
      supabase
        .from("goals")
        .select("id, title, target_value, unit, period, start_date, created_at, archived_at", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at")
        .order("id")
        .range(start, end),
    ),
    selectAll((start, end) =>
      supabase
        .from("goal_logs")
        .select("id, goal_id, date, amount", { count: "exact" })
        .eq("user_id", userId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false })
        .order("id", { ascending: false })
        .range(start, end),
    ),
  ]);
  return { tasks, completions, goals, goalLogs };
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
  // a month of blocks can pass one response page too
  return selectAll((start, end) =>
    supabase
      .from("time_blocks")
      .select(
        "id, day, start_at, end_at, title, description, tags, amount, unit, cost, done, source, remind, reminder_minutes",
        { count: "exact" },
      )
      .eq("user_id", userId)
      .gte("day", from)
      .lte("day", to)
      .order("start_at")
      .order("id")
      .range(start, end),
  );
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

export interface SleepSettingsView {
  plans: SleepPlan[];
  hasPhoneLink: boolean;
}

async function loadSleepPlans(userId: string): Promise<SleepPlan[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sleep_schedules")
    .select("weekday, bedtime, wake_time")
    .eq("user_id", userId)
    .order("weekday");
  if (error) return null;
  return data.map((p) => ({ weekday: p.weekday, bedtime: minutesOfTime(p.bedtime), wake: minutesOfTime(p.wake_time) }));
}

// The user's weekly sleep schedule; null when it couldn't be read.
export async function loadSleepSettings(userId: string): Promise<SleepSettingsView | null> {
  const supabase = await createClient();
  const [plans, settings] = await Promise.all([
    loadSleepPlans(userId),
    supabase.from("sleep_settings").select("hook_token_hash").eq("user_id", userId).maybeSingle(),
  ]);
  if (!plans || settings.error) return null;
  return { plans, hasPhoneLink: !!settings.data?.hook_token_hash };
}

// The sleep nights to ask the user about on `day`: the phone's proposals and
// the schedule's suggestions. A failure just means no questions.
export async function loadSleepSuggestions(userId: string, day: IsoDate): Promise<SleepSuggestion[]> {
  const supabase = await createClient();
  const nights = [addDays(day, -1), day];
  const [plans, blocks, skips, proposals] = await Promise.all([
    loadSleepPlans(userId),
    supabase.from("time_blocks").select("sleep_night").eq("user_id", userId).in("sleep_night", nights),
    supabase.from("sleep_skips").select("night").eq("user_id", userId).in("night", nights),
    supabase.from("sleep_proposals").select("night, bed_at, wake_at").eq("user_id", userId).in("night", nights),
  ]);
  if (!plans || blocks.error || skips.error || proposals.error) return [];
  const settled = new Set([
    ...blocks.data.map((b) => b.sleep_night).filter((n): n is string => n !== null),
    ...skips.data.map((s) => s.night),
  ]);
  return sleepSuggestionsFor(
    day,
    plans,
    settled,
    new Date(),
    proposals.data.map((p) => ({ night: p.night, bedAt: p.bed_at, wakeAt: p.wake_at })),
  );
}

export interface ReminderSettingsView extends ReminderSettings {
  // a linked Bale/Telegram chat to send reminders to
  hasChat: boolean;
}

// The user's reminder settings; no row reads as the defaults.
export async function loadReminderSettings(userId: string): Promise<ReminderSettingsView | null> {
  const supabase = await createClient();
  const [settings, chats] = await Promise.all([
    supabase
      .from("reminder_settings")
      .select("enabled, lead_minutes, include_sleep")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("notification_channels").select("id").eq("user_id", userId).not("chat_id", "is", null),
  ]);
  if (settings.error || chats.error) return null;
  const row = settings.data;
  return {
    ...(row
      ? { enabled: row.enabled, leadMinutes: row.lead_minutes, includeSleep: row.include_sleep }
      : DEFAULT_REMINDER_SETTINGS),
    hasChat: chats.data.length > 0,
  };
}

// The user's reusable setup, for sharing (src/lib/share.ts): templates, the
// weekly sleep schedule and the repeating tasks still in use. Never personal
// records. null when it couldn't be read.
export async function loadShareable(userId: string): Promise<SharePack | null> {
  const supabase = await createClient();
  const [templates, plans, tasks] = await Promise.all([
    loadTemplates(userId).catch(() => null),
    loadSleepPlans(userId),
    supabase
      .from("tasks")
      .select("title, weekdays, archived_at")
      .eq("user_id", userId)
      .eq("is_recurring", true)
      .order("created_at"),
  ]);
  if (!templates || !plans || tasks.error) return null;
  const now = Date.now();
  return {
    v: 1,
    templates: templates.map((t) => ({
      name: t.name,
      blocks: t.blocks.map((b) => ({
        start: formatClock(minutesOfTime(b.start_time)),
        end: formatClock(minutesOfTime(b.end_time)),
        title: b.title,
        tags: b.tags,
      })),
    })),
    sleep: plans.map((p) => ({ weekday: p.weekday, bed: formatClock(p.bedtime), wake: formatClock(p.wake) })),
    // still running, one entry per title (a rescheduled task has one row per version)
    tasks: tasks.data
      .filter((t) => t.archived_at === null || Date.parse(t.archived_at) > now)
      .filter((t, i, all) => all.findIndex((o) => o.title === t.title) === i)
      .map((t) => ({ title: t.title, weekdays: t.weekdays })),
  };
}
