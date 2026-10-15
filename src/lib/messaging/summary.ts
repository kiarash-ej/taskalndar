import { APP_TIME_ZONE, type IsoDate } from "../dates";
import { faDigits, faNumber, formatLongDate } from "../format";

// The daily planner summary sent to a user's bot chat.

// Telegram's message limit; Bale's is the same.
export const MAX_MESSAGE_LENGTH = 4096;

export interface SummaryBlock {
  start_at: string;
  end_at: string;
  title: string;
  description: string;
  tags: string[];
  cost: number | null;
}

export interface SummaryInput {
  day: IsoDate;
  tasks: { title: string; done: boolean }[];
  blocks: SummaryBlock[];
  note: string | null;
  include?: { tasks: boolean; blocks: boolean; note: boolean };
}

const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
});

function time(instant: string): string {
  // A block may end at midnight, which the clock shows as 00:00.
  return faDigits(clock.format(new Date(instant)));
}

export function buildDailySummary(input: SummaryInput): string {
  const include = input.include ?? { tasks: true, blocks: true, note: true };
  const sections: string[][] = [];

  if (include.tasks && input.tasks.length > 0) {
    const done = input.tasks.filter((t) => t.done).length;
    sections.push([
      `✅ کارها (${faDigits(done)} از ${faDigits(input.tasks.length)})`,
      ...input.tasks.map((t) => `${t.done ? "✔️" : "⬜"} ${t.title}`),
    ]);
  }

  if (include.blocks && input.blocks.length > 0) {
    const lines = ["🕒 برنامهٔ زمانی"];
    for (const block of input.blocks) {
      const tags = block.tags.map((t) => ` #${t.replace(/\s/g, "_")}`).join("");
      const cost = block.cost ? ` — ${faNumber(block.cost)} تومان` : "";
      lines.push(`${time(block.start_at)}–${time(block.end_at)} ${block.title}${tags}${cost}`);
      if (block.description.trim()) lines.push(`   ${block.description.trim()}`);
    }
    sections.push(lines);
  }

  if (include.note && input.note?.trim()) sections.push(["📝 یادداشت", input.note.trim()]);

  const body = sections.length > 0
    ? sections.map((lines) => lines.join("\n")).join("\n\n")
    : "برای امروز چیزی ثبت نشده.";
  const text = `📅 ${formatLongDate(input.day)}\n\n${body}`;
  return text.length <= MAX_MESSAGE_LENGTH ? text : `${text.slice(0, MAX_MESSAGE_LENGTH - 1)}…`;
}
