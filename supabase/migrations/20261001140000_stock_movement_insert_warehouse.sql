-- GÜVENLİK: operatör doğrudan (fişsiz) stok hareketi ekleyebiliyordu → stoğu ya da sipariş teslim miktarını
-- elle değiştirebilirdi. Üretim girişi / iptal, NCR ve iş emri fonksiyonları SECURITY DEFINER çalıştığı için
-- operatörün doğrudan ekleme iznine ihtiyacı yok. Doğrudan hareket yalnızca depo ve yönetici.

DROP POLICY IF EXISTS "Ekleme: operatör/depo/admin" ON stock_movements;
DROP POLICY IF EXISTS "Ekleme: depo/admin" ON stock_movements;
CREATE POLICY "Ekleme: depo/admin" ON stock_movements
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND public.has_role('warehouse', 'admin')
  );
