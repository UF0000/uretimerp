-- ═══════════════════════════════════════════════════════════════════
-- Üretim analiz panosu (ekstrüder / enjeksiyon raporu) için veri katmanı
--
-- production_lines.capacity_kg_per_hour : makinenin saatlik kapasitesi
-- production_lines.line_type            : ekstrüzyon | enjeksiyon (pano filtresi)
-- cost_parameters hedefleri             : fire %, overweight toleransı ±%, OEE %
-- v_production_analytics                : vardiya girişi başına ham ölçüler
--   good_kg      = hammadde − fire (sağlam kütle)
--   nominal_kg   = üretilen × reçetedeki birim ağırlık (ekstrüzyon kg/m,
--                  enjeksiyon parça ağırlığı) → overweight = good/nominal − 1
--   run_min      = vardiya süresi − duruş
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE production_lines
  ADD COLUMN IF NOT EXISTS capacity_kg_per_hour NUMERIC CHECK (capacity_kg_per_hour > 0),
  ADD COLUMN IF NOT EXISTS line_type production_type;

UPDATE production_lines
   SET line_type = CASE WHEN upper(code) LIKE 'ENJ%' OR upper(name) LIKE 'ENJEKS%' THEN 'injection'::production_type
                        ELSE 'extrusion'::production_type END
 WHERE line_type IS NULL;

ALTER TABLE cost_parameters
  ADD COLUMN IF NOT EXISTS target_scrap_pct NUMERIC NOT NULL DEFAULT 3 CHECK (target_scrap_pct >= 0),
  ADD COLUMN IF NOT EXISTS overweight_tolerance_pct NUMERIC NOT NULL DEFAULT 2.5 CHECK (overweight_tolerance_pct >= 0),
  ADD COLUMN IF NOT EXISTS target_oee_pct NUMERIC NOT NULL DEFAULT 85 CHECK (target_oee_pct BETWEEN 0 AND 100);

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
  -- Reçetedeki birim ağırlığa göre olması gereken sağlam kütle
  CASE
    WHEN b.production_type = 'extrusion' AND be.kg_per_meter > 0 THEN e.produced_qty * be.kg_per_meter
    WHEN b.production_type = 'injection' AND bi.product_weight_g > 0 THEN e.produced_qty * bi.product_weight_g / 1000
  END AS nominal_kg,
  s.shift_minutes AS planned_min,
  greatest(s.shift_minutes - e.downtime_min, 0) AS run_min,
  l.capacity_kg_per_hour
FROM production_entries e
JOIN work_orders w ON w.id = e.work_order_id
JOIN products p ON p.id = w.product_id
JOIN boms b ON b.id = w.bom_id
LEFT JOIN bom_extrusion be ON be.bom_id = b.id
LEFT JOIN bom_injection bi ON bi.bom_id = b.id
LEFT JOIN production_lines l ON l.id = coalesce(w.line_id, be.line_id)
CROSS JOIN (SELECT coalesce(max(shift_minutes), 720) AS shift_minutes FROM cost_parameters) s;

REVOKE ALL ON v_production_analytics FROM anon;
GRANT SELECT ON v_production_analytics TO authenticated;

NOTIFY pgrst, 'reload schema';
