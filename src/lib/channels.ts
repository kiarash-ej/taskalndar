import { formatClock, parseClock } from "./blocks";
import type { Tables } from "./database.types";
import type { BotKind } from "./messaging/bots";

// The daily-summary channels (Bale / Telegram) on the settings page.

export type ChannelRow = Pick<
  Tables<"notification_channels">,
  | "id"
  | "kind"
  | "link_code"
  | "link_code_expires_at"
  | "linked_at"
  | "enabled"
  | "send_time"
  | "include_tasks"
  | "include_blocks"
  | "include_note"
  | "last_sent_on"
>;

export const BOT_NAMES: Record<BotKind, string> = { bale: "بله", telegram: "تلگرام" };

// The sender runs every 15 minutes, so send_time is a multiple of 15 (Tehran).
const STEP = 15;
const MINUTES_PER_DAY = 24 * 60;

export const SEND_TIME_OPTIONS: string[] = Array.from({ length: MINUTES_PER_DAY / STEP }, (_, i) =>
  formatClock(i * STEP),
);

// "HH:MM" on a 15-minute step before midnight; null otherwise.
export function parseSendTime(value: unknown): string | null {
  const minutes = parseClock(value);
  return minutes !== null && minutes < MINUTES_PER_DAY && minutes % STEP === 0 ? formatClock(minutes) : null;
}

export type ChannelState = "linked" | "pending" | "expired";

export function channelState(channel: ChannelRow, now: Date = new Date()): ChannelState {
  if (channel.linked_at !== null) return "linked";
  const expires = channel.link_code_expires_at ? Date.parse(channel.link_code_expires_at) : 0;
  return channel.link_code && expires > now.getTime() ? "pending" : "expired";
}

// What the user sends to the bot to link the chat.
export function startCommand(code: string): string {
  return `/start ${code}`;
}
