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
import { Search, Trash2 } from "lucide-react";

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

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  onDeleteSelected?: (ids: string[]) => void;
  isDeleting?: boolean;
  /** Toplu işlem butonu metni (varsayılan: "Seçilenleri Sil") */
  bulkActionLabel?: string;
  /** Toplu işlem onay sorusu; {n} seçili kayıt sayısıyla değişir */
  bulkConfirmText?: string;
  disablePagination?: boolean;
}

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
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
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
    data,
    columns: finalColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: disablePagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    autoResetPageIndex: false,
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
  });

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
              value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                table.getColumn(searchKey)?.setFilterValue(event.target.value)
              }
              className="pl-9"
            />
          </div>
        ) : (
          <div /> // Search key yoksa sağdaki butonu tutmak için boş div
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
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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
          </TableBody>
        </Table>
      </div>
      {!disablePagination && (
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
