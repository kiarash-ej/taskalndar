"use client";

import { useState, type KeyboardEvent } from "react";
import { MAX_TAGS, normalizeTag, normalizeTags } from "@/lib/tags";
import { cx, inputClass } from "./ui";

const MAX_SUGGESTIONS = 6;

// Free tags as chips. Each chip is submitted as a `tags` value and whatever
// is still typed as `tag_draft` (the server folds both together), so a tag
// the user forgot to confirm with Enter isn't lost.
export function TagInput({
  id,
  defaultTags,
  suggestions,
}: {
  id: string;
  defaultTags: string[];
  // the user's earlier tags, most used first
  suggestions: string[];
}) {
  const [tags, setTags] = useState(defaultTags);
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const full = tags.length >= MAX_TAGS;

  function add(text: string) {
    setTags((current) => normalizeTags([...current, ...text.split(/[,،]/)]));
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === "," || e.key === "،") && draft.trim()) {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Enter") {
      e.preventDefault(); // an empty tag box shouldn't submit the whole form
    } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      setTags((current) => current.slice(0, -1));
    }
  }

  const needle = normalizeTag(draft).toLowerCase();
  const matches = suggestions
    .filter((s) => !tags.includes(s) && (needle === "" || s.toLowerCase().includes(needle)))
    .slice(0, MAX_SUGGESTIONS);

  return (
    <div className="space-y-1.5">
      <div
        className={cx(
          inputClass,
          "flex min-h-10 flex-wrap items-center gap-1.5 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30",
        )}
      >
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
            #{tag}
            <input type="hidden" name="tags" value={tag} />
            <button
              type="button"
              onClick={() => setTags((current) => current.filter((t) => t !== tag))}
              className="leading-none hover:text-down"
              aria-label={`حذف برچسب ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          name="tag_draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={full}
          placeholder={full ? "حداکثر ۱۰ برچسب" : tags.length ? "" : "مثلاً درس، ورزش"}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
          autoComplete="off"
        />
      </div>
      {(focused || draft) && matches.length > 0 && !full && (
        <div className="flex flex-wrap gap-1.5" aria-label="برچسب‌های پیشنهادی">
          {matches.map((s) => (
            <button
              key={s}
              type="button"
              // keep focus in the box so the list doesn't vanish before the click
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(s)}
              className="rounded-full border border-line px-2 py-0.5 text-xs text-muted hover:border-accent hover:text-accent"
            >
              #{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
