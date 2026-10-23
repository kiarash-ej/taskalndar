"use client";

import { useState, useTransition } from "react";
import { applyTemplate } from "@/lib/actions/blocks";
import { buttonClass } from "./ui";

// One click to lay the weekday's template onto an empty day (the user picks
// it by pressing the button; nothing is applied on their behalf).
export function ApplyDayTemplate({ templateId, name, day }: { templateId: string; name: string; day: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        className={buttonClass.primary}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await applyTemplate(templateId, day);
            if (result.error) setError(result.error);
          })
        }
      >
        {pending ? "در حال اعمال…" : `اعمال «${name}»`}
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-down">
          {error}
        </p>
      )}
    </>
  );
}
