"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { ProductForm } from "@/app/(app)/ana-veri/components/product-form";
import { usePermission } from "@/components/shared/role-provider";
import { Button } from "@/components/ui/button";
import type { ProductFormInput } from "@/lib/validations/master-data";

export function EditProductButton({ product, groups }: { product: ProductFormInput; groups: { code: string; name: string }[] }) {
  const canWrite = usePermission("master-data:write");
  const [open, setOpen] = useState(false);
  if (!canWrite) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="mr-2 h-4 w-4" />
        Kartı düzenle
      </Button>
      {open && <ProductForm open={open} onOpenChange={setOpen} initialData={product} groups={groups} />}
    </>
  );
}
