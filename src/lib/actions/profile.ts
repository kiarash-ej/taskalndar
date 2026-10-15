"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "../auth";
import {
  BACKGROUND_BUCKET,
  gradientById,
  IMAGE_TYPES,
  isHexColor,
  MAX_IMAGE_BYTES,
  type Background,
} from "../background";
import { GENERIC_ERROR, type FormState } from "../form-state";
import { createClient } from "../supabase/server";

function isOwnPath(path: string | null | undefined, userId: string): path is string {
  return !!path && path.startsWith(`${userId}/`);
}

export async function saveBackground(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "ابتدا وارد حساب خود شوید." };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("profiles")
    .select("background_kind, background_value")
    .eq("user_id", user.id)
    .maybeSingle();

  const kind = String(formData.get("kind") ?? "none");
  let next: Background;
  if (kind === "none") {
    next = { kind: "none", value: null };
  } else if (kind === "color") {
    const color = String(formData.get("color") ?? "");
    if (!isHexColor(color)) return { error: "رنگ انتخاب‌شده معتبر نیست." };
    next = { kind: "color", value: color.toLowerCase() };
  } else if (kind === "gradient") {
    const id = String(formData.get("gradient") ?? "");
    if (!gradientById(id)) return { error: "گرادیان انتخاب‌شده معتبر نیست." };
    next = { kind: "gradient", value: id };
  } else if (kind === "image") {
    const file = formData.get("image");
    if (file instanceof File && file.size > 0) {
      const ext = IMAGE_TYPES[file.type];
      if (!ext) return { error: "فقط تصویر JPG، PNG یا WebP پذیرفته می‌شود." };
      if (file.size > MAX_IMAGE_BYTES) return { error: "حجم تصویر باید حداکثر ۳ مگابایت باشد." };
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(BACKGROUND_BUCKET)
        .upload(path, file, { contentType: file.type });
      if (error) return { error: GENERIC_ERROR };
      next = { kind: "image", value: path };
    } else if (current?.background_kind === "image" && isOwnPath(current.background_value, user.id)) {
      return {}; // keep the image already in use
    } else {
      return { error: "یک تصویر انتخاب کنید." };
    }
  } else {
    return { error: GENERIC_ERROR };
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      background_kind: next.kind,
      background_value: next.value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    // don't leave an orphaned upload behind
    if (next.kind === "image" && next.value) {
      await supabase.storage.from(BACKGROUND_BUCKET).remove([next.value]);
    }
    return { error: GENERIC_ERROR };
  }

  // the previous image is no longer referenced
  const old = current?.background_kind === "image" ? current.background_value : null;
  if (isOwnPath(old, user.id) && old !== next.value) {
    await supabase.storage.from(BACKGROUND_BUCKET).remove([old]);
  }

  refresh();
  return { message: "پس‌زمینه ذخیره شد." };
}
