import "server-only";
import type { BotKind } from "./bots";

// Server-side settings for the messaging features; all optional, so the app
// runs without them and a messenger without a token is simply skipped.
export function botTokens(): Partial<Record<BotKind, string>> {
  return {
    bale: process.env.BALE_BOT_TOKEN || undefined,
    telegram: process.env.TELEGRAM_BOT_TOKEN || undefined,
  };
}

// The bots' public usernames (without "@"), shown on the settings page so users
// know where to send the link code. Optional: without one the page says "the bot".
export function botUsernames(): Partial<Record<BotKind, string>> {
  return {
    bale: process.env.BALE_BOT_USERNAME?.replace(/^@/, "") || undefined,
    telegram: process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || undefined,
  };
}

export const botWebhookSecret = () => process.env.BOT_WEBHOOK_SECRET || undefined;
export const cronSecret = () => process.env.CRON_SECRET || undefined;
