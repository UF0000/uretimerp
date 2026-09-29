"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
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

// ── Renkler: tasarım token'ları. Kategorik palet (--cat-*) dağılımlarda sırayla kullanılır;
//    kırmızı/turuncu/yeşil yalnızca durum (hedef dışı / sınırda / hedefte) içindir. ──
const CAT = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)", "var(--cat-7)", "var(--cat-8)"];
const catColor = (i: number) => CAT[i % CAT.length];
/** Hammadde ailesi → sabit renk (sıralama değişse de aile aynı renkte kalır) */
const FAMILY_ORDER = ["PP (Polipropilen)", "PE (Polietilen)", "PERT", "PEX (Çapraz Bağlı PE)", "Masterbatch"];
const familyColor = (name: string, fallbackIndex: number) => {
  const i = FAMILY_ORDER.indexOf(name);
  return i >= 0 ? CAT[i] : catColor(FAMILY_ORDER.length + fallbackIndex);
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

const Swatch = ({ color }: { color: string }) => (
  <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 10 10" aria-hidden>
    <rect width="10" height="10" rx="2" fill={color} />
  </svg>
);

// ─────────────────────────────── Dağılım (halka) ───────────────────────────────

/**
 * Dağılım halkası: hammadde tüketimi, fire nedenleri, duruş nedenleri.
 * Lejant grafiğin altında, renkli karelerle; üzerine gelince miktar ve pay.
 */
export function DistributionDonut({
  data,
  unit,
  colorBy = "index",
  empty = "Kayıt yok.",
}: {
  data: { name: string; value: number }[];
  unit: string;
  colorBy?: "index" | "family";
  empty?: string;
}) {
  const rows = data.filter((d) => d.value > 0);
  const total = rows.reduce((s, d) => s + d.value, 0);
  if (!total) return <p className="py-16 text-center text-sm text-muted-foreground">{empty}</p>;
  const color = (name: string, i: number) => (colorBy === "family" ? familyColor(name, i) : catColor(i));
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="92%" startAngle={90} endAngle={-270} stroke="var(--card)" strokeWidth={2}>
              {rows.map((r, i) => (
                <Cell key={r.name} fill={color(r.name, i)} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} formatter={(v, n) => [`${formatTR(Number(v), 0)} ${unit} · %${formatTR((Number(v) / total) * 100, 1)}`, String(n)]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-1.5" title={`${formatTR(r.value, 0)} ${unit} · %${formatTR((r.value / total) * 100, 1)}`}>
            <Swatch color={color(r.name, i)} />
            <span>{r.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────── Vardiya karşılaştırması ───────────────────────────────

export interface ShiftDatum {
  name: string;
  kg: number;
  qty: number;
  scrapPct: number;
  oeePct: number;
  downtimeMin: number;
  materials: Record<string, number>;
}

const ShiftChart = ({ title, children }: { title: string; children: React.ReactElement }) => (
  <div>
    <h3 className="mb-2 text-sm font-semibold">{title}</h3>
    <div className="h-64">
      <ResponsiveContainer>{children}</ResponsiveContainer>
    </div>
  </div>
);

/** Gündüz / gece: üretim (kg + metre/adet), hammadde tüketimi, fire % ve OEE %, duruş. */
export function ShiftComparison({ data, qtyUnit, families }: { data: ShiftDatum[]; qtyUnit: "Metre" | "Adet"; families: string[] }) {
  const materialRows = data.map((d) => ({ name: d.name, ...d.materials }));
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <ShiftChart title={`Üretim (KG / ${qtyUnit === "Metre" ? "M" : "Adet"})`}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={60} tickFormatter={(v) => formatTR(Number(v), 0)} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v, n) => [formatTR(Number(v), 0), String(n)]} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="kg" name="KG" fill="var(--cat-1)" radius={[3, 3, 0, 0]} maxBarSize={56} />
          <Bar dataKey="qty" name={qtyUnit} fill="var(--cat-2)" radius={[3, 3, 0, 0]} maxBarSize={56} />
        </BarChart>
      </ShiftChart>

      <ShiftChart title="Hammadde tüketimi (KG)">
        <BarChart data={materialRows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={60} tickFormatter={(v) => formatTR(Number(v), 0)} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v, n) => [`${formatTR(Number(v), 0)} kg`, String(n)]} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          {families.map((f, i) => (
            <Bar key={f} dataKey={f} stackId="m" fill={familyColor(f, i)} maxBarSize={110} />
          ))}
        </BarChart>
      </ShiftChart>

      <ShiftChart title="Ort. Fire / OEE (%)">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} domain={[0, 100]} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v, n) => [`%${formatTR(Number(v), 2)}`, String(n)]} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="scrapPct" name="Fire %" fill="var(--danger)" radius={[3, 3, 0, 0]} maxBarSize={56} />
          <Bar dataKey="oeePct" name="OEE %" fill="var(--success)" radius={[3, 3, 0, 0]} maxBarSize={56} />
        </BarChart>
      </ShiftChart>

      <ShiftChart title="Duruş (DK)">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={60} tickFormatter={(v) => formatTR(Number(v), 0)} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v) => [`${formatTR(Number(v), 0)} dk`, "Duruş"]} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="downtimeMin" name="Duruş (dk)" fill="var(--cat-5)" radius={[3, 3, 0, 0]} maxBarSize={110} />
        </BarChart>
      </ShiftChart>
    </div>
  );
}

// ─────────────────────────────── Trend ───────────────────────────────

/** Gün / hafta bazında fire % (sol eksen) ve OEE % (sağ eksen), hedef çizgileriyle. */
export function TrendChart({
  data,
  bucket,
  scrapTarget,
  oeeTarget,
}: {
  data: { period: string; scrapPct: number | null; oeePct: number | null }[];
  bucket: "day" | "week";
  scrapTarget: number;
  oeeTarget: number;
}) {
  const rows = data.map((d) => ({ ...d, label: `${d.period.slice(8, 10)}.${d.period.slice(5, 7)}${bucket === "week" ? " hf." : ""}` }));
  if (!rows.length) return <p className="py-16 text-center text-sm text-muted-foreground">Veri yok.</p>;
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis yAxisId="scrap" tick={axisTick} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `%${formatTR(Number(v), 0)}`} />
          <YAxis yAxisId="oee" orientation="right" domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `%${v}`} />
          <Tooltip {...tooltipStyle} formatter={(v, n) => [`%${formatTR(Number(v), 2)}`, String(n)]} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine yAxisId="scrap" y={scrapTarget} stroke="var(--danger)" strokeDasharray="4 4" />
          <ReferenceLine yAxisId="oee" y={oeeTarget} stroke="var(--success)" strokeDasharray="4 4" />
          <Line yAxisId="scrap" dataKey="scrapPct" name={`Fire % (hedef ≤ ${formatTR(scrapTarget, 1)})`} stroke="var(--danger)" strokeWidth={2} dot={bucket === "week" || rows.length < 40 ? { r: 2.5 } : false} connectNulls />
          <Line yAxisId="oee" dataKey="oeePct" name={`OEE % (hedef ≥ ${formatTR(oeeTarget, 0)})`} stroke="var(--success)" strokeWidth={2} dot={bucket === "week" || rows.length < 40 ? { r: 2.5 } : false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────── İş emri bazlı (durum renkli) ───────────────────────────────

export interface StatusRow {
  label: string;
  sublabel?: string;
  value: number;
  status: Status;
}

const Pager = ({ page, pages, pageSize, total, onPage }: { page: number; pages: number; pageSize: number; total: number; onPage: (p: number) => void }) => (
  <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
    <Button size="sm" variant="outline" disabled={page === 0} onClick={() => onPage(page - 1)}>
      ‹ Önceki
    </Button>
    <span className="text-center">
      Gösterilen {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} / Toplam {total} iş emri
    </span>
    <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
      Sonraki ›
    </Button>
  </div>
);

/**
 * İş emri bazında yatay çubuk (fire %, overweight %): hedefte yeşil, sınırda turuncu,
 * hedef dışı kırmızı. `diverging` ise sıfırın iki yanı. 15'erli sayfalama.
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
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(Object.keys(STATUS_COLORS) as Status[]).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <Swatch color={STATUS_COLORS[s]} />
            {STATUS_LABELS[s]}
          </span>
        ))}
      </div>
      <div className={slice.length > 8 ? "h-[500px]" : "h-72"}>
        <ResponsiveContainer>
          <BarChart data={slice} layout="vertical" margin={{ top: 18, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--border)" />
            <XAxis type="number" domain={domain} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => formatTR(Number(v), 0)} />
            <YAxis type="category" dataKey="label" width={104} tick={axisTick} tickLine={false} axisLine={false} />
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
            <Bar dataKey="value" maxBarSize={22}>
              {slice.map((r) => (
                <Cell key={r.label} fill={STATUS_COLORS[r.status]} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Pager page={page} pages={pages} pageSize={pageSize} total={rows.length} onPage={setPage} />
    </div>
  );
}

/** Gerçek tüketim ile kapasiteye göre beklenen (iş emri bazında, 2 seri). */
export function ActualVsExpected({ rows }: { rows: { label: string; actual: number; expected: number }[] }) {
  const pageSize = 15;
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const slice = rows.slice(page * pageSize, page * pageSize + pageSize);
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">Makine kapasitesi girilmiş iş emri yok.</p>;
  return (
    <div className="space-y-2">
      <div className={slice.length > 8 ? "h-[500px]" : "h-72"}>
        <ResponsiveContainer>
          <BarChart data={slice} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }} barGap={2}>
            <CartesianGrid stroke="var(--border)" />
            <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => formatTR(Number(v), 0)} />
            <YAxis type="category" dataKey="label" width={104} tick={axisTick} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v, n) => [`${formatTR(Number(v), 0)} kg`, String(n)]} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="actual" name="Gerçek tüketim" fill="var(--cat-1)" maxBarSize={10} />
            <Bar dataKey="expected" name="Kapasiteye göre beklenen" fill="var(--cat-3)" maxBarSize={10} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Pager page={page} pages={pages} pageSize={pageSize} total={rows.length} onPage={setPage} />
    </div>
  );
}

// ─────────────────────────────── Fitting (enjeksiyon) panosu ───────────────────────────────

/** Hammadde ailesine göre fire (kg): kayıp + geri dönüşümlü, yığılmış sütun. */
export function MaterialScrapBars({ rows }: { rows: { name: string; lostKg: number; regrindKg: number }[] }) {
  const data = rows.filter((r) => r.lostKg + r.regrindKg > 0);
  if (!data.length) return <p className="py-16 text-center text-sm text-muted-foreground">Fire kaydı yok.</p>;
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatTR(Number(v), 0)} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v, n) => [`${formatTR(Number(v), 1)} kg`, String(n)]} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="lostKg" name="Kayıp fire" stackId="s" fill="var(--danger)" stroke="var(--card)" strokeWidth={1} maxBarSize={110} />
          <Bar dataKey="regrindKg" name="Geri dönüşümlü" stackId="s" fill="var(--cat-3)" stroke="var(--card)" strokeWidth={1} radius={[3, 3, 0, 0]} maxBarSize={110} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Hammadde ailesine göre fire oranı (%), yatay çubuk; hedef çizgisiyle. */
export function MaterialScrapPct({ rows, target }: { rows: { name: string; pct: number }[]; target: number }) {
  if (!rows.length) return <p className="py-16 text-center text-sm text-muted-foreground">Veri yok.</p>;
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 18, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => `%${formatTR(Number(v), 0)}`} />
          <YAxis type="category" dataKey="name" width={120} tick={axisTick} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v) => [`%${formatTR(Number(v), 2)}`, "Fire oranı"]} />
          <ReferenceLine
            x={target}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 3"
            label={{ value: `hedef %${formatTR(target, 1)}`, position: "top", fontSize: 10, fill: "var(--muted-foreground)" }}
          />
          <Bar dataKey="pct" fill="var(--cat-3)" radius={[0, 3, 3, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Vardiya bazlı üretim: sağlam kg ve adet ayrı küçük grafiklerde (tek eksen kuralı). */
export function ShiftProduction({ data }: { data: { name: string; kg: number; qty: number }[] }) {
  const mini = (key: "kg" | "qty", title: string, fill: string, unit: string) => (
    <div>
      <h3 className="mb-1 text-xs font-medium text-muted-foreground">{title}</h3>
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => formatTR(Number(v), 0)} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v) => [`${formatTR(Number(v), 0)} ${unit}`, title]} />
            <Bar dataKey={key} fill={fill} radius={[3, 3, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      {mini("kg", "Sağlam (kg)", "var(--cat-2)", "kg")}
      {mini("qty", "Üretim (adet)", "var(--cat-1)", "adet")}
    </div>
  );
}

export interface PerfRow {
  key: string;
  label: string;
  sublabel: string;
  /** Performans yüzdesi (100 = hedef) */
  value: number;
}

/** Hedeften sapma (puan): ≤10 uygun, 10–25 izle, >25 kritik */
const perfStatus = (value: number, target: number): Status => {
  const dev = Math.abs(value - target);
  return dev <= 10 ? "ok" : dev <= 25 ? "warn" : "bad";
};
const PERF_LABELS: Record<Status, string> = { ok: "Uygun (±10 puan)", warn: "İzle (10–25 puan)", bad: "Kritik (>25 puan)" };

/**
 * Çevrim performansı (%): ideal / gerçek çevrim. Hedeften en uzak olan önce,
 * 8'erli sayfa; satır etiketi iki satır (kod + açıklama), hedef kesikli çizgi.
 */
export function CyclePerfBars({ rows, noun, target = 100 }: { rows: PerfRow[]; noun: string; target?: number }) {
  const pageSize = 8;
  const [page, setPage] = useState(0);
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">Çevrim verisi yok (reçete veya kalıpta çevrim süresi girilmeli).</p>;
  const sorted = [...rows].sort((a, b) => Math.abs(b.value - target) - Math.abs(a.value - target));
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = sorted.slice(current * pageSize, current * pageSize + pageSize).map((r) => ({ ...r, status: perfStatus(r.value, target) }));
  const max = Math.max(target * 1.3, ...rows.map((r) => r.value));
  const byKey = new Map(slice.map((r) => [r.key, r]));
  const renderTick = ({ x, y, payload }: { x: number | string; y: number | string; payload: { value: unknown } }) => {
    const row = byKey.get(String(payload.value));
    return (
      <g transform={`translate(${x},${y})`}>
        <text textAnchor="end" fontSize={10} fill="var(--foreground)" dy={-2}>
          {row?.label}
        </text>
        <text textAnchor="end" fontSize={9} fill="var(--muted-foreground)" dy={10}>
          {(row?.sublabel ?? "").slice(0, 34)}
        </text>
      </g>
    );
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>Kesikli çizgi: hedef %{formatTR(target, 0)}</span>
        {(Object.keys(PERF_LABELS) as Status[]).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <Swatch color={STATUS_COLORS[s]} />
            {PERF_LABELS[s]}
          </span>
        ))}
      </div>
      <div className="h-[380px]">
        <ResponsiveContainer>
          <BarChart data={slice} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 8 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" domain={[0, Math.ceil(max / 10) * 10]} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => `%${v}`} />
            <YAxis type="category" dataKey="key" width={190} tick={renderTick} tickLine={false} axisLine={false} interval={0} />
            <Tooltip
              {...tooltipStyle}
              cursor={{ fill: "var(--muted)" }}
              labelFormatter={(_l, items) => {
                const row = items?.[0]?.payload as PerfRow | undefined;
                return row ? `${row.label} · ${row.sublabel}` : "";
              }}
              formatter={(v) => [`%${formatTR(Number(v), 1)} · ${PERF_LABELS[perfStatus(Number(v), target)]}`, "Çevrim performansı"]}
            />
            <ReferenceLine x={target} stroke="var(--muted-foreground)" strokeDasharray="4 3" />
            <Bar dataKey="value" maxBarSize={18} radius={[0, 3, 3, 0]}>
              <LabelList dataKey="value" position="right" fontSize={10} fill="var(--foreground)" formatter={(v: unknown) => `%${formatTR(Number(v), 1)}`} />
              {slice.map((r) => (
                <Cell key={r.key} fill={STATUS_COLORS[r.status]} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
        <Button size="sm" variant="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>
          ‹ Önceki
        </Button>
        <span className="text-center">
          Gösterilen {current * pageSize + 1}–{Math.min((current + 1) * pageSize, sorted.length)} / {sorted.length} {noun}
        </span>
        <Button size="sm" variant="outline" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
          Sonraki ›
        </Button>
      </div>
    </div>
  );
}
