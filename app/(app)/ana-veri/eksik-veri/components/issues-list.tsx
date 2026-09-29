"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleAlert, TriangleAlert } from "lucide-react";

import type { DataIssue, IssueArea, IssueSeverity } from "@/lib/data-quality";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE = 50;

export function IssuesList({ issues }: { issues: DataIssue[] }) {
  const [area, setArea] = useState<IssueArea | "">("");
  const [severity, setSeverity] = useState<IssueSeverity | "">("");
  const [problem, setProblem] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const areas = [...new Set(issues.map((i) => i.area))];
  const byArea = area ? issues.filter((i) => i.area === area) : issues;
  const problems = [...new Map(byArea.map((i) => [i.problem, byArea.filter((x) => x.problem === i.problem).length])).entries()].sort((a, b) => b[1] - a[1]);
  const visible = byArea.filter((i) => (!severity || i.severity === severity) && (!problem || i.problem === problem));

  const reset = (fn: () => void) => {
    fn();
    setLimit(PAGE);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Alan:</span>
        <Button size="sm" variant={area === "" ? "default" : "outline"} onClick={() => reset(() => { setArea(""); setProblem(""); })}>
          Tümü ({issues.length})
        </Button>
        {areas.map((a) => (
          <Button key={a} size="sm" variant={area === a ? "default" : "outline"} onClick={() => reset(() => { setArea(a); setProblem(""); })}>
            {a} ({issues.filter((i) => i.area === a).length})
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Önem:</span>
        {([["", "Hepsi"], ["blocker", "Hesap yapılamıyor"], ["warning", "Hesap eksik çıkıyor"]] as const).map(([v, label]) => (
          <Button key={v} size="sm" variant={severity === v ? "default" : "outline"} onClick={() => reset(() => setSeverity(v))}>
            {label}
          </Button>
        ))}
      </div>

      {problems.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Eksik:</span>
          <Button size="sm" variant={problem === "" ? "secondary" : "ghost"} onClick={() => reset(() => setProblem(""))}>
            Hepsi
          </Button>
          {problems.map(([p, n]) => (
            <Button key={p} size="sm" variant={problem === p ? "secondary" : "ghost"} onClick={() => reset(() => setProblem(p))}>
              {p} ({n})
            </Button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2 font-medium">Önem</th>
              <th className="px-3 py-2 font-medium">Alan</th>
              <th className="px-3 py-2 font-medium">Kayıt</th>
              <th className="px-3 py-2 font-medium">Eksik</th>
              <th className="px-3 py-2 font-medium">Etkilediği hesap</th>
              <th className="px-3 py-2 font-medium">Düzelt</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Bu filtrede eksik veri yok.
                </td>
              </tr>
            )}
            {visible.slice(0, limit).map((i) => (
              <tr key={i.key} className="border-b border-border last:border-0">
                <td className="px-3 py-2">
                  {i.severity === "blocker" ? (
                    <CircleAlert className="h-4 w-4 text-danger" aria-label="Hesap yapılamıyor" />
                  ) : (
                    <TriangleAlert className="h-4 w-4 text-warning" aria-label="Hesap eksik çıkıyor" />
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline">{i.area}</Badge>
                </td>
                <td className="max-w-xs px-3 py-2">
                  <div className="truncate font-medium" title={i.subject}>
                    {i.subject}
                  </div>
                  {i.detail && <div className="text-xs text-muted-foreground">{i.detail}</div>}
                </td>
                <td className={cn("px-3 py-2", i.severity === "blocker" && "font-medium")}>{i.problem}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{i.effect}</td>
                <td className="px-3 py-2">
                  <Link href={i.href} className="whitespace-nowrap text-xs text-primary underline-offset-2 hover:underline">
                    {i.fixHint}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length > limit && (
        <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
          Daha fazla göster ({visible.length - limit} kaldı)
        </Button>
      )}
    </div>
  );
}
