"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { faDigits, formatPercent } from "@/lib/format";

export interface ChartPoint {
  label: string;
  // null: nothing to score in that period (drawn as a gap)
  score: number | null;
  // shown in the tooltip, e.g. the week's date range
  detail: string;
}

const ACCENT = "var(--accent)";
const GRID = "var(--line)";
const MUTED = "var(--muted)";

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div dir="rtl" className="rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-sm">
      <p className="text-muted">{point.detail}</p>
      <p className="font-bold">{point.score === null ? "بدون داده" : formatPercent(point.score)}</p>
    </div>
  );
}

const yAxisProps = {
  domain: [0, 100] as [number, number],
  ticks: [0, 25, 50, 75, 100],
  tickFormatter: (v: number) => faDigits(v),
  orientation: "right" as const,
  width: 32,
  tick: { fill: MUTED, fontSize: 12 },
  axisLine: false,
  tickLine: false,
};

// The x axis runs right-to-left to match the page: oldest on the right. The
// chart box itself is LTR (Recharts lays out in LTR), so the labels need
// direction="rtl" or "۲۸ شهریور" would read as "شهریور ۲۸".
const xAxisProps = {
  dataKey: "label",
  reversed: true,
  tick: { fill: MUTED, fontSize: 12, direction: "rtl" as const },
  axisLine: { stroke: GRID },
  tickLine: false,
  interval: 0,
  // keeps the first and last labels from being clipped at the edges
  padding: { left: 28, right: 28 },
};

export function WeeklyProgressChart({ data }: { data: ChartPoint[] }) {
  return (
    <div dir="ltr" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: GRID }} />
          <Line
            type="monotone"
            dataKey="score"
            stroke={ACCENT}
            strokeWidth={2.5}
            dot={{ r: 4, fill: ACCENT, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyComparisonChart({ data }: { data: ChartPoint[] }) {
  return (
    <div dir="ltr" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="score" radius={[8, 8, 0, 0]} maxBarSize={48} isAnimationActive={false}>
            {data.map((point, i) => (
              <Cell
                key={point.label}
                fill={ACCENT}
                fillOpacity={i === data.length - 1 ? 1 : 0.45}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
