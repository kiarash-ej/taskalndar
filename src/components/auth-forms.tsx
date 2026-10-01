"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp } from "@/lib/actions/auth";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "./submit-button";
import { Card, Field, FormMessage, inputClass } from "./ui";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action] = useActionState(signIn, initialFormState);
  return (
    <Card>
      <h1 className="mb-5 text-xl font-bold">ورود</h1>
      <form action={action} className="space-y-4">
        <FormMessage state={state.error ? state : { error: notice }} />
        <Field label="ایمیل" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            required
            defaultValue={state.values?.email}
            className={inputClass}
          />
        </Field>
        <Field label="رمز عبور" htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </Field>
        <SubmitButton pendingText="در حال ورود…" className="w-full">
          ورود
        </SubmitButton>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        حساب ندارید؟{" "}
        <Link href="/signup" className="font-semibold text-accent hover:underline">
          ثبت‌نام کنید
        </Link>
      </p>
    </Card>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signUp, initialFormState);
  return (
    <Card>
      <h1 className="mb-5 text-xl font-bold">ثبت‌نام</h1>
      <form action={action} className="space-y-4">
        <FormMessage state={state} />
        <Field label="ایمیل" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            required
            defaultValue={state.values?.email}
            className={inputClass}
          />
        </Field>
        <Field label="رمز عبور (دست‌کم ۶ نویسه)" htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            minLength={6}
            required
            className={inputClass}
          />
        </Field>
        <Field label="تکرار رمز عبور" htmlFor="confirm">
          <input
            id="confirm"
            name="confirm"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            minLength={6}
            required
            className={inputClass}
          />
        </Field>
        <SubmitButton pendingText="در حال ساخت حساب…" className="w-full">
          ساخت حساب
        </SubmitButton>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        قبلاً ثبت‌نام کرده‌اید؟{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          وارد شوید
        </Link>
      </p>
    </Card>
  );
}
