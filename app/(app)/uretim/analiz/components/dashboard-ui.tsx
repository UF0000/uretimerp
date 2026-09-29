import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, type Status } from "@/lib/analytics-status";

/** Boru ve Fitting panolarının ortak parçaları (sunucu bileşenleri). */

export const pct = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? "—" : `%${formatTR(v * 100, d)}`);
export const kg = (v: number, d = 0) => `${formatTR(v, d)} kg`;

/** Hedefe göre durum (küçük iyi): hedefte ≤ hedef, sınırda ≤ hedef × 1,2, üstü hedef dışı. */
export const statusOf = (valuePct: number | null, targetPct: number): Status | undefined => {
  if (valuePct === null) return undefined;
  if (valuePct <= targetPct) return "ok";
  return valuePct <= targetPct * 1.2 ? "warn" : "bad";
};
/** Büyük iyi (OEE, verim, çevrim): hedefte ≥ hedef, sınırda ≥ hedef × 0,85. */
export const statusHigh = (valuePct: number | null, targetPct: number): Status | undefined => {
  if (valuePct === null) return undefined;
  if (valuePct >= targetPct) return "ok";
  return valuePct >= targetPct * 0.85 ? "warn" : "bad";
};

const STATUS_TEXT: Record<Status, string> = { ok: "text-success", warn: "text-warning", bad: "text-danger" };
const STATUS_BORDER: Record<Status, string> = { ok: "border-l-success", warn: "border-l-warning", bad: "border-l-danger" };
export const STATUS_PILL: Record<Status, string> = {
  ok: "bg-success/15 text-success",
  warn: "bg-warning/20 text-warning-foreground",
  bad: "bg-danger/15 text-danger",
};

export type KpiRow = { label: string; value: string; share?: string };

export const Kpi = ({ title, value, hint, status, accent, rows }: { title: string; value: string; hint?: string; status?: Status; accent?: string; rows?: KpiRow[] }) => (
  <Card className={cn("break-inside-avoid border-l-4", status ? STATUS_BORDER[status] : (accent ?? "border-l-border"))}>
    <CardContent className="space-y-1 pt-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className={cn("text-2xl font-semibold tabular-nums", status && STATUS_TEXT[status])}>{value}</div>
      {(hint || status) && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {status && status !== "ok" && <AlertTriangle className={cn("h-3.5 w-3.5", STATUS_TEXT[status])} aria-hidden />}
          {status && <span className={cn("font-medium", STATUS_TEXT[status])}>{STATUS_LABELS[status]}</span>}
          {hint && <span>{hint}</span>}
        </div>
      )}
      {rows && rows.length > 0 && (
        <dl className="divide-y divide-border pt-1 text-xs">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-2 py-1">
              <dt className="truncate text-muted-foreground">{r.label}</dt>
              <dd className="whitespace-nowrap tabular-nums">
                <span className="font-medium">{r.value}</span>
                {r.share && <span className="ml-1.5 text-muted-foreground">{r.share}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </CardContent>
  </Card>
);

/** Durum renkli yüzde hücresi */
export const Pill = ({ value, status, d = 2 }: { value: number | null; status?: Status; d?: number }) =>
  value === null ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <span className={cn("inline-block rounded px-1.5 py-0.5 font-medium tabular-nums", status ? STATUS_PILL[status] : "")}>{pct(value, d)}</span>
  );

export const Section = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
    {children}
  </section>
);

export const ChartCard = ({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) => (
  <Card className={cn("break-inside-avoid", className)}>
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

export const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("whitespace-nowrap px-3 py-2 font-medium", right && "text-right")}>{children}</th>
);
