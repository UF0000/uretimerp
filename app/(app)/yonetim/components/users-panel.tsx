"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Info } from "lucide-react";

import { setUserActive, updateUserRole, type UserRow } from "@/app/actions/admin";
import { ROLE_LABELS, type UserRole } from "@/lib/permissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { getErrorMessage } from "@/lib/utils";

const ROLE_HINTS: Record<UserRole, string> = {
  operator: "İş emri, vardiya girişi",
  warehouse: "Stok hareketi, fiş, iptal",
  quality: "Kalite kontrol, NCR, karantina",
  admin: "Her şey + ana veri, reçete, sipariş, yönetim",
};

export function UsersPanel({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string, action: () => Promise<void>, success: string) => {
    try {
      setBusy(id);
      await action();
      toast.success(success);
    } catch (error) {
      toast.error("Değiştirilemedi", { description: getErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Yeni kullanıcı Supabase panelinden (Authentication → Users → Add user) eklenir; otomatik olarak Operatör
        rolüyle burada görünür. Pasif kullanıcı giriş yapsa bile hiçbir veriyi göremez.
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2 font-medium">Kullanıcı</th>
              <th className="px-3 py-2 font-medium">Rol</th>
              <th className="px-3 py-2 font-medium">Yetkiler</th>
              <th className="px-3 py-2 font-medium">Aktif</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">
                  <div className="font-medium">
                    {u.name} {u.id === currentUserId && <Badge variant="outline">Siz</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={u.role}
                    disabled={busy === u.id}
                    onValueChange={(val) => {
                      if (!val || val === u.role) return;
                      const role = val as UserRole;
                      run(u.id, () => updateUserRole(u.id, role), `${u.name}: ${ROLE_LABELS[role]}`);
                    }}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue>{ROLE_LABELS[u.role]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{ROLE_HINTS[u.role]}</td>
                <td className="px-3 py-2">
                  <Switch
                    checked={u.active}
                    disabled={busy === u.id || u.id === currentUserId}
                    aria-label={`${u.name} aktif`}
                    onCheckedChange={(val) =>
                      run(u.id, () => setUserActive(u.id, val), val ? `${u.name} aktif edildi` : `${u.name} pasife alındı`)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
