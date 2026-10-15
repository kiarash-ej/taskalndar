"use client";

import { useActionState, useState } from "react";
import { saveBackground } from "@/lib/actions/profile";
import {
  COLORS,
  GRADIENTS,
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  type Background,
  type BackgroundKind,
} from "@/lib/background";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "./submit-button";
import { cx, FormMessage, inputClass } from "./ui";

const KINDS: { kind: BackgroundKind; label: string }[] = [
  { kind: "none", label: "پیش‌فرض" },
  { kind: "color", label: "رنگ" },
  { kind: "gradient", label: "گرادیان" },
  { kind: "image", label: "تصویر" },
];

const swatch = (selected: boolean) =>
  cx(
    "size-10 rounded-xl border-2 transition-shadow focus-within:ring-2 focus-within:ring-accent/40",
    selected ? "border-accent ring-2 ring-accent/30" : "border-line",
  );

export function BackgroundForm({ current }: { current: Background }) {
  const [state, action] = useActionState(saveBackground, initialFormState);
  const [kind, setKind] = useState<BackgroundKind>(current.kind);
  const [color, setColor] = useState(current.kind === "color" && current.value ? current.value : COLORS[0]);
  const [gradient, setGradient] = useState(
    current.kind === "gradient" && current.value ? current.value : GRADIENTS[0].id,
  );
  const [fileError, setFileError] = useState<string | null>(null);

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="kind" value={kind} />

      <div role="radiogroup" aria-label="نوع پس‌زمینه" className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            role="radio"
            aria-checked={kind === k.kind}
            onClick={() => setKind(k.kind)}
            className={cx(
              "rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors",
              kind === k.kind
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      {kind === "none" && (
        <p className="text-sm text-muted">از پس‌زمینهٔ ساده و پیش‌فرض برنامه استفاده می‌شود.</p>
      )}

      {kind === "color" && (
        <div className="flex flex-wrap items-center gap-2">
          {COLORS.map((c) => (
            <label key={c} className={swatch(color === c)} style={{ backgroundColor: c }}>
              <input
                type="radio"
                name="color-preset"
                value={c}
                checked={color === c}
                onChange={() => setColor(c)}
                className="sr-only"
                aria-label={`رنگ ${c}`}
              />
            </label>
          ))}
          <label className="ms-2 flex items-center gap-2 text-sm text-muted">
            رنگ دلخواه
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="size-10 cursor-pointer rounded-xl border border-line bg-surface p-1"
            />
          </label>
          <input type="hidden" name="color" value={color} />
        </div>
      )}

      {kind === "gradient" && (
        <div className="flex flex-wrap gap-3">
          {GRADIENTS.map((g) => (
            <label key={g.id} className="flex flex-col items-center gap-1 text-xs text-muted">
              <span className={cx(swatch(gradient === g.id), "block h-10 w-16")} style={{ backgroundImage: g.css }}>
                <input
                  type="radio"
                  name="gradient"
                  value={g.id}
                  checked={gradient === g.id}
                  onChange={() => setGradient(g.id)}
                  className="sr-only"
                  aria-label={g.label}
                />
              </span>
              {g.label}
            </label>
          ))}
        </div>
      )}

      {kind === "image" && (
        <div className="space-y-2">
          <input
            type="file"
            name="image"
            accept={Object.keys(IMAGE_TYPES).join(",")}
            aria-label="تصویر پس‌زمینه"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && file.size > MAX_IMAGE_BYTES) {
                setFileError("حجم تصویر باید حداکثر ۳ مگابایت باشد.");
                e.target.value = "";
              } else {
                setFileError(null);
              }
            }}
            className={inputClass}
          />
          <p className="text-xs text-muted">
            JPG، PNG یا WebP، حداکثر ۳ مگابایت.
            {current.kind === "image" && " اگر تصویر جدیدی انتخاب نکنید، تصویر فعلی می‌ماند."}
          </p>
          {fileError && (
            <p role="alert" className="text-sm text-down">
              {fileError}
            </p>
          )}
        </div>
      )}

      <SubmitButton pendingText="در حال ذخیره…">ذخیره</SubmitButton>
    </form>
  );
}
