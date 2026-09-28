-- İş emri durum kuralları (uygulama atlanıp doğrudan API ile yazılsa bile geçerli):
--   * Üretim kaydı olmayan iş emri "done" yapılamaz (kapatma = complete_work_order).
--   * Tamamlanmış iş emri tekrar açılamaz (stok ve maliyet kayıtları ona bağlı).

CREATE OR REPLACE FUNCTION public.guard_work_order_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'done' AND NEW.status <> 'done' THEN
    RAISE EXCEPTION 'Tamamlanmış iş emri tekrar açılamaz.';
  END IF;
  IF NEW.status = 'done' AND OLD.status <> 'done'
     AND NOT EXISTS (SELECT 1 FROM production_entries WHERE work_order_id = NEW.id) THEN
    RAISE EXCEPTION 'İş emri üretim girişi yapılmadan tamamlanamaz.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS work_orders_status_guard ON work_orders;
CREATE TRIGGER work_orders_status_guard
  BEFORE UPDATE OF status ON work_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_work_order_status();
