"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as xlsx from "xlsx";
import { Download, Factory, FileText, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { cn } from "@/lib/utils";

type Option = { id: string; label: string };

interface AnalyticsFiltersProps {
  from: string;
  to: string;
  lineType: "extrusion" | "injection";
  options: { lines: Option[]; products: Option[]; workOrders: Option[]; rawMaterials: Option[] };
  /** Excel'e aktarılacak tablolar: sayfa adı → satırlar */
  exportSheets: { name: string; rows: Record<string, string | number | null>[] }[];
}

const ALL = "";

/** Boru / Fitting geçişi. Tür değişince türe özgü filtreler (hat, ürün, iş emri, hammadde) sıfırlanır. */
export function TypeToggle({ from, to, lineType }: { from: string; to: string; lineType: "extrusion" | "injection" }) {
  const router = useRouter();
  const switchType = (type: "boru" | "fitting") => {
    const next = new URLSearchParams();
    next.set("tur", type);
    next.set("bas", from);
    next.set("bit", to);
    router.push(`/uretim/analiz?${next.toString()}`);
  };
  return (
    <div className="inline-flex rounded-lg border border-border p-1" role="group" aria-label="Üretim türü">
      {(
        [
          ["boru", "Boru", "extrusion"],
          ["fitting", "Fitting", "injection"],
        ] as const
      ).map(([slug, label, type]) => (
        <Button key={slug} variant={lineType === type ? "default" : "ghost"} onClick={() => switchType(slug)} aria-pressed={lineType === type} className="min-w-28">
          <Factory className="mr-1.5 h-4 w-4" />
          {label}
        </Button>
      ))}
    </div>
  );
}

export function AnalyticsFilters({ from, to, lineType, options, exportSheets }: AnalyticsFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/uretim/analiz?${next.toString()}`);
  };

  const exportExcel = () => {
    const book = xlsx.utils.book_new();
    for (const sheet of exportSheets) {
      const ws = sheet.rows.length ? xlsx.utils.json_to_sheet(sheet.rows) : xlsx.utils.aoa_to_sheet([["(kayıt yok)"]]);
      xlsx.utils.book_append_sheet(book, ws, sheet.name.slice(0, 31));
    }
    xlsx.writeFile(book, `uretim-analizi-${lineType === "extrusion" ? "boru" : "fitting"}-${from}-${to}.xlsx`);
  };

  const select = (key: string, label: string, opts: Option[], placeholder: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <SearchableSelect
        value={params.get(key) ?? ALL}
        onValueChange={(v) => set(key, v)}
        options={[{ value: ALL, label: placeholder }, ...opts.map((o) => ({ value: o.id, label: o.label }))]}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="space-y-4 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <TypeToggle from={from} to={to} lineType={lineType} />
        <span className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <FileText className="mr-1.5 h-4 w-4" />
          PDF / Yazdır
        </Button>
        <Button size="sm" variant="outline" onClick={exportExcel}>
          <Download className="mr-1.5 h-4 w-4" />
          Excel
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        <div className="space-y-1">
          <Label className="text-xs">Başlangıç</Label>
          <Input key={`bas-${from}`} type="date" defaultValue={from} onChange={(e) => e.target.value && set("bas", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Bitiş</Label>
          <Input key={`bit-${to}`} type="date" defaultValue={to} onChange={(e) => e.target.value && set("bit", e.target.value)} />
        </div>
        {select("hat", "Makine / ekstrüder", options.lines, "Tüm makineler")}
        <div className="space-y-1">
          <Label className="text-xs">Vardiya</Label>
          <SearchableSelect
            value={params.get("vardiya") ?? ALL}
            onValueChange={(v) => set("vardiya", v)}
            options={[
              { value: ALL, label: "Tüm vardiyalar" },
              { value: "day", label: "Gündüz" },
              { value: "night", label: "Gece" },
            ]}
            placeholder="Tüm vardiyalar"
          />
        </div>
        {select("hammadde", "Hammadde türü", options.rawMaterials, "Tümü")}
        {select("urun", "Ürün", options.products, "Tüm ürünler")}
        {select("ie", "Üretim emri", options.workOrders, "Tüm iş emirleri")}
        <div className="flex items-end">
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full", params.size <= 1 && "invisible")}
            onClick={() => router.push(`/uretim/analiz?tur=${lineType === "extrusion" ? "boru" : "fitting"}`)}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Temizle
          </Button>
        </div>
      </div>
    </div>
  );
}
