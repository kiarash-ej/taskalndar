"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "../auth";
import { formatClock, minutesOfTime } from "../blocks";
import { isIsoDate, weekdayIndex } from "../dates";
import { GENERIC_ERROR, type FormState } from "../form-state";
import { parseSleepForm, plannedNight } from "../sleep";
import { hashHookToken, newHookToken } from "../sleep-hook";
import { createClient } from "../supabase/server";

const SIGNED_OUT = "ابتدا وارد حساب خود شوید.";

// Replaces the weekly schedule. The planner suggests nights from it; nights
// already accepted keep their blocks.
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
        : "برنامهٔ خواب ذخیره شد. هر شب در برنامهٔ روزانه پیشنهاد می‌شود تا تأییدش کنید.",
  };
}

// Puts a suggested night on the planner, from the schedule as it is now.
// A night already there is left alone.
export async function acceptSleepSuggestion(night: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };
  if (!isIsoDate(night)) return { error: GENERIC_ERROR };

  const supabase = await createClient();
  const [plan, existing] = await Promise.all([
    supabase
      .from("sleep_schedules")
      .select("bedtime, wake_time")
      .eq("user_id", user.id)
      .eq("weekday", weekdayIndex(night))
      .maybeSingle(),
    supabase.from("time_blocks").select("id").eq("user_id", user.id).eq("sleep_night", night).limit(1),
  ]);
  if (plan.error || existing.error) return { error: GENERIC_ERROR };
  if (!plan.data) return { error: "برای این شب برنامهٔ خوابی نیست." };
  if (existing.data.length > 0) {
    refresh();
    return {};
  }

  const { bedAt, wakeAt } = plannedNight(night, {
    bedtime: minutesOfTime(plan.data.bedtime),
    wake: minutesOfTime(plan.data.wake_time),
  });
  const { error } = await supabase.rpc("set_sleep_night", {
    p_user: user.id,
    p_night: night,
    p_bed_at: bedAt.toISOString(),
    p_wake_at: wakeAt.toISOString(),
  });
  if (error) return { error: GENERIC_ERROR };
  refresh();
  return {};
}

// "نه" on a suggested night: it isn't offered again.
export async function skipSleepSuggestion(night: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };
  if (!isIsoDate(night)) return { error: GENERIC_ERROR };

  const supabase = await createClient();
  const { error } = await supabase
    .from("sleep_skips")
    .upsert({ user_id: user.id, night }, { onConflict: "user_id,night", ignoreDuplicates: true });
  if (error) return { error: GENERIC_ERROR };
  refresh();
  return {};
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
