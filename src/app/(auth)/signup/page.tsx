import type { Metadata } from "next";
import { SignupForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "ثبت‌نام" };

export default function SignupPage() {
  return <SignupForm />;
}
