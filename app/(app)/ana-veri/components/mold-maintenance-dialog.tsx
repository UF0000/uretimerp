"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";

import { deleteMoldMaintenance, getMoldMaintenances, recordMoldMaintenance, type MoldMaintenanceRow } from "@/app/actions/master-data/equipment";
import { usePermission } from "@/components/shared/role-provider";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatTR, parseTR } from "@/lib/format";
import {
  MAINTENANCE_KINDS,
  MAINTENANCE_KIND_LABELS,
  MAINTENANCE_STATE_BADGE,
  MAINTENANCE_STATE_LABELS,
  moldMaintenance,
  type MaintenanceKind,
} from "@/lib/mold-maintenance";
import { cn, getErrorMessage } from "@/lib/utils";

export interface MaintenanceMold {
  id: string;
  code: string;
  name: string;
  total_shots: number;
  shots_at_last_maintenance: number;
  maintenance_interval_shots: number | null;
  last_maintenance: string | null;
}

interface MoldMaintenanceDialogProps {
  mold: MaintenanceMold;
  onClose: () => void;
  onSaved: () => void;
}

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
/** "2,5" / "2.5" ikisi de kabul; boş → null */
const optionalNumber = (v: string) => (v.trim() === "" ? null : v.includes(",") ? parseTR(v) : Number(v));

export function MoldMaintenanceDialog({ mold, onClose, onSaved }: MoldMaintenanceDialogProps) {
  const isAdmin = usePermission("admin:all");
  const [history, setHistory] = useState<{ moldId: string; rows: MoldMaintenanceRow[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [doneOn, setDoneOn] = useState(today());
  const [kind, setKind] = useState<MaintenanceKind>("periyodik");
  const [description, setDescription] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [downtime, setDowntime] = useState("");
  const [cost, setCost] = useState("");

  const status = moldMaintenance(mold.total_shots, mold.shots_at_last_maintenance, mold.maintenance_interval_shots);
  const loading = history?.moldId !== mold.id;

  const load = () =>
    getMoldMaintenances(mold.id)
      .then((rows) => setHistory({ moldId: mold.id, rows }))
      .catch((error) => toast.error("Bakım kayıtları getirilemedi", { description: getErrorMessage(error) }));

  useEffect(() => {
    let alive = true;
    getMoldMaintenances(mold.id)
      .then((rows) => alive && setHistory({ moldId: mold.id, rows }))
      .catch((error) => alive && toast.error("Bakım kayıtları getirilemedi", { description: getErrorMessage(error) }));
    return () => {
      alive = false;
    };
  }, [mold.id]);

  const submit = async () => {
    const downtimeHours = optionalNumber(downtime);
    const costValue = optionalNumber(cost);
    if ((downtimeHours !== null && !Number.isFinite(downtimeHours)) || (costValue !== null && !Number.isFinite(costValue))) {
      toast.error("Duruş ve maliyet için geçerli bir sayı girin.");
      return;
    }
    try {
      setSaving(true);
      await recordMoldMaintenance({
        mold_id: mold.id,
        done_on: doneOn,
        kind,
        description: description || null,
        performed_by: performedBy || null,
        downtime_hours: downtimeHours,
        cost: costValue,
      });
      toast.success("Bakım kaydedildi; atış sayacı bakım sonrası için sıfırlandı.");
      setDescription("");
      setPerformedBy("");
      setDowntime("");
      setCost("");
      onSaved();
      await load();
    } catch (error) {
      toast.error("Bakım kaydedilemedi", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: MoldMaintenanceRow) => {
    if (!confirm("Bu bakım kaydı silinsin mi? Atış sayacının sıfır noktası geri alınmaz.")) return;
    try {
      await deleteMoldMaintenance(row.id);
      toast.success("Bakım kaydı silindi.");
      await load();
    } catch (error) {
      toast.error("Silinemedi", { description: getErrorMessage(error) });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Kalıp bakımı — {mold.code}</DialogTitle>
          <DialogDescription>{mold.name}</DialogDescription>
        </DialogHeader>

        {/* Durum */}
        <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Durum</p>
            <Badge variant={MAINTENANCE_STATE_BADGE[status.state]}>{MAINTENANCE_STATE_LABELS[status.state]}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Bakımdan beri</p>
            <p className="font-medium tabular-nums">{formatTR(status.since, 0)} atış</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Bakım aralığı</p>
            <p className="font-medium tabular-nums">{mold.maintenance_interval_shots ? `${formatTR(mold.maintenance_interval_shots, 0)} atış` : "Tanımsız"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Son bakım</p>
            <p className="font-medium">{mold.last_maintenance ? formatDate(mold.last_maintenance) : "—"}</p>
          </div>
          {status.pct !== null && (
            <div className="col-span-2 sm:col-span-4">
              <progress
                value={Math.min(100, status.pct)}
                max={100}
                aria-label="Bakım aralığının kullanılan kısmı"
                className={cn(
                  "h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-muted",
                  status.state === "gecikti"
                    ? "[&::-moz-progress-bar]:bg-danger [&::-webkit-progress-value]:bg-danger"
                    : status.state === "yaklasiyor"
                      ? "[&::-moz-progress-bar]:bg-warning [&::-webkit-progress-value]:bg-warning"
                      : "[&::-moz-progress-bar]:bg-success [&::-webkit-progress-value]:bg-success",
                )}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                %{formatTR(status.pct, 0)} kullanıldı
                {status.remaining !== null && status.remaining > 0 ? ` · bakıma ${formatTR(status.remaining, 0)} atış kaldı` : " · bakım zamanı geçti"}
              </p>
            </div>
          )}
        </div>

        {/* Bakım girişi */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Bakım yapıldı</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="mm-date">Tarih</Label>
              <Input id="mm-date" type="date" value={doneOn} max={today()} onChange={(e) => e.target.value && setDoneOn(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tür</Label>
              <SearchableSelect value={kind} onValueChange={(v) => v && setKind(v as MaintenanceKind)} options={MAINTENANCE_KINDS.map((k) => ({ value: k, label: MAINTENANCE_KIND_LABELS[k] }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mm-by">Yapan (kişi / firma)</Label>
              <Input id="mm-by" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="mm-down">Duruş (saat)</Label>
                <Input id="mm-down" inputMode="decimal" value={downtime} onChange={(e) => setDowntime(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mm-cost">Maliyet (₺)</Label>
                <Input id="mm-cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="mm-desc">Yapılan işlem</Label>
              <Textarea id="mm-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Örn: Maça temizliği, ejektör pimi değişimi" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Kaydedince bakım anındaki atış sayısı ({formatTR(mold.total_shots, 0)}) not edilir ve sonraki bakım bu noktadan sayılır.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Kapat
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
              Bakımı kaydet
            </Button>
          </div>
        </div>

        {/* Geçmiş */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Bakım geçmişi</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : history?.rows.length ? (
            <ul className="space-y-2">
              {history.rows.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-2 rounded border border-border p-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {formatDate(r.done_on)} · {MAINTENANCE_KIND_LABELS[r.kind as MaintenanceKind] ?? r.kind} · {formatTR(Number(r.shots_at), 0)} atışta
                    </p>
                    {r.description && <p className="text-muted-foreground">{r.description}</p>}
                    <p className="text-xs text-muted-foreground">
                      {[
                        r.performed_by && `Yapan: ${r.performed_by}`,
                        r.downtime_hours !== null && `Duruş: ${formatTR(Number(r.downtime_hours), 1)} sa`,
                        r.cost !== null && `Maliyet: ${formatTR(Number(r.cost))} ₺`,
                        (Array.isArray(r.creator) ? r.creator[0] : r.creator)?.name && `Giren: ${(Array.isArray(r.creator) ? r.creator[0] : r.creator)?.name}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => remove(r)} aria-label="Bakım kaydını sil">
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Henüz bakım kaydı yok.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
