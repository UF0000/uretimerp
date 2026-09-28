"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { formatTR } from "@/lib/format";
import { STATUS_COLORS, STATUS_LABELS, type Status } from "@/lib/analytics-status";

// ── Renkler: tasarım token'ları (palet doğrulandı: CVD ayrımı geçer) ──
const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-5)", "var(--chart-4)"];
const OTHER = "var(--muted-foreground)";
/** Aile → sabit renk (sıralama değişse de renk varlığı takip eder) */
const FAMILY_ORDER = ["PP (Polipropilen)", "PE (Polietilen)", "PERT", "PEX (Çapraz Bağlı PE)", "Masterbatch"];
const familyColor = (name: string, fallbackIndex: number) => {
  const i = FAMILY_ORDER.indexOf(name);
  return i >= 0 ? SERIES[i] : SERIES[(FAMILY_ORDER.length + fallbackIndex) % SERIES.length];
};


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

/** Hammadde tüketim dağılımı (halka). En fazla 5 aile, gerisi "Diğer". */
export function MaterialDonut({ data }: { data: { name: string; value: number }[] }) {
  const top = data.slice(0, 5);
  const rest = data.slice(5).reduce((s, d) => s + d.value, 0);
  const rows = rest > 0 ? [...top, { name: "Diğer", value: rest }] : top;
  const total = rows.reduce((s, d) => s + d.value, 0);
  if (!total) return <p className="py-10 text-center text-sm text-muted-foreground">Tüketim kaydı yok.</p>;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="h-48 w-48 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="95%" stroke="var(--card)" strokeWidth={2}>
              {rows.map((r, i) => (
                <Cell key={r.name} fill={r.name === "Diğer" ? OTHER : familyColor(r.name, i)} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} formatter={(v) => [`${formatTR(Number(v), 0)} kg`, "Tüketim"]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 10 10" aria-hidden>
                <rect width="10" height="10" rx="2" fill={r.name === "Diğer" ? OTHER : familyColor(r.name, i)} />
              </svg>
              {r.name}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {formatTR(r.value, 0)} kg · %{formatTR((r.value / total) * 100, 1)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Vardiya karşılaştırması: aynı ölçü için gündüz/gece (tek eksen, tek birim). */
export function ShiftBars({ data, unit, decimals = 0 }: { data: { name: string; value: number }[]; unit: string; decimals?: number }) {
  return (
    <div className="h-44">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatTR(Number(v), decimals > 0 ? 1 : 0)} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v) => [`${formatTR(Number(v), decimals)} ${unit}`, ""]} />
          <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={48} label={{ position: "top", fontSize: 11, fill: "var(--foreground)", formatter: (v: unknown) => formatTR(Number(v), decimals) }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Vardiya × hammadde ailesi yığılmış sütun. */
export function ShiftMaterialStack({ data, families }: { data: Record<string, number | string>[]; families: string[] }) {
  return (
    <div className="h-44">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatTR(Number(v), 0)} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v, n) => [`${formatTR(Number(v), 0)} kg`, String(n)]} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          {families.map((f, i) => (
            <Bar key={f} dataKey={f} stackId="m" fill={familyColor(f, i)} stroke="var(--card)" strokeWidth={1} maxBarSize={48} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface StatusRow {
  label: string;
  sublabel?: string;
  value: number;
  status: Status;
}

/**
 * İş emri bazında yatay çubuk (fire %, overweight %). Durum rengi + etiket;
 * `diverging` ise sıfırın iki yanı. 15'erli sayfalama.
 */
export function StatusBars({
  rows,
  references = [],
  diverging = false,
}: {
  rows: StatusRow[];
  references?: { value: number; label: string }[];
  diverging?: boolean;
}) {
  const pageSize = 15;
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const slice = rows.slice(page * pageSize, page * pageSize + pageSize);
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">Veri yok.</p>;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), ...references.map((r) => Math.abs(r.value)), 1);
  const domain: [number, number] = diverging ? [-Math.ceil(max), Math.ceil(max)] : [0, Math.ceil(max * 1.1)];

  return (
    <div className="space-y-2">
      <div className={slice.length > 8 ? "h-[430px]" : "h-64"}>
        <ResponsiveContainer>
          <BarChart data={slice} layout="vertical" margin={{ top: 22, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" domain={domain} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => formatTR(Number(v), 0)} />
            <YAxis type="category" dataKey="label" width={96} tick={axisTick} tickLine={false} axisLine={false} />
            <Tooltip
              {...tooltipStyle}
              cursor={{ fill: "var(--muted)" }}
              formatter={(v, _n, item) => {
                const row = item.payload as StatusRow;
                return [`%${formatTR(Number(v), 2)} · ${STATUS_LABELS[row.status]}`, row.sublabel ?? ""];
              }}
            />
            {diverging && <ReferenceLine x={0} stroke="var(--muted-foreground)" />}
            {references.map((r) => (
              <ReferenceLine key={r.label} x={r.value} stroke="var(--muted-foreground)" strokeDasharray="4 3" label={{ value: r.label, position: "top", fontSize: 10, fill: "var(--muted-foreground)" }} />
            ))}
            <Bar dataKey="value" radius={4} maxBarSize={16}>
              {slice.map((r) => (
                <Cell key={r.label} fill={STATUS_COLORS[r.status]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex gap-3">
          {(Object.keys(STATUS_COLORS) as Status[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" aria-hidden>
                <rect width="10" height="10" rx="2" fill={STATUS_COLORS[s]} />
              </svg>
              {STATUS_LABELS[s]}
            </span>
          ))}
        </span>
        {pages > 1 && (
          <span className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Önceki
            </Button>
            {page + 1} / {pages}
            <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
              Sonraki
            </Button>
          </span>
        )}
      </div>
    </div>
  );
}

/** Gerçek tüketim ile kapasiteye göre beklenen (iş emri bazında, 2 seri). */
export function ActualVsExpected({ rows }: { rows: { label: string; actual: number; expected: number }[] }) {
  const pageSize = 15;
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const slice = rows.slice(page * pageSize, page * pageSize + pageSize);
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">Hat kapasitesi girilmiş iş emri yok.</p>;
  return (
    <div className="space-y-2">
      <div className={slice.length > 8 ? "h-[500px]" : "h-72"}>
        <ResponsiveContainer>
          <BarChart data={slice} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }} barGap={2}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => formatTR(Number(v), 0)} />
            <YAxis type="category" dataKey="label" width={96} tick={axisTick} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v, n) => [`${formatTR(Number(v), 0)} kg`, n === "actual" ? "Gerçek tüketim" : "Kapasiteye göre beklenen"]} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === "actual" ? "Gerçek tüketim" : "Kapasiteye göre beklenen")} />
            <Bar dataKey="actual" fill="var(--chart-1)" radius={4} maxBarSize={10} />
            <Bar dataKey="expected" fill="var(--chart-3)" radius={4} maxBarSize={10} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Önceki
          </Button>
          {page + 1} / {pages}
          <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
            Sonraki
          </Button>
        </div>
      )}
    </div>
  );
}
