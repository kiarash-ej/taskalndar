"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "../auth";
import { isIsoDate, todayIso } from "../dates";
import { formValues, GENERIC_ERROR, type FormState } from "../form-state";
import { parseSchedule, scheduleIncludes } from "../schedule";
import { createClient } from "../supabase/server";

const MAX_TITLE = 200;

function parseTitle(formData: FormData): string | null {
  const title = String(formData.get("title") ?? "").trim();
  return title.length > 0 && title.length <= MAX_TITLE ? title : null;
}

const NO_WEEKDAYS_ERROR = "دست‌کم یک روز هفته را انتخاب کنید.";

export async function createTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["title", "kind"]);
  const user = await getCurrentUser();
  if (!user) return { error: "ابتدا وارد حساب خود شوید.", values };

  const title = parseTitle(formData);
  const date = formData.get("date");
  const schedule = parseSchedule(formData);
  if (!title) return { error: "عنوان کار را بنویسید (حداکثر ۲۰۰ نویسه).", values };
  if (!isIsoDate(date)) return { error: GENERIC_ERROR, values };
  if (!schedule) return { error: NO_WEEKDAYS_ERROR, values };

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    user_id: user.id,
    title,
    is_recurring: schedule.is_recurring,
    weekdays: schedule.weekdays,
    date,
  });
  if (error) return { error: GENERIC_ERROR, values };

  refresh();
  return {
    values: { kind: values.kind },
    // the new task won't be on this day's checklist, so say where it went
    message: scheduleIncludes(schedule, date)
      ? undefined
      : "کار ثبت شد و از این روز به بعد در روزهای انتخاب‌شده نمایش داده می‌شود.",
  };
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
  const schedule = parseSchedule(formData);
  if (!title) return { error: "عنوان کار را بنویسید (حداکثر ۲۰۰ نویسه).", values };
  if (!isIsoDate(day)) return { error: GENERIC_ERROR, values };
  if (!schedule) return { error: NO_WEEKDAYS_ERROR, values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_task_schedule", {
    p_task_id: taskId,
    p_title: title,
    p_is_recurring: schedule.is_recurring,
    // omitted (not null) for every day / one-time: the argument defaults to null
    p_weekdays: schedule.weekdays ?? undefined,
    p_effective_date: day,
  });
  if (error) return { error: GENERIC_ERROR, values };

  refresh();
  return {};
}

// Ends a task from the planner (delete_task, supabase/migrations/*_future_task_cutoffs.sql):
// one that hasn't started is removed; one that has is archived today, keeping
// its history; an ended historical version keeps its cutoff. Any replacement
// still waiting to start goes with it, so no schedule lives on unseen.
export async function deleteTask(taskId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "ابتدا وارد حساب خود شوید." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_task", { p_task_id: taskId });
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
