import { clockOf, formatClock, formatClockRange } from "./blocks";
import { calendarDateOf } from "./dates";
import { faDigits, parseLocalizedNumber } from "./format";

// Reminders before time blocks (supabase/migrations/*_reminders.sql): a
// default lead time per user, which any block can override or turn off.

export const MAX_LEAD_MINUTES = 1440;
export const DEFAULT_LEAD_MINUTES = 10;
// quick picks in the forms; any whole number up to a day is allowed
export const LEAD_PRESETS = [0, 5, 10, 15, 30, 60];

export interface ReminderSettings {
  enabled: boolean;
  leadMinutes: number;
  includeSleep: boolean;
}

// no settings saved yet: off until the user turns reminders on
export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  leadMinutes: DEFAULT_LEAD_MINUTES,
  includeSleep: true,
};

// "۱ ساعت و ۳۰ دقیقه"
function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${faDigits(h)} ساعت`, m && `${faDigits(m)} دقیقه`].filter(Boolean).join(" و ");
}

// "۱۰ دقیقه قبل", "۱ ساعت و ۳۰ دقیقه قبل", "سر وقت"
export function formatLead(minutes: number): string {
  return minutes === 0 ? "سر وقت" : `${formatMinutes(minutes)} قبل`;
}

// A whole number of minutes, 0 to a day, typed with any digits; null otherwise.
export function parseLeadMinutes(value: FormDataEntryValue | null): number | null {
  const n = parseLocalizedNumber(String(value ?? ""));
  return Number.isInteger(n) && n >= 0 && n <= MAX_LEAD_MINUTES ? n : null;
}

const LEAD_ERROR = "زمان یادآوری باید عددی صحیح بین ۰ تا ۱۴۴۰ دقیقه باشد.";

export function parseReminderSettingsForm(formData: FormData): ReminderSettings | { error: string } {
  const leadMinutes = parseLeadMinutes(formData.get("lead_minutes"));
  if (leadMinutes === null) return { error: LEAD_ERROR };
  return {
    enabled: formData.get("enabled") === "on",
    leadMinutes,
    includeSleep: formData.get("include_sleep") === "on",
  };
}

// The block form's reminder choice: `reminder` is "default", "off", or
// "custom" with the minutes in `reminder_minutes`.
export interface BlockReminder {
  remind: boolean;
  // null: the user's default lead time
  reminder_minutes: number | null;
}

export function parseBlockReminder(formData: FormData): BlockReminder | { error: string } {
  const choice = String(formData.get("reminder") ?? "default");
  if (choice === "default") return { remind: true, reminder_minutes: null };
  if (choice === "off") return { remind: false, reminder_minutes: null };
  const minutes = parseLeadMinutes(formData.get("reminder_minutes"));
  return minutes === null ? { error: LEAD_ERROR } : { remind: true, reminder_minutes: minutes };
}

export interface DueReminder {
  title: string;
  start_at: string;
  end_at: string;
  is_sleep: boolean;
}

// The message: how long until the block starts, its title and its times.
export function buildReminderText(reminder: DueReminder, now: Date): string {
  const minutesLeft = Math.round((Date.parse(reminder.start_at) - now.getTime()) / 60_000);
  const day = calendarDateOf(reminder.start_at);
  const start = clockOf(day, reminder.start_at);
  if (reminder.is_sleep) {
    const when = minutesLeft > 0 ? `${formatMinutes(minutesLeft)} دیگر` : "الان";
    return `🌙 ${when} وقت خواب است (${faDigits(formatClock(start))}). شب بخیر!`;
  }
  const end = clockOf(day, reminder.end_at);
  const when = minutesLeft > 0 ? `${formatMinutes(minutesLeft)} دیگر` : "همین حالا";
  return `⏰ ${when}: ${reminder.title}\n${formatClockRange(start, end)}`;
}
