// Instants (timestamps) against the calendar days of a time zone, e.g. for
// time_blocks, which must not cross the user's midnight. Days are
// "YYYY-MM-DD" strings, like the database's `date` columns.

export interface DaySegment {
  day: string;
  start: Date;
  end: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

// The wall-clock reading of `instant` in `timeZone`, as if that reading were UTC.
function wallClockAsUtc(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    formatter(timeZone).formatToParts(instant).map((p) => [p.type, Number(p.value)]),
  );
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function offsetMs(instant: Date, timeZone: string): number {
  return wallClockAsUtc(instant, timeZone) - Math.floor(instant.getTime() / 1000) * 1000;
}

export function calendarDayIn(instant: Date, timeZone: string): string {
  return new Date(wallClockAsUtc(instant, timeZone)).toISOString().slice(0, 10);
}

// The instant `day` begins (its 00:00) in `timeZone`.
export function startOfDayIn(day: string, timeZone: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const midnightAsUtc = Date.UTC(y, m - 1, d);
  // The offset at the guess may differ from the one at midnight itself around
  // a DST switch, so take the offset again at the first estimate.
  const guess = midnightAsUtc - offsetMs(new Date(midnightAsUtc), timeZone);
  return new Date(midnightAsUtc - offsetMs(new Date(guess), timeZone));
}

// Cuts [start, end) at every midnight of `timeZone` it crosses, so each piece
// lies inside one calendar day (e.g. a timer that ran past midnight).
export function splitAtMidnights(start: Date, end: Date, timeZone: string): DaySegment[] {
  if (!(end.getTime() > start.getTime())) throw new RangeError('A span must end after it starts');
  const segments: DaySegment[] = [];
  let from = start;
  while (from.getTime() < end.getTime()) {
    const day = calendarDayIn(from, timeZone);
    const nextDay = new Date(Date.parse(day) + MS_PER_DAY).toISOString().slice(0, 10);
    const midnight = startOfDayIn(nextDay, timeZone);
    const to = midnight.getTime() < end.getTime() ? midnight : end;
    segments.push({ day, start: from, end: to });
    from = to;
  }
  return segments;
}
