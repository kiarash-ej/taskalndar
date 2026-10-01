"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, Spinner } from "./ui";

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: keyof typeof buttonClass;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${buttonClass[variant]} ${className}`}>
      {pending && <Spinner />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
