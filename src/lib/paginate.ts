// Supabase caps every response (1,000 rows by default, configurable per
// project) without saying so, so a long history would quietly lose rows and
// give wrong scores. selectAll reads page after page, each ordered by a
// unique key so no row is skipped or repeated, until it has every row.

export const PAGE_SIZE = 1000;
// a safety stop: no user's history comes near this many pages
const MAX_PAGES = 1000;

export interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
  // the total matching rows, from select(..., { count: "exact" })
  count?: number | null;
}

// `page(from, to)` runs the query for rows from..to (inclusive, 0-based), with
// a deterministic order ending in a unique column. Any failed page fails the
// whole read: callers never see a partial result as if it were complete.
export async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  let total: number | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error, count } = await page(rows.length, rows.length + pageSize - 1);
    if (error) throw new Error(error.message);
    if (typeof count === "number") total = count;
    const batch = data ?? [];
    rows.push(...batch);
    // The server may return fewer rows than asked (a lower project limit), so
    // only the total, or an empty page when there is none, says it's the end.
    if (batch.length === 0 || (total !== null && rows.length >= total)) return rows;
  }
  throw new Error("selectAll: too many pages");
}
