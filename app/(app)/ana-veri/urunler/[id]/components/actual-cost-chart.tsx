"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatTR } from "@/lib/format";

const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };

/** Biten iş emirlerinin gerçekleşen birim maliyeti; kesikli çizgi standart maliyet. */
export function ActualCostChart({ rows, standard }: { rows: { no: string; finishedAt: string | null; unitCost: number }[]; standard: number | null }) {
  const data = rows.map((r) => ({ label: r.no, date: r.finishedAt?.slice(0, 10) ?? "", unitCost: r.unitCost }));
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={12} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => formatTR(Number(v), 2)} />
          <Tooltip
            contentStyle={{ borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--popover)", color: "var(--popover-foreground)", fontSize: 12 }}
            labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.date ?? ""}`}
            formatter={(v) => [`${formatTR(Number(v), 4)} ₺`, "Gerçekleşen birim maliyet"]}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          {standard !== null && (
            <ReferenceLine y={standard} stroke="var(--cat-3)" strokeDasharray="6 4" label={{ value: `standart ${formatTR(standard, 4)} ₺`, position: "insideTopRight", fontSize: 11, fill: "var(--cat-3)" }} />
          )}
          <Line dataKey="unitCost" name="Gerçekleşen birim maliyet (₺)" stroke="var(--cat-1)" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
