"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ncrCloseSchema, NcrCloseFormValues } from "@/lib/validations/quality";
import { closeNcr, type NcrRow } from "@/app/actions/quality";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn, getErrorMessage } from "@/lib/utils";
import { formatTR } from "@/lib/format";

interface NcrCloseModalProps {
  ncr: NcrRow | null;
  onClose: () => void;
  warehouses: { id: string; name: string; type: string }[];
}

export function NcrCloseModal({ ncr, onClose, warehouses }: NcrCloseModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const releaseTargets = warehouses.filter((w) => w.type !== "quarantine" && w.type !== "scrap");
  const inQuarantine = Boolean(ncr?.quarantine_warehouse_id);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<NcrCloseFormValues>({ resolver: zodResolver(ncrCloseSchema) });

  useEffect(() => {
    if (!ncr) return;
    reset({
      id: ncr.id,
      root_cause: "",
      corrective_action: "",
      disposition: null,
      release_warehouse_id: ncr.source_warehouse_id ?? "",
    });
  }, [ncr, reset]);

  const disposition = watch("disposition");

  const onSubmit = async (data: NcrCloseFormValues) => {
    if (inQuarantine && !data.disposition) {
      toast.error("Karantinadaki mal için karar seçin: serbest bırak veya imha.");
      return;
    }
    try {
      setIsSubmitting(true);
      await closeNcr(data);
      toast.success(`${ncr?.no} kapatıldı`);
      onClose();
    } catch (error) {
      toast.error("Kapatılamadı", { description: getErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!ncr) return null;

  return (
    <Dialog open={Boolean(ncr)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ncr.no} — Kapat</DialogTitle>
          <DialogDescription>
            {ncr.product?.code} · {formatTR(Number(ncr.quantity), 2)} {ncr.product?.unit} · {ncr.description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Kök Neden *</Label>
            <Textarea {...register("root_cause")} rows={2} placeholder="Uygunsuzluğa ne sebep oldu?" />
            {errors.root_cause && <p className="text-xs text-danger">{errors.root_cause.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Düzeltici Faaliyet *</Label>
            <Textarea {...register("corrective_action")} rows={2} placeholder="Tekrarlanmaması için ne yapıldı?" />
            {errors.corrective_action && <p className="text-xs text-danger">{errors.corrective_action.message}</p>}
          </div>

          {inQuarantine && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <p className="text-sm">
                <span className="font-medium">Karantinadaki mal:</span> {formatTR(Number(ncr.quantity), 2)}{" "}
                {ncr.product?.unit} ({ncr.quarantine?.name})
              </p>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Karantina kararı">
                {(
                  [
                    ["release", "Serbest bırak", "Kullanılabilir; depoya geri döner"],
                    ["scrap", "İmha et", "Karantinadan fire olarak düşer"],
                  ] as const
                ).map(([value, label, hint]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={disposition === value}
                    onClick={() => setValue("disposition", value)}
                    className={cn(
                      "rounded-md border p-3 text-left text-sm transition-colors",
                      disposition === value ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
                    )}
                  >
                    <span className="font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </button>
                ))}
              </div>
              {disposition === "release" && (
                <div className="space-y-2">
                  <Label>Serbest Bırakılan Malın Gireceği Depo</Label>
                  <SearchableSelect
                    value={watch("release_warehouse_id") || ""}
                    onValueChange={(val) => setValue("release_warehouse_id", val)}
                    options={releaseTargets.map((w) => ({ value: w.id, label: w.name }))}
                    placeholder="Depo seçin"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              NCR&apos;yi Kapat
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
