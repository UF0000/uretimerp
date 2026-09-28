"use client";

import { useState } from "react";
import * as xlsx from "xlsx";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getExportData } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/utils";

/** Tüm ana tabloları tek Excel dosyasında (her tablo bir sayfa) indirir. */
export function ExportPanel() {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    try {
      setBusy(true);
      const { exportedAt, sheets } = await getExportData();
      const book = xlsx.utils.book_new();
      for (const sheet of sheets) {
        const ws = sheet.rows.length ? xlsx.utils.json_to_sheet(sheet.rows) : xlsx.utils.aoa_to_sheet([["(kayıt yok)"]]);
        xlsx.utils.book_append_sheet(book, ws, sheet.name.slice(0, 31));
      }
      const stamp = exportedAt.slice(0, 16).replace("T", "-").replace(":", "");
      xlsx.writeFile(book, `uretim-erp-yedek-${stamp}.xlsx`);
      const total = sheets.reduce((s, x) => s + x.rows.length, 0);
      toast.success("Yedek indirildi", { description: `${sheets.length} tablo, ${total} kayıt` });
    } catch (error) {
      toast.error("Dışa aktarılamadı", { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4 text-sm">
      <p>
        Ana veri, reçeteler, siparişler, iş emirleri, vardiya girişleri, lotlar, tüm stok hareketleri, stok bakiyesi,
        kalite kayıtları ve parametreler tek bir Excel dosyasında indirilir (her tablo ayrı sayfa).
      </p>
      <p className="text-muted-foreground">
        Bu dosya raporlama ve arşiv içindir. Veritabanının kendisi Supabase tarafından ayrıca yedeklenir; geri yükleme
        Supabase panelindeki Database → Backups bölümünden yapılır.
      </p>
      <Button onClick={download} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        Excel Yedeğini İndir
      </Button>
    </div>
  );
}
