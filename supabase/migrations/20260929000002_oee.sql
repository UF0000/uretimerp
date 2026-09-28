-- ═══════════════════════════════════════════════════════════════════
-- OEE (Toplam Ekipman Etkinliği)
--
-- OEE = Kullanılabilirlik × Performans × Kalite, her vardiya girişi için ham
-- bileşenler v_oee_entries görünümünde; oranlar raporda ağırlıklı toplanır:
--   Kullanılabilirlik = run_sec / planned_sec      (planlı süre = vardiya süresi)
--   Performans        = ideal_sec / run_sec        (ideal veri yoksa ideal_sec NULL)
--   Kalite            = good_kg / total_kg         (kütle bazlı: hammadde − fire)
-- ═══════════════════════════════════════════════════════════════════

-- Vardiya süresi (dk). Vardiyalar gündüz/gece → varsayılan 12 saat.
ALTER TABLE cost_parameters
  ADD COLUMN IF NOT EXISTS shift_minutes NUMERIC NOT NULL DEFAULT 720 CHECK (shift_minutes > 0);

-- Ekstrüzyon hedef hızı (m/saat): performans hesabı için ideal üretim hızı
ALTER TABLE bom_extrusion
  ADD COLUMN IF NOT EXISTS target_m_per_hour NUMERIC CHECK (target_m_per_hour > 0);

-- save_bom: target_m_per_hour da kaydedilir (gövde 20260928000004 ile aynı, sadece ekstrüzyon eki)
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
    INSERT INTO bom_extrusion (bom_id, line_id, kg_per_meter, scrap_pct, scrap_product_id, target_m_per_hour)
    VALUES (v_id, nullif(v_ext->>'line_id', '')::uuid, nullif(v_ext->>'kg_per_meter', '')::numeric,
            nullif(v_ext->>'scrap_pct', '')::numeric, nullif(v_ext->>'scrap_product_id', '')::uuid,
            nullif(v_ext->>'target_m_per_hour', '')::numeric);
  ELSIF v_type = 'injection' AND v_inj IS NOT NULL AND jsonb_typeof(v_inj) = 'object' THEN
    INSERT INTO bom_injection (bom_id, mold_id, cavity_count, cycle_time_sec, runner_sprue_weight_g,
                               product_weight_g, scrap_product_id)
    VALUES (v_id, nullif(v_inj->>'mold_id', '')::uuid, nullif(v_inj->>'cavity_count', '')::integer,
            nullif(v_inj->>'cycle_time_sec', '')::numeric, nullif(v_inj->>'runner_sprue_weight_g', '')::numeric,
            nullif(v_inj->>'product_weight_g', '')::numeric, nullif(v_inj->>'scrap_product_id', '')::uuid);
  END IF;

  RETURN jsonb_build_object('id', v_id, 'version', v_version, 'new_version', v_new_version);
END $$;

CREATE OR REPLACE VIEW v_oee_entries
WITH (security_invoker = true) AS
SELECT
  e.id AS entry_id,
  e.work_order_id,
  w.no AS work_order_no,
  w.product_id,
  e.entry_time,
  (e.entry_time AT TIME ZONE 'Europe/Istanbul')::date AS day,
  e.shift,
  b.production_type,
  w.line_id,
  coalesce(w.mold_id, bi.mold_id) AS mold_id,
  s.shift_minutes * 60 AS planned_sec,
  greatest(s.shift_minutes - e.downtime_min, 0) * 60 AS run_sec,
  e.downtime_min,
  e.downtime_reason_code_id,
  e.scrap_qty AS scrap_kg,
  e.scrap_reason_code_id,
  e.produced_qty,
  e.total_used_kg AS total_kg,
  greatest(e.total_used_kg - e.scrap_qty, 0) AS good_kg,
  CASE
    -- Enjeksiyon: ideal süre = çevrim × atış sayısı. Ağırlıklar biliniyorsa atış,
    -- fire dahil harcanan kütleden; yoksa sağlam adet / göz sayısından.
    WHEN b.production_type = 'injection' AND coalesce(bi.cycle_time_sec, m.cycle_time_sec) > 0 THEN
      coalesce(bi.cycle_time_sec, m.cycle_time_sec) *
      CASE
        WHEN bi.product_weight_g > 0 AND e.total_used_kg > 0 THEN
          (e.total_used_kg * 1000)
          / (greatest(coalesce(bi.cavity_count, m.cavity_count, 1), 1) * bi.product_weight_g + coalesce(bi.runner_sprue_weight_g, 0))
        ELSE e.produced_qty / greatest(coalesce(bi.cavity_count, m.cavity_count, 1), 1)
      END
    -- Ekstrüzyon: ideal süre = (sağlam metre + fire metre) / hedef hız
    WHEN b.production_type = 'extrusion' AND be.target_m_per_hour > 0 THEN
      3600 * (e.produced_qty + CASE WHEN be.kg_per_meter > 0 THEN e.scrap_qty / be.kg_per_meter ELSE 0 END)
      / be.target_m_per_hour
  END AS ideal_sec
FROM production_entries e
JOIN work_orders w ON w.id = e.work_order_id
JOIN boms b ON b.id = w.bom_id
LEFT JOIN bom_injection bi ON bi.bom_id = b.id
LEFT JOIN bom_extrusion be ON be.bom_id = b.id
LEFT JOIN molds m ON m.id = coalesce(w.mold_id, bi.mold_id)
CROSS JOIN (SELECT coalesce(max(shift_minutes), 720) AS shift_minutes FROM cost_parameters) s;

REVOKE ALL ON v_oee_entries FROM anon;
GRANT SELECT ON v_oee_entries TO authenticated;

NOTIFY pgrst, 'reload schema';
