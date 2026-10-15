// Tags on time blocks (and templates) are free text, so the same word must
// always be stored the same way: the database only accepts trimmed, distinct
// tags of 1–40 characters, at most 10 per block (public.tags_are_canonical).

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 40;

// Arabic keyboard letters that look identical to the Persian ones.
const ARABIC_TO_PERSIAN: Record<string, string> = { "ي": "ی", "ى": "ی", "ك": "ک" };

export function normalizeTag(input: string): string {
  return input
    .replace(/[يىك]/g, (ch) => ARABIC_TO_PERSIAN[ch])
    .replace(/\s+/g, " ")
    .replace(/^[\s‌#]+|[\s‌]+$/g, "")
    .slice(0, MAX_TAG_LENGTH)
    .replace(/[\s‌]+$/, "");
}

// Accepts a list or comma-separated text ("درس، ورزش").
export function normalizeTags(input: string | string[]): string[] {
  const raw = typeof input === "string" ? input.split(/[,،]/) : input;
  const tags: string[] = [];
  for (const tag of raw.map(normalizeTag)) {
    if (tag !== "" && !tags.includes(tag)) tags.push(tag);
  }
  return tags.slice(0, MAX_TAGS);
}
