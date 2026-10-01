-- ═══════════════════════════════════════════════════════════════════
-- DIA 2026 üretim raporlarında olup ürün kartı olmayan 35 kod (kullanıcı onayı, 2026-10-01)
--  - Adlar DIA'dan; boru grup 24 (metre), fitting grup 25 (adet)
--  - Çap/SDR/et/boy/ambalaj bilgisi aynı genel koddaki (varyant) karttan; kardeşi olmayanlar adından
--  - V1C092525B (vana gövdesi T 25x3/4 "B") KLP-V1C1321525 kalıbında basılır → genel kod 1C1321525
-- RCT-0004: V1C052020.HENQ (90° dişi dirsek) ekstrüzyon tanımlıydı → enjeksiyon, kalıp KLP-V1C052020
-- (çevrim/göz/ağırlık reçetede boş → kalıp kartından). Üretimde kullanılmadığı için yerinde düzeltilir.
-- ═══════════════════════════════════════════════════════════════════

WITH src (code, name, unit, group_code, variant_code, diameter_mm, sdr, wall_thickness_mm, pipe_length_m) AS (VALUES
  ('V1A0590L4.KOLOM', 'SDR 7,4 COMPOSITE HOT & COLD WATER PIPE 90 x 12.3 mm YEŞİL SANİPLASTİCA KOLOMBİYA', 'metre', '24', NULL, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric),
  ('V1A0563L4.KOLOM', 'SDR 7,4 COMPOSITE HOT & COLD WATER PIPE 63 x 8.6 mm YEŞİL SANİPLASTİCA KOLOMBİYA', 'metre', '24', NULL, NULL, NULL, NULL, NULL),
  ('G1A0540L3.BAS', 'SDR 7,4 COMPOSITE HOT & COLD WATER PIPE 40 x 5.5 mm GRİ BASALT BULGARİSTAN', 'metre', '24', NULL, 40, 7.4, 5.5, 3),
  ('G1A0532L3.BAS', 'SDR 7,4 COMPOSITE HOT & COLD WATER PIPE 32 x 4.4 mm GRİ BASALT BULGARİSTAN', 'metre', '24', NULL, 32, 7.4, 4.4, 3),
  ('G1A0525L3.BAS', 'SDR 7,4 COMPOSITE HOT & COLD WATER PIPE 25 x 3.5 mm GRİ BASALT BULGARİSTAN', 'metre', '24', NULL, 25, 7.4, 3.5, 3),
  ('G1A0520L3.BAS', 'SDR 7,4 COMPOSITE HOT & COLD WATER PIPE 20 x 2.8 mm GRİ BASALT BULGARİSTAN', 'metre', '24', NULL, 20, 7.4, 2.8, 3),
  ('V1A0575L4.YB', 'SDR 7,4 COMPOSITE HOT & COLD WATER PIPE 75 x 10.3 mm YEŞİL SANİPLASTİCA YALÇIN BORU', 'metre', '24', NULL, NULL, NULL, NULL, NULL),
  ('V1A0163L4.YB', 'SDR 11 FIBERGLAS HOT-COLD WATER PIPE 63 x 5.8 mm YEŞİL SP YALÇIN BORU', 'metre', '24', NULL, NULL, NULL, NULL, NULL),
  ('V1A0563L4.YB', 'SDR 7,4 COMPOSITE HOT & COLD WATER PIPE 63 x 8.6 mm YEŞİL SANİPLASTİCA YALÇIN BORU', 'metre', '24', NULL, NULL, NULL, NULL, NULL),
  ('V1A0175L4.YB', 'SDR 11 FIBERGLAS HOT-COLD WATER PIPE 75 x 6.8 mm YEŞİL SP YALÇIN BORU', 'metre', '24', NULL, NULL, NULL, NULL, NULL),
  ('V1A0190L4.YB', 'SDR 11 FIBERGLAS HOT-COLD WATER PIPE 90 x 8.2 mm YEŞİL SP YALÇIN BORU', 'metre', '24', NULL, NULL, NULL, NULL, NULL),
  ('V1A0420L4.COES', 'PN 20 (SDR 6) HOT & COLD WATER PIPE 20 x 3,4 mm YEŞİL COES FİLİSTİN, KUVEYT', 'metre', '24', NULL, NULL, NULL, NULL, NULL),
  ('V1A0425L4.COES', 'PN 20 (SDR 6) HOT & COLD WATER PIPE 25 x 4,2 mm YEŞİL COES FİLİSTİN, KUVEYT', 'metre', '24', NULL, NULL, NULL, NULL, NULL),
  ('V1C092525B.HENQ', 'VALVE BODY T PART 25x3/4" HENQ', 'adet', '25', '1C1321525', NULL, NULL, NULL, NULL),
  ('V1C092525B.SANİ', 'VALVE BODY T PART 25x3/4" SANİ', 'adet', '25', '1C1321525', NULL, NULL, NULL, NULL),
  ('A1C062025.HENQ', 'ADAPTOR FEMALE 25x3/4" MAVİ (HENQ)', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('A1C032520.HENQ', 'ADAPTOR MALE 25x1/2" MAVİ (HENQ)', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('A1C012520.HENQ', 'ADAPTOR FEMALE 25x1/2" MAVİ (HENQ)', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('A1C032525.HENQ', 'ADAPTOR MALE 25x3/4" MAVİ (HENQ)', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('A1C052020.HENQ', 'ELBOW FEMALE 20x1/2" MAVİ (HENQ)', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('A1C062020.HENQ', 'ELBOW MALE 20x1/2" MAVİ (HENQ)', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('A1C062520.HENQ', '90° ELBOW MALE DN. 25MM x 1/2 MAVİ (HENQ)', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('A1C012020.HENQ', 'ADAPTOR FEMALE 20x1/2" MAVİ (HENQ)', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('A1C032020.HENQ', 'ADAPTOR MALE 20x1/2" MAVİ (HENQ)', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('A1C013232.HENQ', 'ADAPTOR FEMALE 32x1" MAVİ (HENQ)', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('A1C033232.HENQ', 'ADAPTOR MALE 32x1" MAVİ (HENQ)', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('A1C052520.HENQ', 'ELBOW FEMALE 25x1/2" MAVİ (HENQ)', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('A1C1321520.HENQ', 'VALVE BODY T-PART 20MM x 1/2 MAVİ (HENQ)', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('A1C1321525.HENQ', 'VALVE BODY T-PART 25MM x 3/4 MAVİ (HENQ)', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('G1C032520.SLOV', 'ADAPTOR MALE 25x1/2" GRİ SLOVAKYA', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('G1C012520.SANİTAS', 'ADAPTOR FEMALE 25x1/2" GRİ (SANİTAS)', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('V1C1321520.SANİ', 'VALVE BODY T-PART 20MM x 1/2 (SANİ)', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('A1C032020.SANİ', 'ADAPTOR MALE 20x1/2" MAVİ (SANİ)', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('A1C032525.SANİ', 'ADAPTOR MALE 25x3/4" MAVİ (SANİ)', 'adet', '25', NULL, NULL, NULL, NULL, NULL),
  ('A1C033232.SANİ', 'ADAPTOR MALE 32x1" MAVİ (SANİ)', 'adet', '25', NULL, NULL, NULL, NULL, NULL)
),
prepared AS (
  SELECT s.*, coalesce(s.variant_code, public.pp_variant_base(s.code)) AS base FROM src s
)
INSERT INTO products (
  code, name, type, unit, active, group_code, variant_code, category, material_group, diameter_mm, sdr,
  wall_thickness_mm, pipe_length_m, package_type, package_qty, pallet_qty, package_weight_kg, bag_type, bag_qty
)
SELECT
  p.code, p.name, 'finished', p.unit::unit_type, true, p.group_code, p.base,
  coalesce(sib.category, CASE p.group_code WHEN '24' THEN 'boru' ELSE 'baglanti_parcasi' END),
  coalesce(sib.material_group, CASE WHEN p.group_code = '24' THEN 'PP/PPR' END),
  coalesce(p.diameter_mm, sib.diameter_mm), coalesce(p.sdr, sib.sdr), coalesce(p.wall_thickness_mm, sib.wall_thickness_mm),
  coalesce(p.pipe_length_m, sib.pipe_length_m), sib.package_type, sib.package_qty, sib.pallet_qty, sib.package_weight_kg, sib.bag_type, sib.bag_qty
FROM prepared p
LEFT JOIN LATERAL (
  SELECT * FROM products x WHERE x.variant_code = p.base AND x.active AND x.code <> p.code ORDER BY x.code LIMIT 1
) sib ON true
ON CONFLICT (code) DO UPDATE SET
  name = excluded.name,
  group_code = excluded.group_code,
  variant_code = excluded.variant_code,
  category = coalesce(products.category, excluded.category),
  material_group = coalesce(products.material_group, excluded.material_group),
  diameter_mm = coalesce(products.diameter_mm, excluded.diameter_mm),
  sdr = coalesce(products.sdr, excluded.sdr),
  wall_thickness_mm = coalesce(products.wall_thickness_mm, excluded.wall_thickness_mm),
  pipe_length_m = coalesce(products.pipe_length_m, excluded.pipe_length_m),
  package_type = coalesce(products.package_type, excluded.package_type),
  package_qty = coalesce(products.package_qty, excluded.package_qty),
  pallet_qty = coalesce(products.pallet_qty, excluded.pallet_qty),
  package_weight_kg = coalesce(products.package_weight_kg, excluded.package_weight_kg),
  bag_type = coalesce(products.bag_type, excluded.bag_type),
  bag_qty = coalesce(products.bag_qty, excluded.bag_qty);

-- RCT-0004 → enjeksiyon (yalnız hâlâ ekstrüzyon ve hiç kullanılmamışsa)
WITH b AS (
  SELECT b.id, be.scrap_product_id
  FROM boms b LEFT JOIN bom_extrusion be ON be.bom_id = b.id
  WHERE b.code = 'RCT-0004' AND b.production_type = 'extrusion'
    AND NOT EXISTS (SELECT 1 FROM work_orders w WHERE w.bom_id = b.id)
),
upd AS (
  UPDATE boms SET production_type = 'injection' WHERE id IN (SELECT id FROM b) RETURNING id
),
del AS (
  DELETE FROM bom_extrusion WHERE bom_id IN (SELECT id FROM b) RETURNING bom_id
)
INSERT INTO bom_injection (bom_id, mold_id, scrap_product_id)
SELECT b.id, (SELECT id FROM molds WHERE code = 'KLP-V1C052020'), b.scrap_product_id
FROM b
WHERE EXISTS (SELECT 1 FROM upd WHERE upd.id = b.id)
ON CONFLICT DO NOTHING;
