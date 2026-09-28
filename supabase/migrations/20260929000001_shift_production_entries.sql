-- ═══════════════════════════════════════════════════════════════════
-- Vardiya bazlı üretim girişi
--
-- Bir iş emrine vardiya vardiya çok sayıda giriş yapılır. Her giriş kendi
-- lot'unu, hammadde tüketimini, mamul/fire girişini ve kalıp atışını tek
-- işlemde yazar. İş emri son girişte ya da close_work_order ile kapanır.
-- complete_work_order (tek seferde kapanış) bunun yerine geçer ve kaldırılır.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE production_entries
  ADD COLUMN IF NOT EXISTS total_used_kg NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lot_no TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS production_entries_work_order_idx ON production_entries(work_order_id);

CREATE OR REPLACE FUNCTION public.record_production_entry(
  p_work_order_id UUID,
  p_shift shift_type,
  p_produced_qty NUMERIC,
  p_total_used_kg NUMERIC,
  p_scrap_kg NUMERIC DEFAULT 0,
  p_scrap_product_id UUID DEFAULT NULL,
  p_scrap_reason_code_id UUID DEFAULT NULL,
  p_downtime_min NUMERIC DEFAULT 0,
  p_downtime_reason_code_id UUID DEFAULT NULL,
  p_actual_cycle_time_sec NUMERIC DEFAULT NULL,
  p_target_warehouse_id UUID DEFAULT NULL,
  p_operator TEXT DEFAULT NULL,
  p_close_work_order BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_produced NUMERIC := coalesce(p_produced_qty, 0);
  v_used NUMERIC := coalesce(p_total_used_kg, 0);
  v_scrap NUMERIC := coalesce(p_scrap_kg, 0);
  v_downtime NUMERIC := coalesce(p_downtime_min, 0);
  v_wo work_orders%ROWTYPE;
  v_bom boms%ROWTYPE;
  v_inj bom_injection%ROWTYPE;
  v_raw_wh UUID;
  v_target_wh UUID;
  v_scrap_wh UUID;
  v_ratio_sum NUMERIC;
  v_lot_no TEXT;
  v_entry_id UUID;
  v_mold_id UUID;
  v_cavity INTEGER;
  v_shots INTEGER := 0;
BEGIN
  -- SECURITY DEFINER: RLS atlanır, yetki burada açıkça kontrol edilir
  IF NOT public.has_role('operator', 'admin') THEN
    RAISE EXCEPTION 'Üretim girişi için Operatör veya Admin yetkisi gerekir.';
  END IF;

  -- ── Değer kontrolleri ──
  IF v_produced < 0 OR v_used < 0 OR v_scrap < 0 OR v_downtime < 0 THEN
    RAISE EXCEPTION 'Miktarlar negatif olamaz.';
  END IF;
  IF v_produced = 0 AND v_scrap = 0 AND v_downtime = 0 THEN
    RAISE EXCEPTION 'Boş giriş: üretim, fire veya duruş girilmelidir.';
  END IF;
  IF (v_produced > 0 OR v_scrap > 0) AND v_used <= 0 THEN
    RAISE EXCEPTION 'Üretim veya fire varsa kullanılan hammadde girilmelidir.';
  END IF;
  IF v_scrap > v_used THEN RAISE EXCEPTION 'Fire, kullanılan hammaddeden fazla olamaz.'; END IF;
  IF v_downtime > 24 * 60 THEN RAISE EXCEPTION 'Duruş süresi bir günden uzun olamaz.'; END IF;
  IF p_actual_cycle_time_sec IS NOT NULL AND p_actual_cycle_time_sec <= 0 THEN
    RAISE EXCEPTION 'Çevrim süresi 0''dan büyük olmalıdır.';
  END IF;

  IF v_scrap > 0 THEN
    IF p_scrap_product_id IS NULL THEN RAISE EXCEPTION 'Fire girildi ama hurda ürünü seçilmedi.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM reason_codes WHERE id = p_scrap_reason_code_id AND kind = 'scrap') THEN
      RAISE EXCEPTION 'Fire girildiyse fire neden kodu seçilmelidir.';
    END IF;
  END IF;
  IF v_downtime > 0 AND NOT EXISTS (
    SELECT 1 FROM reason_codes WHERE id = p_downtime_reason_code_id AND kind = 'downtime'
  ) THEN
    RAISE EXCEPTION 'Duruş girildiyse duruş neden kodu seçilmelidir.';
  END IF;

  -- ── İş emri (kilitli) ──
  SELECT * INTO v_wo FROM work_orders WHERE id = p_work_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'İş emri bulunamadı.'; END IF;
  IF v_wo.status = 'done' THEN RAISE EXCEPTION 'Bu iş emri tamamlanmış; yeni giriş yapılamaz.'; END IF;
  IF v_wo.status = 'planned' THEN
    UPDATE work_orders SET status = 'in_progress', started_at = coalesce(started_at, now()) WHERE id = v_wo.id;
  END IF;

  SELECT * INTO v_bom FROM boms WHERE id = v_wo.bom_id;

  IF v_used > 0 THEN
    SELECT coalesce(sum(ratio_pct), 0) INTO v_ratio_sum
    FROM bom_items WHERE bom_id = v_bom.id AND ratio_pct IS NOT NULL;
    IF abs(v_ratio_sum - 100) > 0.5 THEN
      RAISE EXCEPTION 'Reçete (v%) hammadde oranlarının toplamı %%100 olmalı; şu an %%%.', v_bom.version, round(v_ratio_sum, 2);
    END IF;
    SELECT id INTO v_raw_wh FROM warehouses WHERE type = 'raw' ORDER BY name LIMIT 1;
    IF v_raw_wh IS NULL THEN RAISE EXCEPTION 'Hammadde tipli depo tanımlı değil.'; END IF;
  END IF;

  IF v_produced > 0 THEN
    IF p_target_warehouse_id IS NOT NULL THEN
      SELECT id INTO v_target_wh FROM warehouses WHERE id = p_target_warehouse_id AND type = 'finished';
      IF v_target_wh IS NULL THEN RAISE EXCEPTION 'Seçilen hedef depo bir mamul deposu değil.'; END IF;
    ELSE
      SELECT id INTO v_target_wh FROM warehouses WHERE type = 'finished' ORDER BY name LIMIT 1;
      IF v_target_wh IS NULL THEN RAISE EXCEPTION 'Mamul tipli depo tanımlı değil.'; END IF;
    END IF;
  END IF;

  IF v_scrap > 0 THEN
    SELECT id INTO v_scrap_wh FROM warehouses WHERE type = 'scrap' ORDER BY name LIMIT 1;
    IF v_scrap_wh IS NULL THEN RAISE EXCEPTION 'Hurda tipli depo tanımlı değil.'; END IF;
  END IF;

  -- ── Lot (sadece üretim veya fire varsa): L<YYMMDD>-<iş emri no>-<sıra> ──
  IF v_produced > 0 OR v_scrap > 0 THEN
    v_lot_no := 'L' || to_char(now() AT TIME ZONE 'Europe/Istanbul', 'YYMMDD') || '-' || v_wo.no || '-'
                || ((SELECT count(*) FROM lots WHERE work_order_id = v_wo.id) + 1);
    INSERT INTO lots (lot_no, product_id, production_date, work_order_id)
    VALUES (v_lot_no, v_wo.product_id, (now() AT TIME ZONE 'Europe/Istanbul')::date, v_wo.id);
  END IF;

  INSERT INTO production_entries (
    work_order_id, shift, produced_qty, scrap_qty, scrap_reason_code_id, downtime_min,
    downtime_reason_code_id, actual_cycle_time_sec, operator, total_used_kg, lot_no, user_id
  ) VALUES (
    v_wo.id, p_shift, v_produced, v_scrap,
    CASE WHEN v_scrap > 0 THEN p_scrap_reason_code_id END, v_downtime,
    CASE WHEN v_downtime > 0 THEN p_downtime_reason_code_id END, p_actual_cycle_time_sec,
    nullif(trim(p_operator), ''), v_used, v_lot_no, v_uid
  ) RETURNING id INTO v_entry_id;

  -- ── Stok hareketleri ──
  IF v_used > 0 THEN
    INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, lot_no, source_type, source_id, user_id, note)
    SELECT i.component_product_id, v_raw_wh, 'out', round(v_used * i.ratio_pct / 100, 4), NULL,
           'production', v_wo.id, v_uid, 'İş emri ' || v_wo.no || ' tüketim (' || v_lot_no || ')'
    FROM bom_items i
    WHERE i.bom_id = v_bom.id AND coalesce(i.ratio_pct, 0) > 0;
  END IF;

  IF v_produced > 0 THEN
    INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, lot_no, source_type, source_id, user_id, note)
    VALUES (v_wo.product_id, v_target_wh, 'in', v_produced, v_lot_no, 'production', v_wo.id, v_uid,
            'İş emri ' || v_wo.no || ' üretim');
  END IF;

  IF v_scrap > 0 THEN
    INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, lot_no, source_type, source_id, user_id, note)
    VALUES (p_scrap_product_id, v_scrap_wh, 'in', v_scrap, v_lot_no, 'scrap', v_wo.id, v_uid,
            'İş emri ' || v_wo.no || ' fire');
  END IF;

  -- ── Kalıp atış sayacı (enjeksiyon): atış = üretilen / göz sayısı ──
  IF v_bom.production_type = 'injection' AND v_produced > 0 THEN
    SELECT * INTO v_inj FROM bom_injection WHERE bom_id = v_bom.id;
    v_mold_id := coalesce(v_wo.mold_id, v_inj.mold_id);
    IF v_mold_id IS NOT NULL THEN
      SELECT coalesce(v_inj.cavity_count, m.cavity_count, 1) INTO v_cavity FROM molds m WHERE m.id = v_mold_id;
      v_shots := ceil(v_produced / greatest(v_cavity, 1));
      UPDATE molds SET total_shots = total_shots + v_shots WHERE id = v_mold_id;
    END IF;
  END IF;

  IF p_close_work_order THEN
    UPDATE work_orders SET status = 'done', finished_at = now() WHERE id = v_wo.id;
  END IF;

  RETURN jsonb_build_object(
    'entry_id', v_entry_id, 'lot_no', v_lot_no, 'mold_shots', v_shots,
    'closed', coalesce(p_close_work_order, false)
  );
END $$;

-- Ayrı kapatma (son vardiya girildikten sonra); üretim kaydı şartını tetikleyici denetler
CREATE OR REPLACE FUNCTION public.close_work_order(p_work_order_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role('operator', 'admin') THEN
    RAISE EXCEPTION 'İş emri kapatmak için Operatör veya Admin yetkisi gerekir.';
  END IF;
  UPDATE work_orders SET status = 'done', finished_at = now()
   WHERE id = p_work_order_id AND status = 'in_progress';
  IF NOT FOUND THEN RAISE EXCEPTION 'Sadece üretimdeki bir iş emri kapatılabilir.'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.record_production_entry(UUID, shift_type, NUMERIC, NUMERIC, NUMERIC, UUID, UUID, NUMERIC, UUID, NUMERIC, UUID, TEXT, BOOLEAN) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_production_entry(UUID, shift_type, NUMERIC, NUMERIC, NUMERIC, UUID, UUID, NUMERIC, UUID, NUMERIC, UUID, TEXT, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.close_work_order(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.close_work_order(UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.complete_work_order(UUID, shift_type, NUMERIC, NUMERIC, NUMERIC, UUID, UUID, TEXT);

NOTIFY pgrst, 'reload schema';
