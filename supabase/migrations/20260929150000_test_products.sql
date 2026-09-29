-- ═══════════════════════════════════════════════════════════════════
-- TEST VERİSİ (ürün kartı denemesi) — sonra temizlenecek
--   Ürünler: V9TEST01 (PPR boru), A9TEST01.HENQ (aynı borunun renk/firma varyantı),
--            D.990.063.99 (PE fitting), TEST-MTL-01 (metal insert), TEST-HAM-PPR (hammadde)
--   Hepsi description = 'TEST ÜRÜNÜ — silinecek'. Stok hareketleri note = 'TEST VERİSİ'.
--   Temizlik: hareketler ters kayıtla sıfırlanır (defter append-only), ürünler pasife alınır.
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_raw_wh UUID;
  v_fin_wh UUID;
  v_line UUID;
  v_ham UUID;
  v_metal UUID;
  v_boru UUID;
  v_boru2 UUID;
  v_fit UUID;
  v_mold UUID;
  v_bom UUID;
  i INT;
  v_day TIMESTAMPTZ;
  v_note CONSTANT TEXT := 'TEST VERİSİ';
  v_desc CONSTANT TEXT := 'TEST ÜRÜNÜ — silinecek';
BEGIN
  IF EXISTS (SELECT 1 FROM products WHERE code = 'V9TEST01') THEN
    RETURN; -- daha önce eklenmiş
  END IF;

  -- Depolar (yoksa test deposu)
  SELECT id INTO v_raw_wh FROM warehouses WHERE type = 'raw' ORDER BY name LIMIT 1;
  IF v_raw_wh IS NULL THEN INSERT INTO warehouses (name, type) VALUES ('TEST Hammadde Deposu', 'raw') RETURNING id INTO v_raw_wh; END IF;
  SELECT id INTO v_fin_wh FROM warehouses WHERE type = 'finished' ORDER BY name LIMIT 1;
  IF v_fin_wh IS NULL THEN INSERT INTO warehouses (name, type) VALUES ('TEST Mamul Deposu', 'finished') RETURNING id INTO v_fin_wh; END IF;
  SELECT id INTO v_line FROM production_lines WHERE line_type = 'extrusion' AND (name || ' ' || code) ~* 'PPR' LIMIT 1;

  -- ─── Ürünler ───
  INSERT INTO products (code, name, type, unit, category, material_grade, min_stock, critical_stock, unit_cost, currency, description)
  VALUES ('TEST-HAM-PPR', 'TEST PPR-RCT Hammadde (granül)', 'raw', 'kg', 'hammadde', 'PPR-RCT', 5000, 2000, 1.45, 'USD', v_desc)
  RETURNING id INTO v_ham;

  INSERT INTO products (code, name, type, unit, category, material_grade, min_stock, critical_stock, unit_cost, currency, description)
  VALUES ('TEST-MTL-01', 'TEST Pirinç Dişli İnsert 1/2"', 'raw', 'adet', 'metal', 'CW617N', 2000, 500, 0.35, 'USD', v_desc)
  RETURNING id INTO v_metal;

  INSERT INTO products (code, name, type, unit, category, material_group, diameter_mm, wall_thickness_mm, sdr, group_code, variant_code, min_stock, critical_stock, description)
  VALUES ('V9TEST01', 'TEST PPR BORU 20 x 3.4 mm SDR 6 YEŞİL', 'finished', 'metre', 'boru', 'PP/PPR', 20, 3.4, 6, '21', '9TEST01', 4000, 1500, v_desc)
  RETURNING id INTO v_boru;

  INSERT INTO products (code, name, type, unit, category, material_group, diameter_mm, wall_thickness_mm, sdr, group_code, variant_code, min_stock, critical_stock, description)
  VALUES ('A9TEST01.HENQ', 'TEST PPR BORU 20 x 3.4 mm SDR 6 MAVİ (HENQ)', 'finished', 'metre', 'boru', 'PP/PPR', 20, 3.4, 6, '21', '9TEST01', 2000, 800, v_desc)
  RETURNING id INTO v_boru2;

  INSERT INTO products (code, name, type, unit, category, material_group, diameter_mm, sdr, group_code, min_stock, critical_stock, description)
  VALUES ('D.990.063.99', 'TEST PE 45° DİRSEK D.63', 'finished', 'adet', 'baglanti_parcasi', 'PE', 63, 11, '99', 3000, 1000, v_desc)
  RETURNING id INTO v_fit;

  -- ─── Reçeteler ───
  INSERT INTO boms (product_id, code, name, version, active, production_type, notes)
  VALUES (v_boru, 'TEST-RCT-BORU', 'TEST PPR boru 20x3.4 reçetesi', 1, true, 'extrusion', v_desc) RETURNING id INTO v_bom;
  INSERT INTO bom_extrusion (bom_id, line_id, kg_per_meter, target_m_per_hour) VALUES (v_bom, v_line, 0.172, 620);
  INSERT INTO bom_items (bom_id, component_product_id, quantity, unit, ratio_pct) VALUES (v_bom, v_ham, 1, 'kg', 100);

  INSERT INTO boms (product_id, code, name, version, active, production_type, notes)
  VALUES (v_boru2, 'TEST-RCT-BORU2', 'TEST PPR boru 20x3.4 (HENQ) reçetesi', 1, true, 'extrusion', v_desc) RETURNING id INTO v_bom;
  INSERT INTO bom_extrusion (bom_id, line_id, kg_per_meter, target_m_per_hour) VALUES (v_bom, v_line, 0.172, 620);
  INSERT INTO bom_items (bom_id, component_product_id, quantity, unit, ratio_pct) VALUES (v_bom, v_ham, 1, 'kg', 100);

  INSERT INTO molds (code, name, product_id, cavity_count, cycle_time_sec, product_weight_g, sprue_weight_g, status)
  VALUES ('KLP-TEST-01', 'TEST Kalıp — 45° dirsek D.63', v_fit, 4, 28, 142.5, 36, 'active') RETURNING id INTO v_mold;
  INSERT INTO boms (product_id, code, name, version, active, production_type, notes)
  VALUES (v_fit, 'TEST-RCT-FIT', 'TEST 45° dirsek D.63 reçetesi', 1, true, 'injection', v_desc) RETURNING id INTO v_bom;
  INSERT INTO bom_injection (bom_id, mold_id, cavity_count, cycle_time_sec, runner_sprue_weight_g, product_weight_g)
  VALUES (v_bom, v_mold, 4, 28, 36, 142.5);
  INSERT INTO bom_items (bom_id, component_product_id, quantity, unit, ratio_pct) VALUES (v_bom, v_ham, 1, 'kg', 100);

  -- ─── Son 12 ayın hareketleri (her ayın 10'u ve 22'si) ───
  FOR i IN 0..11 LOOP
    v_day := date_trunc('month', now()) - make_interval(months => 11 - i) + interval '9 days 10 hours';

    -- Hammadde: satın alma girişi, üretimde tüketim
    INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, source_type, created_at, note) VALUES
      (v_ham, v_raw_wh, 'in', 9000 + (i * 733) % 4000, 'purchase', v_day, v_note),
      (v_ham, v_raw_wh, 'out', 6500 + (i * 911) % 3000, 'production', v_day + interval '12 days', v_note),
      (v_metal, v_raw_wh, 'in', 6000 + (i * 457) % 2500, 'purchase', v_day, v_note),
      (v_metal, v_raw_wh, 'out', 4200 + (i * 389) % 2000, 'production', v_day + interval '12 days', v_note);

    -- Borular: üretim girişi, satış
    INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, source_type, created_at, note) VALUES
      (v_boru, v_fin_wh, 'in', 24000 + (i * 2917) % 12000, 'production', v_day, v_note),
      (v_boru, v_fin_wh, 'out', 19000 + (i * 3301) % 11000, 'sale', v_day + interval '12 days', v_note),
      (v_boru2, v_fin_wh, 'in', 9000 + (i * 1733) % 6000, 'production', v_day, v_note),
      (v_boru2, v_fin_wh, 'out', 7000 + (i * 1511) % 5000, 'sale', v_day + interval '12 days', v_note);

    -- Fitting: üretim girişi, satış
    INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, source_type, created_at, note) VALUES
      (v_fit, v_fin_wh, 'in', 11000 + (i * 1297) % 6000, 'production', v_day, v_note),
      (v_fit, v_fin_wh, 'out', 9000 + (i * 1433) % 5500, 'sale', v_day + interval '12 days', v_note);
  END LOOP;
END $$;
