"use client";

import { useActionState, useOptimistic, useState, useTransition, type ReactNode } from "react";
import { deleteTask, setTaskDone, updateTask } from "@/lib/actions/tasks";
import type { IsoDate } from "@/lib/dates";
import { initialFormState, type FormState } from "@/lib/form-state";
import type { TaskRow } from "@/lib/scoring";
import { Pencil, Trash } from "./icons";
import { SubmitButton } from "./submit-button";
import { buttonClass, cx, FormMessage, iconButtonClass, inputClass } from "./ui";

// The checklist of one day's tasks. Ticking is optimistic; with `editable`
// each row can also be renamed, switched between daily/one-time, or deleted.
export function TaskChecklist({
  day,
  today,
  tasks,
  doneIds,
  editable = false,
  empty,
}: {
  day: IsoDate;
  today: IsoDate;
  tasks: TaskRow[];
  doneIds: string[];
  editable?: boolean;
  empty?: ReactNode;
}) {
  const [done, setOptimisticDone] = useOptimistic(
    new Set(doneIds),
    (current, { id, value }: { id: string; value: boolean }) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    },
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const canTick = day <= today;

  function toggle(id: string, value: boolean) {
    setError(null);
    startTransition(async () => {
      setOptimisticDone({ id, value });
      const result = await setTaskDone(id, day, value);
      if (result.error) setError(result.error);
    });
  }

  if (tasks.length === 0) return <>{empty}</>;

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-down-soft px-3 py-2 text-sm text-down">
          {error}
        </p>
      )}
      {!canTick && (
        <p className="mb-3 text-sm text-muted">
          این روز هنوز نرسیده؛ کارها را می‌توانید از همان روز به بعد تیک بزنید.
        </p>
      )}
      <ul className="divide-y divide-line">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            day={day}
            today={today}
            done={done.has(task.id)}
            canTick={canTick}
            editable={editable}
            onToggle={(value) => toggle(task.id, value)}
            onError={setError}
          />
        ))}
      </ul>
    </div>
  );
}

function TaskItem({
  task,
  day,
  today,
  done,
  canTick,
  editable,
  onToggle,
  onError,
}: {
  task: TaskRow;
  day: IsoDate;
  today: IsoDate;
  done: boolean;
  canTick: boolean;
  editable: boolean;
  onToggle: (value: boolean) => void;
  onError: (error: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, startDelete] = useTransition();
  const checkboxId = `task-${task.id}`;

  function remove() {
    const keepsHistory = task.is_recurring && task.date < today;
    const question = keepsHistory
      ? `«${task.title}» از امروز به بعد از برنامه حذف شود؟ سابقهٔ روزهای گذشته حفظ می‌شود.`
      : `«${task.title}» حذف شود؟`;
    if (!window.confirm(question)) return;
    onError(null);
    startDelete(async () => {
      const result = await deleteTask(task.id);
      if (result.error) onError(result.error);
    });
  }

  if (editing) {
    return (
      <li className="py-3">
        <TaskEditForm task={task} day={day} onClose={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className={cx("flex items-center gap-3 py-2.5", deleting && "opacity-50")}>
      <input
        id={checkboxId}
        type="checkbox"
        checked={done}
        disabled={!canTick || deleting}
        onChange={(e) => onToggle(e.target.checked)}
        className="size-5 shrink-0 cursor-pointer accent-accent disabled:cursor-not-allowed"
      />
      <label
        htmlFor={checkboxId}
        className={cx(
          "min-w-0 flex-1 cursor-pointer break-words",
          done && "text-muted line-through decoration-muted/60",
        )}
      >
        {task.title}
      </label>
      <span
        className={cx(
          "shrink-0 rounded-full px-2 py-0.5 text-xs",
          task.is_recurring ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted",
        )}
      >
        {task.is_recurring ? "هر روز" : "یک‌بار"}
      </span>
      {editable && (
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={deleting}
            className={iconButtonClass}
            aria-label={`ویرایش «${task.title}»`}
          >
            <Pencil />
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className={cx(iconButtonClass, "hover:text-down")}
            aria-label={`حذف «${task.title}»`}
          >
            <Trash />
          </button>
        </div>
      )}
    </li>
  );
}

function TaskEditForm({ task, day, onClose }: { task: TaskRow; day: IsoDate; onClose: () => void }) {
  const [state, action] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await updateTask(task.id, prev, formData);
    if (!result.error) onClose();
    return result;
  }, initialFormState);
  const kind = state.values?.kind ?? (task.is_recurring ? "recurring" : "once");

  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <input type="hidden" name="day" value={day} />
      <input
        name="title"
        aria-label="عنوان کار"
        required
        maxLength={200}
        defaultValue={state.values?.title ?? task.title}
        autoFocus
        className={inputClass}
      />
      <KindPicker name={`edit-${task.id}`} defaultValue={kind} />
      <div className="flex gap-2">
        <SubmitButton pendingText="در حال ذخیره…">ذخیره</SubmitButton>
        <button type="button" onClick={onClose} className={buttonClass.ghost}>
          انصراف
        </button>
      </div>
    </form>
  );
}

// Radio pair for tasks.is_recurring, submitted as kind=recurring|once.
export function KindPicker({ name, defaultValue }: { name: string; defaultValue: string }) {
  const options = [
    { value: "recurring", label: "هر روز", hint: "از این روز به بعد تکرار می‌شود" },
    { value: "once", label: "یک‌بار", hint: "فقط برای همین روز" },
  ];
  return (
    <fieldset className="grid grid-cols-2 gap-2">
      <legend className="sr-only">نوع کار</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-start gap-2 rounded-xl border border-line p-2.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
        >
          <input
            type="radio"
            name="kind"
            value={option.value}
            defaultChecked={defaultValue === option.value}
            className="mt-1 accent-accent"
            id={`${name}-${option.value}`}
          />
          <span>
            <span className="block font-medium">{option.label}</span>
            <span className="block text-xs text-muted">{option.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
