"use server";

import type { AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { formValues, GENERIC_ERROR, type FormState } from "../form-state";
import { createClient } from "../supabase/server";

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: "ایمیل یا رمز عبور اشتباه است.",
  email_not_confirmed: "ایمیل شما هنوز تأیید نشده است. روی پیوند ایمیل تأیید کلیک کنید.",
  user_already_exists: "با این ایمیل قبلاً ثبت‌نام شده است. وارد شوید.",
  email_exists: "با این ایمیل قبلاً ثبت‌نام شده است. وارد شوید.",
  weak_password: "رمز عبور ضعیف است. دست‌کم ۶ نویسه انتخاب کنید.",
  email_address_invalid: "نشانی ایمیل معتبر نیست.",
  email_address_not_authorized: "ارسال ایمیل تأیید به این نشانی ممکن نیست. با پشتیبانی تماس بگیرید.",
  signup_disabled: "ثبت‌نام در حال حاضر بسته است.",
  over_email_send_rate_limit: "تعداد درخواست‌ها زیاد بوده. چند دقیقهٔ دیگر دوباره تلاش کنید.",
  over_request_rate_limit: "تعداد درخواست‌ها زیاد بوده. چند دقیقهٔ دیگر دوباره تلاش کنید.",
};

function authErrorMessage(error: AuthError): string {
  return (error.code && AUTH_ERRORS[error.code]) || GENERIC_ERROR;
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const email = values.email.trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "ایمیل و رمز عبور را وارد کنید.", values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error), values };

  redirect("/");
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const email = values.email.trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!email || !password) return { error: "ایمیل و رمز عبور را وارد کنید.", values };
  if (password.length < 6) return { error: "رمز عبور باید دست‌کم ۶ نویسه باشد.", values };
  if (password !== confirm) return { error: "رمز عبور و تکرار آن یکسان نیستند.", values };

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: origin ? { emailRedirectTo: `${origin}/auth/callback` } : undefined,
  });
  if (error) return { error: authErrorMessage(error), values };

  // With "Confirm email" off in Supabase the user is signed in right away.
  if (data.session) redirect("/");

  return {
    message: `پیوند تأیید به ${email} فرستاده شد. پس از تأیید ایمیل، وارد شوید.`,
    values,
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
