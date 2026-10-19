"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "../auth";
import { formatClock } from "../blocks";
import { GENERIC_ERROR, type FormState } from "../form-state";
import { parseSleepForm } from "../sleep";
import { hashHookToken, newHookToken } from "../sleep-hook";
import { createClient } from "../supabase/server";

const SIGNED_OUT = "ابتدا وارد حساب خود شوید.";

// Replaces the weekly schedule. Upcoming nights the user hasn't edited are
// planned again from it; the planner creates them on its next load.
export async function saveSleepSchedule(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };
  const plans = parseSleepForm(formData);
  if ("error" in plans) return { error: plans.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_sleep_schedule", {
    p_weekdays: plans.map((p) => p.weekday),
    p_bedtimes: plans.map((p) => formatClock(p.bedtime)),
    p_wake_times: plans.map((p) => formatClock(p.wake)),
  });
  if (error) return { error: GENERIC_ERROR };

  refresh();
  return {
    message:
      plans.length === 0
        ? "برنامهٔ خواب خاموش شد."
        : "برنامهٔ خواب ذخیره شد و از امشب در برنامهٔ روزانه چیده می‌شود.",
  };
}

// A new secret for the phone link, shown once; any earlier link stops working.
export async function createSleepPhoneLink(): Promise<{ token?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };
  const token = newHookToken();

  const supabase = await createClient();
  const { error } = await supabase
    .from("sleep_settings")
    .upsert({ user_id: user.id, hook_token_hash: hashHookToken(token) }, { onConflict: "user_id" });
  if (error) return { error: GENERIC_ERROR };

  refresh();
  return { token };
}

export async function deleteSleepPhoneLink(): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };

  const supabase = await createClient();
  const { error } = await supabase
    .from("sleep_settings")
    .update({ hook_token_hash: null })
    .eq("user_id", user.id);
  if (error) return { error: GENERIC_ERROR };

  refresh();
  return {};
}
