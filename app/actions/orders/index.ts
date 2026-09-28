"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { orderSchema, OrderFormValues } from "@/lib/validations/orders";

export async function getOrders() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      partner:partners(name),
      items:order_items(*, product:products(name, code, unit))
    `)
    .order("order_date", { ascending: false });

  if (error) throw new Error("Siparişler getirilirken hata oluştu: " + error.message);
  return data;
}

export async function saveOrder(data: OrderFormValues) {
  const supabase = await createClient();
  const parsed = orderSchema.safeParse(data);
  if (!parsed.success) throw new Error("Geçersiz sipariş verisi.");
  const payload = parsed.data;

  // Insert Order
  const { data: newOrder, error } = await supabase
    .from("orders")
    .insert([{
      no: payload.no,
      partner_id: payload.partner_id,
      order_date: payload.order_date,
      delivery_date: payload.delivery_date || null,
      status: payload.status,
    }])
    .select()
    .single();

  if (error) throw new Error("Sipariş kaydedilemedi: " + error.message);

  // Insert Items
  const itemsToInsert = payload.items.map(item => ({
    order_id: newOrder.id,
    product_id: item.product_id,
    quantity: item.quantity,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(itemsToInsert);

  if (itemsError) throw new Error("Sipariş kalemleri kaydedilemedi: " + itemsError.message);

  revalidatePath("/siparisler");
  return newOrder.id;
}

export async function bulkDeleteOrders(ids: string[]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .delete()
    .in("id", ids);

  if (error) throw new Error("Siparişler silinirken hata oluştu: " + error.message);
  revalidatePath("/siparisler");
}

export type OrderRow = Awaited<ReturnType<typeof getOrders>>[number];
