import { createHash, randomBytes } from "node:crypto";

// The phone link's secret (POST /api/sleep?token=...). Only its sha256 is
// stored, in sleep_settings.hook_token_hash, so a leaked database row can't
// be used to write someone's sleep.

export function newHookToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashHookToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Where a request's values come from, first match wins: the query string,
// then a JSON or form body.
export async function readHookParams(request: Request): Promise<Record<string, string>> {
  const values: Record<string, string> = {};
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const body: unknown = await request.json();
      if (body && typeof body === "object") {
        for (const [k, v] of Object.entries(body)) {
          if (typeof v === "string" || typeof v === "number") values[k] = String(v);
        }
      }
    } else if (type.includes("form")) {
      for (const [k, v] of (await request.formData()).entries()) {
        if (typeof v === "string") values[k] = v;
      }
    }
  } catch {
    // an unreadable body is the same as an empty one
  }
  for (const [k, v] of new URL(request.url).searchParams) values[k] = v;
  return values;
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  return match ? match[1] : null;
}
