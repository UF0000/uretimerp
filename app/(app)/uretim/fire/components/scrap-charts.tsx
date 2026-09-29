"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatTR } from "@/lib/format";

const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };
const tooltipStyle = {
  contentStyle: {
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    fontSize: 12,
  },
};

const shortDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

/** Dönem bazında fire kg (sütun) ve fire % (çizgi), hedef çizgisiyle. */
export function ScrapTrendChart({
  data,
  target,
  bucket,
}: {
  data: { period: string; scrapKg: number; scrapPct: number | null }[];
  target: number;
  bucket: "day" | "week";
}) {
  const rows = data.map((d) => ({ ...d, label: bucket === "week" ? `${shortDate(d.period)} hf.` : shortDate(d.period) }));
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={12} />
          <YAxis yAxisId="kg" tick={axisTick} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatTR(Number(v), 0)} />
          <YAxis yAxisId="pct" orientation="right" tick={axisTick} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `%${formatTR(Number(v), 0)}`} />
          <Tooltip
            {...tooltipStyle}
            cursor={{ fill: "var(--muted)" }}
            formatter={(v, name) => (name === "Fire %" ? [`%${formatTR(Number(v), 2)}`, name] : [`${formatTR(Number(v), 1)} kg`, name])}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="kg" dataKey="scrapKg" name="Fire (kg)" fill="var(--chart-2)" radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Line yAxisId="pct" dataKey="scrapPct" name="Fire %" stroke="var(--chart-1)" strokeWidth={2} dot={false} connectNulls />
          <ReferenceLine yAxisId="pct" y={target} stroke="var(--danger)" strokeDasharray="4 4" label={{ value: `hedef %${formatTR(target, 1)}`, position: "insideTopRight", fontSize: 11, fill: "var(--danger)" }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Neden Pareto'su: fire kg (sütun) ve kümülatif pay (çizgi), %80 çizgisiyle. */
export function ScrapParetoChart({ data }: { data: { code: string; label: string; kg: number; cumulative: number }[] }) {
  const rows = data.slice(0, 12).map((d) => ({ ...d, cumulativePct: d.cumulative * 100 }));
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="code" tick={axisTick} tickLine={false} axisLine={false} interval={0} />
          <YAxis yAxisId="kg" tick={axisTick} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatTR(Number(v), 0)} />
          <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `%${v}`} />
          <Tooltip
            {...tooltipStyle}
            cursor={{ fill: "var(--muted)" }}
            labelFormatter={(code) => rows.find((r) => r.code === code)?.label ?? String(code)}
            formatter={(v, name) => (name === "Kümülatif" ? [`%${formatTR(Number(v), 1)}`, name] : [`${formatTR(Number(v), 1)} kg`, name])}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="kg" dataKey="kg" name="Fire (kg)" fill="var(--chart-2)" radius={[3, 3, 0, 0]} maxBarSize={36} />
          <Line yAxisId="pct" dataKey="cumulativePct" name="Kümülatif" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
          <ReferenceLine yAxisId="pct" y={80} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
