import type { Metadata } from "next";
import { MonthlyComparisonChart, WeeklyProgressChart, type ChartPoint } from "@/components/progress-charts";
import { MonthlyChangeBadge } from "@/components/progress-widgets";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { loadProgressData } from "@/lib/data";
import { todayIso } from "@/lib/dates";
import { faDigits, formatDayMonth, formatMonthYear, formatPercent, JALALI_MONTH_NAMES } from "@/lib/format";
import { compareWithPreviousMonth, scoreMonths, scoreWeeks, scoringWindowStart } from "@/lib/scoring";

export const metadata: Metadata = { title: "آمار و پیشرفت" };

const WEEKS = 8;
const MONTHS = 6;

export default async function StatsPage() {
  const user = await requireUser();
  const today = todayIso();
  const data = await loadProgressData(user.id, scoringWindowStart(today, WEEKS, MONTHS), today);

  const weeks: ChartPoint[] = scoreWeeks(data, today, WEEKS).map((w) => ({
    label: formatDayMonth(w.start),
    score: w.hasData ? Math.round(w.score) : null,
    detail: `هفتهٔ ${formatDayMonth(w.start)} تا ${formatDayMonth(w.end)}`,
  }));
  const months: ChartPoint[] = scoreMonths(data, today, MONTHS).map((m) => ({
    label: JALALI_MONTH_NAMES[m.month.jm - 1],
    score: m.hasData ? Math.round(m.score) : null,
    detail: formatMonthYear(m.month),
  }));
  const { current, previous, change } = compareWithPreviousMonth(data, today);
  const hasAnyData = weeks.some((w) => w.score !== null) || months.some((m) => m.score !== null);

  return (
    <div>
      <PageHeader
        title="آمار و پیشرفت"
        subtitle="امتیاز ترکیبی: میانگین درصد انجام کارهای روزانه و درصد پیشرفت هدف‌ها"
      />

      {!hasAnyData && (
        <Card className="mb-4 py-8 text-center">
          <p className="font-semibold">هنوز داده‌ای برای نمودار نیست.</p>
          <p className="mt-1 text-sm text-muted">
            با تیک زدن کارهای روزانه و ثبت پیشرفت هدف‌ها، نمودارها اینجا شکل می‌گیرند.
          </p>
        </Card>
      )}

      <div className="grid gap-4">
        <Card>
          <CardHeader title={`پیشرفت ${faDigits(WEEKS)} هفتهٔ اخیر`} subtitle="هر هفته از شنبه تا جمعه" />
          <WeeklyProgressChart data={weeks} />
        </Card>

        <Card>
          <CardHeader
            title="مقایسهٔ ماه‌به‌ماه"
            subtitle={`${faDigits(MONTHS)} ماه اخیر شمسی؛ ماه جاری تا امروز`}
            aside={<MonthlyChangeBadge change={change} />}
          />
          <MonthlyComparisonChart data={months} />
          <p className="mt-3 text-sm text-muted">
            {change.kind === "fresh-start"
              ? "ماه قبل امتیازی نداشت، پس این ماه «شروع تازه» حساب می‌شود."
              : `این ماه تا امروز ${formatPercent(current.score)} در برابر ${formatPercent(previous.score)} در ماه قبل.`}
          </p>
        </Card>
      </div>
    </div>
  );
}
