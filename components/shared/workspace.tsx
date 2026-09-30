"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { House, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { UserMenu } from "@/components/shared/user-menu";
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
}

interface WorkspaceProps {
  initialPath: string | null;
  userName?: string;
  userRole?: UserRole;
}

const MAX_TABS = 10;
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

/** Oturum boyunca sekmeler hatırlanır (sayfa yenilense de); form içerikleri değil, adresler */
const restore = (initialPath: string | null): { tabs: Tab[]; activeId: string } => {
  let tabs: Tab[] = [];
  let activeId = "";
  try {
    const raw = window.sessionStorage.getItem(TABS_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { tabs?: { id: string; path: string | null; title: string }[]; activeId?: string };
      tabs = (saved.tabs ?? [])
        .filter((t) => t.path === null || isAppPath(t.path))
        .map((t) => ({ id: t.id, src: t.path, path: t.path, title: t.title || labelOf(t.path) }));
      activeId = saved.activeId ?? "";
    }
  } catch {
    // saklama kapalı / bozuk veri: boş başla
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

  const closeTab = (id: string) => {
    const idx = tabs.findIndex((t) => t.id === id);
    const rest = tabs.filter((t) => t.id !== id);
    if (rest.length === 0) {
      const t = makeTab(null);
      setTabs([t]);
      setActiveId(t.id);
      return;
    }
    setTabs(rest);
    if (id === activeId) setActiveId(rest[Math.min(idx, rest.length - 1)].id);
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
      window.sessionStorage.setItem(TABS_STORAGE_KEY, JSON.stringify({ tabs: tabs.map(({ id, path, title }) => ({ id, path, title })), activeId }));
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
      <header className="flex h-12 shrink-0 items-end gap-2 border-b border-border bg-muted/40 px-2 print:hidden">
        <button
          type="button"
          onClick={() => openNew(null)}
          title="Ana sayfa"
          aria-label="Ana sayfa"
          className="mb-1.5 flex h-8 shrink-0 items-center rounded-md px-1 hover:bg-background"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">ÜE</span>
        </button>

        <div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto" role="tablist" aria-label="Açık sayfalar">
          {tabs.map((t) => {
            const isActive = t.id === active?.id;
            return (
              <div
                key={t.id}
                data-tab-id={t.id}
                className={cn(
                  "group flex h-9 max-w-[220px] shrink-0 items-center gap-1 rounded-t-md border border-b-0 pl-3 pr-1 text-sm",
                  isActive ? "border-border bg-background font-medium text-foreground" : "border-transparent text-muted-foreground hover:bg-background/60",
                )}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className="flex min-w-0 items-center gap-1.5 text-left"
                  title={t.title}
                  onClick={() => setActiveId(t.id)}
                  onAuxClick={(e) => e.button === 1 && closeTab(t.id)}
                >
                  {!t.path && <House className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">{t.title}</span>
                </button>
                <button
                  type="button"
                  aria-label={`${t.title} sekmesini kapat`}
                  className={cn("rounded p-0.5 hover:bg-muted", isActive ? "opacity-100" : "opacity-60 group-hover:opacity-100")}
                  onClick={() => closeTab(t.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            aria-label="Yeni sekme"
            title="Yeni sekme"
            className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
            onClick={() => openNew(null)}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-1 shrink-0">
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
