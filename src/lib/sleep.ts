import { clockOf, clockToInstant, formatClock, MINUTES_PER_DAY, parseClock } from "./blocks";
import { addDays, calendarDateOf, weekdayIndex, type IsoDate } from "./dates";
import { faDigits, WEEKDAY_NAMES } from "./format";

// The sleep schedule (supabase/migrations/*_sleep_schedule.sql): a bedtime and
// wake time per night of the week, which the planner offers as suggestions. A night is named by the day of its evening
// ("شنبه شب"); a bedtime from 12:00 is on that day, an earlier one after its
// midnight, and waking is the first wake time after going to bed.

const MS_PER_MINUTE = 60_000;
const NOON = 12 * 60;
// what sleep_schedules accepts
export const MIN_SLEEP_MINUTES = 60;
export const MAX_SLEEP_MINUTES = 16 * 60;
// what set_sleep_night accepts, for a single night set from the phone
export const MAX_NIGHT_MINUTES = 20 * 60;

export interface SleepPlan {
  // the night's evening day, 0 = Saturday .. 6 = Friday
  weekday: number;
  // minutes since midnight
  bedtime: number;
  wake: number;
}

// Minutes asleep with this bedtime and wake time (matches public.sleep_minutes).
export function sleepMinutes(bedtime: number, wake: number): number {
  return (((wake - bedtime) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

// When the night of `night` begins at `bedtime` (matches public.sleep_night_start).
export function nightStart(night: IsoDate, bedtime: number): Date {
  return new Date(clockToInstant(bedtime >= NOON ? night : addDays(night, 1), bedtime));
}

// The night an instant belongs to: nights run from noon to noon.
export function nightOf(instant: Date): IsoDate {
  return calendarDateOf(new Date(instant.getTime() - NOON * MS_PER_MINUTE));
}

// "۷ ساعت و ۳۰ دقیقه"
export function formatSleepLength(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${faDigits(m)} دقیقه`;
  return m === 0 ? `${faDigits(h)} ساعت` : `${faDigits(h)} ساعت و ${faDigits(m)} دقیقه`;
}

// The schedule form: per night of the week an `on_<w>` checkbox and
// `bed_<w>` / `wake_<w>` times. Nights left unchecked have no plan.
export function parseSleepForm(formData: FormData): SleepPlan[] | { error: string } {
  const plans: SleepPlan[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    if (!formData.get(`on_${weekday}`)) continue;
    const name = WEEKDAY_NAMES[weekday];
    const bedtime = parseClock(formData.get(`bed_${weekday}`));
    const wake = parseClock(formData.get(`wake_${weekday}`));
    if (bedtime === null || wake === null || bedtime === MINUTES_PER_DAY || wake === MINUTES_PER_DAY) {
      return { error: `ساعت خواب و بیداری ${name} شب را وارد کنید.` };
    }
    const length = sleepMinutes(bedtime, wake);
    if (length < MIN_SLEEP_MINUTES || length > MAX_SLEEP_MINUTES) {
      return { error: `خواب ${name} شب باید بین ۱ تا ۱۶ ساعت باشد.` };
    }
    plans.push({ weekday, bedtime, wake });
  }
  return plans;
}

// When a night with this plan begins and ends.
export function plannedNight(night: IsoDate, plan: { bedtime: number; wake: number }): { bedAt: Date; wakeAt: Date } {
  const bedAt = nightStart(night, plan.bedtime);
  return { bedAt, wakeAt: new Date(bedAt.getTime() + sleepMinutes(plan.bedtime, plan.wake) * MS_PER_MINUTE) };
}

export interface SleepSuggestion {
  night: IsoDate;
  // ISO timestamps, so the suggestion can go to the browser as is
  bedAt: string;
  wakeAt: string;
  // the weekly schedule, or a night the phone link sent
  from: "schedule" | "phone";
}

export interface SleepProposal {
  night: IsoDate;
  bedAt: string;
  wakeAt: string;
}

// What to ask about for the nights that touch `day` (the one from the evening
// before and the one starting that evening). A night the phone sent is asked
// about even if it's on the planner already (to replace it); the schedule's
// suggestion only for nights not on the planner and not turned down. Nights
// over for a day or more aren't asked about.
export function sleepSuggestionsFor(
  day: IsoDate,
  plans: SleepPlan[],
  settled: Set<IsoDate>,
  now: Date,
  proposals: SleepProposal[] = [],
): SleepSuggestion[] {
  const dayStart = Date.parse(clockToInstant(day, 0));
  const dayEnd = Date.parse(clockToInstant(day, MINUTES_PER_DAY));
  const suggestions: SleepSuggestion[] = [];
  for (const night of [addDays(day, -1), day]) {
    const proposal = proposals.find((p) => p.night === night);
    const plan = plans.find((p) => p.weekday === weekdayIndex(night));
    let suggestion: SleepSuggestion | null = null;
    if (proposal) suggestion = { ...proposal, from: "phone" };
    else if (plan && !settled.has(night)) {
      const { bedAt, wakeAt } = plannedNight(night, plan);
      suggestion = { night, bedAt: bedAt.toISOString(), wakeAt: wakeAt.toISOString(), from: "schedule" };
    }
    if (!suggestion) continue;
    const bed = Date.parse(suggestion.bedAt);
    const wake = Date.parse(suggestion.wakeAt);
    if (wake <= dayStart || bed >= dayEnd) continue;
    if (wake < now.getTime() - MINUTES_PER_DAY * MS_PER_MINUTE) continue;
    suggestions.push(suggestion);
  }
  return suggestions;
}

// --- the phone link (src/app/api/sleep) ---

// A time sent by a phone automation: "now", a wall-clock time in Tehran
// ("07:00", "7:00 AM", Persian digits too) or a full ISO 8601 timestamp.
export type HookTime = { kind: "now" } | { kind: "clock"; minutes: number } | { kind: "instant"; at: Date };

const CLOCK_12H = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm|ق\.?ظ|ب\.?ظ)?$/i;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i;

// undefined: not sent; null: not understood.
export function parseHookTime(value: string | null | undefined): HookTime | null | undefined {
  if (value === null || value === undefined) return undefined;
  const text = value
    .trim()
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  if (text === "") return undefined;
  if (/^(now|الان|اکنون)$/i.test(text)) return { kind: "now" };
  if (ISO_INSTANT.test(text)) {
    const at = new Date(text);
    return Number.isNaN(at.getTime()) ? null : { kind: "instant", at };
  }
  const match = CLOCK_12H.exec(text);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const suffix = match[3]?.toLowerCase();
  if (minutes > 59) return null;
  if (suffix) {
    if (hours < 1 || hours > 12) return null;
    const pm = suffix === "pm" || suffix.startsWith("ب");
    hours = (hours % 12) + (pm ? 12 : 0);
  } else if (hours > 23) {
    return null;
  }
  return { kind: "clock", minutes: hours * 60 + minutes };
}

// The first instant at this Tehran wall-clock time after `ref`, or the last one before it.
function nextAt(minutes: number, ref: Date): Date {
  const day = calendarDateOf(ref);
  const same = new Date(clockToInstant(day, minutes));
  return same > ref ? same : new Date(clockToInstant(addDays(day, 1), minutes));
}

function previousAt(minutes: number, ref: Date): Date {
  const day = calendarDateOf(ref);
  const same = new Date(clockToInstant(day, minutes));
  return same < ref ? same : new Date(clockToInstant(addDays(day, -1), minutes));
}

function nearestAt(minutes: number, ref: Date): Date {
  const next = nextAt(minutes, ref);
  const previous = previousAt(minutes, ref);
  return next.getTime() - ref.getTime() <= ref.getTime() - previous.getTime() ? next : previous;
}

// Which night a phone call is about, from whatever it sent: a wake-up clock
// time is the next one (an alarm being set), a bedtime clock time the one
// before the wake-up, or the nearest one when only the bedtime is sent.
export function anchorNight(
  bed: HookTime | undefined,
  wake: HookTime | undefined,
  now: Date,
): { night: IsoDate; bedAt?: Date; wakeAt?: Date } {
  const instant = (t: HookTime | undefined) => (t?.kind === "now" ? now : t?.kind === "instant" ? t.at : undefined);
  let bedAt = instant(bed);
  let wakeAt = instant(wake);
  if (wake?.kind === "clock") wakeAt = nextAt(wake.minutes, bedAt ?? now);
  if (bed?.kind === "clock") bedAt = wakeAt ? previousAt(bed.minutes, wakeAt) : nearestAt(bed.minutes, now);
  const night = nightOf((bedAt ?? wakeAt)!);
  return { night, bedAt, wakeAt };
}

export interface NightContext {
  // the night's sleep blocks already on the planner, if any
  existing: { bedAt: Date; wakeAt: Date } | null;
  // the weekly schedule for that night of the week, if any
  plan: { bedtime: number; wake: number } | null;
}

// Fills in what the phone didn't send from the planner, then the schedule.
export function resolveNight(
  anchor: { night: IsoDate; bedAt?: Date; wakeAt?: Date },
  { existing, plan }: NightContext,
): { bedAt: Date; wakeAt: Date } | { error: string } {
  const bedAt = anchor.bedAt ?? existing?.bedAt ?? (plan ? plannedNight(anchor.night, plan).bedAt : undefined);
  if (!bedAt) return { error: "ساعت خواب مشخص نیست: آن را هم بفرستید یا در تنظیمات برنامهٔ خواب بسازید." };
  let wakeAt = anchor.wakeAt;
  if (!wakeAt && existing && existing.wakeAt > bedAt) wakeAt = existing.wakeAt;
  if (!wakeAt && plan) wakeAt = nextAt(plan.wake, bedAt);
  if (!wakeAt) return { error: "ساعت بیداری مشخص نیست: آن را هم بفرستید یا در تنظیمات برنامهٔ خواب بسازید." };
  const minutes = (wakeAt.getTime() - bedAt.getTime()) / MS_PER_MINUTE;
  if (minutes <= 0) return { error: "ساعت بیداری باید بعد از ساعت خواب باشد." };
  if (minutes > MAX_NIGHT_MINUTES) return { error: "خواب بیش از ۲۰ ساعت ثبت نمی‌شود." };
  return { bedAt, wakeAt };
}

// "۲۳:۰۰" in Tehran
export function formatInstantClock(instant: Date): string {
  const day = calendarDateOf(instant);
  return faDigits(formatClock(clockOf(day, instant.toISOString())));
}
