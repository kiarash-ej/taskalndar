import { createHash, timingSafeEqual } from "node:crypto";

// Constant-time comparison of a presented secret with the expected one.
// Hashing first gives both sides the same length.
export function secretMatches(presented: string | null | undefined, expected: string | undefined): boolean {
  if (!presented || !expected) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(presented), digest(expected));
}
