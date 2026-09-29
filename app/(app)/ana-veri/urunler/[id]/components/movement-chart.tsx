"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatTR } from "@/lib/format";

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };

/** Son 12 ay: üretim girişi, satış, satın alma ve (hammadde ise) üretimde tüketim. */
export function MovementChart({
  data,
  unit,
}: {
  data: { month: string; production: number; sale: number; purchase: number; consumption: number }[];
  unit: string;
}) {
  const rows = data.map((d) => ({ ...d, label: `${MONTHS[Number(d.month.slice(5, 7)) - 1]} ${d.month.slice(2, 4)}` }));
  const has = (k: "production" | "sale" | "purchase" | "consumption") => rows.some((r) => r[k] > 0);
  if (!has("production") && !has("sale") && !has("purchase") && !has("consumption")) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Son 12 ayda stok hareketi yok.</p>;
  }
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => formatTR(Number(v), 0)} />
          <Tooltip
            contentStyle={{ borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--popover)", color: "var(--popover-foreground)", fontSize: 12 }}
            cursor={{ fill: "var(--muted)" }}
            formatter={(v, n) => [`${formatTR(Number(v), 0)} ${unit}`, String(n)]}
          />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          {has("production") && <Bar dataKey="production" name="Üretim" fill="var(--cat-2)" radius={[3, 3, 0, 0]} maxBarSize={28} />}
          {has("sale") && <Bar dataKey="sale" name="Satış / sevk" fill="var(--cat-1)" radius={[3, 3, 0, 0]} maxBarSize={28} />}
          {has("purchase") && <Bar dataKey="purchase" name="Satın alma" fill="var(--cat-3)" radius={[3, 3, 0, 0]} maxBarSize={28} />}
          {has("consumption") && <Bar dataKey="consumption" name="Üretimde tüketim" fill="var(--cat-4)" radius={[3, 3, 0, 0]} maxBarSize={28} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
