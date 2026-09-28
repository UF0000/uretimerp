"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { formatTR } from "@/lib/format";

interface ProductionChartProps {
  data: { date: string; amount: number }[];
}

export function ProductionChart({ data }: ProductionChartProps) {
  const formattedData = data.map((item) => ({
    ...item,
    formattedDate: format(parseISO(item.date), "dd MMM", { locale: tr }),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={formattedData}
        margin={{
          top: 5,
          right: 10,
          left: -20,
          bottom: 0,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <XAxis 
          dataKey="formattedDate" 
          tickLine={false} 
          axisLine={false} 
          tick={{ fontSize: 12 }} 
          dy={10}
        />
        <YAxis 
          tickLine={false} 
          axisLine={false} 
          tick={{ fontSize: 12 }} 
        />
        <Tooltip 
          contentStyle={{ borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--popover)", color: "var(--popover-foreground)" }}
          labelStyle={{ fontWeight: "bold", marginBottom: "4px" }}
          formatter={(value) => [`${formatTR(Number(value), 0)} Birim`, "Üretim"]}
        />
        <Line
          type="monotone"
          dataKey="amount"
          stroke="var(--chart-1)"
          strokeWidth={3}
          dot={{ r: 4, fill: "var(--chart-1)", strokeWidth: 0 }}
          activeDot={{ r: 6, fill: "var(--chart-1)" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
