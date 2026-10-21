"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "../auth";
import { formatClock, MINUTES_PER_DAY, minutesOfTime, parseClock } from "../blocks";
import { isIsoDate, weekdayIndex } from "../dates";
import { GENERIC_ERROR, type FormState } from "../form-state";
import {
  MAX_SLEEP_MINUTES,
  MIN_SLEEP_MINUTES,
  parseSleepForm,
  plannedNight,
  sleepMinutes,
} from "../sleep";
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

// The user's answer "yes" to a sleep question: puts the night on the
// planner, replacing whatever it had. With `times` ("HH:MM" bedtime and wake
// time the user typed) those are used; otherwise the phone's proposal for the
// night, or else the schedule.
export async function acceptSleepSuggestion(
  night: string,
  times?: { bed: string; wake: string },
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };
  if (!isIsoDate(night)) return { error: GENERIC_ERROR };

  const supabase = await createClient();
  let span: { bedAt: Date; wakeAt: Date };
  if (times) {
    const bedtime = parseClock(times.bed);
    const wake = parseClock(times.wake);
    if (bedtime === null || wake === null || bedtime === MINUTES_PER_DAY || wake === MINUTES_PER_DAY) {
      return { error: "ساعت خواب و بیداری را وارد کنید." };
    }
    const length = sleepMinutes(bedtime, wake);
    if (length < MIN_SLEEP_MINUTES || length > MAX_SLEEP_MINUTES) return { error: "خواب باید بین ۱ تا ۱۶ ساعت باشد." };
    span = plannedNight(night, { bedtime, wake });
  } else {
    const [proposal, plan] = await Promise.all([
      supabase.from("sleep_proposals").select("bed_at, wake_at").eq("user_id", user.id).eq("night", night).maybeSingle(),
      supabase
        .from("sleep_schedules")
        .select("bedtime, wake_time")
        .eq("user_id", user.id)
        .eq("weekday", weekdayIndex(night))
        .maybeSingle(),
    ]);
    if (proposal.error || plan.error) return { error: GENERIC_ERROR };
    if (proposal.data) {
      span = { bedAt: new Date(proposal.data.bed_at), wakeAt: new Date(proposal.data.wake_at) };
    } else if (plan.data) {
      span = plannedNight(night, {
        bedtime: minutesOfTime(plan.data.bedtime),
        wake: minutesOfTime(plan.data.wake_time),
      });
    } else {
      return { error: "برای این شب پیشنهادی نیست. ساعت را خودتان وارد کنید." };
    }
  }

  const { error } = await supabase.rpc("set_sleep_night", {
    p_user: user.id,
    p_night: night,
    p_bed_at: span.bedAt.toISOString(),
    p_wake_at: span.wakeAt.toISOString(),
  });
  if (error) return { error: GENERIC_ERROR };
  // answered: the phone's question for this night is done
  await supabase.from("sleep_proposals").delete().eq("user_id", user.id).eq("night", night);
  refresh();
  return {};
}

// The user's answer "no": the phone's proposal is dropped, and the schedule
// doesn't suggest this night again.
export async function skipSleepSuggestion(night: string, from: "schedule" | "phone"): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };
  if (!isIsoDate(night)) return { error: GENERIC_ERROR };

  const supabase = await createClient();
  const { error } =
    from === "phone"
      ? await supabase.from("sleep_proposals").delete().eq("user_id", user.id).eq("night", night)
      : await supabase
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
