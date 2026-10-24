"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, type LabelProps } from "recharts";
import { formatPercent } from "@/lib/format";
import { formatDuration, type TagShare } from "@/lib/report-view";

const ACCENT = "var(--accent)";
const MUTED = "var(--muted)";
const FG = "var(--fg)";
const ROW_HEIGHT = 36;
const MAX_BARS = 10;

// "no tag" is the empty tag
const tagLabel = (tag: string) => (tag ? `#${tag}` : "بدون برچسب");

function ShareTooltip({ active, payload }: { active?: boolean; payload?: { payload: TagShare }[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div dir="rtl" className="rounded-xl border border-line bg-surface-solid px-3 py-2 text-sm shadow-sm">
      <p className="font-bold">{tagLabel(row.tag)}</p>
      <p className="text-muted">
        {formatDuration(row.minutes)} · {formatPercent(row.percent)} از زمان کل
      </p>
    </div>
  );
}

// The share just past the bar's free end. On the reversed axis Recharts may
// hand over a negative width, so take the left edge either way.
function PercentAtTip(props: LabelProps) {
  const x = Number(props.x ?? 0);
  const width = Number(props.width ?? 0);
  const y = Number(props.y ?? 0);
  const height = Number(props.height ?? 0);
  return (
    <text
      x={Math.min(x, x + width) - 6}
      y={y + height / 2}
      dominantBaseline="central"
      textAnchor="start"
      direction="rtl"
      fill={MUTED}
      fontSize={12}
    >
      {formatPercent(Number(props.value))}
    </text>
  );
}

// Time per tag as one-colour horizontal bars, longest first, growing from the
// right like the page. A block counts for each of its tags, so the shares can
// add up to more than the total — which is why this isn't a pie.
export function TagShareChart({ rows }: { rows: TagShare[] }) {
  const shown = rows.slice(0, MAX_BARS);
  return (
    <div dir="ltr" className="w-full" style={{ height: shown.length * ROW_HEIGHT + 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        {/* the left margin leaves room for the percentage at the longest bar's tip */}
        <BarChart data={shown} layout="vertical" margin={{ top: 4, right: 4, bottom: 4, left: 48 }}>
          <XAxis type="number" dataKey="minutes" reversed hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="tag"
            orientation="right"
            width={110}
            tickFormatter={tagLabel}
            // RTL text anchors on its right edge, so "end" keeps the label beside the axis instead of over the bars
            tick={{ fill: FG, fontSize: 13, direction: "rtl", textAnchor: "end" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ShareTooltip />} cursor={{ fill: "var(--surface-2)" }} />
          {/* on the reversed axis the bar's corners mirror: this rounds its free (left) end */}
          <Bar dataKey="minutes" fill={ACCENT} barSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="percent" content={PercentAtTip} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
