"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "../auth";
import { isIsoDate, todayIso } from "../dates";
import { formValues, GENERIC_ERROR, type FormState } from "../form-state";
import { createClient } from "../supabase/server";

const MAX_TITLE = 200;

function parseTitle(formData: FormData): string | null {
  const title = String(formData.get("title") ?? "").trim();
  return title.length > 0 && title.length <= MAX_TITLE ? title : null;
}

// "recurring" (every day from `date` on) or "once" (only on `date`)
function parseRecurring(formData: FormData): boolean {
  return formData.get("kind") !== "once";
}

export async function createTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["title", "kind"]);
  const user = await getCurrentUser();
  if (!user) return { error: "ابتدا وارد حساب خود شوید.", values };

  const title = parseTitle(formData);
  const date = formData.get("date");
  if (!title) return { error: "عنوان کار را بنویسید (حداکثر ۲۰۰ نویسه).", values };
  if (!isIsoDate(date)) return { error: GENERIC_ERROR, values };

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    user_id: user.id,
    title,
    is_recurring: parseRecurring(formData),
    date,
  });
  if (error) return { error: GENERIC_ERROR, values };

  refresh();
  return { values: { kind: values.kind } };
}

export async function updateTask(
  taskId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData, ["title", "kind"]);
  const title = parseTitle(formData);
  const day = formData.get("day");
  const user = await getCurrentUser();
  if (!user) return { error: "ابتدا وارد حساب خود شوید.", values };
  if (!title) return { error: "عنوان کار را بنویسید (حداکثر ۲۰۰ نویسه).", values };
  if (!isIsoDate(day)) return { error: GENERIC_ERROR, values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_task_schedule", {
    p_task_id: taskId,
    p_title: title,
    p_is_recurring: parseRecurring(formData),
    p_effective_date: day,
  });
  if (error) return { error: GENERIC_ERROR, values };

  refresh();
  return {};
}

// A recurring task that has already been running is archived rather than
// deleted, so the days it was on the checklist keep their history; it stops
// appearing from today on. Anything else is deleted outright.
export async function deleteTask(taskId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("is_recurring, date, archived_at")
    .eq("id", taskId)
    .single();
  if (!task) return { error: GENERIC_ERROR };
  // Historical schedule versions must keep their original cutoff. Deleting
  // one again from a past calendar day must not resurrect its later days.
  if (task.archived_at !== null) return {};

  const keepHistory = task.is_recurring && task.date < todayIso();
  const { error } = keepHistory
    ? await supabase.from("tasks").update({ archived_at: new Date().toISOString() }).eq("id", taskId)
    : await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { error: GENERIC_ERROR };

  refresh();
  return {};
}

export async function setTaskDone(
  taskId: string,
  date: string,
  done: boolean,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "ابتدا وارد حساب خود شوید." };
  if (!isIsoDate(date) || date > todayIso()) {
    return { error: "کارهای روزهای آینده را نمی‌شود از قبل تیک زد." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_completions")
    .upsert({ task_id: taskId, user_id: user.id, date, done }, { onConflict: "task_id,date" });
  if (error) return { error: GENERIC_ERROR };

  refresh();
  return {};
}
