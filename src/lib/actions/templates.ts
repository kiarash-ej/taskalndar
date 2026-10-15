"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "../auth";
import { formatClock, parseClockRange, parseTagFields, parseTitle } from "../blocks";
import { formValues, GENERIC_ERROR, type FormState } from "../form-state";
import { createClient } from "../supabase/server";

const SIGNED_OUT = "ابتدا وارد حساب خود شوید.";
const MAX_NAME = 100;

function parseName(formData: FormData): string | null {
  const name = String(formData.get("name") ?? "").trim();
  return name.length > 0 && name.length <= MAX_NAME ? name : null;
}

export async function createTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["name"]);
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT, values };
  const name = parseName(formData);
  if (!name) return { error: "نام تمپلیت را بنویسید (حداکثر ۱۰۰ نویسه).", values };

  const supabase = await createClient();
  const { error } = await supabase.from("day_templates").insert({ user_id: user.id, name });
  if (error) return { error: GENERIC_ERROR, values };

  refresh();
  return {};
}

export async function renameTemplate(templateId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["name"]);
  const name = parseName(formData);
  if (!name) return { error: "نام تمپلیت را بنویسید (حداکثر ۱۰۰ نویسه).", values };

  const supabase = await createClient();
  const { error } = await supabase.from("day_templates").update({ name }).eq("id", templateId);
  if (error) return { error: GENERIC_ERROR, values };

  refresh();
  return {};
}

// Its blocks go with it (on delete cascade). Days it was applied to keep theirs.
export async function deleteTemplate(templateId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("day_templates").delete().eq("id", templateId);
  if (error) return { error: GENERIC_ERROR };
  refresh();
  return {};
}

export async function addTemplateBlock(templateId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = { ...formValues(formData, ["title", "start", "end", "tag_draft"]), tags: parseTagFields(formData).join(",") };
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT, values };
  const title = parseTitle(formData);
  if (!title) return { error: "عنوان جعبه را بنویسید (حداکثر ۲۰۰ نویسه).", values };
  const range = parseClockRange(formData);
  if ("error" in range) return { error: range.error, values };

  const supabase = await createClient();
  const { error } = await supabase.from("day_template_blocks").insert({
    template_id: templateId,
    user_id: user.id,
    start_time: formatClock(range.start),
    end_time: formatClock(range.end),
    title,
    tags: parseTagFields(formData),
  });
  if (error) return { error: GENERIC_ERROR, values };

  refresh();
  return {};
}

export async function deleteTemplateBlock(blockId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("day_template_blocks").delete().eq("id", blockId);
  if (error) return { error: GENERIC_ERROR };
  refresh();
  return {};
}
