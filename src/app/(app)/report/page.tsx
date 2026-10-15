import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { TagShareChart } from "@/components/tag-share-chart";
import { buttonClass, Card, CardHeader, cx, inputClass, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { clockOf, formatClockRange } from "@/lib/blocks";
import { loadTimeBlocks, loadUserTags } from "@/lib/data";
import { todayIso } from "@/lib/dates";
import { faNumber, formatLongDate, formatMonthYear, formatPercent, WEEKDAY_NAMES } from "@/lib/format";
import { filterBlocks, summarizeReport, type ReportItem } from "@/lib/report";
import { formatDuration, monthParam, parseReportQuery, tagShares } from "@/lib/report-view";
import { ALL_WEEKDAYS } from "@/lib/schedule";
import { recentMonths } from "@/lib/scoring";

export const metadata: Metadata = { title: "گزارش ماهانه" };

const MONTH_CHOICES = 12;

const chip =
  "cursor-pointer rounded-full border border-line px-3 py-1 text-sm text-muted transition-colors " +
  "has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent " +
  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40";

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const user = await requireUser();
  const today = todayIso();
  const query = parseReportQuery(await searchParams, today);
  const { filter } = query;

  const [blocks, userTags] = await Promise.all([loadTimeBlocks(user.id, filter.from, filter.to), loadUserTags()]);
  const items = filterBlocks(blocks, filter);
  const summary = summarizeReport(items);
  const shares = tagShares(summary);
  // tags picked in the filter stay selectable even if no longer in the suggestions
  const tagChoices = [...new Set([...(filter.tags ?? []), ...userTags])];
  const months = recentMonths(today, MONTH_CHOICES).reverse();
  const filtered = Boolean(filter.weekdays || filter.tags || filter.text || filter.timeFrom);

  return (
    <div>
      <PageHeader
        title="گزارش ماهانه"
        subtitle={`جعبه‌های زمانی ${formatMonthYear(query.month)}${filtered ? " با فیلترهای انتخاب‌شده" : ""}`}
      />

      <Card className="mb-4">
        <Form action="/report" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr_1fr]">
            <label className="space-y-1.5 text-sm font-medium">
              <span className="block">ماه</span>
              <select name="month" defaultValue={monthParam(query.month)} className={inputClass}>
                {months.map((m) => (
                  <option key={monthParam(m)} value={monthParam(m)}>
                    {formatMonthYear(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              <span className="block">از ساعت</span>
              <input name="from" type="time" dir="ltr" defaultValue={query.timeFrom} className={inputClass} />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              <span className="block">تا ساعت</span>
              <input name="to" type="time" dir="ltr" defaultValue={query.timeTo} className={inputClass} />
            </label>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">روزهای هفته</legend>
            <div className="flex flex-wrap gap-1.5">
              {ALL_WEEKDAYS.map((d) => (
                <label key={d} className={chip}>
                  <input
                    type="checkbox"
                    name="wd"
                    value={d}
                    defaultChecked={filter.weekdays?.includes(d)}
                    className="sr-only"
                  />
                  {WEEKDAY_NAMES[d]}
                </label>
              ))}
            </div>
          </fieldset>

          {tagChoices.length > 0 && (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">برچسب‌ها</legend>
              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {tagChoices.map((tag) => (
                  <label key={tag} className={chip}>
                    <input
                      type="checkbox"
                      name="tag"
                      value={tag}
                      defaultChecked={filter.tags?.includes(tag)}
                      className="sr-only"
                    />
                    #{tag}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex flex-wrap gap-2">
            <input
              name="q"
              type="search"
              defaultValue={filter.text}
              aria-label="جستجو در عنوان، توضیحات و برچسب‌ها"
              placeholder="جستجو در عنوان، توضیحات و برچسب‌ها"
              className={cx(inputClass, "min-w-48 flex-1")}
            />
            <button type="submit" className={buttonClass.primary}>
              نمایش گزارش
            </button>
            <Link href={`/report?month=${monthParam(query.month)}`} className={buttonClass.ghost}>
              پاک کردن فیلترها
            </Link>
          </div>
          {query.warning && (
            <p role="alert" className="rounded-xl bg-down-soft px-3 py-2 text-sm text-down">
              {query.warning}
            </p>
          )}
        </Form>
      </Card>

      {items.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="font-semibold">جعبه‌ای با این فیلترها پیدا نشد.</p>
          <p className="mt-1 text-sm text-muted">
            ماه یا فیلترها را تغییر دهید، یا در{" "}
            <Link href="/planner" className="font-semibold text-accent hover:underline">
              برنامهٔ روزانه
            </Link>{" "}
            جعبهٔ زمانی ثبت کنید.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="زمان کل" value={formatDuration(summary.totalMinutes)} hint="هم‌پوشانی‌ها یک بار شمرده شده‌اند" />
            <Stat
              label="جعبه‌ها"
              value={`${faNumber(summary.blockCount)} جعبه`}
              hint={`در ${faNumber(summary.dayCount)} روز`}
            />
            <Stat label="هزینه" value={`${faNumber(summary.totalCost)} تومان`} />
            <Stat
              label="مقدار انجام‌شده"
              value={
                summary.amountByUnit.length === 0
                  ? "—"
                  : summary.amountByUnit.map((a) => `${faNumber(a.amount)} ${a.unit || "(بدون واحد)"}`).join("، ")
              }
            />
          </div>

          <Card>
            <CardHeader
              title="سهم برچسب‌ها"
              subtitle="زمان هر برچسب نسبت به زمان کل؛ جعبهٔ چندبرچسبی برای هر برچسبش حساب می‌شود، پس جمع درصدها می‌تواند از ۱۰۰ بیشتر شود."
            />
            <TagShareChart rows={shares} />
            <table className="mt-4 w-full text-sm">
              <caption className="sr-only">زمان هر برچسب</caption>
              <thead className="text-muted">
                <tr className="border-b border-line">
                  <th className="py-1.5 text-start font-medium">برچسب</th>
                  <th className="py-1.5 text-start font-medium">زمان</th>
                  <th className="py-1.5 text-end font-medium">سهم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shares.map((row) => (
                  <tr key={row.tag || "untagged"}>
                    <td className="py-1.5">{row.tag ? `#${row.tag}` : "بدون برچسب"}</td>
                    <td className="py-1.5">{formatDuration(row.minutes)}</td>
                    <td className="py-1.5 text-end">{formatPercent(row.percent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <CardHeader title="جعبه‌های منطبق" subtitle={`${faNumber(items.length)} جعبه، به ترتیب زمان`} />
            <MatchingBlocks items={items} />
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

// Grouped by day; a block cut by the time filter shows how much of it counted.
function MatchingBlocks({ items }: { items: ReportItem[] }) {
  const days = [...new Set(items.map((item) => item.block.day))];
  return (
    <div className="space-y-5">
      {days.map((day) => (
        <section key={day}>
          <h3 className="mb-1 text-sm font-bold text-muted">{formatLongDate(day)}</h3>
          <ul className="divide-y divide-line">
            {items
              .filter((item) => item.block.day === day)
              .map(({ block, minutes }) => {
                const start = clockOf(day, block.start_at);
                const end = clockOf(day, block.end_at);
                const clipped = minutes < end - start;
                return (
                  <li key={block.id} className="space-y-1 py-2.5">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-semibold text-accent tabular-nums">{formatClockRange(start, end)}</span>
                      <span className={cx("font-medium", block.done && "text-muted")}>{block.title}</span>
                      {clipped && <span className="text-xs text-muted">({formatDuration(minutes)} در بازهٔ ساعت)</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {block.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">
                          #{tag}
                        </span>
                      ))}
                      {block.amount !== null && (
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
                          {faNumber(block.amount)} {block.unit}
                        </span>
                      )}
                      {block.cost !== null && (
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
                          {faNumber(block.cost)} تومان
                        </span>
                      )}
                    </div>
                    {block.description && (
                      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-muted">{block.description}</p>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
