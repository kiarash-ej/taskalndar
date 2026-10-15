// Bale and Telegram speak the same bot API (https://<host>/bot<token>/<method>),
// so one client covers both.

export const BOT_KINDS = ["bale", "telegram"] as const;
export type BotKind = (typeof BOT_KINDS)[number];

const API_BASE: Record<BotKind, string> = {
  bale: "https://tapi.bale.ai",
  telegram: "https://api.telegram.org",
};

export function isBotKind(value: unknown): value is BotKind {
  return typeof value === "string" && (BOT_KINDS as readonly string[]).includes(value);
}

export interface BotCommand {
  command: string;
  argument: string;
  chatId: string;
}

// "/start <code>" or "/stop" from an incoming update; null for anything else.
export function parseCommand(update: unknown): BotCommand | null {
  const message = (update as { message?: { text?: unknown; chat?: { id?: unknown } } } | null)?.message;
  const text = message?.text;
  const chatId = message?.chat?.id;
  if (typeof text !== "string" || (typeof chatId !== "number" && typeof chatId !== "string")) return null;
  const match = /^\/([a-z]+)(?:@\w+)?(?:\s+(.*))?$/i.exec(text.trim());
  if (!match) return null;
  return { command: match[1].toLowerCase(), argument: (match[2] ?? "").trim(), chatId: String(chatId) };
}

export async function sendBotMessage(
  kind: BotKind,
  token: string,
  chatId: string,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(`${API_BASE[kind]}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const body = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !body?.ok) {
    // The URL holds the token, so the error names only what the API said.
    throw new Error(`${kind} sendMessage failed (${response.status}): ${body?.description ?? "no description"}`);
  }
}

// Opens the bot with "/start <code>" already filled in. (Bale users send the
// command themselves; the app shows it to copy.)
export function telegramLinkUrl(botUsername: string, code: string): string {
  return `https://t.me/${botUsername}?start=${code}`;
}
