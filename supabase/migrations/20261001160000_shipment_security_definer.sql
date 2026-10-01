-- Depocu sevkiyat yapamıyordu: create_shipment siparişi FOR UPDATE ile kilitliyor; çağıranın
-- yetkisiyle (INVOKER) çalışınca RLS'in UPDATE kuralı uygulanır ve siparişi yalnız yönetici
-- güncelleyebildiği için depocuya "Sipariş bulunamadı." dönüyordu (simülasyon buldu).
-- Fonksiyon rolü kendisi denetler (depo/yönetici); üretim/NCR fonksiyonları gibi DEFINER çalışır.
ALTER FUNCTION public.create_shipment(UUID, UUID, DATE, JSONB, TEXT, TEXT, TEXT, TEXT) SECURITY DEFINER;
ALTER FUNCTION public.cancel_shipment(UUID) SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
