-- ═══════════════════════════════════════════════════════════════════
-- Reçine lotu seçimi (kesin izlenebilirlik)
--
-- v_stock_lot       : lot bazında stok bakiyesi (ürün × depo × lot)
-- record_production_entry(p_raw_lots): hammadde tüketimi seçilen reçine lotundan
--                     düşülür; lotta yeterli miktar yoksa kayıt reddedilir.
--                     Lot seçilmezse eski davranış (lotsuz tüketim) sürer.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_stock_lot
WITH (security_invoker = true) AS
SELECT
  product_id,
  warehouse_id,
  lot_no,
  sum(CASE WHEN direction = 'in' THEN quantity ELSE -quantity END) AS qty,
  min(created_at) AS first_in_at
FROM stock_movements
WHERE lot_no IS NOT NULL
GROUP BY product_id, warehouse_id, lot_no;

REVOKE ALL ON v_stock_lot FROM anon;
GRANT SELECT ON v_stock_lot TO authenticated;

-- Parametre eklendiği için eski imza kaldırılır (aşırı yükleme belirsizliği olmasın)
DROP FUNCTION IF EXISTS public.record_production_entry(UUID, shift_type, NUMERIC, NUMERIC, NUMERIC, UUID, UUID, NUMERIC, UUID, NUMERIC, UUID, TEXT, BOOLEAN);

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
  p_close_work_order BOOLEAN DEFAULT false,
  -- { "<hammadde ürün id>": "<reçine lot no>" } — isteğe bağlı
  p_raw_lots JSONB DEFAULT NULL
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
  v_item RECORD;
  v_raw_lot TEXT;
  v_lot_avail NUMERIC;
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

    -- Seçilen reçine lotlarında yeterli miktar var mı?
    IF p_raw_lots IS NOT NULL THEN
      FOR v_item IN
        SELECT i.component_product_id AS product_id, p.code, round(v_used * i.ratio_pct / 100, 4) AS qty
        FROM bom_items i JOIN products p ON p.id = i.component_product_id
        WHERE i.bom_id = v_bom.id AND coalesce(i.ratio_pct, 0) > 0
      LOOP
        v_raw_lot := nullif(trim(p_raw_lots ->> v_item.product_id::text), '');
        IF v_raw_lot IS NOT NULL THEN
          SELECT coalesce(sum(CASE WHEN direction = 'in' THEN quantity ELSE -quantity END), 0) INTO v_lot_avail
          FROM stock_movements
          WHERE product_id = v_item.product_id AND warehouse_id = v_raw_wh AND lot_no = v_raw_lot;
          IF v_lot_avail < v_item.qty THEN
            RAISE EXCEPTION '% lotunda yeterli % yok: gereken %, mevcut %.',
              v_raw_lot, v_item.code, replace(round(v_item.qty, 2)::text, '.', ','), replace(round(v_lot_avail, 2)::text, '.', ',');
          END IF;
        END IF;
      END LOOP;
    END IF;
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
    INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, lot_no, source_type, source_id, user_id, note, production_entry_id)
    SELECT i.component_product_id, v_raw_wh, 'out', round(v_used * i.ratio_pct / 100, 4),
           nullif(trim(p_raw_lots ->> i.component_product_id::text), ''),
           'production', v_wo.id, v_uid, 'İş emri ' || v_wo.no || ' tüketim (' || coalesce(v_lot_no, '-') || ')', v_entry_id
    FROM bom_items i
    WHERE i.bom_id = v_bom.id AND coalesce(i.ratio_pct, 0) > 0;
  END IF;

  IF v_produced > 0 THEN
    INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, lot_no, source_type, source_id, user_id, note, production_entry_id)
    VALUES (v_wo.product_id, v_target_wh, 'in', v_produced, v_lot_no, 'production', v_wo.id, v_uid,
            'İş emri ' || v_wo.no || ' üretim', v_entry_id);
  END IF;

  IF v_scrap > 0 THEN
    INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, lot_no, source_type, source_id, user_id, note, production_entry_id)
    VALUES (p_scrap_product_id, v_scrap_wh, 'in', v_scrap, v_lot_no, 'scrap', v_wo.id, v_uid,
            'İş emri ' || v_wo.no || ' fire', v_entry_id);
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

REVOKE ALL ON FUNCTION public.record_production_entry(UUID, shift_type, NUMERIC, NUMERIC, NUMERIC, UUID, UUID, NUMERIC, UUID, NUMERIC, UUID, TEXT, BOOLEAN, JSONB) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_production_entry(UUID, shift_type, NUMERIC, NUMERIC, NUMERIC, UUID, UUID, NUMERIC, UUID, NUMERIC, UUID, TEXT, BOOLEAN, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
