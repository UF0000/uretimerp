-- ═══════════════════════════════════════════════════════════════════
-- Kapatılan iş emrini yeniden açma (yalnızca admin, reopen_work_order ile)
--   Kural korunur: doğrudan UPDATE ile done → başka durum yapılamaz; yalnızca bu fonksiyon
--   işlem içinde izin bayrağı koyarak açabilir. Kim / ne zaman / neden kaydedilir.
--   Tamamlama kontrolü artık iptal edilen girişleri saymaz.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS reopened_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reopen_note TEXT,
  ADD COLUMN IF NOT EXISTS reopen_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.guard_work_order_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
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

CREATE OR REPLACE FUNCTION public.reopen_work_order(p_work_order_id UUID, p_note TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wo work_orders%ROWTYPE;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Kapatılmış iş emrini yalnızca yönetici yeniden açabilir.';
  END IF;
  SELECT * INTO v_wo FROM work_orders WHERE id = p_work_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'İş emri bulunamadı.'; END IF;
  IF v_wo.status <> 'done' THEN RAISE EXCEPTION 'İş emri zaten açık.'; END IF;

  PERFORM set_config('app.reopen_work_order', 'on', true); -- yalnızca bu işlem için
  UPDATE work_orders
     SET status = 'in_progress', finished_at = NULL,
         reopened_at = now(), reopened_by = auth.uid(), reopen_note = nullif(trim(p_note), ''),
         reopen_count = reopen_count + 1
   WHERE id = p_work_order_id;
  PERFORM set_config('app.reopen_work_order', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.reopen_work_order(UUID, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.reopen_work_order(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
