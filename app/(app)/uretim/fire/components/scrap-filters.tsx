"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as xlsx from "xlsx";
import { Download, FileText, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/shared/searchable-select";

const ALL = "";

interface ScrapFiltersProps {
  from: string;
  to: string;
  lineOptions: { id: string; label: string }[];
  exportSheets: { name: string; rows: Record<string, string | number | null>[] }[];
}

export function ScrapFilters({ from, to, lineOptions, exportSheets }: ScrapFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();

  const set = (key: string, value: string, reset: string[] = []) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    for (const r of reset) next.delete(r);
    router.push(`/uretim/fire?${next.toString()}`);
  };

  const exportExcel = () => {
    const book = xlsx.utils.book_new();
    for (const sheet of exportSheets) {
      const ws = sheet.rows.length ? xlsx.utils.json_to_sheet(sheet.rows) : xlsx.utils.aoa_to_sheet([["(kayıt yok)"]]);
      xlsx.utils.book_append_sheet(book, ws, sheet.name.slice(0, 31));
    }
    xlsx.writeFile(book, `fire-raporu-${from}-${to}.xlsx`);
  };

  return (
    <div className="space-y-3 print:hidden">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="space-y-1">
          <Label className="text-xs">Başlangıç</Label>
          <Input key={`bas-${from}`} type="date" defaultValue={from} onChange={(e) => e.target.value && set("bas", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Bitiş</Label>
          <Input key={`bit-${to}`} type="date" defaultValue={to} onChange={(e) => e.target.value && set("bit", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Üretim türü</Label>
          <SearchableSelect
            value={params.get("tur") ?? ALL}
            onValueChange={(v) => set("tur", v, ["hat"])}
            options={[
              { value: ALL, label: "Tümü" },
              { value: "ekstruzyon", label: "Ekstrüzyon" },
              { value: "enjeksiyon", label: "Enjeksiyon" },
            ]}
            placeholder="Tümü"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Makine</Label>
          <SearchableSelect
            value={params.get("hat") ?? ALL}
            onValueChange={(v) => set("hat", v)}
            options={[{ value: ALL, label: "Tüm makineler" }, ...lineOptions.map((o) => ({ value: o.id, label: o.label }))]}
            placeholder="Tüm makineler"
          />
        </div>
        <div className="col-span-2 flex items-end gap-2 md:col-span-1">
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <FileText className="mr-1.5 h-4 w-4" />
            PDF
          </Button>
          <Button size="sm" variant="outline" onClick={exportExcel}>
            <Download className="mr-1.5 h-4 w-4" />
            Excel
          </Button>
          {params.size > 0 && (
            <Button size="sm" variant="ghost" onClick={() => router.push("/uretim/fire")} aria-label="Filtreleri temizle">
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
