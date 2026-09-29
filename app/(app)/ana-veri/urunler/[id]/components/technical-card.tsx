"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { updateProductTechnical, type ProductDetail, type TechnicalValues } from "@/app/actions/product-detail";
import { usePermission } from "@/components/shared/role-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTR } from "@/lib/format";
import { getErrorMessage } from "@/lib/utils";
import { mPerHourToMin, mPerMinToHour } from "@/lib/speed";

type Technical = NonNullable<ProductDetail["technical"]>;
type FieldKey = keyof TechnicalValues;

const FIELDS: Record<"extrusion" | "injection", { key: FieldKey; label: string; unit: string; step: string; pick: (t: Technical) => number | null }[]> = {
  extrusion: [
    { key: "kg_per_meter", label: "Metre ağırlığı", unit: "kg/m", step: "0.001", pick: (t) => t.kgPerMeter },
    { key: "target_m_per_hour", label: "Üretim hızı (hedef)", unit: "m/dk", step: "0.001", pick: (t) => mPerHourToMin(t.targetMPerHour) },
  ],
  injection: [
    { key: "cycle_time_sec", label: "Çevrim süresi", unit: "sn", step: "0.001", pick: (t) => t.cycleTimeSec },
    { key: "cavity_count", label: "Göz sayısı", unit: "göz", step: "1", pick: (t) => t.cavityCount },
    { key: "product_weight_g", label: "Parça ağırlığı", unit: "g", step: "0.001", pick: (t) => t.productWeightG },
    { key: "runner_sprue_weight_g", label: "Yolluk ağırlığı (atış başı)", unit: "g", step: "0.001", pick: (t) => t.runnerWeightG },
  ],
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border px-3 py-2">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="font-semibold tabular-nums">{value}</div>
  </div>
);

export function TechnicalCard({ productId, technical }: { productId: string; technical: Technical }) {
  const canWrite = usePermission("master-data:write");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fields = FIELDS[technical.productionType];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, f.pick(technical)?.toString() ?? ""])));

  const fmt = (v: number | null, unit: string, d = 2) => (v === null ? "—" : `${formatTR(v, d)} ${unit}`);
  const t = technical;
  // kg/saat = kg/m × m/saat (veritabanında hız m/saat)
  const kgPerHour = t.kgPerMeter && t.targetMPerHour ? t.kgPerMeter * t.targetMPerHour : null;
  const pcsPerHour = t.cycleTimeSec && t.cavityCount ? (3600 / t.cycleTimeSec) * t.cavityCount : null;

  const save = async () => {
    const payload: TechnicalValues = {};
    for (const f of fields) {
      const raw = values[f.key]?.trim();
      const n = raw ? Number(raw.replace(",", ".")) : null;
      // Hız ekranda m/dk, kayıtta m/saat
      payload[f.key] = f.key === "target_m_per_hour" ? mPerMinToHour(n) : n;
    }
    try {
      setSaving(true);
      const r = await updateProductTechnical(productId, t.bomId, payload);
      toast.success("Teknik veriler kaydedildi", {
        description: r.newVersion
          ? `Reçete üretimde kullanıldığı için yeni versiyon (v${r.version}) açıldı; geçmiş üretimler eski değerle kalır.`
          : "Reçete" + (t.mold ? " ve kalıp kartı" : "") + " güncellendi.",
      });
      setEditing(false);
    } catch (error) {
      toast.error("Kaydedilemedi", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          Kaynak: <Link href={`/recete/${t.bomId}`} className="text-primary underline-offset-2 hover:underline">{t.bomLabel}</Link>
          {t.mold && (
            <>
              {" · "}Kalıp: <span className="font-medium text-foreground">{t.mold.code}</span>
            </>
          )}
          {t.lineName && (
            <>
              {" · "}Hat: <span className="font-medium text-foreground">{t.lineName}</span>
            </>
          )}
        </span>
        {canWrite && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Düzenle
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`tech-${f.key}`}>
                  {f.label} ({f.unit})
                </Label>
                <Input id={`tech-${f.key}`} type="number" step={f.step} value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Kaydedince reçete{t.mold ? " ve kalıp kartı" : ""} de güncellenir. Reçete üretimde kullanılmışsa yeni versiyon açılır.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Kaydet
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              Vazgeç
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {fields.map((f) => (
            <Stat key={f.key} label={f.label} value={fmt(f.pick(t), f.unit, f.key === "cavity_count" ? 0 : f.key === "kg_per_meter" ? 3 : f.key === "target_m_per_hour" ? 2 : 1)} />
          ))}
          {t.productionType === "extrusion" ? (
            <Stat label="Saatlik üretim (hesap)" value={fmt(kgPerHour, "kg/saat", 1)} />
          ) : (
            <Stat label="Saatlik üretim (hesap)" value={fmt(pcsPerHour, "adet/saat", 0)} />
          )}
        </div>
      )}
    </div>
  );
}
