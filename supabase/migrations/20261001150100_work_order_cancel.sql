-- İş emri iptali: yanlışlıkla açılan / vazgeçilen iş emri "İptal" olur (silinmez; kim / ne zaman / neden kaydedilir).
-- Yalnızca yönetici; geçerli (iptal edilmemiş) üretim girişi varsa önce girişler iptal edilmelidir.
-- İptal edilen iş emrine giriş yapılamaz, geri açılamaz; ihtiyaç (MRP) ve panel hesaplarına girmez.

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cancel_note TEXT;

CREATE OR REPLACE FUNCTION public.guard_work_order_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'İptal edilmiş iş emri yeniden açılamaz; yeni iş emri açın.';
  END IF;
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled'
     AND coalesce(current_setting('app.cancel_work_order', true), '') <> 'on' THEN
    RAISE EXCEPTION 'İş emri yalnızca "İptal et" ile (yönetici) iptal edilebilir.';
  END IF;
  IF OLD.status = 'done' AND NEW.status <> 'done'
     AND coalesce(current_setting('app.reopen_work_order', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Tamamlanmış iş emri yalnızca "Yeniden aç" ile (yönetici) açılabilir.';
  END IF;
  IF NEW.status = 'done' AND OLD.status <> 'done'
     AND NOT EXISTS (SELECT 1 FROM production_entries WHERE work_order_id = NEW.id AND cancelled_at IS NULL) THEN
    RAISE EXCEPTION 'İş emri üretim girişi yapılmadan tamamlanamaz.';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_work_order(p_work_order_id UUID, p_note TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_wo work_orders%ROWTYPE;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'İş emrini yalnızca yönetici iptal edebilir.';
  END IF;
  IF coalesce(trim(p_note), '') = '' THEN
    RAISE EXCEPTION 'İptal nedeni yazılmalıdır.';
  END IF;
  SELECT * INTO v_wo FROM work_orders WHERE id = p_work_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'İş emri bulunamadı.'; END IF;
  IF v_wo.status = 'cancelled' THEN RAISE EXCEPTION 'İş emri zaten iptal edilmiş.'; END IF;
  IF v_wo.status = 'done' THEN RAISE EXCEPTION 'Tamamlanmış iş emri iptal edilemez; gerekirse önce yeniden açın ve girişleri iptal edin.'; END IF;
  IF EXISTS (SELECT 1 FROM production_entries WHERE work_order_id = p_work_order_id AND cancelled_at IS NULL) THEN
    RAISE EXCEPTION 'Bu iş emrinde geçerli üretim girişi var; önce girişleri iptal edin (stok ters kayıtla geri alınır).';
  END IF;
  PERFORM set_config('app.cancel_work_order', 'on', true);
  UPDATE work_orders
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_note = trim(p_note)
   WHERE id = p_work_order_id;
  PERFORM set_config('app.cancel_work_order', 'off', true);
END $$;

REVOKE ALL ON FUNCTION public.cancel_work_order(UUID, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.cancel_work_order(UUID, TEXT) TO authenticated;

-- İptal edilmiş iş emrine üretim girişi yapılamaz (tüm giriş fonksiyonları için tek yerde)
CREATE OR REPLACE FUNCTION public.production_entry_wo_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM work_orders WHERE id = NEW.work_order_id AND status = 'cancelled') THEN
    RAISE EXCEPTION 'İptal edilmiş iş emrine üretim girişi yapılamaz.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS production_entry_wo_guard ON production_entries;
CREATE TRIGGER production_entry_wo_guard BEFORE INSERT ON production_entries
  FOR EACH ROW EXECUTE FUNCTION public.production_entry_wo_guard();
