import { formatClock, MINUTES_PER_DAY, parseClock } from "./blocks";
import { sleepMinutes, MAX_SLEEP_MINUTES, MIN_SLEEP_MINUTES } from "./sleep";
import { normalizeTags } from "./tags";

// Sharing a template, or a whole planner setup ("profile"), with someone
// else: everything shared travels inside the code itself ("TSK1.<base64url
// JSON>"), so nothing is stored or made public on the server. The link form
// puts the code after "#" in /import, which browsers never send to a server.
// Only reusable setup is shared, never personal records (notes, completions,
// goals). Importing always shows the contents and asks first.

export const CODE_PREFIX = "TSK1.";
const MAX_CODE_LENGTH = 200_000;
export const MAX_TEMPLATES = 20;
export const MAX_TEMPLATE_BLOCKS = 50;
export const MAX_TASKS = 100;
const MAX_TITLE = 200;
const MAX_NAME = 100;

export interface SharedBlock {
  // "HH:MM"; end may be "24:00" (until midnight)
  start: string;
  end: string;
  title: string;
  tags: string[];
}

export interface SharedTemplate {
  name: string;
  blocks: SharedBlock[];
}

export interface SharedSleepNight {
  // the night's evening day, 0 = Saturday .. 6 = Friday
  weekday: number;
  bed: string;
  wake: string;
}

export interface SharedTask {
  title: string;
  // null: every day; otherwise those days of the week
  weekdays: number[] | null;
}

export interface SharePack {
  v: 1;
  templates: SharedTemplate[];
  sleep: SharedSleepNight[];
  tasks: SharedTask[];
}

export const EMPTY_PACK: SharePack = { v: 1, templates: [], sleep: [], tasks: [] };

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code: string): string {
  const base64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function encodeShare(pack: SharePack): string {
  return CODE_PREFIX + toBase64Url(JSON.stringify(pack));
}

// The link that opens the import page with this code ready to review.
export function shareLink(origin: string, code: string): string {
  return `${origin}/import#${code}`;
}

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 && t.length <= max ? t : null;
};

const clock = (value: unknown, allowMidnight: boolean): number | null => {
  // "9:00" as well as "09:00"
  const minutes = parseClock(typeof value === "string" && /^\d:\d\d$/.test(value) ? `0${value}` : value);
  if (minutes === null) return null;
  return minutes < MINUTES_PER_DAY || allowMidnight ? minutes : null;
};

function cleanBlock(raw: unknown): SharedBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = text(r.title, MAX_TITLE);
  const start = clock(r.start, false);
  let end = clock(r.end, true);
  if (end === 0 && start !== null && start > 0) end = MINUTES_PER_DAY;
  if (!title || start === null || end === null || end <= start) return null;
  const tags = Array.isArray(r.tags) ? normalizeTags(r.tags.filter((t): t is string => typeof t === "string")) : [];
  return { start: formatClock(start), end: formatClock(end), title, tags };
}

function cleanTemplate(raw: unknown): SharedTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = text(r.name, MAX_NAME);
  if (!name || !Array.isArray(r.blocks)) return null;
  const blocks = r.blocks.slice(0, MAX_TEMPLATE_BLOCKS).map(cleanBlock);
  if (blocks.some((b) => b === null)) return null;
  return { name, blocks: (blocks as SharedBlock[]).sort((a, b) => a.start.localeCompare(b.start)) };
}

function cleanSleep(raw: unknown): SharedSleepNight | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const weekday = Number(r.weekday);
  const bed = clock(r.bed, false);
  const wake = clock(r.wake, false);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || bed === null || wake === null) return null;
  const length = sleepMinutes(bed, wake);
  if (length < MIN_SLEEP_MINUTES || length > MAX_SLEEP_MINUTES) return null;
  return { weekday, bed: formatClock(bed), wake: formatClock(wake) };
}

function cleanTask(raw: unknown): SharedTask | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = text(r.title, MAX_TITLE);
  if (!title) return null;
  if (r.weekdays === null || r.weekdays === undefined) return { title, weekdays: null };
  if (!Array.isArray(r.weekdays)) return null;
  const days = [...new Set(r.weekdays.map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  if (days.length === 0 || days.length !== r.weekdays.length) return null;
  return { title, weekdays: days.length === 7 ? null : days };
}

export type DecodeResult = { pack: SharePack } | { error: string };

const BAD_CODE = "این کد معتبر نیست. کل کد را بدون جا انداختن کپی کنید.";

// A code from encodeShare, or a link containing one. Everything is checked
// again here (and again on the server), whatever made the code.
export function decodeShare(input: string): DecodeResult {
  const trimmed = input.trim();
  const at = trimmed.indexOf(CODE_PREFIX);
  if (at < 0) return { error: BAD_CODE };
  const code = trimmed.slice(at + CODE_PREFIX.length).split(/[\s&]/)[0];
  if (code.length === 0 || code.length > MAX_CODE_LENGTH) return { error: BAD_CODE };

  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(code));
  } catch {
    return { error: BAD_CODE };
  }
  if (!raw || typeof raw !== "object" || (raw as { v?: unknown }).v !== 1) {
    return { error: "این کد از نسخهٔ دیگری از تسکلندر است و خوانده نمی‌شود." };
  }
  const r = raw as Record<string, unknown>;
  const list = (value: unknown, max: number) => (Array.isArray(value) ? value.slice(0, max) : []);

  const templates = list(r.templates, MAX_TEMPLATES).map(cleanTemplate);
  const sleep = list(r.sleep, 7).map(cleanSleep);
  const tasks = list(r.tasks, MAX_TASKS).map(cleanTask);
  if ([...templates, ...sleep, ...tasks].some((x) => x === null)) return { error: BAD_CODE };
  const nights = sleep as SharedSleepNight[];
  if (new Set(nights.map((n) => n.weekday)).size !== nights.length) return { error: BAD_CODE };

  const pack: SharePack = {
    v: 1,
    templates: templates as SharedTemplate[],
    sleep: nights.sort((a, b) => a.weekday - b.weekday),
    tasks: tasks as SharedTask[],
  };
  if (pack.templates.length + pack.sleep.length + pack.tasks.length === 0) return { error: "این کد خالی است." };
  return { pack };
}

// Plain lines from any other app or note, one block per line:
//   07:00-08:00 ورزش #سلامتی
//   ۱۶:۰۰ تا ۱۸:۰۰ درس ریاضی
// Lines that aren't a block are reported by number, not silently dropped.
export function parseBlockLines(input: string): { blocks: SharedBlock[]; badLines: number[] } {
  const blocks: SharedBlock[] = [];
  const badLines: number[] = [];
  const lines = input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .split(/\r?\n/);
  lines.forEach((line, i) => {
    const l = line.trim().replace(/^[-*••]\s*/, "");
    if (l === "") return;
    const match = /^(\d{1,2}:\d{2})\s*(?:-|–|—|تا|to)\s*(\d{1,2}:\d{2})\s+(.+)$/i.exec(l);
    if (!match || blocks.length >= MAX_TEMPLATE_BLOCKS) {
      badLines.push(i + 1);
      return;
    }
    const pad = (t: string) => t.padStart(5, "0");
    const tags = [...match[3].matchAll(/#([^\s#]+)/g)].map((m) => m[1].replace(/_/g, " "));
    const title = match[3].replace(/#[^\s#]+/g, "").replace(/\s+/g, " ").trim();
    const block = cleanBlock({ start: pad(match[1]), end: pad(match[2]), title, tags });
    if (block) blocks.push(block);
    else badLines.push(i + 1);
  });
  blocks.sort((a, b) => a.start.localeCompare(b.start));
  return { blocks, badLines };
}
