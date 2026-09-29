"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Columns3, Search, Trash2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useColumnWidths } from "./use-column-widths";
import { normalizeSearch, recordText, searchTokens } from "@/lib/search";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Verilirse arama kutusu gösterilir; arama satırdaki tüm alanlarda kelime kelime yapılır */
  searchKey?: string;
  searchPlaceholder?: string;
  onDeleteSelected?: (ids: string[]) => void;
  isDeleting?: boolean;
  /** Toplu işlem butonu metni (varsayılan: "Seçilenleri Sil") */
  bulkActionLabel?: string;
  /** Toplu işlem onay sorusu; {n} seçili kayıt sayısıyla değişir */
  bulkConfirmText?: string;
  disablePagination?: boolean;
  /** Arama kutusunun yanında gösterilecek ek filtreler / düğmeler */
  toolbar?: React.ReactNode;
  /** Satıra çift tıklanınca (ör. detay sayfasını aç) */
  onRowDoubleClick?: (row: TData) => void;
  /** Sütun genişliklerinin saklanacağı anahtar (varsayılan: sütun adlarından) */
  storageKey?: string;
  /** Kaydırmalı liste (varsayılan): başlık sabit, satırlar aşağı kaydırdıkça yüklenir. false = sayfalı */
  scrollable?: boolean;
}

const SCROLL_STEP = 100;

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Ara...",
  onDeleteSelected,
  isDeleting = false,
  bulkActionLabel = "Seçilenleri Sil",
  bulkConfirmText = "Seçili {n} kaydı silmek istediğinize emin misiniz?",
  disablePagination = false,
  toolbar,
  onRowDoubleClick,
  storageKey,
  scrollable = true,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  // Arama: satırdaki tüm metinlerde, kelime kelime (bkz. lib/search.ts)
  const [search, setSearch] = React.useState("");
  const searchIndex = React.useMemo(() => new WeakMap<object, string>(), []);
  const searched = React.useMemo(() => {
    const tokens = searchTokens(search);
    if (!tokens.length) return data;
    return data.filter((row) => {
      const key = row as object;
      let text = searchIndex.get(key);
      if (text === undefined) {
        text = normalizeSearch(recordText(row));
        searchIndex.set(key, text);
      }
      return tokens.every((t) => text!.includes(t));
    });
  }, [data, search, searchIndex]);
  const [rowSelection, setRowSelection] = React.useState({});

  // Eğer toplu silme fonksiyonu verildiyse Checkbox sütununu başa ekle
  const finalColumns = React.useMemo(() => {
    if (!onDeleteSelected) return columns;

    const selectColumn: ColumnDef<TData, TValue> = {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Tümünü seç"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Satırı seç"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    };

    return [selectColumn, ...columns];
  }, [columns, onDeleteSelected]);

  const table = useReactTable({
    data: searched,
    columns: finalColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: disablePagination || scrollable ? undefined : getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    autoResetPageIndex: false,
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
  });

  const columnIds = table.getVisibleLeafColumns().map((c) => c.id);

  // Kaydırmalı liste: veri (filtre) değişince baştan; son satıra yaklaşınca 100 satır daha
  const [limit, setLimit] = React.useState(SCROLL_STEP);
  const [limitFor, setLimitFor] = React.useState(searched);
  if (limitFor !== searched) {
    setLimitFor(searched);
    setLimit(SCROLL_STEP);
  }
  const allRows = table.getRowModel().rows;
  const rows = scrollable ? allRows.slice(0, limit) : allRows;
  const sentinel = React.useCallback(
    (node: HTMLTableRowElement | null) => {
      if (!node || !scrollable) return;
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) setLimit((l) => l + SCROLL_STEP);
        },
        { root: node.closest("[data-slot=table-container]"), rootMargin: "400px" },
      );
      io.observe(node);
      return () => io.disconnect();
    },
    [scrollable],
  );
  const widths = useColumnWidths(storageKey ?? columnIds.join("|"), columnIds);

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  
  const handleBulkDelete = () => {
    if (!onDeleteSelected || selectedRows.length === 0) return;
    
    // row.original nesnesinde 'id' alanı olduğunu varsayıyoruz
    const ids = selectedRows
      .map((row) => (row.original as { id?: string }).id)
      .filter((id): id is string => Boolean(id));
    if (ids.length > 0) {
      if (confirm(bulkConfirmText.replace("{n}", String(ids.length)))) {
        onDeleteSelected(ids);
        table.resetRowSelection();
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {searchKey ? (
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
        ) : (
          !toolbar && <div /> // Search key yoksa sağdaki butonu tutmak için boş div
        )}
        {toolbar}
        {widths.custom && (
          <Button variant="ghost" size="sm" onClick={widths.reset} title="Sütun genişliklerini otomatiğe döndür">
            <Columns3 className="mr-1.5 h-4 w-4" />
            Sütunları sıfırla
          </Button>
        )}

        {selectedRows.length > 0 && onDeleteSelected && (
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleBulkDelete}
            disabled={isDeleting}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {bulkActionLabel} ({selectedRows.length})
          </Button>
        )}
      </div>
      <div className="rounded-md border border-border bg-card">
        <Table
          ref={widths.tableRef}
          fixedColumns={widths.custom}
          containerClassName={scrollable ? "max-h-[70vh] overflow-auto" : undefined}
          width={widths.custom ? widths.total : undefined}
        >
          {widths.custom && (
            <colgroup>
              {columnIds.map((id) => (
                <col key={id} width={widths.get(id)} />
              ))}
            </colgroup>
          )}
          <TableHeader className={cn(scrollable && "sticky top-0 z-20 bg-card shadow-[0_1px_0_var(--border)]")}>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} data-col={header.column.id} className={cn("group/th relative", widths.custom && "overflow-hidden text-ellipsis")}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      {header.column.id !== "select" && (
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          aria-label="Sütun genişliği: sürükleyin, çift tıklayınca sığdırılır"
                          title="Sürükleyerek genişletin · çift tıklayınca içeriğe sığar"
                          onPointerDown={(e) => widths.startResize(header.column.id, e)}
                          onDoubleClick={() => widths.autoFit(header.column.id)}
                          className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize touch-none select-none border-r-2 border-transparent hover:border-primary group-hover/th:border-border"
                        />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn("hover:bg-muted/50", onRowDoubleClick && "cursor-pointer select-none")}
                  onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(row.original) : undefined}
                  title={onRowDoubleClick ? "Ayrıntı için çift tıklayın" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} data-col={cell.column.id} className={cn(widths.custom && "overflow-hidden text-ellipsis")}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={finalColumns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Sonuç bulunamadı.
                </TableCell>
              </TableRow>
            )}
            {scrollable && rows.length < allRows.length && (
              <TableRow ref={sentinel} key={`more-${rows.length}`}>
                <TableCell colSpan={finalColumns.length} className="h-12 text-center text-xs text-muted-foreground">
                  Yükleniyor… ({rows.length} / {allRows.length})
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {scrollable && (
        <div className="text-sm text-muted-foreground">Toplam {allRows.length} kayıt · aşağı kaydırdıkça yüklenir</div>
      )}
      {!disablePagination && !scrollable && (
        <div className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Toplam {table.getFilteredRowModel().rows.length} kayıttan {(table.getState().pagination.pageIndex * table.getState().pagination.pageSize) + 1} - {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} arası gösteriliyor.
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Önceki
            </Button>
            
            {/* Dar ekranda numaralar yerine "3 / 9" */}
            <span className="text-sm tabular-nums text-muted-foreground sm:hidden">
              {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
            </span>
            <div className="hidden items-center gap-1 sm:flex">
              {Array.from({ length: table.getPageCount() }, (_, i) => i).map(pageIndex => {
                const currentPage = table.getState().pagination.pageIndex;
                const isNear = Math.abs(pageIndex - currentPage) <= 1;
                const isEdge = pageIndex === 0 || pageIndex === table.getPageCount() - 1;
                
                if (!isNear && !isEdge) {
                  if (pageIndex === 1 || pageIndex === table.getPageCount() - 2) {
                    return <span key={pageIndex} className="px-2 text-muted-foreground">...</span>;
                  }
                  return null;
                }

                return (
                  <Button
                    key={pageIndex}
                    variant={currentPage === pageIndex ? "default" : "outline"}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => table.setPageIndex(pageIndex)}
                  >
                    {pageIndex + 1}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Sonraki
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
