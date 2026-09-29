-- ═══════════════════════════════════════════════════════════════════
-- Fitting (enjeksiyon) analiz panosu
--  1) Kalıp çalışma tipi (otomatik / yarı otomatik) — "KALIP_ÜRÜN_İNFO.xlsx" KALIP ÇALIŞMA sütunu
--  2) v_production_analytics: nominal yolluk (kg) sütunu
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE molds
  ADD COLUMN IF NOT EXISTS operation_mode TEXT CHECK (operation_mode IN ('otomatik', 'yari_otomatik'));

UPDATE molds m SET operation_mode = v.mode
FROM (VALUES
  ('KLP-D.110.000.04', 'otomatik'),
  ('KLP-D.125.000.04', 'yari_otomatik'),
  ('KLP-D.160.000.04', 'yari_otomatik'),
  ('KLP-D.200.000.04', 'yari_otomatik'),
  ('KLP-D.125.063.07', 'yari_otomatik'),
  ('KLP-D.125.075.07', 'yari_otomatik'),
  ('KLP-D.125.090.07', 'yari_otomatik'),
  ('KLP-D.125.110.07', 'yari_otomatik'),
  ('KLP-D.125.125.07', 'yari_otomatik'),
  ('KLP-D.160.110.07', 'yari_otomatik'),
  ('KLP-D.200.110.09', 'otomatik'),
  ('KLP-D.200.160.09', 'otomatik'),
  ('KLP-D.250.160.09', 'otomatik'),
  ('KLP-D.250.200.09', 'otomatik'),
  ('KLP-D.040.ENJ.21', 'otomatik'),
  ('KLP-D.050.ENJ.21', 'otomatik'),
  ('KLP-D.056.ENJ.21', 'otomatik'),
  ('KLP-D.063.ENJ.21', 'otomatik'),
  ('KLP-D.075.ENJ.21', 'otomatik'),
  ('KLP-D.090.ENJ.21', 'otomatik'),
  ('KLP-D.110.ENJ.21', 'otomatik'),
  ('KLP-D.125.ENJ.21', 'otomatik'),
  ('KLP-D.160.ENJ.21', 'otomatik'),
  ('KLP-D.200.ENJ.21', 'otomatik'),
  ('KLP-D.250.ENJ.21', 'otomatik'),
  ('KLP-D.050.100.23', 'otomatik'),
  ('KLP-D.063.100.23', 'otomatik'),
  ('KLP-D.075.100.23', 'otomatik'),
  ('KLP-D.090.100.23', 'otomatik'),
  ('KLP-D.110.100.23', 'otomatik'),
  ('KLP-D.125.100.23', 'otomatik'),
  ('KLP-D.090.190.23', 'otomatik'),
  ('KLP-D.000.010.23', 'otomatik'),
  ('KLP-D.000.009.23', 'otomatik'),
  ('KLP-D.000.001.23', 'otomatik'),
  ('KLP-V1C062020', 'yari_otomatik'),
  ('KLP-V1C062520', 'yari_otomatik'),
  ('KLP-V1C062525', 'yari_otomatik'),
  ('KLP-V1C063232', 'yari_otomatik'),
  ('KLP-V1C063225', 'yari_otomatik'),
  ('KLP-V1C052020', 'yari_otomatik'),
  ('KLP-V1C052520', 'yari_otomatik'),
  ('KLP-V1C052525', 'yari_otomatik'),
  ('KLP-V1C053232', 'yari_otomatik'),
  ('KLP-V1C053225', 'yari_otomatik'),
  ('KLP-V1C032020', 'yari_otomatik'),
  ('KLP-V1C032520', 'yari_otomatik'),
  ('KLP-V1C032525', 'yari_otomatik'),
  ('KLP-V1C033232', 'yari_otomatik'),
  ('KLP-V1C033225', 'yari_otomatik'),
  ('KLP-V1C012020', 'yari_otomatik'),
  ('KLP-V1C012520', 'yari_otomatik'),
  ('KLP-V1C012525', 'yari_otomatik'),
  ('KLP-V1C013232', 'yari_otomatik'),
  ('KLP-V1C013225', 'yari_otomatik'),
  ('KLP-V1C1321520', 'yari_otomatik'),
  ('KLP-V1C1321525', 'yari_otomatik')
) AS v(code, mode)
WHERE m.code = v.code AND m.operation_mode IS NULL;

CREATE OR REPLACE VIEW v_production_analytics
WITH (security_invoker = true) AS
SELECT
  e.id AS entry_id,
  e.entry_time,
  (e.entry_time AT TIME ZONE 'Europe/Istanbul')::date AS day,
  e.shift,
  e.lot_no,
  w.id AS work_order_id,
  w.no AS work_order_no,
  w.product_id,
  p.code AS product_code,
  p.name AS product_name,
  p.unit AS product_unit,
  b.id AS bom_id,
  b.code AS bom_code,
  b.production_type,
  coalesce(w.line_id, be.line_id) AS line_id,
  coalesce(w.mold_id, bi.mold_id) AS mold_id,
  e.operator,
  e.produced_qty,
  e.total_used_kg AS used_kg,
  e.scrap_qty AS scrap_kg,
  greatest(e.total_used_kg - e.scrap_qty, 0) AS good_kg,
  e.scrap_reason_code_id,
  e.downtime_min,
  e.downtime_reason_code_id,
  e.actual_cycle_time_sec,
  CASE
    WHEN b.production_type = 'extrusion' AND be.kg_per_meter > 0 THEN e.produced_qty * be.kg_per_meter
    WHEN b.production_type = 'injection' AND coalesce(nullif(bi.product_weight_g, 0), m.product_weight_g) > 0 THEN
      e.produced_qty
      * (coalesce(nullif(bi.product_weight_g, 0), m.product_weight_g)
         + coalesce(nullif(bi.runner_sprue_weight_g, 0), m.sprue_weight_g, 0) / greatest(coalesce(nullif(bi.cavity_count, 0), m.cavity_count, 1), 1))
      / 1000
  END AS nominal_kg,
  coalesce(extract(epoch FROM e.end_at - e.start_at) / 60, s.shift_minutes) AS planned_min,
  greatest(coalesce(extract(epoch FROM e.end_at - e.start_at) / 60, s.shift_minutes) - e.downtime_min, 0) AS run_min,
  (SELECT c.capacity_kg_per_hour FROM line_capacities c
    WHERE c.line_id = coalesce(w.line_id, be.line_id) AND c.active
      AND (e.entry_time AT TIME ZONE 'Europe/Istanbul')::date BETWEEN c.valid_from AND coalesce(c.valid_to, 'infinity'::date)
    ORDER BY c.valid_from DESC LIMIT 1) AS capacity_kg_per_hour,
  p.material_group,
  p.diameter_mm,
  p.sdr,
  (SELECT r.capacity_kg_per_hour FROM reference_capacities r
    WHERE r.active AND r.approval = 'approved'
      AND r.material_group = p.material_group AND r.diameter_mm = p.diameter_mm
      AND (r.sdr IS NULL OR p.sdr IS NULL OR r.sdr = p.sdr)
    ORDER BY (r.sdr = p.sdr) DESC NULLS LAST, r.year DESC LIMIT 1) AS reference_kg_per_hour,
  -- Nominal yolluk: atış sayısı (üretilen / göz) × atış başı yolluk
  CASE
    WHEN b.production_type = 'injection' AND coalesce(nullif(bi.runner_sprue_weight_g, 0), m.sprue_weight_g, 0) > 0 THEN
      e.produced_qty / greatest(coalesce(nullif(bi.cavity_count, 0), m.cavity_count, 1), 1)
      * coalesce(nullif(bi.runner_sprue_weight_g, 0), m.sprue_weight_g) / 1000
  END AS runner_kg
FROM production_entries e
JOIN work_orders w ON w.id = e.work_order_id
JOIN products p ON p.id = w.product_id
JOIN boms b ON b.id = w.bom_id
LEFT JOIN bom_extrusion be ON be.bom_id = b.id
LEFT JOIN bom_injection bi ON bi.bom_id = b.id
LEFT JOIN molds m ON m.id = coalesce(w.mold_id, bi.mold_id)
CROSS JOIN (SELECT coalesce(max(shift_minutes), 720) AS shift_minutes FROM cost_parameters) s
WHERE e.cancelled_at IS NULL;
