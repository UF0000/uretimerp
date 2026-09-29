-- ═══════════════════════════════════════════════════════════════════
-- Üretim girişi v2
--   * Tarih + saat aralığı (start_at/end_at): planlı süre = aralık (yoksa vardiya süresi)
--   * Operatör listeden (operators)
--   * Çoklu fire (neden + kg) ve çoklu duruş (neden + dk) satırları
--   * Gerçekleşen çevrim otomatik (enjeksiyon: çalışma sn / atış)
--   * Düzeltme = eski girişi ters kayıtla iptal + yeni giriş (tek işlem); iptal edilen giriş analizlere girmez
-- ═══════════════════════════════════════════════════════════════════

-- ─── Operatörler ───
CREATE TABLE IF NOT EXISTS operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Okuma: aktif kullanıcı" ON operators;
CREATE POLICY "Okuma: aktif kullanıcı" ON operators FOR SELECT TO authenticated USING (public.app_role() IS NOT NULL);
DROP POLICY IF EXISTS "Yazma: admin" ON operators;
CREATE POLICY "Yazma: admin" ON operators FOR ALL TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

-- Önceki girişlerde yazılmış operatör isimleri listeye alınır
INSERT INTO operators (name)
SELECT DISTINCT trim(operator) FROM production_entries WHERE nullif(trim(operator), '') IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- ─── Giriş alanları ───
ALTER TABLE production_entries
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES operators(id),
  ADD COLUMN IF NOT EXISTS mold_id UUID REFERENCES molds(id),
  ADD COLUMN IF NOT EXISTS mold_shots INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cancel_note TEXT,
  ADD COLUMN IF NOT EXISTS replaced_by_entry_id UUID REFERENCES production_entries(id);

DO $$ BEGIN
  ALTER TABLE production_entries ADD CONSTRAINT production_entries_time_range CHECK (end_at IS NULL OR start_at IS NULL OR end_at > start_at);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Fire ve duruş satırları ───
CREATE TABLE IF NOT EXISTS production_entry_scraps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES production_entries(id) ON DELETE CASCADE,
  reason_code_id UUID NOT NULL REFERENCES reason_codes(id),
  kg NUMERIC NOT NULL CHECK (kg > 0)
);
CREATE INDEX IF NOT EXISTS production_entry_scraps_entry_idx ON production_entry_scraps (entry_id);

CREATE TABLE IF NOT EXISTS production_entry_downtimes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES production_entries(id) ON DELETE CASCADE,
  reason_code_id UUID NOT NULL REFERENCES reason_codes(id),
  minutes NUMERIC NOT NULL CHECK (minutes > 0)
);
CREATE INDEX IF NOT EXISTS production_entry_downtimes_entry_idx ON production_entry_downtimes (entry_id);

-- Eski girişlerin tek nedenleri satır olarak da yazılır (dağılımlar tek kaynaktan)
INSERT INTO production_entry_scraps (entry_id, reason_code_id, kg)
SELECT e.id, e.scrap_reason_code_id, e.scrap_qty FROM production_entries e
WHERE e.scrap_qty > 0 AND e.scrap_reason_code_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM production_entry_scraps s WHERE s.entry_id = e.id);
INSERT INTO production_entry_downtimes (entry_id, reason_code_id, minutes)
SELECT e.id, e.downtime_reason_code_id, e.downtime_min FROM production_entries e
WHERE e.downtime_min > 0 AND e.downtime_reason_code_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM production_entry_downtimes d WHERE d.entry_id = e.id);

-- Satırlar yalnızca giriş fonksiyonlarıyla yazılır; herkes okur
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['production_entry_scraps', 'production_entry_downtimes'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Okuma: aktif kullanıcı" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Okuma: aktif kullanıcı" ON public.%I FOR SELECT TO authenticated USING (public.app_role() IS NOT NULL)', t);
  END LOOP;
END $$;

-- ─── Giriş iptali (ters kayıt) ───
CREATE OR REPLACE FUNCTION public.cancel_production_entry(p_entry_id UUID, p_note TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_entry production_entries%ROWTYPE;
  v_wo work_orders%ROWTYPE;
  v_mv RECORD;
  v_avail NUMERIC;
BEGIN
  IF NOT public.has_role('operator', 'admin') THEN
    RAISE EXCEPTION 'Giriş iptali için Operatör veya Admin yetkisi gerekir.';
  END IF;

  SELECT * INTO v_entry FROM production_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Giriş bulunamadı.'; END IF;
  IF v_entry.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'Bu giriş zaten iptal edilmiş.'; END IF;

  SELECT * INTO v_wo FROM work_orders WHERE id = v_entry.work_order_id FOR UPDATE;
  IF v_wo.status = 'done' THEN
    RAISE EXCEPTION 'İş emri tamamlanmış; girişi düzeltmek için önce iş emrini yeniden açın.';
  END IF;

  -- Girişin (henüz geri alınmamış) hareketleri ters kayıtla geri alınır
  FOR v_mv IN
    SELECT m.* FROM stock_movements m
    WHERE m.production_entry_id = p_entry_id AND m.reverses_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM stock_movements r WHERE r.reverses_id = m.id)
  LOOP
    -- Girişte depoya giren mal (mamul/fire) sonradan çıkmışsa geri alınamaz
    IF v_mv.direction = 'in' THEN
      SELECT coalesce(sum(CASE WHEN direction = 'in' THEN quantity ELSE -quantity END), 0) INTO v_avail
      FROM stock_movements
      WHERE product_id = v_mv.product_id AND warehouse_id = v_mv.warehouse_id
        AND lot_no IS NOT DISTINCT FROM v_mv.lot_no;
      IF v_avail < v_mv.quantity THEN
        RAISE EXCEPTION '% lotunun bir kısmı depodan çıkmış (kalan %); giriş düzeltilemez.',
          coalesce(v_mv.lot_no, '-'), replace(round(v_avail, 2)::text, '.', ',');
      END IF;
    END IF;
    INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, lot_no, source_type, source_id, user_id, note, production_entry_id, reverses_id)
    VALUES (v_mv.product_id, v_mv.warehouse_id,
            CASE WHEN v_mv.direction = 'in' THEN 'out'::movement_direction ELSE 'in'::movement_direction END,
            v_mv.quantity, v_mv.lot_no, v_mv.source_type, v_mv.source_id, v_uid,
            'Giriş iptali: ' || coalesce(nullif(trim(p_note), ''), 'düzeltme'), p_entry_id, v_mv.id);
  END LOOP;

  IF v_entry.mold_id IS NOT NULL AND v_entry.mold_shots > 0 THEN
    UPDATE molds SET total_shots = greatest(total_shots - v_entry.mold_shots, 0) WHERE id = v_entry.mold_id;
  END IF;

  UPDATE production_entries
     SET cancelled_at = now(), cancelled_by = v_uid, cancel_note = nullif(trim(p_note), '')
   WHERE id = p_entry_id;
END $$;
REVOKE ALL ON FUNCTION public.cancel_production_entry(UUID, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.cancel_production_entry(UUID, TEXT) TO authenticated;

-- ─── Giriş kaydet (yeni veya düzeltme) ───
CREATE OR REPLACE FUNCTION public.save_production_entry(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wo_id UUID := (p->>'work_order_id')::uuid;
  v_start TIMESTAMPTZ := (p->>'start_at')::timestamptz;
  v_end TIMESTAMPTZ := (p->>'end_at')::timestamptz;
  v_replaces UUID := nullif(p->>'replaces_entry_id', '')::uuid;
  v_operator_id UUID := nullif(p->>'operator_id', '')::uuid;
  v_operator TEXT;
  v_produced NUMERIC := coalesce((p->>'produced_qty')::numeric, 0);
  v_duration_min NUMERIC;
  v_scrap NUMERIC;
  v_downtime NUMERIC;
  v_scrap_reason UUID;
  v_down_reason UUID;
  v_shift shift_type;
  v_local TIME;
  v_day_start TIME;
  v_night_start TIME;
  v_wo work_orders%ROWTYPE;
  v_bom boms%ROWTYPE;
  v_inj bom_injection%ROWTYPE;
  v_cavity INTEGER;
  v_cycle NUMERIC;
  v_result jsonb;
  v_entry_id UUID;
BEGIN
  IF NOT public.has_role('operator', 'admin') THEN
    RAISE EXCEPTION 'Üretim girişi için Operatör veya Admin yetkisi gerekir.';
  END IF;
  IF v_start IS NULL OR v_end IS NULL THEN RAISE EXCEPTION 'Başlangıç ve bitiş zamanı girilmelidir.'; END IF;
  IF v_end <= v_start THEN RAISE EXCEPTION 'Bitiş zamanı başlangıçtan sonra olmalıdır.'; END IF;
  v_duration_min := extract(epoch FROM v_end - v_start) / 60;
  IF v_duration_min > 24 * 60 THEN RAISE EXCEPTION 'Bir giriş en fazla 24 saatlik olabilir.'; END IF;

  -- Fire / duruş satırları
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p->'scraps', '[]')) x
             WHERE coalesce((x->>'kg')::numeric, 0) <= 0
                OR NOT EXISTS (SELECT 1 FROM reason_codes r WHERE r.id = (x->>'reason_code_id')::uuid AND r.kind = 'scrap')) THEN
    RAISE EXCEPTION 'Her fire satırında fire nedeni ve 0''dan büyük kg olmalıdır.';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p->'downtimes', '[]')) x
             WHERE coalesce((x->>'minutes')::numeric, 0) <= 0
                OR NOT EXISTS (SELECT 1 FROM reason_codes r WHERE r.id = (x->>'reason_code_id')::uuid AND r.kind = 'downtime')) THEN
    RAISE EXCEPTION 'Her duruş satırında duruş nedeni ve 0''dan büyük dakika olmalıdır.';
  END IF;
  SELECT coalesce(sum((x->>'kg')::numeric), 0) INTO v_scrap FROM jsonb_array_elements(coalesce(p->'scraps', '[]')) x;
  SELECT coalesce(sum((x->>'minutes')::numeric), 0) INTO v_downtime FROM jsonb_array_elements(coalesce(p->'downtimes', '[]')) x;
  IF v_downtime > v_duration_min THEN
    RAISE EXCEPTION 'Toplam duruş (% dk) çalışma aralığından (% dk) uzun olamaz.', round(v_downtime), round(v_duration_min);
  END IF;
  -- Ana neden: en büyük satır (eski tek alanlı raporlar için)
  SELECT (x->>'reason_code_id')::uuid INTO v_scrap_reason FROM jsonb_array_elements(coalesce(p->'scraps', '[]')) x ORDER BY (x->>'kg')::numeric DESC LIMIT 1;
  SELECT (x->>'reason_code_id')::uuid INTO v_down_reason FROM jsonb_array_elements(coalesce(p->'downtimes', '[]')) x ORDER BY (x->>'minutes')::numeric DESC LIMIT 1;

  IF v_operator_id IS NOT NULL THEN
    SELECT name INTO v_operator FROM operators WHERE id = v_operator_id;
    IF v_operator IS NULL THEN RAISE EXCEPTION 'Operatör bulunamadı.'; END IF;
  END IF;

  -- Vardiya başlangıç saatinden
  SELECT coalesce(max(day_shift_start), '08:00'), coalesce(max(night_shift_start), '20:00') INTO v_day_start, v_night_start FROM cost_parameters;
  v_local := (v_start AT TIME ZONE 'Europe/Istanbul')::time;
  v_shift := CASE WHEN v_local >= v_day_start AND v_local < v_night_start THEN 'day' ELSE 'night' END;

  -- Düzeltme: eski giriş aynı iş emrine ait olmalı; önce iptal edilir
  IF v_replaces IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM production_entries WHERE id = v_replaces AND work_order_id = v_wo_id) THEN
      RAISE EXCEPTION 'Düzeltilen giriş bu iş emrine ait değil.';
    END IF;
    PERFORM public.cancel_production_entry(v_replaces, 'Düzeltme');
  END IF;

  -- Gerçekleşen çevrim (enjeksiyon): çalışma süresi / atış
  SELECT * INTO v_wo FROM work_orders WHERE id = v_wo_id;
  SELECT * INTO v_bom FROM boms WHERE id = v_wo.bom_id;
  IF v_bom.production_type = 'injection' AND v_produced > 0 THEN
    SELECT * INTO v_inj FROM bom_injection WHERE bom_id = v_bom.id;
    SELECT greatest(coalesce(v_inj.cavity_count, m.cavity_count, 1), 1) INTO v_cavity
    FROM (SELECT 1) one LEFT JOIN molds m ON m.id = coalesce(v_wo.mold_id, v_inj.mold_id);
    v_cycle := round(((v_duration_min - v_downtime) * 60) / (v_produced / greatest(v_cavity, 1)), 3);
    IF v_cycle <= 0 THEN v_cycle := NULL; END IF;
  END IF;

  v_result := public.record_production_entry(
    p_work_order_id => v_wo_id,
    p_shift => v_shift,
    p_produced_qty => v_produced,
    p_total_used_kg => coalesce((p->>'total_used_kg')::numeric, 0),
    p_scrap_kg => v_scrap,
    p_scrap_product_id => nullif(p->>'scrap_product_id', '')::uuid,
    p_scrap_reason_code_id => v_scrap_reason,
    p_downtime_min => v_downtime,
    p_downtime_reason_code_id => v_down_reason,
    p_actual_cycle_time_sec => v_cycle,
    p_target_warehouse_id => nullif(p->>'target_warehouse_id', '')::uuid,
    p_operator => v_operator,
    p_close_work_order => coalesce((p->>'close_work_order')::boolean, false),
    p_raw_lots => CASE WHEN jsonb_typeof(p->'raw_lots') = 'object' AND p->'raw_lots' <> '{}'::jsonb THEN p->'raw_lots' END
  );
  v_entry_id := (v_result->>'entry_id')::uuid;

  UPDATE production_entries
     SET start_at = v_start, end_at = v_end, entry_time = v_start, operator_id = v_operator_id,
         mold_id = CASE WHEN (v_result->>'mold_shots')::int > 0 THEN coalesce(v_wo.mold_id, v_inj.mold_id) END,
         mold_shots = coalesce((v_result->>'mold_shots')::int, 0)
   WHERE id = v_entry_id;

  INSERT INTO production_entry_scraps (entry_id, reason_code_id, kg)
  SELECT v_entry_id, (x->>'reason_code_id')::uuid, (x->>'kg')::numeric FROM jsonb_array_elements(coalesce(p->'scraps', '[]')) x;
  INSERT INTO production_entry_downtimes (entry_id, reason_code_id, minutes)
  SELECT v_entry_id, (x->>'reason_code_id')::uuid, (x->>'minutes')::numeric FROM jsonb_array_elements(coalesce(p->'downtimes', '[]')) x;

  IF v_replaces IS NOT NULL THEN
    UPDATE production_entries SET replaced_by_entry_id = v_entry_id WHERE id = v_replaces;
  END IF;

  RETURN v_result || jsonb_build_object('shift', v_shift, 'actual_cycle_sec', v_cycle, 'replaced', v_replaces IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.save_production_entry(jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.save_production_entry(jsonb) TO authenticated;

-- ─── Analiz görünümleri: iptaller hariç; planlı süre giriş aralığından ───
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
  coalesce(extract(epoch FROM e.end_at - e.start_at) / 60, s.shift_minutes) * 60 AS planned_sec,
  greatest(coalesce(extract(epoch FROM e.end_at - e.start_at) / 60, s.shift_minutes) - e.downtime_min, 0) * 60 AS run_sec,
  e.downtime_min,
  e.downtime_reason_code_id,
  e.scrap_qty AS scrap_kg,
  e.scrap_reason_code_id,
  e.produced_qty,
  e.total_used_kg AS total_kg,
  greatest(e.total_used_kg - e.scrap_qty, 0) AS good_kg,
  CASE
    WHEN b.production_type = 'injection' AND coalesce(bi.cycle_time_sec, m.cycle_time_sec) > 0 THEN
      coalesce(bi.cycle_time_sec, m.cycle_time_sec) *
      CASE
        WHEN bi.product_weight_g > 0 AND e.total_used_kg > 0 THEN
          (e.total_used_kg * 1000)
          / (greatest(coalesce(bi.cavity_count, m.cavity_count, 1), 1) * bi.product_weight_g + coalesce(bi.runner_sprue_weight_g, 0))
        ELSE e.produced_qty / greatest(coalesce(bi.cavity_count, m.cavity_count, 1), 1)
      END
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
CROSS JOIN (SELECT coalesce(max(shift_minutes), 720) AS shift_minutes FROM cost_parameters) s
WHERE e.cancelled_at IS NULL;

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
    WHEN b.production_type = 'injection' AND bi.product_weight_g > 0 THEN e.produced_qty * bi.product_weight_g / 1000
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
    ORDER BY (r.sdr = p.sdr) DESC NULLS LAST, r.year DESC LIMIT 1) AS reference_kg_per_hour
FROM production_entries e
JOIN work_orders w ON w.id = e.work_order_id
JOIN products p ON p.id = w.product_id
JOIN boms b ON b.id = w.bom_id
LEFT JOIN bom_extrusion be ON be.bom_id = b.id
LEFT JOIN bom_injection bi ON bi.bom_id = b.id
CROSS JOIN (SELECT coalesce(max(shift_minutes), 720) AS shift_minutes FROM cost_parameters) s
WHERE e.cancelled_at IS NULL;

NOTIFY pgrst, 'reload schema';
