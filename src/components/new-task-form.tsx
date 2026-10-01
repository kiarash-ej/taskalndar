"use client";

import { useActionState } from "react";
import { createTask } from "@/lib/actions/tasks";
import type { IsoDate } from "@/lib/dates";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "./submit-button";
import { KindPicker } from "./task-checklist";
import { FormMessage, inputClass } from "./ui";

export function NewTaskForm({ day }: { day: IsoDate }) {
  const [state, action] = useActionState(createTask, initialFormState);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <input type="hidden" name="date" value={day} />
      <div className="flex gap-2">
        <input
          name="title"
          aria-label="عنوان کار جدید"
          placeholder="کار جدید، مثلاً «۲۰ دقیقه مطالعه»"
          required
          maxLength={200}
          defaultValue={state.error ? state.values?.title : undefined}
          className={inputClass}
        />
        <SubmitButton pendingText="…" className="shrink-0">
          افزودن
        </SubmitButton>
      </div>
      <KindPicker name="new-task" defaultValue={state.values?.kind ?? "recurring"} />
    </form>
  );
}
