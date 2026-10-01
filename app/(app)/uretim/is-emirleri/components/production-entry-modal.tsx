"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Ban, Loader2, Lock, LockOpen, Pencil, Plus, Trash2, Wand2, X } from "lucide-react";
import { usePermission } from "@/components/shared/role-provider";
import { toast } from "sonner";

import { cancelProductionEntry, closeWorkOrder, getWorkOrderEntries, reopenWorkOrder, saveProductionEntry, type RawLot, type WorkOrderEntries } from "@/app/actions/production";
import type { WorkOrderRow } from "@/app/actions/work-orders";
import { entryRange, productionEntryV2Schema, type ProductionEntryV2Values } from "@/lib/validations/production";
import { entryMetrics, injectionKgPerPart, type EntryMetrics } from "@/lib/entry-metrics";
import { mPerHourToMin } from "@/lib/speed";
import { formatTR } from "@/lib/format";
import { cn, getErrorMessage, one } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Option = { id: string; code: string; name?: string; label?: string };
type Entry = WorkOrderEntries["entries"][number];
type Targets = WorkOrderEntries["targets"];
type Shifts = WorkOrderEntries["shifts"];
const DEFAULT_SHIFTS: Shifts = { dayStart: "08:00", nightStart: "20:00" };
type Tone = "ok" | "warn" | "bad" | "none";

interface ProductionEntryModalProps {
  workOrder: WorkOrderRow | null;
  isOpen: boolean;
  onClose: () => void;
  scrapProducts: Option[];
  /** Mamulün girebileceği depolar (type = finished) */
  targetWarehouses: { id: string; name: string }[];
  scrapReasons: Option[];
  downtimeReasons: Option[];
  /** Hammadde depolarındaki lotlar (FIFO sıralı) */
  rawLots: RawLot[];
}

interface FormState {
  replaces_entry_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  operator_id: string;
  produced_qty: string;
  total_used_kg: string;
  scraps: { reason_code_id: string; kg: string }[];
  downtimes: { reason_code_id: string; minutes: string }[];
  scrap_product_id: string;
  target_warehouse_id: string;
  close_work_order: boolean;
  raw_lots: Record<string, string>;
}

const TZ = "Europe/Istanbul";
const localDate = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: TZ });
const localTime = (d: Date) => d.toLocaleTimeString("tr-TR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const toNum = (v: string) => (v.trim() === "" ? 0 : Number(v.replace(",", ".")));
const pct = (v: number | null, d = 1) => (v === null ? "—" : `%${formatTR(v * 100, d)}`);
const hm = (min: number) => `${Math.floor(min / 60)} sa ${Math.round(min % 60)} dk`;

const TONE_TEXT: Record<Tone, string> = { ok: "text-success", warn: "text-warning", bad: "text-danger", none: "" };
const TONE_PILL: Record<Tone, string> = { ok: "bg-success/15 text-success", warn: "bg-warning/20 text-warning-foreground", bad: "bg-danger/15 text-danger", none: "" };
const TONE_BORDER: Record<Tone, string> = { ok: "border-l-success", warn: "border-l-warning", bad: "border-l-danger", none: "border-l-border" };

const scrapTone = (v: number | null, t: Targets): Tone => (v === null ? "none" : v * 100 <= t.scrapPct ? "ok" : v * 100 <= t.scrapPct * 1.2 ? "warn" : "bad");
const oeeTone = (v: number | null, t: Targets): Tone => (v === null ? "none" : v * 100 >= t.oeePct ? "ok" : v * 100 >= t.oeePct * 0.85 ? "warn" : "bad");
const owTone = (v: number | null, t: Targets): Tone =>
  v === null ? "none" : Math.abs(v * 100) <= t.overweightTolerancePct ? "ok" : Math.abs(v * 100) <= t.overweightTolerancePct * 1.2 ? "warn" : "bad";
const capTone = (v: number | null): Tone => (v === null ? "none" : v >= 0.9 ? "ok" : v >= 0.75 ? "warn" : "bad");

const Pill = ({ value, tone, d = 1 }: { value: number | null; tone: Tone; d?: number }) =>
  value === null ? <span className="text-muted-foreground">—</span> : <span className={cn("rounded px-1.5 py-0.5 font-medium tabular-nums", TONE_PILL[tone])}>{pct(value, d)}</span>;

const Kpi = ({ label, value, hint, tone = "none" }: { label: string; value: string; hint?: string; tone?: Tone }) => (
  <div className={cn("rounded-md border border-l-4 border-border bg-card px-3 py-2", TONE_BORDER[tone])}>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={cn("text-lg font-semibold tabular-nums", TONE_TEXT[tone])}>{value}</div>
    {hint && <div className="truncate text-xs text-muted-foreground">{hint}</div>}
  </div>
);

/** Yeni girişin varsayılan saatleri: son girişin bitişinden ya da şu anki vardiyadan */
function defaultTimes(entries: Entry[], shifts: Shifts) {
  const last = [...entries].filter((e) => e.endAt).sort((a, b) => (a.endAt ?? "").localeCompare(b.endAt ?? "")).pop();
  if (last?.endAt) {
    const start = new Date(last.endAt);
    return { date: localDate(start), start_time: localTime(start), end_time: localTime(new Date(start.getTime() + 12 * 3600000)) };
  }
  // Şu anki vardiya (Yönetim → Parametreler'deki başlangıç saatleri; SS:DD metin olarak karşılaştırılır)
  const now = new Date();
  const time = localTime(now);
  const isDay = time >= shifts.dayStart && time < shifts.nightStart;
  const date = time < shifts.dayStart ? localDate(new Date(now.getTime() - 86400000)) : localDate(now);
  return { date, start_time: isDay ? shifts.dayStart : shifts.nightStart, end_time: isDay ? shifts.nightStart : shifts.dayStart };
}

const blankForm = (): FormState => ({
  replaces_entry_id: null,
  date: "",
  start_time: "",
  end_time: "",
  operator_id: "",
  produced_qty: "",
  total_used_kg: "",
  scraps: [{ reason_code_id: "", kg: "" }],
  downtimes: [{ reason_code_id: "", minutes: "" }],
  scrap_product_id: "",
  target_warehouse_id: "",
  close_work_order: false,
  raw_lots: {},
});

/** Yeni giriş formu: saatler son girişten, depo ve hurda ürünü varsayılanlardan */
const newEntryForm = (entries: Entry[], shifts: Shifts, scrapProductId: string, warehouseId: string): FormState => ({
  ...blankForm(),
  ...defaultTimes(entries, shifts),
  scrap_product_id: scrapProductId,
  target_warehouse_id: warehouseId,
});

export function ProductionEntryModal({ workOrder, isOpen, onClose, scrapProducts, targetWarehouses, scrapReasons, downtimeReasons, rawLots }: ProductionEntryModalProps) {
  const router = useRouter();
  const isAdmin = usePermission("admin:all");
  const [data, setData] = useState<WorkOrderEntries | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyEntry, setBusyEntry] = useState<string | null>(null);
  // Hammadde kutusu elle değiştirildiyse otomatik hesap durur; sihirli değnek otomatiğe döndürür
  const [usedManual, setUsedManual] = useState(false);

  const bom = one(workOrder?.bom);
  const defaultScrapProduct = (bom?.production_type === "injection" ? one(bom?.bom_injection)?.scrap_product_id : one(bom?.bom_extrusion)?.scrap_product_id) ?? "";

  const defaultWarehouse = targetWarehouses[0]?.id ?? "";
  const emptyForm = (list: Entry[]) => newEntryForm(list, data?.shifts ?? DEFAULT_SHIFTS, defaultScrapProduct, defaultWarehouse);

  const { register, control, reset, setValue, getValues } = useForm<FormState>({ defaultValues: blankForm() });
  const scrapRows = useFieldArray({ control, name: "scraps" });
  const downRows = useFieldArray({ control, name: "downtimes" });
  const f = useWatch({ control }) as FormState;

  // Pencere açılınca / iş emri değişince girişleri yükle (yükleniyor = veri başka iş emrine ait)
  const loading = Boolean(workOrder) && data?.workOrder.id !== workOrder?.id;
  useEffect(() => {
    if (!isOpen || !workOrder) return;
    let alive = true;
    getWorkOrderEntries(workOrder.id)
      .then((d) => {
        if (!alive) return;
        setData(d);
        reset(newEntryForm(d.entries, d.shifts, defaultScrapProduct, defaultWarehouse));
        setUsedManual(false);
      })
      .catch((error) => toast.error("Girişler yüklenemedi", { description: getErrorMessage(error) }));
    return () => {
      alive = false;
    };
  }, [isOpen, workOrder, reset, defaultScrapProduct, defaultWarehouse]);

  const reload = async () => {
    if (!workOrder) return null;
    const d = await getWorkOrderEntries(workOrder.id);
    setData(d);
    return d;
  };

  const tech = data?.tech;
  const targets = data?.targets ?? { scrapPct: 3, overweightTolerancePct: 2.5, oeePct: 85 };
  const unit = data?.workOrder.product?.unit ?? workOrder?.product?.unit ?? "";
  const isInjection = tech?.productionType === "injection";
  const entries = useMemo(() => data?.entries ?? [], [data]);
  const reasonLabel = useMemo(() => new Map([...scrapReasons, ...downtimeReasons].map((r) => [r.id, r.label ?? r.name ?? r.code])), [scrapReasons, downtimeReasons]);

  // ── İş emri toplamları ──
  const metricsOf = (e: Entry): EntryMetrics | null =>
    tech ? entryMetrics({ plannedMin: e.plannedMin, downtimeMin: e.downtimeMin, producedQty: e.producedQty, usedKg: e.usedKg, scrapKg: e.scrapKg }, { ...tech, capacityKgPerHour: e.capacityKgPerHour }) : null;
  const totals = useMemo(() => {
    const sum = (k: keyof Pick<Entry, "plannedMin" | "downtimeMin" | "producedQty" | "usedKg" | "scrapKg">) => entries.reduce((s, e) => s + e[k], 0);
    const input = { plannedMin: sum("plannedMin"), downtimeMin: sum("downtimeMin"), producedQty: sum("producedQty"), usedKg: sum("usedKg"), scrapKg: sum("scrapKg") };
    return { input, m: tech ? entryMetrics(input, tech) : null };
  }, [entries, tech]);
  const planned = data?.workOrder.plannedQty ?? Number(workOrder?.planned_qty ?? 0);
  const progress = planned > 0 ? Math.min(1, totals.input.producedQty / planned) : 0;

  // ── Formdaki girişin canlı hesabı ──
  const range = f.date && f.start_time && f.end_time && f.start_time !== f.end_time ? entryRange(f.date, f.start_time, f.end_time) : null;
  const liveScrap = (f.scraps ?? []).reduce((s, r) => s + toNum(r.kg ?? ""), 0);
  const liveDown = (f.downtimes ?? []).reduce((s, r) => s + toNum(r.minutes ?? ""), 0);
  const produced = toNum(f.produced_qty ?? "");
  const used = toNum(f.total_used_kg ?? "");
  const live = tech && range ? entryMetrics({ plannedMin: range.minutes, downtimeMin: liveDown, producedQty: produced, usedKg: used, scrapKg: liveScrap }, tech) : null;
  // Birim tüketim: ekstrüzyon kg/m · enjeksiyon parça + yolluk payı (yolluk atış başı / göz)
  const unitKg = tech ? (tech.productionType === "extrusion" ? tech.kgPerMeter : injectionKgPerPart(tech)) : null;
  const runnerPerPartG = tech?.runnerWeightG ? tech.runnerWeightG / Math.max(1, tech.cavityCount ?? 1) : 0;
  const expectedGoodKg = unitKg ? produced * unitKg : null;
  const expectedUsedKg = expectedGoodKg !== null ? expectedGoodKg + liveScrap : null;
  const bomItems = (bom?.items ?? []).filter((i) => Number(i.ratio_pct) > 0);

  // Otomatik hammadde = sağlam üretim × birim ağırlık + fire (üretim/fire değiştikçe güncellenir)
  const autoUsed = expectedUsedKg !== null && (produced > 0 || liveScrap > 0) ? String(Math.round(expectedUsedKg * 1000) / 1000) : "";
  useEffect(() => {
    if (usedManual || !unitKg) return;
    if (getValues("total_used_kg") !== autoUsed) setValue("total_used_kg", autoUsed);
  }, [usedManual, unitKg, autoUsed, getValues, setValue]);

  const suggestUsed = () => {
    if (!unitKg) return toast.info("Reçetede birim ağırlık yok; hammaddeyi elle girin.");
    setUsedManual(false);
    setValue("total_used_kg", autoUsed);
  };

  const resetForm = (list: Entry[]) => {
    reset(emptyForm(list));
    setUsedManual(false);
  };

  const edit = (e: Entry) => {
    const start = new Date(e.startAt ?? e.entryTime ?? "");
    const end = e.endAt ? new Date(e.endAt) : new Date(start.getTime() + e.plannedMin * 60000);
    reset({
      ...emptyForm(entries),
      replaces_entry_id: e.id,
      date: localDate(start),
      start_time: localTime(start),
      end_time: localTime(end),
      operator_id: e.operatorId ?? data?.operators.find((o) => o.name === e.operator)?.id ?? "",
      produced_qty: String(e.producedQty || ""),
      total_used_kg: String(e.usedKg || ""),
      scraps: e.scraps.length ? e.scraps.map((x) => ({ reason_code_id: x.reasonCodeId, kg: String(x.kg) })) : [{ reason_code_id: "", kg: "" }],
      downtimes: e.downtimes.length ? e.downtimes.map((x) => ({ reason_code_id: x.reasonCodeId, minutes: String(x.minutes) })) : [{ reason_code_id: "", minutes: "" }],
    });
    // Kayıtlı değer otomatik hesaptan farklıysa elle girilmiş sayılır, korunur
    const auto = unitKg ? e.producedQty * unitKg + e.scrapKg : null;
    setUsedManual(auto === null || Math.abs(auto - e.usedKg) > 0.001);
    document.getElementById("entry-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancelEntry = async (e: Entry) => {
    if (!confirm("Bu giriş iptal edilsin mi? Stok hareketleri ters kayıtla geri alınır, kalıp sayacı düşülür.")) return;
    try {
      setBusyEntry(e.id);
      await cancelProductionEntry(e.id, "İptal");
      toast.success("Giriş iptal edildi");
      const d = await reload();
      if (getValues("replaces_entry_id") === e.id) resetForm(d?.entries ?? []);
      router.refresh();
    } catch (error) {
      toast.error("İptal edilemedi", { description: getErrorMessage(error) });
    } finally {
      setBusyEntry(null);
    }
  };

  const submit = async () => {
    if (!workOrder) return;
    const v = getValues();
    // Boş bırakılan fire/duruş satırları yok sayılır
    const payload: ProductionEntryV2Values = {
      work_order_id: workOrder.id,
      replaces_entry_id: v.replaces_entry_id,
      date: v.date,
      start_time: v.start_time,
      end_time: v.end_time,
      operator_id: v.operator_id,
      produced_qty: toNum(v.produced_qty),
      total_used_kg: toNum(v.total_used_kg),
      scraps: v.scraps.filter((r) => r.reason_code_id || r.kg.trim()).map((r) => ({ reason_code_id: r.reason_code_id, kg: toNum(r.kg) })),
      downtimes: v.downtimes.filter((r) => r.reason_code_id || r.minutes.trim()).map((r) => ({ reason_code_id: r.reason_code_id, minutes: toNum(r.minutes) })),
      scrap_product_id: v.scrap_product_id || null,
      target_warehouse_id: v.target_warehouse_id || null,
      close_work_order: v.close_work_order,
      raw_lots: v.raw_lots,
    };
    const parsed = productionEntryV2Schema.safeParse(payload);
    if (!parsed.success) return toast.error("Eksik veya hatalı bilgi", { description: parsed.error.issues[0]?.message });
    try {
      setSaving(true);
      const r = await saveProductionEntry(parsed.data);
      toast.success(r.replaced ? "Giriş düzeltildi" : "Giriş kaydedildi", {
        description: [r.lotNo ? `Lot: ${r.lotNo}` : "Stok hareketi yok (sadece duruş)", r.moldShots > 0 ? `Kalıp +${formatTR(r.moldShots, 0)} atış` : null, r.closed ? "İş emri kapatıldı" : null]
          .filter(Boolean)
          .join(" · "),
      });
      router.refresh();
      if (r.closed) return onClose();
      const d = await reload();
      resetForm(d?.entries ?? []);
    } catch (error) {
      toast.error("Kaydedilemedi", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const reopen = async () => {
    if (!workOrder) return;
    const note = prompt("İş emri yeniden açılacak. Neden? (isteğe bağlı)");
    if (note === null) return;
    try {
      setStatusBusy(true);
      await reopenWorkOrder(workOrder.id, note);
      toast.success("İş emri yeniden açıldı", { description: "Girişleri düzeltip tekrar kapatabilirsiniz." });
      await reload();
      router.refresh();
    } catch (error) {
      toast.error("Açılamadı", { description: getErrorMessage(error) });
    } finally {
      setStatusBusy(false);
    }
  };

  const closeOrder = async () => {
    if (!workOrder || !confirm("İş emri kapatılsın mı? Kapatılan iş emrine giriş yapılamaz.")) return;
    try {
      setStatusBusy(true);
      await closeWorkOrder(workOrder.id);
      toast.success("İş emri kapatıldı");
      await reload();
      router.refresh();
    } catch (error) {
      toast.error("Kapatılamadı", { description: getErrorMessage(error) });
    } finally {
      setStatusBusy(false);
    }
  };

  if (!workOrder) return null;
  const editing = Boolean(f.replaces_entry_id);
  // Tamamlanmış ya da iptal edilmiş iş emrinde girişler salt okunur
  const isClosed = data?.workOrder.status === "done" || data?.workOrder.status === "cancelled";
  const operatorOptions = (data?.operators ?? []).map((o) => ({ value: o.id, label: o.name }));
  const targetSpeed = mPerHourToMin(tech?.targetMPerHour);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94vh] w-[96vw] overflow-y-auto sm:max-w-[1400px]">
        <DialogHeader>
          <DialogTitle>Üretim Girişi — {workOrder.no}</DialogTitle>
          <DialogDescription>
            {workOrder.product?.code} {workOrder.product?.name}
            {data?.workOrder.moldLabel && ` · Kalıp: ${data.workOrder.moldLabel}`}
          </DialogDescription>
        </DialogHeader>

        {data?.workOrder.status === "cancelled" && (
          <div className="flex items-center gap-2 rounded-md border border-l-4 border-border border-l-danger bg-danger/10 px-4 py-3 text-sm">
            <Lock className="h-4 w-4 text-danger" aria-hidden />
            Bu iş emri iptal edilmiş; girişler yalnızca görüntülenebilir ve iş emri geri açılamaz.
          </div>
        )}
        {isClosed && data?.workOrder.status !== "cancelled" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-l-4 border-border border-l-warning bg-warning/10 px-4 py-3 text-sm">
            <span className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-warning" aria-hidden />
              Bu iş emri kapatılmış; girişler yalnızca görüntülenebilir.
              {!isAdmin && " Düzeltme için yöneticinin yeniden açması gerekir."}
            </span>
            {isAdmin && (
              <Button size="sm" onClick={reopen} disabled={statusBusy}>
                {statusBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <LockOpen className="mr-1.5 h-4 w-4" />}
                Yeniden aç ve düzenle
              </Button>
            )}
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" aria-label="Yükleniyor" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── İş emri özeti ── */}
            <section className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>
                    Üretilen <span className="font-semibold tabular-nums">{formatTR(totals.input.producedQty, 0)}</span> / {formatTR(planned, 0)} {unit}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{pct(progress, 0)}</span>
                </div>
                <progress value={progress * 100} max={100} aria-label="İş emri ilerlemesi" className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary" />
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                <Kpi label="Giriş sayısı" value={String(entries.length)} hint={`${formatTR(totals.input.usedKg, 0)} kg hammadde`} />
                <Kpi label="Fire" value={pct(totals.m?.scrapPct ?? null, 2)} hint={`${formatTR(totals.input.scrapKg, 1)} kg · hedef ≤ %${formatTR(targets.scrapPct, 1)}`} tone={scrapTone(totals.m?.scrapPct ?? null, targets)} />
                <Kpi label="OEE" value={pct(totals.m?.oee ?? null)} hint={`çalışma / vardiya · hedef ≥ %${formatTR(targets.oeePct, 0)}`} tone={oeeTone(totals.m?.oee ?? null, targets)} />
                <Kpi label="Overweight" value={pct(totals.m?.overweightPct ?? null, 2)} hint={`tolerans ±%${formatTR(targets.overweightTolerancePct, 1)}`} tone={owTone(totals.m?.overweightPct ?? null, targets)} />
                <Kpi label="Kapasite kullanımı" value={pct(totals.m?.capacityUse ?? null, 0)} hint={tech?.capacityKgPerHour ? `makine ${formatTR(tech.capacityKgPerHour, 0)} kg/sa` : "makine kapasitesi yok"} tone={capTone(totals.m?.capacityUse ?? null)} />
                <Kpi label="Çalışma / duruş" value={`${formatTR((totals.m?.runMin ?? 0) / 60, 1)} / ${formatTR(totals.input.downtimeMin / 60, 1)} sa`} hint={isInjection ? (totals.m?.actualCycleSec ? `ort. çevrim ${formatTR(totals.m.actualCycleSec, 1)} sn` : undefined) : totals.m?.actualSpeedMPerMin ? `ort. hız ${formatTR(totals.m.actualSpeedMPerMin, 2)} m/dk` : undefined} />
              </div>
            </section>

            {/* ── Yapılan girişler ── */}
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Yapılan girişler</h3>
                {!isClosed && entries.length > 0 && (
                  <Button size="sm" variant="secondary" onClick={closeOrder} disabled={statusBusy}>
                    <Lock className="mr-1.5 h-4 w-4" />
                    İş emrini kapat
                  </Button>
                )}
              </div>
              {entries.length === 0 ? (
                <p className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">Henüz giriş yok.</p>
              ) : (
                <div className="max-h-72 overflow-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
                      <tr>
                        {["Tarih / saat", "Operatör", `Üretim (${unit})`, "Hammadde", "Fire", "Duruş", isInjection ? "Gerç. çevrim" : "Gerç. hız", "OEE", "Overweight", "Kapasite", "Lot", ""].map((h, i) => (
                          <th key={i} className={cn("whitespace-nowrap px-2 py-2 font-medium", i >= 2 && i <= 9 && "text-right")}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e) => {
                        const m = metricsOf(e);
                        const start = e.startAt ? new Date(e.startAt) : e.entryTime ? new Date(e.entryTime) : null;
                        const end = e.endAt ? new Date(e.endAt) : null;
                        return (
                          <tr key={e.id} className={cn("border-b border-border last:border-0 even:bg-muted/30", f.replaces_entry_id === e.id && "bg-primary/10")}>
                            <td className="whitespace-nowrap px-2 py-2">
                              {start ? `${start.toLocaleDateString("tr-TR", { timeZone: TZ })} ${localTime(start)}` : "—"}
                              {end ? `–${localTime(end)}` : <span className="text-xs text-muted-foreground"> ({e.shift === "night" ? "gece" : "gündüz"})</span>}
                            </td>
                            <td className="max-w-[8rem] truncate px-2 py-2">{e.operator ?? "—"}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{formatTR(e.producedQty, 0)}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{formatTR(e.usedKg, 1)} kg</td>
                            <td className="px-2 py-2 text-right" title={e.scraps.map((x) => `${reasonLabel.get(x.reasonCodeId) ?? "?"}: ${formatTR(x.kg, 1)} kg`).join("\n")}>
                              <span className="mr-1 text-xs text-muted-foreground tabular-nums">{formatTR(e.scrapKg, 1)} kg</span>
                              <Pill value={m?.scrapPct ?? null} tone={scrapTone(m?.scrapPct ?? null, targets)} d={2} />
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums" title={e.downtimes.map((x) => `${reasonLabel.get(x.reasonCodeId) ?? "?"}: ${formatTR(x.minutes, 0)} dk`).join("\n")}>
                              {formatTR(e.downtimeMin, 0)} dk
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">
                              {isInjection ? (m?.actualCycleSec ? `${formatTR(m.actualCycleSec, 1)} sn` : "—") : m?.actualSpeedMPerMin ? `${formatTR(m.actualSpeedMPerMin, 2)} m/dk` : "—"}
                            </td>
                            <td className="px-2 py-2 text-right">
                              <Pill value={m?.oee ?? null} tone={oeeTone(m?.oee ?? null, targets)} />
                            </td>
                            <td className="px-2 py-2 text-right">
                              <Pill value={m?.overweightPct ?? null} tone={owTone(m?.overweightPct ?? null, targets)} d={2} />
                            </td>
                            <td className="px-2 py-2 text-right">
                              <Pill value={m?.capacityUse ?? null} tone={capTone(m?.capacityUse ?? null)} d={0} />
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">{e.lotNo ?? "—"}</td>
                            <td className="whitespace-nowrap px-2 py-2 text-right">
                              <Button size="icon" variant="ghost" onClick={() => edit(e)} disabled={isClosed || busyEntry === e.id} aria-label="Düzelt" title={isClosed ? "Önce iş emrini yeniden açın" : "Düzelt"}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => cancelEntry(e)} disabled={isClosed || busyEntry === e.id} aria-label="İptal et" title={isClosed ? "Önce iş emrini yeniden açın" : "İptal et"}>
                                {busyEntry === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4 text-danger" />}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── Giriş formu ── */}
            {!isClosed && (
            <section id="entry-form" className={cn("space-y-4 rounded-lg border p-4", editing ? "border-primary bg-primary/5" : "border-border")}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{editing ? "Girişi düzelt" : "Yeni giriş"}</h3>
                {editing && (
                  <Button size="sm" variant="ghost" onClick={() => resetForm(entries)}>
                    <X className="mr-1 h-4 w-4" />
                    Düzeltmeden vazgeç
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <div className="space-y-1">
                  <Label htmlFor="pe-date">Tarih *</Label>
                  <Input id="pe-date" type="date" {...register("date")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pe-start">Başlangıç *</Label>
                  <Input id="pe-start" type="time" {...register("start_time")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pe-end">Bitiş *</Label>
                  <Input id="pe-end" type="time" {...register("end_time")} />
                  <p className="text-xs text-muted-foreground">{range ? `${hm(range.minutes)}${range.endAt.getDate() !== range.startAt.getDate() ? " · ertesi gün bitiyor" : ""}` : "saat aralığı girin"}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Operatör *</Label>
                  <SearchableSelect value={f.operator_id ?? ""} onValueChange={(v) => setValue("operator_id", v)} options={operatorOptions} placeholder={operatorOptions.length ? "Operatör seçin" : "Operatör listesi boş"} />
                  {operatorOptions.length === 0 && (
                    <p className="text-xs text-warning">
                      Ana Veri → <Link href="/ana-veri" className="underline">Operatörler</Link> sekmesinden ekleyin.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="pe-produced">Sağlam üretim ({unit})</Label>
                  <Input id="pe-produced" type="number" step="0.001" min="0" {...register("produced_qty")} />
                  <p className="text-xs text-muted-foreground">Kalan: {formatTR(Math.max(0, planned - totals.input.producedQty), 0)} {unit}</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pe-used">Kullanılan hammadde (kg)</Label>
                  <div className="flex gap-1">
                    <Input id="pe-used" type="number" step="0.001" min="0" {...register("total_used_kg", { onChange: () => setUsedManual(true) })} />
                    <Button type="button" variant={usedManual ? "default" : "outline"} size="icon" onClick={suggestUsed} title="Otomatik hesaba dön: üretim × birim ağırlık + fire">
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {unitKg ? (
                    <p className="text-xs text-muted-foreground">
                      {isInjection
                        ? `Birim: ${formatTR(tech?.productWeightG ?? 0, 1)} g parça + ${formatTR(runnerPerPartG, 1)} g yolluk = ${formatTR(unitKg * 1000, 1)} g`
                        : `Birim: ${formatTR(unitKg, 3)} kg/m`}
                      {expectedUsedKg !== null && produced > 0 && (
                        <>
                          <br />
                          Beklenen: {formatTR(produced, 0)} × {formatTR(unitKg * 1000, 1)} g = {formatTR(expectedGoodKg ?? 0, 2)} kg + fire {formatTR(liveScrap, 2)} kg ={" "}
                          <span className="font-medium text-foreground">{formatTR(expectedUsedKg, 2)} kg</span>
                        </>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-warning">Reçetede birim ağırlık yok</p>
                  )}
                  {unitKg ? (
                    <p className={cn("text-xs", usedManual ? "text-warning" : "text-muted-foreground")}>
                      {usedManual ? "Elle girildi — otomatiğe dönmek için değneğe basın" : "Otomatik: üretim ve fire girdikçe hesaplanır"}
                    </p>
                  ) : null}
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Mamulün gireceği depo</Label>
                  <SearchableSelect value={f.target_warehouse_id ?? ""} onValueChange={(v) => setValue("target_warehouse_id", v)} options={targetWarehouses.map((w) => ({ value: w.id, label: w.name }))} placeholder="Depo seçin" />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Fire satırları */}
                <div className="space-y-2 rounded-md border border-l-4 border-border border-l-danger p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Fire</span>
                    <span className="text-xs text-muted-foreground tabular-nums">toplam {formatTR(liveScrap, 3)} kg</span>
                  </div>
                  {scrapRows.fields.map((row, i) => (
                    <div key={row.id} className="flex gap-2">
                      <div className="flex-1">
                        <SearchableSelect
                          value={f.scraps?.[i]?.reason_code_id ?? ""}
                          onValueChange={(v) => setValue(`scraps.${i}.reason_code_id`, v)}
                          options={scrapReasons.map((r) => ({ value: r.id, label: `${r.code} - ${r.label ?? r.name ?? ""}`, searchString: r.code }))}
                          placeholder="Fire nedeni"
                        />
                      </div>
                      <Input type="number" step="0.001" min="0" placeholder="kg" className="w-28" {...register(`scraps.${i}.kg`)} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => scrapRows.remove(i)} aria-label="Satırı sil">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="outline" onClick={() => scrapRows.append({ reason_code_id: "", kg: "" })}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Fire satırı ekle
                  </Button>
                  {liveScrap > 0 && (
                    <div className="space-y-1 pt-1">
                      <Label className="text-xs">Fire hangi hurda/regrind ürününe işlensin?</Label>
                      <SearchableSelect
                        value={f.scrap_product_id ?? ""}
                        onValueChange={(v) => setValue("scrap_product_id", v)}
                        options={scrapProducts.map((p) => ({ value: p.id, label: `${p.code} - ${p.name ?? ""}`, searchString: p.code }))}
                        placeholder="Hurda ürünü seçin"
                      />
                    </div>
                  )}
                </div>

                {/* Duruş satırları */}
                <div className="space-y-2 rounded-md border border-l-4 border-border border-l-warning p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Duruş</span>
                    <span className="text-xs text-muted-foreground tabular-nums">toplam {formatTR(liveDown, 0)} dk</span>
                  </div>
                  {downRows.fields.map((row, i) => (
                    <div key={row.id} className="flex gap-2">
                      <div className="flex-1">
                        <SearchableSelect
                          value={f.downtimes?.[i]?.reason_code_id ?? ""}
                          onValueChange={(v) => setValue(`downtimes.${i}.reason_code_id`, v)}
                          options={downtimeReasons.map((r) => ({ value: r.id, label: `${r.code} - ${r.label ?? r.name ?? ""}`, searchString: r.code }))}
                          placeholder="Duruş nedeni"
                        />
                      </div>
                      <Input type="number" step="1" min="0" placeholder="dk" className="w-28" {...register(`downtimes.${i}.minutes`)} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => downRows.remove(i)} aria-label="Satırı sil">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="outline" onClick={() => downRows.append({ reason_code_id: "", minutes: "" })}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Duruş satırı ekle
                  </Button>
                </div>
              </div>

              {/* Reçine lotları (isteğe bağlı) */}
              {used > 0 && bomItems.length > 0 && (
                <details className="rounded-md border border-border p-3">
                  <summary className="cursor-pointer text-sm font-medium">Tüketilen hammadde lotları (isteğe bağlı, izlenebilirlik için)</summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {bomItems.map((item) => {
                      const product = one(item.product);
                      const need = (used * Number(item.ratio_pct)) / 100;
                      const lots = rawLots.filter((l) => l.productId === item.component_product_id);
                      const selected = f.raw_lots?.[item.component_product_id] ?? "";
                      const selectedLot = lots.find((l) => l.lotNo === selected);
                      return (
                        <div key={item.component_product_id} className="space-y-1">
                          <div className="flex justify-between gap-2 text-xs">
                            <span className="font-medium">{product?.code}</span>
                            <span className="text-muted-foreground">gereken {formatTR(need, 2)} kg</span>
                          </div>
                          <SearchableSelect
                            value={selected}
                            onValueChange={(v) => setValue("raw_lots", { ...(f.raw_lots ?? {}), [item.component_product_id]: v })}
                            options={[{ value: "", label: "Lot seçilmedi" }, ...lots.map((l, i) => ({ value: l.lotNo, label: `${l.lotNo} — ${formatTR(l.qty, 2)} kg${i === 0 ? " (en eski)" : ""}` }))]}
                            placeholder={lots.length ? "Lot seçilmedi" : "Lotlu stok yok"}
                            disabled={lots.length === 0}
                          />
                          {selectedLot && selectedLot.qty < need && <p className="text-xs text-danger">Bu lotta yeterli miktar yok.</p>}
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}

              {/* Canlı hesap */}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                <Kpi label="Çalışma süresi" value={live ? hm(live.runMin) : "—"} hint={range ? `planlı ${hm(range.minutes)} − duruş ${formatTR(liveDown, 0)} dk` : undefined} />
                {isInjection ? (
                  <Kpi
                    label="Gerçekleşen çevrim"
                    value={live?.actualCycleSec ? `${formatTR(live.actualCycleSec, 1)} sn` : "—"}
                    hint={tech?.cycleTimeSec ? `hedef ${formatTR(tech.cycleTimeSec, 1)} sn · ${tech.cavityCount ?? 1} göz` : "reçetede çevrim yok"}
                    tone={live?.actualCycleSec && tech?.cycleTimeSec ? (live.actualCycleSec <= tech.cycleTimeSec * 1.05 ? "ok" : live.actualCycleSec <= tech.cycleTimeSec * 1.2 ? "warn" : "bad") : "none"}
                  />
                ) : (
                  <Kpi
                    label="Gerçekleşen hız"
                    value={live?.actualSpeedMPerMin ? `${formatTR(live.actualSpeedMPerMin, 2)} m/dk` : "—"}
                    hint={targetSpeed ? `hedef ${formatTR(targetSpeed, 2)} m/dk` : "reçetede hedef hız yok"}
                    tone={live?.actualSpeedMPerMin && targetSpeed ? (live.actualSpeedMPerMin >= targetSpeed * 0.95 ? "ok" : live.actualSpeedMPerMin >= targetSpeed * 0.8 ? "warn" : "bad") : "none"}
                  />
                )}
                <Kpi label="Fire" value={pct(live?.scrapPct ?? null, 2)} tone={scrapTone(live?.scrapPct ?? null, targets)} />
                <Kpi label="OEE" value={pct(live?.oee ?? null)} hint={live && range ? `${hm(live.runMin)} / ${hm(range.minutes)}${live.performance !== null ? ` · hız perf. ${pct(live.performance, 0)}` : ""}` : undefined} tone={oeeTone(live?.oee ?? null, targets)} />
                <Kpi label="Overweight" value={pct(live?.overweightPct ?? null, 2)} tone={owTone(live?.overweightPct ?? null, targets)} />
                <Kpi label="Kapasite kullanımı" value={pct(live?.capacityUse ?? null, 0)} hint={live?.kgPerHour ? `${formatTR(live.kgPerHour, 1)} kg/sa` : undefined} tone={capTone(live?.capacityUse ?? null)} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <label className="flex items-center gap-3 text-sm">
                  <Switch checked={Boolean(f.close_work_order)} onCheckedChange={(v) => setValue("close_work_order", v)} />
                  <span>
                    <span className="font-medium">Bu girişle iş emrini kapat</span>
                    <span className="block text-xs text-muted-foreground">Kapatılan iş emrine giriş ve düzeltme yapılamaz.</span>
                  </span>
                </label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                    Kapat
                  </Button>
                  <Button type="button" onClick={submit} disabled={saving || loading}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editing ? "Düzeltmeyi kaydet" : f.close_work_order ? "Kaydet ve iş emrini kapat" : "Girişi kaydet"}
                  </Button>
                </div>
              </div>
            </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
