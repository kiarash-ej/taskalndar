"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "../auth";
import { GENERIC_ERROR, type FormState } from "../form-state";
import { parseReminderSettingsForm } from "../reminders";
import { createClient } from "../supabase/server";

export async function saveReminderSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "ابتدا وارد حساب خود شوید." };
  const settings = parseReminderSettingsForm(formData);
  if ("error" in settings) return { error: settings.error, values: { lead_minutes: String(formData.get("lead_minutes") ?? "") } };

  const supabase = await createClient();
  const { error } = await supabase.from("reminder_settings").upsert(
    {
      user_id: user.id,
      enabled: settings.enabled,
      lead_minutes: settings.leadMinutes,
      include_sleep: settings.includeSleep,
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: GENERIC_ERROR };

  refresh();
  return { message: settings.enabled ? "تنظیمات یادآوری ذخیره شد." : "یادآوری‌ها خاموش شد." };
}
