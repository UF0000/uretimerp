import { Recycle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTR } from "@/lib/format";
import type { RegrindScrapGroup } from "@/app/actions/stock";

/** Grade bazında regrind (tekrar kullanılabilir) ve hurda (satış/imha) stokları. */
export function RegrindScrapSummary({ groups }: { groups: RegrindScrapGroup[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Recycle className="h-4 w-4 text-muted-foreground" aria-hidden />
          Regrind ve Hurda — Grade Bazında
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Stokta regrind veya hurda yok. Grade ayrımı için her grade ayrı ürün kartı olarak (tip: Regrind veya Hurda,
            malzeme sınıfı dolu) tanımlanmalı.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium">Grade</th>
                <th className="px-3 py-2 text-right font-medium">Regrind (kg)</th>
                <th className="px-3 py-2 text-right font-medium">Hurda (kg)</th>
                <th className="px-3 py-2 font-medium">Ürünler</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.grade} className="border-b border-border align-top last:border-0">
                  <td className="px-3 py-2 font-medium">{g.grade}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{g.regrindKg ? formatTR(g.regrindKg, 2) : "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{g.scrapKg ? formatTR(g.scrapKg, 2) : "-"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {g.products.map((p) => `${p.code} (${formatTR(p.qty, 2)} kg)`).join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
