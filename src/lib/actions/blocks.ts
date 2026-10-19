"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "../auth";
import { clockOf, clockToInstant, formatClock, parseBlockForm, parseTagFields, type BlockFields } from "../blocks";
import { isIsoDate } from "../dates";
import { formValues, GENERIC_ERROR, type FormState } from "../form-state";
import { parseBlockReminder, type BlockReminder } from "../reminders";
import { createClient } from "../supabase/server";

const SIGNED_OUT = "ابتدا وارد حساب خود شوید.";
const BLOCK_FIELDS = [
  "title", "start", "end", "description", "amount", "unit", "cost", "tag_draft", "reminder", "reminder_minutes",
];

// What a failed submit gives back to the form, tag chips included.
function blockValues(formData: FormData): Record<string, string> {
  return { ...formValues(formData, BLOCK_FIELDS), tags: parseTagFields(formData).join(",") };
}

function blockRow(day: string, fields: BlockFields, reminder: BlockReminder) {
  return {
    ...reminder,
    day,
    start_at: clockToInstant(day, fields.start),
    end_at: clockToInstant(day, fields.end),
    title: fields.title,
    description: fields.description,
    tags: fields.tags,
    amount: fields.amount,
    unit: fields.unit,
    cost: fields.cost,
  };
}

export async function createBlock(day: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = blockValues(formData);
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT, values };
  if (!isIsoDate(day)) return { error: GENERIC_ERROR, values };
  const fields = parseBlockForm(formData);
  if ("error" in fields) return { error: fields.error, values };
  const reminder = parseBlockReminder(formData);
  if ("error" in reminder) return { error: reminder.error, values };

  const supabase = await createClient();
  const { error } = await supabase.from("time_blocks").insert({ user_id: user.id, ...blockRow(day, fields, reminder) });
  if (error) return { error: GENERIC_ERROR, values };

  refresh();
  return {};
}

export async function updateBlock(
  blockId: string,
  day: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = blockValues(formData);
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT, values };
  if (!isIsoDate(day)) return { error: GENERIC_ERROR, values };
  const fields = parseBlockForm(formData);
  if ("error" in fields) return { error: fields.error, values };
  const reminder = parseBlockReminder(formData);
  if ("error" in reminder) return { error: reminder.error, values };

  const supabase = await createClient();
  const { error } = await supabase.from("time_blocks").update(blockRow(day, fields, reminder)).eq("id", blockId);
  if (error) return { error: GENERIC_ERROR, values };

  refresh();
  return {};
}

export async function deleteBlock(blockId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("time_blocks").delete().eq("id", blockId);
  if (error) return { error: GENERIC_ERROR };
  refresh();
  return {};
}

export async function setBlockDone(blockId: string, done: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("time_blocks").update({ done }).eq("id", blockId);
  if (error) return { error: GENERIC_ERROR };
  refresh();
  return {};
}

// Copies the template's blocks onto the day. Applying twice adds them twice;
// the UI confirms first when the day already has blocks.
export async function applyTemplate(templateId: string, day: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };
  if (!isIsoDate(day)) return { error: GENERIC_ERROR };

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_day_template", { p_template_id: templateId, p_day: day });
  if (error) return { error: GENERIC_ERROR };
  refresh();
  return {};
}

// Saves the day's blocks (times, titles and tags) as a new named template.
export async function saveDayAsTemplate(day: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["name"]);
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT, values };
  if (!isIsoDate(day)) return { error: GENERIC_ERROR, values };
  const name = values.name.trim();
  if (!name || name.length > 100) return { error: "نام تمپلیت را بنویسید (حداکثر ۱۰۰ نویسه).", values };

  const supabase = await createClient();
  const { data: blocks, error: readError } = await supabase
    .from("time_blocks")
    .select("start_at, end_at, title, tags")
    .eq("user_id", user.id)
    .eq("day", day)
    // the sleep schedule already puts those on every day
    .neq("source", "sleep")
    .order("start_at");
  if (readError) return { error: GENERIC_ERROR, values };
  if (blocks.length === 0) return { error: "این روز جعبه‌ای ندارد که در تمپلیت ذخیره شود.", values };

  const { data: template, error: templateError } = await supabase
    .from("day_templates")
    .insert({ user_id: user.id, name })
    .select("id")
    .single();
  if (templateError) return { error: GENERIC_ERROR, values };

  const { error } = await supabase.from("day_template_blocks").insert(
    blocks.map((b) => ({
      template_id: template.id,
      user_id: user.id,
      start_time: formatClock(clockOf(day, b.start_at)),
      end_time: formatClock(clockOf(day, b.end_at)),
      title: b.title,
      tags: b.tags,
    })),
  );
  if (error) {
    // don't leave an empty template behind
    await supabase.from("day_templates").delete().eq("id", template.id);
    return { error: GENERIC_ERROR, values };
  }

  refresh();
  return { message: `تمپلیت «${name}» ذخیره شد.` };
}
