"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "../auth";
import { parseSendTime } from "../channels";
import { formValues, GENERIC_ERROR, type FormState } from "../form-state";
import { isBotKind } from "../messaging/bots";
import { botTokens } from "../messaging/config";
import { createClient } from "../supabase/server";

const SIGNED_OUT = "ابتدا وارد حساب خود شوید.";
const NOT_AVAILABLE = "ارسال به این پیام‌رسان روی این سرور فعال نیست.";

// Creates the channel row; the database fills in a fresh link code (30
// minutes). With `replace`, an existing row of that messenger is removed
// first: that's how a user gets a new code or re-links another chat.
export async function connectChannel(kind: string, replace = false): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };
  if (!isBotKind(kind) || !botTokens()[kind]) return { error: NOT_AVAILABLE };

  const supabase = await createClient();
  if (replace) {
    const { error } = await supabase.from("notification_channels").delete().eq("user_id", user.id).eq("kind", kind);
    if (error) return { error: GENERIC_ERROR };
  }
  const { error } = await supabase.from("notification_channels").insert({ user_id: user.id, kind });
  if (error) return { error: GENERIC_ERROR };

  refresh();
  return {};
}

export async function disconnectChannel(channelId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("notification_channels").delete().eq("id", channelId);
  if (error) return { error: GENERIC_ERROR };
  refresh();
  return {};
}

// Only the columns users may write (A's column privileges): on/off, send
// time and what the message includes.
export async function saveChannelSettings(
  channelId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData, ["send_time"]);
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT, values };

  const sendTime = parseSendTime(formData.get("send_time"));
  if (!sendTime) return { error: "ساعت ارسال را از فهرست انتخاب کنید.", values };
  const include = {
    include_tasks: formData.get("include_tasks") === "on",
    include_blocks: formData.get("include_blocks") === "on",
    include_note: formData.get("include_note") === "on",
  };
  if (!include.include_tasks && !include.include_blocks && !include.include_note) {
    return { error: "دست‌کم یک بخش را برای پیام انتخاب کنید.", values };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_channels")
    .update({ enabled: formData.get("enabled") === "on", send_time: sendTime, ...include })
    .eq("id", channelId);
  if (error) return { error: GENERIC_ERROR, values };

  refresh();
  return { message: "تنظیمات ارسال ذخیره شد." };
}
