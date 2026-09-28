-- ═══════════════════════════════════════════════════════════════════
-- Üretim girişi ve reçete kaydı: tek işlemde (atomik) veritabanı fonksiyonları
--
-- complete_work_order : üretim kaydı + lot + stok hareketleri + kalıp atış
--                       sayacı + iş emri kapanışı. Biri başarısız olursa hiçbiri yazılmaz.
-- save_bom            : reçete kaydı. Üretimde kullanılmış bir reçete düzenlenirse
--                       yerinde değiştirilmez; yeni versiyon açılır, eskisi pasife alınır.
-- delete_bom          : kullanılmamış reçeteyi detaylarıyla birlikte kalıcı siler.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Üretim ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.complete_work_order(
  p_work_order_id UUID,
  p_shift shift_type,
  p_produced_qty NUMERIC,
  p_total_used_kg NUMERIC,
  p_scrap_kg NUMERIC DEFAULT 0,
  p_scrap_product_id UUID DEFAULT NULL,
  p_target_warehouse_id UUID DEFAULT NULL,
  p_operator TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
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

  IF coalesce(p_produced_qty, 0) <= 0 THEN RAISE EXCEPTION 'Üretilen miktar 0''dan büyük olmalıdır.'; END IF;
  IF coalesce(p_total_used_kg, 0) <= 0 THEN RAISE EXCEPTION 'Kullanılan hammadde 0''dan büyük olmalıdır.'; END IF;
  IF coalesce(p_scrap_kg, 0) < 0 THEN RAISE EXCEPTION 'Fire miktarı negatif olamaz.'; END IF;
  IF p_scrap_kg > p_total_used_kg THEN RAISE EXCEPTION 'Fire, kullanılan hammaddeden fazla olamaz.'; END IF;

  -- İş emrini kilitle: aynı iş emri iki kez aynı anda kapatılamaz
  SELECT * INTO v_wo FROM work_orders WHERE id = p_work_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'İş emri bulunamadı.'; END IF;
  IF v_wo.status = 'done' THEN RAISE EXCEPTION 'Bu iş emri zaten tamamlanmış.'; END IF;

  SELECT * INTO v_bom FROM boms WHERE id = v_wo.bom_id;

  -- Hammadde dağılımı oranlarla yapılır; toplam %100 olmalı
  SELECT coalesce(sum(ratio_pct), 0) INTO v_ratio_sum
  FROM bom_items WHERE bom_id = v_bom.id AND ratio_pct IS NOT NULL;
  IF abs(v_ratio_sum - 100) > 0.5 THEN
    RAISE EXCEPTION 'Reçete (v%) hammadde oranlarının toplamı %%100 olmalı; şu an %%%.', v_bom.version, round(v_ratio_sum, 2);
  END IF;

  -- Depolar
  SELECT id INTO v_raw_wh FROM warehouses WHERE type = 'raw' ORDER BY name LIMIT 1;
  IF v_raw_wh IS NULL THEN RAISE EXCEPTION 'Hammadde tipli depo tanımlı değil.'; END IF;

  IF p_target_warehouse_id IS NOT NULL THEN
    SELECT id INTO v_target_wh FROM warehouses WHERE id = p_target_warehouse_id AND type = 'finished';
    IF v_target_wh IS NULL THEN RAISE EXCEPTION 'Seçilen hedef depo bir mamul deposu değil.'; END IF;
  ELSE
    SELECT id INTO v_target_wh FROM warehouses WHERE type = 'finished' ORDER BY name LIMIT 1;
    IF v_target_wh IS NULL THEN RAISE EXCEPTION 'Mamul tipli depo tanımlı değil.'; END IF;
  END IF;

  IF p_scrap_kg > 0 THEN
    IF p_scrap_product_id IS NULL THEN
      RAISE EXCEPTION 'Fire miktarı girildi ama hurda ürünü seçilmedi.';
    END IF;
    SELECT id INTO v_scrap_wh FROM warehouses WHERE type = 'scrap' ORDER BY name LIMIT 1;
    IF v_scrap_wh IS NULL THEN RAISE EXCEPTION 'Hurda tipli depo tanımlı değil.'; END IF;
  END IF;

  -- Lot: L<YYMMDD>-<iş emri no>-<sıra>
  v_lot_no := 'L' || to_char(now() AT TIME ZONE 'Europe/Istanbul', 'YYMMDD') || '-' || v_wo.no || '-'
              || ((SELECT count(*) FROM lots WHERE work_order_id = v_wo.id) + 1);
  INSERT INTO lots (lot_no, product_id, production_date, work_order_id)
  VALUES (v_lot_no, v_wo.product_id, (now() AT TIME ZONE 'Europe/Istanbul')::date, v_wo.id);

  INSERT INTO production_entries (work_order_id, shift, produced_qty, scrap_qty, operator)
  VALUES (v_wo.id, p_shift, p_produced_qty, coalesce(p_scrap_kg, 0), nullif(trim(p_operator), ''))
  RETURNING id INTO v_entry_id;

  -- Hammadde tüketimi (reçete oranlarına göre)
  INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, source_type, source_id, user_id, note)
  SELECT i.component_product_id, v_raw_wh, 'out', round(p_total_used_kg * i.ratio_pct / 100, 4),
         'production', v_wo.id, v_uid, 'İş emri ' || v_wo.no || ' tüketim'
  FROM bom_items i
  WHERE i.bom_id = v_bom.id AND coalesce(i.ratio_pct, 0) > 0;

  -- Mamul girişi
  INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, lot_no, source_type, source_id, user_id, note)
  VALUES (v_wo.product_id, v_target_wh, 'in', p_produced_qty, v_lot_no, 'production', v_wo.id, v_uid,
          'İş emri ' || v_wo.no || ' üretim');

  -- Fire / hurda girişi (aynı lot numarasıyla: soyağacı)
  IF p_scrap_kg > 0 THEN
    INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, lot_no, source_type, source_id, user_id, note)
    VALUES (p_scrap_product_id, v_scrap_wh, 'in', p_scrap_kg, v_lot_no, 'scrap', v_wo.id, v_uid,
            'İş emri ' || v_wo.no || ' fire');
  END IF;

  -- Kalıp atış sayacı (enjeksiyon): atış = üretilen / göz sayısı
  IF v_bom.production_type = 'injection' THEN
    SELECT * INTO v_inj FROM bom_injection WHERE bom_id = v_bom.id;
    v_mold_id := coalesce(v_wo.mold_id, v_inj.mold_id);
    IF v_mold_id IS NOT NULL THEN
      SELECT coalesce(v_inj.cavity_count, m.cavity_count, 1) INTO v_cavity FROM molds m WHERE m.id = v_mold_id;
      v_shots := ceil(p_produced_qty / greatest(v_cavity, 1));
      UPDATE molds SET total_shots = total_shots + v_shots WHERE id = v_mold_id;
    END IF;
  END IF;

  UPDATE work_orders
     SET status = 'done',
         started_at = coalesce(started_at, now()),
         finished_at = now()
   WHERE id = v_wo.id;

  RETURN jsonb_build_object('lot_no', v_lot_no, 'entry_id', v_entry_id, 'mold_shots', v_shots);
END $$;

REVOKE ALL ON FUNCTION public.complete_work_order(UUID, shift_type, NUMERIC, NUMERIC, NUMERIC, UUID, UUID, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.complete_work_order(UUID, shift_type, NUMERIC, NUMERIC, NUMERIC, UUID, UUID, TEXT) TO authenticated;

-- ─── Reçete ────────────────────────────────────────────────────────

-- p_bom: { id?, product_id, active, production_type, regrind_pct, notes,
--          items: [{component_product_id, quantity, unit, ratio_pct}],
--          parameters: [{key, value}],
--          extrusion: {...} | null, injection: {...} | null }
-- Dönüş: { id, version, new_version: bool }
CREATE OR REPLACE FUNCTION public.save_bom(p_bom jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id UUID := nullif(p_bom->>'id', '')::uuid;
  v_product_id UUID := (p_bom->>'product_id')::uuid;
  v_type production_type := (p_bom->>'production_type')::production_type;
  v_old boms%ROWTYPE;
  v_version INTEGER;
  v_new_version BOOLEAN := false;
  v_ext jsonb := p_bom->'extrusion';
  v_inj jsonb := p_bom->'injection';
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Reçete kaydetmek için Admin yetkisi gerekir.';
  END IF;

  IF v_id IS NOT NULL THEN
    SELECT * INTO v_old FROM boms WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Reçete bulunamadı.'; END IF;
    IF v_old.product_id <> v_product_id THEN
      RAISE EXCEPTION 'Mevcut bir reçetenin ürünü değiştirilemez; yeni reçete oluşturun.';
    END IF;

    -- Üretimde kullanılmışsa: geçmiş maliyet bozulmasın diye yeni versiyon
    IF EXISTS (SELECT 1 FROM work_orders WHERE bom_id = v_id) THEN
      UPDATE boms SET active = false WHERE id = v_id;
      v_id := NULL;
      v_new_version := true;
    ELSE
      UPDATE boms
         SET active = coalesce((p_bom->>'active')::boolean, true),
             production_type = v_type,
             regrind_pct = nullif(p_bom->>'regrind_pct', '')::numeric,
             notes = nullif(p_bom->>'notes', '')
       WHERE id = v_id;
      DELETE FROM bom_items WHERE bom_id = v_id;
      DELETE FROM bom_parameters WHERE bom_id = v_id;
      DELETE FROM bom_extrusion WHERE bom_id = v_id;
      DELETE FROM bom_injection WHERE bom_id = v_id;
      v_version := v_old.version;
    END IF;
  END IF;

  IF v_id IS NULL THEN
    SELECT coalesce(max(version), 0) + 1 INTO v_version FROM boms WHERE product_id = v_product_id;
    INSERT INTO boms (product_id, version, active, production_type, regrind_pct, notes)
    VALUES (v_product_id, v_version, coalesce((p_bom->>'active')::boolean, true), v_type,
            nullif(p_bom->>'regrind_pct', '')::numeric, nullif(p_bom->>'notes', ''))
    RETURNING id INTO v_id;
  END IF;

  INSERT INTO bom_items (bom_id, component_product_id, quantity, unit, ratio_pct)
  SELECT v_id, (x->>'component_product_id')::uuid, (x->>'quantity')::numeric,
         (x->>'unit')::unit_type, nullif(x->>'ratio_pct', '')::numeric
  FROM jsonb_array_elements(coalesce(p_bom->'items', '[]')) x;

  INSERT INTO bom_parameters (bom_id, key, value)
  SELECT v_id, x->>'key', x->>'value'
  FROM jsonb_array_elements(coalesce(p_bom->'parameters', '[]')) x;

  IF v_type = 'extrusion' AND v_ext IS NOT NULL AND jsonb_typeof(v_ext) = 'object' THEN
    INSERT INTO bom_extrusion (bom_id, line_id, kg_per_meter, scrap_pct, scrap_product_id)
    VALUES (v_id, nullif(v_ext->>'line_id', '')::uuid, nullif(v_ext->>'kg_per_meter', '')::numeric,
            nullif(v_ext->>'scrap_pct', '')::numeric, nullif(v_ext->>'scrap_product_id', '')::uuid);
  ELSIF v_type = 'injection' AND v_inj IS NOT NULL AND jsonb_typeof(v_inj) = 'object' THEN
    INSERT INTO bom_injection (bom_id, mold_id, cavity_count, cycle_time_sec, runner_sprue_weight_g,
                               product_weight_g, scrap_product_id)
    VALUES (v_id, nullif(v_inj->>'mold_id', '')::uuid, nullif(v_inj->>'cavity_count', '')::integer,
            nullif(v_inj->>'cycle_time_sec', '')::numeric, nullif(v_inj->>'runner_sprue_weight_g', '')::numeric,
            nullif(v_inj->>'product_weight_g', '')::numeric, nullif(v_inj->>'scrap_product_id', '')::uuid);
  END IF;

  RETURN jsonb_build_object('id', v_id, 'version', v_version, 'new_version', v_new_version);
END $$;

CREATE OR REPLACE FUNCTION public.delete_bom(p_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Reçete silmek için Admin yetkisi gerekir.';
  END IF;
  IF EXISTS (SELECT 1 FROM work_orders WHERE bom_id = p_id) THEN
    RAISE EXCEPTION 'Bu reçete iş emirlerinde kullanıldığı için kalıcı silinemez; pasife alabilirsiniz.';
  END IF;
  DELETE FROM bom_items WHERE bom_id = p_id;
  DELETE FROM bom_parameters WHERE bom_id = p_id;
  DELETE FROM bom_extrusion WHERE bom_id = p_id;
  DELETE FROM bom_injection WHERE bom_id = p_id;
  DELETE FROM boms WHERE id = p_id;
END $$;

REVOKE ALL ON FUNCTION public.save_bom(jsonb) FROM anon, public;
REVOKE ALL ON FUNCTION public.delete_bom(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.save_bom(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_bom(UUID) TO authenticated;

-- Aynı ürün için aynı versiyon numarası iki kez olamaz
CREATE UNIQUE INDEX IF NOT EXISTS boms_product_version_key ON boms(product_id, version);

NOTIFY pgrst, 'reload schema';
