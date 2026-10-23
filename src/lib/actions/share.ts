"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "../auth";
import { todayIso } from "../dates";
import { GENERIC_ERROR } from "../form-state";
import { decodeShare, type SharedTemplate } from "../share";
import { createClient } from "../supabase/server";

const SIGNED_OUT = "ابتدا وارد حساب خود شوید.";

// What the user ticked on the import page: which templates (by position in
// the code, with the name they gave each), whether to use the shared sleep
// schedule, and which tasks.
export interface ImportChoice {
  templates: { index: number; name: string }[];
  sleep: boolean;
  tasks: number[];
}

export interface ImportResult {
  error?: string;
  added?: { templates: number; sleep: boolean; tasks: number };
}

// Adds the chosen parts of a shared code to the user's own account. The code
// is decoded and checked again here; the page's preview is never trusted.
export async function importShared(code: string, choice: ImportChoice): Promise<ImportResult> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };
  const decoded = decodeShare(code);
  if ("error" in decoded) return { error: decoded.error };
  const { pack } = decoded;

  const templates: SharedTemplate[] = [];
  for (const { index, name } of choice.templates) {
    const template = pack.templates[index];
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!template || !trimmed || trimmed.length > 100) return { error: "نام تمپلیت را بنویسید (حداکثر ۱۰۰ نویسه)." };
    templates.push({ ...template, name: trimmed });
  }
  const tasks = choice.tasks.map((i) => pack.tasks[i]);
  if (tasks.some((t) => !t)) return { error: GENERIC_ERROR };
  const sleep = choice.sleep && pack.sleep.length > 0;
  if (templates.length === 0 && tasks.length === 0 && !sleep) return { error: "چیزی برای افزودن انتخاب نشده." };

  const supabase = await createClient();

  for (const template of templates) {
    const { data: row, error } = await supabase
      .from("day_templates")
      .insert({ user_id: user.id, name: template.name })
      .select("id")
      .single();
    if (error) return { error: GENERIC_ERROR };
    if (template.blocks.length > 0) {
      const { error: blocksError } = await supabase.from("day_template_blocks").insert(
        template.blocks.map((b) => ({
          template_id: row.id,
          user_id: user.id,
          start_time: b.start,
          end_time: b.end,
          title: b.title,
          tags: b.tags,
        })),
      );
      if (blocksError) {
        // don't leave an empty template behind
        await supabase.from("day_templates").delete().eq("id", row.id);
        return { error: GENERIC_ERROR };
      }
    }
  }

  if (sleep) {
    const { error } = await supabase.rpc("save_sleep_schedule", {
      p_weekdays: pack.sleep.map((n) => n.weekday),
      p_bedtimes: pack.sleep.map((n) => n.bed),
      p_wake_times: pack.sleep.map((n) => n.wake),
    });
    if (error) return { error: GENERIC_ERROR };
  }

  if (tasks.length > 0) {
    // repeating tasks from today, like ones made in the planner
    const date = todayIso();
    const { error } = await supabase.from("tasks").insert(
      tasks.map((t) => ({ user_id: user.id, title: t.title, is_recurring: true, weekdays: t.weekdays, date })),
    );
    if (error) return { error: GENERIC_ERROR };
  }

  refresh();
  return { added: { templates: templates.length, sleep, tasks: tasks.length } };
}
