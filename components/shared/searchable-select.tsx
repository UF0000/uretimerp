"use client";

import { useState } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface Option {
  value: string;
  label: string;
  searchString?: string;
}

interface SearchableSelectProps {
  value: string;
  onValueChange: (val: string) => void;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableSelect({ 
  value, 
  onValueChange, 
  options, 
  placeholder = "Seçiniz", 
  searchPlaceholder = "Ara...",
  className,
  disabled = false
}: SearchableSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredOptions = options.filter(opt => {
    const term = searchTerm.toLowerCase();
    return opt.label.toLowerCase().includes(term) || opt.searchString?.toLowerCase().includes(term);
  });

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

  return (
    <Select 
      value={value} 
      onValueChange={(val) => onValueChange(val ?? "")}
      onOpenChange={(open) => { if (!open) setSearchTerm(""); }}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {selectedLabel}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <div className="p-2 sticky top-0 bg-popover z-10 border-b mb-1">
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="h-8"
          />
        </div>
        {filteredOptions.length === 0 && (
          <div className="p-2 text-sm text-muted-foreground text-center">Sonuç bulunamadı</div>
        )}
        {options.map((opt) => {
          const isSelected = opt.value === value;
          const isFiltered = filteredOptions.some(f => f.value === opt.value);
          
          // Always mount the selected item so Radix SelectValue doesn't show the raw UUID.
          // Hide it if it doesn't match the search filter.
          if (!isSelected && !isFiltered) return null;
          
          return (
            <SelectItem 
              key={opt.value} 
              value={opt.value}
              className={!isFiltered ? "hidden" : ""}
            >
              {opt.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
