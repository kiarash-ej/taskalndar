import { APP_TIME_ZONE, todayIso } from "../dates";

const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
});

// "HH:MM" on the app's (Tehran) clock.
export function appClockTime(now: Date): string {
  const parts = clock.formatToParts(now);
  const get = (type: "hour" | "minute") => parts.find((p) => p.type === type)!.value;
  return `${get("hour")}:${get("minute")}`;
}

export interface ChannelSchedule {
  // "HH:MM:SS", Tehran time, as Postgres returns a `time`
  send_time: string;
  last_sent_on: string | null;
}

// A channel gets today's summary once its send time has passed, at most once
// per Tehran day. The sender runs every 15 minutes, so a missed run is caught
// up by the next one.
export function isDue(channel: ChannelSchedule, now: Date): boolean {
  if (channel.last_sent_on === todayIso(now)) return false;
  return channel.send_time.slice(0, 5) <= appClockTime(now);
}
