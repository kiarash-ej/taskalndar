import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "ورود" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const notice =
    error === "confirm"
      ? "ورود خودکار پس از تأیید ایمیل انجام نشد. اگر روی پیوند ایمیل کلیک کرده‌اید، با ایمیل و رمز عبور خود وارد شوید."
      : undefined;
  return <LoginForm notice={notice} />;
}
