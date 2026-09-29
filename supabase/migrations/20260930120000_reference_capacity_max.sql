-- Referans kapasite: aynı grup × çap × SDR için birden çok yıl varsa EN YÜKSEK kapasite rehber kabul edilir
-- (o hızla üretildiyse yine üretilebilir). Önceki kural: en güncel yıl.
-- Diğer yıllar silinmez; Yönetim → Kapasite'de varsayılan olarak gizlenir.

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
    ORDER BY (r.sdr = p.sdr) DESC NULLS LAST, r.capacity_kg_per_hour DESC, r.year DESC LIMIT 1) AS reference_kg_per_hour,
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
