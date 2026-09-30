"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRightToLine, Copy, House, Pin, PinOff, Plus, RotateCw, X, XCircle } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

import { UserMenu } from "@/components/shared/user-menu";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { NAV_ITEMS } from "@/components/shared/nav-items";
import { useCan } from "@/components/shared/role-provider";
import { APP_TITLE_SUFFIX, TABS_STORAGE_KEY, WORKSPACE_PATH, isAppPath, type FrameMessage, type HostMessage } from "@/lib/workspace";
import type { UserRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  /** iframe'in ilk adresi; sekme içi gezinmede değişmez (değişirse sayfa baştan yüklenir) */
  src: string | null;
  /** Sekmede şu an açık adres; null = yeni sekme (menü ekranı) */
  path: string | null;
  title: string;
  /** Sabitlenmiş: solda durur, kapatılamaz, çıkış-giriş sonrası da açılır */
  pinned?: boolean;
}

interface WorkspaceProps {
  initialPath: string | null;
  userName?: string;
  userRole?: UserRole;
}

const MAX_TABS = 10;
/** Sabitlenmiş sekmeler tarayıcıda kalıcı (girişte sekmeler temizlense de geri açılır) */
const PINNED_KEY = "uretim-erp:sabit-sekmeler";
const NEW_TAB_TITLE = "Ana sayfa";

const newId = () => Math.random().toString(36).slice(2, 10);

/** Adres için menüdeki ad (sayfa başlığı gelene kadar) */
const labelOf = (path: string | null) => {
  if (!path) return NEW_TAB_TITLE;
  const p = path.split("?")[0];
  const item = NAV_ITEMS.find((i) => {
    const prefix = i.activePrefix ?? i.href;
    return p === prefix || p.startsWith(`${prefix}/`);
  });
  return item?.label ?? p;
};

const post = (frames: Map<string, HTMLIFrameElement>, tabId: string, msg: HostMessage) =>
  frames.get(tabId)?.contentWindow?.postMessage(msg, window.location.origin);

const makeTab = (path: string | null): Tab => ({ id: newId(), src: path, path, title: labelOf(path) });

/** Sabitlenmiş sekmeler her zaman solda */
const pinnedFirst = (ts: Tab[]) => [...ts.filter((t) => t.pinned), ...ts.filter((t) => !t.pinned)];

/** Oturum boyunca sekmeler hatırlanır (sayfa yenilense de); form içerikleri değil, adresler */
const restore = (initialPath: string | null): { tabs: Tab[]; activeId: string } => {
  let tabs: Tab[] = [];
  let activeId = "";
  // Oturumda kayıtlı sekme yoksa (ilk giriş) ana sayfa ekranıyla başlanır
  let fresh = true;
  try {
    const raw = window.sessionStorage.getItem(TABS_STORAGE_KEY);
    fresh = !raw;
    if (raw) {
      const saved = JSON.parse(raw) as { tabs?: { id: string; path: string | null; title: string; pinned?: boolean }[]; activeId?: string };
      tabs = (saved.tabs ?? [])
        .filter((t) => t.path === null || isAppPath(t.path))
        .map((t) => ({ id: t.id, src: t.path, path: t.path, title: t.title || labelOf(t.path), pinned: Boolean(t.pinned && t.path) }));
      activeId = saved.activeId ?? "";
    }
  } catch {
    // saklama kapalı / bozuk veri: boş başla
  }
  // Sabitlenmiş sekmeler (girişten sonra da) açık gelsin
  try {
    const pins = JSON.parse(window.localStorage.getItem(PINNED_KEY) ?? "[]") as { path: string; title: string }[];
    for (const pin of pins.filter((x) => isAppPath(x.path)).reverse()) {
      const existing = tabs.find((t) => t.path === pin.path);
      if (existing) existing.pinned = true;
      else tabs = [{ ...makeTab(pin.path), title: pin.title || labelOf(pin.path), pinned: true }, ...tabs];
    }
  } catch {
    // saklama kapalı: sabit sekme yok
  }
  tabs = pinnedFirst(tabs);
  if (fresh && !initialPath) {
    const home = makeTab(null);
    tabs = [...tabs, home];
    activeId = home.id;
  }
  if (initialPath) {
    const existing = tabs.find((t) => t.path === initialPath);
    if (existing) activeId = existing.id;
    else {
      const t = makeTab(initialPath);
      tabs = [...tabs, t].slice(-MAX_TABS);
      activeId = t.id;
    }
  }
  if (tabs.length === 0) tabs = [makeTab(null)];
  if (!tabs.some((t) => t.id === activeId)) activeId = tabs[0].id;
  return { tabs, activeId };
};

export default function Workspace({ initialPath, userName, userRole }: WorkspaceProps) {
  const [initial] = useState(() => restore(initialPath));
  const [tabs, setTabs] = useState<Tab[]>(initial.tabs);
  const [activeId, setActiveId] = useState(initial.activeId);
  const frames = useRef(new Map<string, HTMLIFrameElement>());
  const tabsRef = useRef(tabs);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  // Çalışma alanı bir sekmenin içinde açılmasın (iç içe sekme)
  useEffect(() => {
    if (window.parent !== window) window.location.replace("/dashboard");
  }, []);

  const openNew = useCallback((path: string | null) => {
    const ts = tabsRef.current;
    // Aynı adres (ya da ana sayfa sekmesi) zaten açıksa ona geç
    const existing = ts.find((t) => t.path === path);
    if (existing) return setActiveId(existing.id);
    if (ts.length >= MAX_TABS) {
      toast.info(`En fazla ${MAX_TABS} sekme açılabilir; kullanmadığınız bir sekmeyi kapatın.`);
      return;
    }
    const t = makeTab(path);
    tabsRef.current = [...ts, t];
    setTabs(tabsRef.current);
    setActiveId(t.id);
  }, []);

  // Ana sayfa sekmesinde seçilen sayfa o sekmede açılır
  const openHere = (href: string) => {
    if (!active) return;
    if (active.src) post(frames.current, active.id, { type: "navigate", path: href });
    setTabs((ts) => ts.map((t) => (t.id === active.id ? { ...t, src: t.src ?? href, path: href, title: labelOf(href) } : t)));
  };

  /** Sekmeleri kapatır (sabitlenmişler hariç); etkin sekme kapanırsa yanındakine geçer */
  const closeTabs = (ids: string[]) => {
    const closing = new Set(tabs.filter((t) => ids.includes(t.id) && !t.pinned).map((t) => t.id));
    if (closing.size === 0) return;
    const rest = tabs.filter((t) => !closing.has(t.id));
    if (rest.length === 0) {
      const t = makeTab(null);
      setTabs([t]);
      setActiveId(t.id);
      return;
    }
    setTabs(rest);
    if (closing.has(activeId)) {
      const idx = tabs.findIndex((t) => t.id === activeId);
      const after = tabs.slice(idx + 1).find((t) => !closing.has(t.id));
      const before = [...tabs.slice(0, idx)].reverse().find((t) => !closing.has(t.id));
      setActiveId((after ?? before ?? rest[0]).id);
    }
  };
  const closeTab = (id: string) => {
    if (tabs.find((t) => t.id === id)?.pinned) {
      toast.info("Sabitlenmiş sekme kapatılamaz; önce sağ tıkla sabitlemeyi kaldırın.");
      return;
    }
    closeTabs([id]);
  };
  const closeOthers = (id: string) => closeTabs(tabs.filter((t) => t.id !== id).map((t) => t.id));
  const closeRight = (id: string) => closeTabs(tabs.slice(tabs.findIndex((t) => t.id === id) + 1).map((t) => t.id));

  const togglePin = (id: string) => setTabs((ts) => pinnedFirst(ts.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t))));

  /** Aynı sayfayı yeni bir sekmede daha açar (yanına) */
  const duplicateTab = (id: string) => {
    const src = tabs.find((t) => t.id === id);
    if (!src?.path) return;
    if (tabs.length >= MAX_TABS) {
      toast.info(`En fazla ${MAX_TABS} sekme açılabilir; kullanmadığınız bir sekmeyi kapatın.`);
      return;
    }
    const copy = { ...makeTab(src.path), title: src.title };
    const idx = tabs.findIndex((t) => t.id === id);
    setTabs(pinnedFirst([...tabs.slice(0, idx + 1), copy, ...tabs.slice(idx + 1)]));
    setActiveId(copy.id);
  };

  /** Sayfayı baştan yükler (yarım kalan form içerikleri gider) */
  const reloadTab = (id: string) => frames.current.get(id)?.contentWindow?.location.reload();

  // Sekmeye tıklama (kutunun her yeri) ve tutup sürükleyerek yer değiştirme
  const drag = useRef<{ id: string; startX: number; moved: boolean; touch: boolean } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const dragStart = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (e.button !== 0 || (e.target as Element).closest("[data-tab-close]")) return;
    const touch = e.pointerType === "touch";
    drag.current = { id, startX: e.clientX, moved: false, touch };
    // Dokunmatikte sürükleme yok: yatay kaydırma sekme çubuğunu kaydırır
    if (!touch) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // yakalama desteklenmiyorsa sürükleme yine sekme üzerinde çalışır
      }
    }
  };

  const dragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.touch) return;
    if (!d.moved && Math.abs(e.clientX - d.startX) < 6) return;
    if (!d.moved) {
      d.moved = true;
      setDraggingId(d.id);
    }
    const over = [...document.querySelectorAll<HTMLElement>("[data-tab-id]")].find((el) => {
      const r = el.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right;
    });
    const targetId = over?.dataset.tabId;
    if (!targetId || targetId === d.id) return;
    setTabs((ts) => {
      const from = ts.findIndex((t) => t.id === d.id);
      const to = ts.findIndex((t) => t.id === targetId);
      if (from < 0 || to < 0) return ts;
      const next = [...ts];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      // Sabitlenmiş ve sabitlenmemiş sekmeler birbirinin arasına geçmez
      return pinnedFirst(next);
    });
  };

  const dragEnd = () => {
    const d = drag.current;
    drag.current = null;
    setDraggingId(null);
    if (d && !d.moved) setActiveId(d.id);
  };

  const dragCancel = () => {
    drag.current = null;
    setDraggingId(null);
  };

  // Sayfalardan gelen mesajlar: adres/başlık değişti, yeni sekmede aç
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const msg = e.data as FrameMessage | null;
      if (!msg || typeof msg !== "object" || !("type" in msg)) return;
      const tabId = [...frames.current.entries()].find(([, f]) => f.contentWindow === e.source)?.[0];
      if (!tabId) return;
      if (msg.type === "nav" && isAppPath(msg.path)) {
        const title = msg.title.endsWith(APP_TITLE_SUFFIX) ? msg.title.slice(0, -APP_TITLE_SUFFIX.length) : msg.title;
        setTabs((ts) => ts.map((t) => (t.id === tabId ? { ...t, path: msg.path, title: title || labelOf(msg.path) } : t)));
      } else if (msg.type === "open" && isAppPath(msg.path)) {
        openNew(msg.path);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [openNew]);

  // Sekmeye geri dönülünce sayfa verilerini tazele (ör. yeni açılan reçete iş emri formunda görünsün)
  const lastActive = useRef(activeId);
  useEffect(() => {
    if (lastActive.current !== activeId) post(frames.current, activeId, { type: "activate" });
    lastActive.current = activeId;
    // Dar ekranda etkin sekme görünür kalsın
    document.querySelector(`[data-tab-id="${activeId}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId]);

  // Sekmeleri hatırla + adres çubuğu etkin sekmeyi göstersin (yenileyince aynı sayfa açılır)
  useEffect(() => {
    try {
      window.sessionStorage.setItem(TABS_STORAGE_KEY, JSON.stringify({ tabs: tabs.map(({ id, path, title, pinned }) => ({ id, path, title, pinned })), activeId }));
      window.localStorage.setItem(PINNED_KEY, JSON.stringify(tabs.filter((t) => t.pinned && t.path).map((t) => ({ path: t.path, title: t.title }))));
    } catch {
      // saklama kapalı: sekmeler yalnızca bu açılışta kalır
    }
    const url = active?.path ? `${WORKSPACE_PATH}?ac=${encodeURIComponent(active.path)}` : WORKSPACE_PATH;
    window.history.replaceState(null, "", url);
    document.title = `${active?.title ?? NEW_TAB_TITLE}${APP_TITLE_SUFFIX}`;
  }, [tabs, activeId, active]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Üst çubuk: ana sayfa · sekmeler · yeni sekme · kullanıcı */}
      <header className="flex h-16 shrink-0 items-end gap-3 border-b border-border bg-muted/40 px-2 print:hidden">
        <button
          type="button"
          onClick={() => openNew(null)}
          title="Ana sayfa"
          aria-label="Ana sayfa"
          className="mb-2 flex h-10 shrink-0 items-center rounded-md border border-border bg-logo-surface px-1.5 sm:mb-1.5 sm:h-12 sm:px-2 transition-shadow hover:shadow-sm"
        >
          <Image src="/logo-sifonik.png" alt="Sifonik" width={319} height={89} priority className="h-7 w-auto sm:h-10" />
        </button>

        <div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto" role="tablist" aria-label="Açık sayfalar">
          {tabs.map((t, index) => {
            const isActive = t.id === active?.id;
            const hasRight = tabs.slice(index + 1).some((x) => !x.pinned);
            const hasOthers = tabs.some((x) => x.id !== t.id && !x.pinned);
            return (
              <ContextMenu key={t.id}>
                <ContextMenuTrigger
                  data-tab-id={t.id}
                  role="tab"
                  tabIndex={0}
                  aria-selected={isActive}
                  title={t.pinned ? `${t.title} (sabitlenmiş)` : t.title}
                  onPointerDown={(e) => dragStart(e, t.id)}
                  onPointerMove={dragMove}
                  onPointerUp={dragEnd}
                  onPointerCancel={dragCancel}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveId(t.id);
                    }
                  }}
                  onAuxClick={(e) => e.button === 1 && !t.pinned && closeTab(t.id)}
                  className={cn(
                    "group flex h-11 max-w-[260px] shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-t-md border border-b-0 pl-4 pr-1.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    // Her sekmenin çerçevesi görünür; etkin sekme üstte marka rengi çizgiyle ve açık zeminle ayrılır
                    isActive
                      ? "border-foreground/25 border-t-2 border-t-primary bg-background font-medium text-foreground shadow-sm"
                      : "border-foreground/20 bg-muted text-muted-foreground hover:border-foreground/35 hover:bg-background/70 hover:text-foreground",
                    t.pinned && "pr-3",
                    draggingId === t.id && "cursor-grabbing opacity-70 shadow-sm",
                  )}
                >
                  {t.pinned && <Pin className="h-4 w-4 shrink-0 text-primary" aria-label="Sabitlenmiş" />}
                  {!t.path && <House className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{t.title}</span>
                  {!t.pinned && (
                    <button
                      type="button"
                      data-tab-close
                      aria-label={`${t.title} sekmesini kapat`}
                      className={cn("ml-auto shrink-0 rounded p-1 hover:bg-muted", isActive ? "opacity-100" : "opacity-60 group-hover:opacity-100")}
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(t.id);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <DropdownMenuItem disabled={!t.src} onClick={() => reloadTab(t.id)}>
                    <RotateCw />
                    Yenile
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!t.path} onClick={() => duplicateTab(t.id)}>
                    <Copy />
                    Sekmeyi çoğalt
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!t.path} onClick={() => togglePin(t.id)}>
                    {t.pinned ? <PinOff /> : <Pin />}
                    {t.pinned ? "Sabitlemeyi kaldır" : "Sabitle"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={t.pinned} onClick={() => closeTab(t.id)}>
                    <X />
                    Kapat
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!hasOthers} onClick={() => closeOthers(t.id)}>
                    <XCircle />
                    Diğer sekmeleri kapat
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!hasRight} onClick={() => closeRight(t.id)}>
                    <ArrowRightToLine />
                    Sağdakileri kapat
                  </DropdownMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
          <button
            type="button"
            aria-label="Yeni sekme"
            title="Yeni sekme"
            className="mb-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
            onClick={() => openNew(null)}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-2 shrink-0">
          <UserMenu userName={userName} userRole={userRole} />
        </div>
      </header>

      {/* Sekme içerikleri: hepsi açık kalır, yalnızca etkin olan görünür */}
      <div className="relative flex-1 bg-background">
        {tabs.map((t) =>
          t.src ? (
            <iframe
              key={t.id}
              ref={(el) => {
                if (el) frames.current.set(t.id, el);
                else frames.current.delete(t.id);
              }}
              src={t.src}
              title={t.title}
              aria-hidden={t.id !== active?.id}
              className={cn("absolute inset-0 h-full w-full border-0", t.id !== active?.id && "pointer-events-none invisible")}
            />
          ) : t.id === active?.id ? (
            <Launcher key={t.id} onPick={openHere} />
          ) : null,
        )}
      </div>
    </div>
  );
}

/** Ana sayfa: menü simgeleri ortada, seçilen sayfa bu sekmede açılır */
function Launcher({ onPick }: { onPick: (href: string) => void }) {
  const can = useCan();
  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="flex min-h-full flex-col items-center justify-center p-4 py-10 md:p-8">
        <h1 className="text-center text-2xl font-semibold tracking-tight">Nereye gitmek istiyorsunuz?</h1>
        <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">
          Seçtiğiniz sayfa bu sekmede açılır. Aynı anda başka bir sayfa için üstteki + ile yeni sekme açın.
        </p>
        <div className="mt-8 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
          {NAV_ITEMS.filter((i) => !i.permission || can(i.permission)).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => onPick(item.href)}
                className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-5 text-center transition-colors hover:border-primary hover:bg-accent md:p-7"
              >
                <Icon className="h-9 w-9 text-primary" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
