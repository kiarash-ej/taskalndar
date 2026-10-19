import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { tasksForDay } from "../scoring";
import { isBotKind } from "./bots";
import type { DueChannel, SummarySource } from "./daily";
import type { ReminderChat, ReminderSource } from "./reminders";

// SummarySource backed by the service-role client. RLS doesn't apply to it,
// so every query filters by user_id explicitly.
export function supabaseSummarySource(supabase: SupabaseClient<Database>): SummarySource {
  return {
    async linkedChannels() {
      const { data, error } = await supabase
        .from("notification_channels")
        .select("id, user_id, kind, chat_id, send_time, last_sent_on, include_tasks, include_blocks, include_note")
        .eq("enabled", true)
        .not("chat_id", "is", null);
      if (error) throw new Error(error.message);
      return data.filter((c): c is DueChannel => isBotKind(c.kind) && c.chat_id !== null);
    },

    async dayData(userId, day) {
      const [tasks, completions, blocks, note] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, is_recurring, date, weekdays, archived_at")
          .eq("user_id", userId)
          .lte("date", day)
          .order("created_at"),
        supabase.from("task_completions").select("task_id, done").eq("user_id", userId).eq("date", day),
        supabase
          .from("time_blocks")
          .select("start_at, end_at, title, description, tags, cost")
          .eq("user_id", userId)
          .eq("day", day)
          .order("start_at"),
        supabase.from("daily_notes").select("body").eq("user_id", userId).eq("day", day).maybeSingle(),
      ]);
      for (const result of [tasks, completions, blocks, note]) {
        if (result.error) throw new Error(result.error.message);
      }
      const done = new Set((completions.data ?? []).filter((c) => c.done).map((c) => c.task_id));
      return {
        tasks: tasksForDay(tasks.data ?? [], day).map((t) => ({ title: t.title, done: done.has(t.id) })),
        blocks: blocks.data ?? [],
        note: note.data?.body ?? null,
      };
    },

    async markSent(channelId, day) {
      const { error } = await supabase
        .from("notification_channels")
        .update({ last_sent_on: day })
        .eq("id", channelId);
      if (error) throw new Error(error.message);
    },
  };
}

// ReminderSource backed by the service-role client.
export function supabaseReminderSource(supabase: SupabaseClient<Database>): ReminderSource {
  return {
    async claimDue() {
      const { data, error } = await supabase.rpc("claim_due_reminders");
      if (error) throw new Error(error.message);
      return data;
    },

    async chatsFor(userIds) {
      const { data, error } = await supabase
        .from("notification_channels")
        .select("user_id, kind, chat_id")
        .in("user_id", userIds)
        .not("chat_id", "is", null);
      if (error) throw new Error(error.message);
      return data.filter((c): c is ReminderChat => isBotKind(c.kind) && c.chat_id !== null);
    },

    async release(blockIds) {
      const { error } = await supabase.from("time_blocks").update({ reminded_at: null }).in("id", blockIds);
      if (error) throw new Error(error.message);
    },
  };
}
