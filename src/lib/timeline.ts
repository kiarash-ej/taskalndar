import { MINUTES_PER_DAY } from "./blocks";

// The planner's timeline view: blocks placed by time of day, side by side
// where they overlap, moved and stretched in quarter-hour steps.

export const SNAP_MINUTES = 15;
const MIN_LENGTH = SNAP_MINUTES;

export interface TimelineItem {
  id: string;
  start: number;
  end: number;
}

export interface Placed extends TimelineItem {
  // this block's column, of `columns` in its group of overlapping blocks
  column: number;
  columns: number;
}

// Overlapping blocks share the width: each takes the first free column, and
// every block in a run of overlaps gets the same number of columns.
export function layoutColumns(items: TimelineItem[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed: Placed[] = [];
  let group: Placed[] = [];
  let groupEnd = -1;
  let columnEnds: number[] = [];

  const closeGroup = () => {
    const columns = columnEnds.length;
    for (const p of group) p.columns = columns;
    group = [];
    columnEnds = [];
  };

  for (const item of sorted) {
    if (item.start >= groupEnd && group.length > 0) closeGroup();
    let column = columnEnds.findIndex((end) => end <= item.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(item.end);
    } else {
      columnEnds[column] = item.end;
    }
    const p: Placed = { ...item, column, columns: 1 };
    group.push(p);
    placed.push(p);
    groupEnd = Math.max(groupEnd, item.end);
  }
  closeGroup();
  return placed;
}

export const snap = (minutes: number) => Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;

// Moving keeps the length and stays inside the day.
export function moveTo(item: { start: number; end: number }, start: number): { start: number; end: number } {
  const length = item.end - item.start;
  const s = Math.min(MINUTES_PER_DAY - length, Math.max(0, snap(start)));
  return { start: s, end: s + length };
}

// Stretching the bottom edge: at least a quarter hour, at most midnight.
export function resizeTo(item: { start: number; end: number }, end: number): { start: number; end: number } {
  return { start: item.start, end: Math.min(MINUTES_PER_DAY, Math.max(item.start + MIN_LENGTH, snap(end))) };
}

// The hours to draw: the waking day, widened to fit every block.
export function hourRange(items: TimelineItem[], from = 7, to = 23): { first: number; last: number } {
  const first = Math.min(from, ...items.map((i) => Math.floor(i.start / 60)));
  const last = Math.max(to, ...items.map((i) => Math.ceil(i.end / 60)));
  return { first: Math.max(0, first), last: Math.min(24, last) };
}
