"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CircleAlert, TriangleAlert } from "lucide-react";

import { getNotifications } from "@/app/actions/notifications";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NOTIFICATION_GROUPS, SEEN_NOTIFICATIONS_KEY, type AppNotification } from "@/lib/notifications";
import { cn } from "@/lib/utils";

/** Yenileme aralığı: 5 dakika (ayrıca pencereye dönülünce) */
const REFRESH_MS = 5 * 60 * 1000;
/** Grup başına gösterilen en fazla bildirim */
const PER_GROUP = 5;

const readSeen = (): Set<string> => {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(SEEN_NOTIFICATIONS_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
};

interface NotificationBellProps {
  /** Bildirime tıklanınca sayfayı (yeni sekmede) aç */
  onOpen: (href: string) => void;
}

export function NotificationBell({ onOpen }: NotificationBellProps) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [seen, setSeen] = useState<Set<string>>(() => readSeen());

  const load = useCallback(() => {
    getNotifications()
      .then(setItems)
      .catch(() => {
        // Bildirim alınamazsa sessizce geç (oturum düşmüş olabilir); bir sonraki yenilemede tekrar denenir
      });
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    window.addEventListener("focus", load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  const unseen = items.filter((i) => !seen.has(i.key));
  const unseenDanger = unseen.some((i) => i.severity === "danger");

  // Açılınca hepsi görüldü (yalnızca güncel anahtarlar saklanır; eskiler birikmez)
  const markSeen = () => {
    const next = new Set(items.map((i) => i.key));
    setSeen(next);
    try {
      window.localStorage.setItem(SEEN_NOTIFICATIONS_KEY, JSON.stringify([...next]));
    } catch {
      // saklama kapalı: sayı bu açılışta sıfırlanır
    }
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && markSeen()}>
      <DropdownMenuTrigger
        aria-label={unseen.length ? `Bildirimler: ${unseen.length} yeni` : "Bildirimler"}
        title="Bildirimler"
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground"
      >
        <Bell className="h-5 w-5" />
        {unseen.length > 0 && (
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums",
              unseenDanger ? "bg-danger text-danger-foreground" : "bg-warning text-warning-foreground",
            )}
          >
            {unseen.length > 99 ? "99+" : unseen.length}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-1rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="font-semibold">Bildirimler</span>
          <span className="text-xs text-muted-foreground">{items.length ? `${items.length} uyarı` : ""}</span>
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Şu an uyarı yok. Her şey yolunda.</p>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto p-1">
            {NOTIFICATION_GROUPS.map(({ kind, label }, gi) => {
              const group = items.filter((i) => i.kind === kind);
              if (!group.length) return null;
              return (
                <div key={kind}>
                  {gi > 0 && <DropdownMenuSeparator />}
                  <p className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">
                    {label} ({group.length})
                  </p>
                  {group.slice(0, PER_GROUP).map((n) => (
                    <DropdownMenuItem key={n.key} onClick={() => onOpen(n.href)} className="items-start gap-2 py-1.5">
                      {n.severity === "danger" ? <CircleAlert className="mt-0.5 text-danger" /> : <TriangleAlert className="mt-0.5 text-warning" />}
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{n.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{n.detail}</span>
                      </span>
                    </DropdownMenuItem>
                  ))}
                  {group.length > PER_GROUP && (
                    <DropdownMenuItem onClick={() => onOpen(group[0].href)} className="text-xs text-primary">
                      … ve {group.length - PER_GROUP} uyarı daha — sayfada gör
                    </DropdownMenuItem>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
