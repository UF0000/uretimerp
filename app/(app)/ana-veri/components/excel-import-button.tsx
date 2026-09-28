"use client";

import { useRef, useState } from "react";
import * as xlsx from "xlsx";
import { Upload, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { getErrorMessage } from "@/lib/utils";
import type { ExcelRow } from "@/lib/excel";
interface ExcelImportButtonProps {
  onImport: (data: ExcelRow[]) => Promise<number>;
  sampleFormat: string;
}

export function ExcelImportButton({
  onImport,
  sampleFormat,
}: ExcelImportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = xlsx.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = xlsx.utils.sheet_to_json<ExcelRow>(ws);

        if (data.length === 0) {
          throw new Error("Excel dosyası boş veya okunamadı.");
        }

        const importedCount = await onImport(data);
        toast.success(`${importedCount} adet kayıt başarıyla içe aktarıldı!`);
        setIsOpen(false);
      } catch (err) {
        toast.error("İçe Aktarım Hatası", {
          description: getErrorMessage(err),
        });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };
    reader.onerror = () => {
      toast.error("Dosya okunamadı.");
      setIsImporting(false);
    };

    reader.readAsBinaryString(file);
  };

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        <Upload className="w-4 h-4 mr-2" />
        Excel&apos;den Yükle
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excel&apos;den İçe Aktar</DialogTitle>
            <DialogDescription>
              Excel (.xlsx, .xls) dosyanızı seçerek toplu veri
              yükleyebilirsiniz.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-muted p-4 rounded-md text-sm">
              <div className="font-semibold mb-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 text-primary" />
                Excel Sütun Formatı
              </div>
              <p className="text-muted-foreground whitespace-pre-wrap font-mono text-xs">
                {sampleFormat}
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                * Koyu renkli veya parantez içindeki ifadeler (örn: Kodu, Adi)
                Excel sütun başlıklarınız olmalıdır. Sütun adları birebir
                eşleşmelidir.
              </p>
            </div>

            <div className="flex justify-center">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                    Yükleniyor...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" /> Dosya Seç
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
