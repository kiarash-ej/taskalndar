"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "../auth";
import { isIsoDate, todayIso } from "../dates";
import { formValues, GENERIC_ERROR, type FormState } from "../form-state";
import { parseLocalizedNumber } from "../format";
import { createClient } from "../supabase/server";

function parsePositive(value: FormDataEntryValue | null): number | null {
  const n = parseLocalizedNumber(String(value ?? ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function createGoal(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["title", "target_value", "unit"]);
  const user = await getCurrentUser();
  if (!user) return { error: "ابتدا وارد حساب خود شوید.", values };

  const title = values.title.trim();
  const unit = values.unit.trim();
  const target = parsePositive(values.target_value);
  if (!title || title.length > 200) return { error: "عنوان هدف را بنویسید.", values };
  if (target === null) return { error: "مقدار هدف باید عددی بزرگ‌تر از صفر باشد.", values };
  if (!unit || unit.length > 40) return { error: "واحد هدف را بنویسید (مثلاً کیلومتر).", values };

  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .insert({ user_id: user.id, title, target_value: target, unit, period: "monthly" });
  if (error) return { error: GENERIC_ERROR, values };

  refresh();
  return {};
}

export async function logGoalProgress(
  goalId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData, ["amount", "date"]);
  const user = await getCurrentUser();
  if (!user) return { error: "ابتدا وارد حساب خود شوید.", values };

  const amount = parsePositive(values.amount);
  if (amount === null) return { error: "مقدار باید عددی بزرگ‌تر از صفر باشد.", values };
  if (!isIsoDate(values.date) || values.date > todayIso()) {
    return { error: "تاریخ معتبری انتخاب کنید (امروز یا قبل از آن).", values };
  }

  const supabase = await createClient();
  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("start_date, archived_at")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .single();
  if (goalError || !goal) return { error: GENERIC_ERROR, values };
  if (goal.archived_at !== null) return { error: "هدف بایگانی شده است.", values };
  if (values.date < goal.start_date) {
    return { error: "تاریخ ثبت پیشرفت نمی‌تواند قبل از شروع هدف باشد.", values };
  }
  const { error } = await supabase
    .from("goal_logs")
    .insert({ goal_id: goalId, user_id: user.id, date: values.date, amount });
  if (error) return { error: GENERIC_ERROR, values };

  refresh();
  return { values: { date: values.date } };
}

export async function deleteGoalLog(logId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("goal_logs").delete().eq("id", logId);
  if (error) return { error: GENERIC_ERROR };
  refresh();
  return {};
}

// Archived goals leave the goals page but keep counting for the days they were active.
export async function archiveGoal(goalId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", goalId)
    .is("archived_at", null);
  if (error) return { error: GENERIC_ERROR };
  refresh();
  return {};
}
