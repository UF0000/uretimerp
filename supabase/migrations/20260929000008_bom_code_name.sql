-- ═══════════════════════════════════════════════════════════════════
-- Reçete kodu ve adı
--
-- code : reçetenin kimliği (RCT-#### otomatik ya da elle); yeni versiyonlar
--        aynı kodu taşır → (code, version) benzersiz. Bir ürüne birden çok
--        reçete (farklı kod) açılabilir.
-- name : zorunlu, kullanıcının tanıdığı ad (örn. "PE100 Ø20 siyah — standart")
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE boms
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT;

-- Mevcut reçeteler: aynı ürünün versiyonları aynı kodu alır, sıra ilk oluşturulma tarihine göre
WITH families AS (
  SELECT product_id, row_number() OVER (ORDER BY min(created_at), product_id) AS n
  FROM boms WHERE code IS NULL GROUP BY product_id
)
UPDATE boms b
   SET code = 'RCT-' || lpad(f.n::text, 4, '0')
  FROM families f
 WHERE b.product_id = f.product_id AND b.code IS NULL;

UPDATE boms b SET name = p.name FROM products p WHERE p.id = b.product_id AND b.name IS NULL;

ALTER TABLE boms ALTER COLUMN code SET NOT NULL, ALTER COLUMN name SET NOT NULL;

-- Versiyon artık ürüne göre değil koda göre benzersiz
DROP INDEX IF EXISTS boms_product_version_key;
CREATE UNIQUE INDEX IF NOT EXISTS boms_code_version_key ON boms(code, version);

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
  v_code TEXT := upper(nullif(trim(p_bom->>'code'), ''));
  v_name TEXT := nullif(trim(p_bom->>'name'), '');
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Reçete kaydetmek için Admin yetkisi gerekir.';
  END IF;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Reçete adı zorunludur.'; END IF;

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
         SET name = v_name,
             active = coalesce((p_bom->>'active')::boolean, true),
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
    v_code := v_old.code; -- kod reçetenin kimliğidir; yeni versiyon da aynı kodu taşır
  END IF;

  IF v_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('bom_code'));
    IF v_new_version THEN
      -- Mevcut reçetenin yeni versiyonu: aynı kod, versiyon koda göre artar
      SELECT coalesce(max(version), 0) + 1 INTO v_version FROM boms WHERE code = v_code;
    ELSE
      -- Yeni reçete: kod verilmediyse RCT-#### üretilir; verilen kod benzersiz olmalı
      IF v_code IS NULL THEN
        SELECT 'RCT-' || lpad((coalesce(max(substring(code FROM '^RCT-([0-9]+)$')::int), 0) + 1)::text, 4, '0')
          INTO v_code FROM boms;
      ELSIF EXISTS (SELECT 1 FROM boms WHERE code = v_code) THEN
        RAISE EXCEPTION '% reçete kodu zaten kullanılıyor; farklı bir kod girin veya mevcut reçeteyi düzenleyin.', v_code;
      END IF;
      v_version := 1;
    END IF;
    INSERT INTO boms (product_id, code, name, version, active, production_type, regrind_pct, notes)
    VALUES (v_product_id, v_code, v_name, v_version, coalesce((p_bom->>'active')::boolean, true), v_type,
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

  RETURN jsonb_build_object('id', v_id, 'code', v_code, 'version', v_version, 'new_version', v_new_version);
END $$;

NOTIFY pgrst, 'reload schema';
