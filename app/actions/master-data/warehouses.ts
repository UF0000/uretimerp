"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { warehouseSchema, WarehouseFormValues } from "@/lib/validations/master-data";

export async function getWarehouses() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .order("name");

  if (error) throw new Error("Depolar getirilirken bir hata oluştu: " + error.message);
  return data;
}

export async function saveWarehouse(data: WarehouseFormValues) {
  const supabase = await createClient();
  const parsed = warehouseSchema.safeParse(data);
  if (!parsed.success) throw new Error("Geçersiz form verisi.");
  
  const payload = parsed.data;

  if (payload.id) {
    const { error } = await supabase
      .from("warehouses")
      .update({
        name: payload.name,
        type: payload.type,
      })
      .eq("id", payload.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("warehouses")
      .insert([{
        name: payload.name,
        type: payload.type,
      }]);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/ana-veri");
}

export async function deleteWarehouse(id: string) {
  const supabase = await createClient();
  // Depoları tamamen silmek sakıncalıdır eğer bağlı stok hareketi varsa. 
  // Şimdilik sadece silmeyi deneyeceğiz. Supabase foreign key restrict hatası verebilir.
  const { error } = await supabase
    .from("warehouses")
    .delete()
    .eq("id", id);
    
  if (error) {
    if (error.code === '23503') { // foreign_key_violation
       throw new Error("Bu depoya ait stok hareketi olduğu için silinemez.");
    }
    throw new Error(error.message);
  }
  revalidatePath("/ana-veri");
}

export async function bulkDeleteWarehouses(ids: string[]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("warehouses")
    .delete()
    .in("id", ids);
    
  if (error) {
    if (error.code === '23503') {
       throw new Error("Seçili depolardan bazılarına ait stok hareketi olduğu için silinemez.");
    }
    throw new Error("Toplu silme başarısız: " + error.message);
  }
  revalidatePath("/ana-veri");
}

export type WarehouseRow = Awaited<ReturnType<typeof getWarehouses>>[number];
