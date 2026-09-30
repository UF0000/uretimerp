"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { matchesTokens, searchTokens } from "@/lib/search";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  value: string[];
  onValueChange: (val: string[]) => void;
  options: Option[];
  /** Hiçbiri seçili değilken gösterilir (ör. "Tüm aileler") */
  placeholder: string;
  className?: string;
}

/** Aramalı çoklu seçim: boş seçim = filtre yok (hepsi) */
export function MultiSelect({ value, onValueChange, options, placeholder, className }: MultiSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const tokens = searchTokens(searchTerm);
  const visible = new Set(options.filter((o) => matchesTokens(tokens, o.label)).map((o) => o.value));

  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const summary = value.length === 0 ? placeholder : value.length <= 2 ? value.map(labelOf).join(", ") : `${value.length} seçili`;

  return (
    <Select
      multiple
      value={value}
      onValueChange={(val) => onValueChange(Array.isArray(val) ? val : [])}
      onOpenChange={(open) => {
        if (!open) setSearchTerm("");
      }}
    >
      <SelectTrigger className={className} title={value.length ? value.map(labelOf).join(", ") : undefined}>
        <SelectValue className={value.length === 0 ? "text-muted-foreground" : "truncate"}>{summary}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <div className="sticky top-0 z-10 mb-1 flex gap-1 border-b bg-popover p-2">
          <Input placeholder="Ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className="h-8" />
          {value.length > 0 && (
            <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0" onClick={() => onValueChange([])}>
              <X className="mr-1 h-3.5 w-3.5" />
              Temizle
            </Button>
          )}
        </div>
        {visible.size === 0 && <div className="p-2 text-center text-sm text-muted-foreground">Sonuç bulunamadı</div>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className={visible.has(o.value) ? "" : "hidden"}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
