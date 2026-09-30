"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WORKSPACE_PATH, sectionOf, type FrameMessage, type HostMessage } from "@/lib/workspace";

const toHost = (msg: FrameMessage) => window.parent.postMessage(msg, window.location.origin);

/**
 * Sayfa ↔ çalışma alanı köprüsü (sayfalar sekme içinde, iframe'de çalışır).
 * - Adres/başlık değişince sekmeye bildirir
 * - Başka bölüme giden bağlantıları (ör. iş emrinden "Reçete oluştur") yeni sekmede açtırır; Ctrl+tık da yeni sekme
 * - Sekmeye dönülünce verileri tazeler (router.refresh: form durumu korunur)
 * Sayfa sekme dışında açıldıysa çalışma alanına yönlendirir.
 */
export function EmbedBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();

  // Sekme dışında açıldı: çalışma alanında bu sayfayla aç
  useEffect(() => {
    if (window.parent !== window) return;
    const here = window.location.pathname + window.location.search;
    window.location.replace(`${WORKSPACE_PATH}?ac=${encodeURIComponent(here)}`);
  }, []);

  // Adres ve başlık (başlık gezinmeden biraz sonra güncellenir)
  useEffect(() => {
    if (window.parent === window) return;
    const path = pathname + (query ? `?${query}` : "");
    const send = () => toHost({ type: "nav", path, title: document.title });
    send();
    const timers = [window.setTimeout(send, 300), window.setTimeout(send, 1500)];
    return () => timers.forEach(window.clearTimeout);
  }, [pathname, query]);

  // Çalışma alanından gelen komutlar
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const msg = e.data as HostMessage | null;
      if (msg?.type === "navigate" && typeof msg.path === "string" && msg.path.startsWith("/") && !msg.path.startsWith("//")) router.push(msg.path);
      else if (msg?.type === "activate") router.refresh();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  // Başka bölüme giden bağlantılar yeni sekmede
  useEffect(() => {
    if (window.parent === window) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const newTab = e.ctrlKey || e.metaKey || sectionOf(url.pathname) !== sectionOf(window.location.pathname);
      if (!newTab) return;
      e.preventDefault();
      toHost({ type: "open", path: url.pathname + url.search });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
