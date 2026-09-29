"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatTR } from "@/lib/format";

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };

type Row = { month: string; production: number; sale: number; purchase: number; consumption: number };

/**
 * Son 12 ay, çizgi grafik: giriş (üretim) ve çıkış (satış) ayrı çizgiler, ortada ikisinin farkı.
 * Üretimi/satışı olmayan ürünlerde (hammadde, metal) satın alma ve üretimde tüketim gösterilir.
 */
export function MovementChart({ data, unit }: { data: Row[]; unit: string }) {
  const sum = (k: keyof Omit<Row, "month">) => data.reduce((s, r) => s + r[k], 0);
  const isTraded = sum("production") > 0 || sum("sale") > 0;
  const isBought = sum("purchase") > 0 || sum("consumption") > 0;
  if (!isTraded && !isBought) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Son 12 ayda stok hareketi yok.</p>;
  }

  const labels = isTraded
    ? { in: "Üretim", out: "Satış / sevk", diff: "Fark (üretim − satış)" }
    : { in: "Satın alma", out: "Üretimde tüketim", diff: "Fark (giriş − tüketim)" };
  const rows = data.map((d) => {
    const inQty = isTraded ? d.production : d.purchase;
    const outQty = isTraded ? d.sale : d.consumption;
    return { label: `${MONTHS[Number(d.month.slice(5, 7)) - 1]} ${d.month.slice(2, 4)}`, in: inQty, out: outQty, diff: inQty - outQty };
  });

  return (
    <div className="h-80">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => formatTR(Number(v), 0)} />
          <Tooltip
            contentStyle={{ borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--popover)", color: "var(--popover-foreground)", fontSize: 12 }}
            formatter={(v, n) => [`${formatTR(Number(v), 0)} ${unit}`, String(n)]}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" />
          <Line dataKey="in" name={labels.in} stroke="var(--cat-2)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line dataKey="out" name={labels.out} stroke="var(--cat-1)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line dataKey="diff" name={labels.diff} stroke="var(--cat-3)" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
