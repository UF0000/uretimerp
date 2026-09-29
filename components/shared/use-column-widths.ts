"use client";

import * as React from "react";

const MIN = 48;
const PADDING = 24; // hücre yatay dolgusu (px-2 × 2) + tutamaç payı

const CHANGE_EVENT = "table-widths-change";

const readRaw = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const parse = (raw: string | null): Record<string, number> | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return null;
  }
};

const save = (key: string, value: Record<string, number> | null) => {
  try {
    if (value) window.localStorage.setItem(key, JSON.stringify(value));
    else window.localStorage.removeItem(key);
  } catch {
    // tarayıcı depolaması kapalıysa genişlikler kaydedilmez
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
};

/**
 * Excel benzeri sütun genişliği: başlık kenarını sürükleyerek ayarlama, kenara çift
 * tıklayınca içeriğe sığdırma. Kullanıcı dokunana kadar tablo otomatik düzende kalır;
 * ilk ayarda o anki genişlikler ölçülüp sabitlenir. Genişlikler tarayıcıda saklanır.
 */
export function useColumnWidths(tableKey: string, columnIds: string[]) {
  const storageKey = `table-widths:${tableKey}`;
  const tableRef = React.useRef<HTMLTableElement>(null);
  // Kaydedilmiş genişlikler (sunucuda yok → ilk çizim otomatik düzen); sürüklerken geçici değer
  const raw = React.useSyncExternalStore(subscribe, () => readRaw(storageKey), () => null);
  const stored = React.useMemo(() => parse(raw), [raw]);
  const [dragging, setDragging] = React.useState<Record<string, number> | null>(null);
  const widths = dragging ?? stored;

  const measure = React.useCallback((): Record<string, number> => {
    const out: Record<string, number> = {};
    tableRef.current?.querySelectorAll<HTMLTableCellElement>("thead th[data-col]").forEach((th) => {
      out[th.dataset.col!] = Math.round(th.getBoundingClientRect().width);
    });
    return out;
  }, []);

  const current = React.useCallback(() => ({ ...measure(), ...(widths ?? {}) }), [measure, widths]);

  const startResize = (columnId: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const base = current();
    const startX = e.clientX;
    const startWidth = base[columnId] ?? 120;
    let latest = base;
    const onMove = (ev: PointerEvent) => {
      latest = { ...base, [columnId]: Math.max(MIN, Math.round(startWidth + ev.clientX - startX)) };
      setDragging(latest);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      save(storageKey, latest);
      setDragging(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /** Sütunu en geniş hücre içeriğine göre ayarlar (Excel'de kenara çift tıklama). */
  const autoFit = (columnId: string) => {
    const table = tableRef.current;
    if (!table) return;
    const range = document.createRange();
    let max = MIN;
    table.querySelectorAll<HTMLElement>(`[data-col="${CSS.escape(columnId)}"]`).forEach((cell) => {
      // Başlıktaki sürükleme tutamacı ölçüme girmesin
      const handle = cell.querySelector(":scope > [role=separator]");
      range.selectNodeContents(cell);
      if (handle) {
        if (handle === cell.firstChild) return;
        range.setEndBefore(handle);
      }
      max = Math.max(max, Math.ceil(range.getBoundingClientRect().width) + PADDING);
    });
    save(storageKey, { ...current(), [columnId]: max });
  };

  const reset = () => save(storageKey, null);

  const custom = widths !== null;
  const get = (id: string) => widths?.[id] ?? 120;
  const total = custom ? columnIds.reduce((s, id) => s + get(id), 0) : undefined;

  return { tableRef, custom, get, total, startResize, autoFit, reset };
}
