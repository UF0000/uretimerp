-- ═══════════════════════════════════════════════════════════════════
-- Kapasite ayarları: makine kapasitesi (geçerlilik tarihli), ürün/kalıp
-- referans kapasitesi (grup × çap × SDR), çalışma takvimi / tatiller
--
-- Kullanılabilir saat (gün) = 24 − tatil saati − (haftalık kapalı günse 24)
-- NŞA kapasite = Σ gün (o gün geçerli makine kapasitesi × kullanılabilir saat)
-- Referans kapasite: ürünün grup/çap/SDR'sine uyan onaylı, en güncel yıl
-- ═══════════════════════════════════════════════════════════════════

-- ─── Ürün boyut özellikleri (referans kapasite eşleşmesi için) ───
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS material_group TEXT,
  ADD COLUMN IF NOT EXISTS diameter_mm NUMERIC CHECK (diameter_mm > 0),
  ADD COLUMN IF NOT EXISTS sdr NUMERIC CHECK (sdr > 0);

-- Ad içinden doldur: "SDR 7,4 ... PIPE 20 x 2.8 mm", "HDPE PIPE EN 1519 D.90" (kelepçe vb. hariç)
UPDATE products p
   SET diameter_mm = coalesce(
         replace((regexp_match(p.name, '(\d+(?:[.,]\d+)?)\s*[xX]\s*\d'))[1], ',', '.')::numeric,
         (regexp_match(p.name, 'D\.\s*(\d+)'))[1]::numeric),
       sdr = replace((regexp_match(p.name, 'SDR\s*(\d+(?:[.,]\d+)?)', 'i'))[1], ',', '.')::numeric,
       material_group = CASE
         WHEN p.name ~* 'HDPE|\mPE\s*-?\s*100\M|\mPE\M' THEN 'PE'
         WHEN p.name ~* 'HOT|COLD|PPR|PP-R|FIBERGLAS|COMPOSITE|LILAC|SICAK|SOĞUK' THEN 'PP/PPR'
       END
 WHERE p.type IN ('finished', 'semi')
   AND p.name ~* '(PIPE|BORU)'
   AND p.name !~* 'CLAMP|KELEP'
   AND p.diameter_mm IS NULL;

-- ─── Makine kapasitesi (geçerlilik tarihli) ───
CREATE TABLE IF NOT EXISTS line_capacities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID NOT NULL REFERENCES production_lines(id),
  capacity_kg_per_hour NUMERIC NOT NULL CHECK (capacity_kg_per_hour > 0),
  valid_from DATE NOT NULL,
  valid_to DATE CHECK (valid_to IS NULL OR valid_to >= valid_from),
  note TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Aynı makinede aktif kapasite dönemleri çakışamaz
CREATE OR REPLACE FUNCTION public.guard_line_capacity_overlap()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.active AND EXISTS (
    SELECT 1 FROM line_capacities c
    WHERE c.line_id = NEW.line_id AND c.active AND c.id <> NEW.id
      AND daterange(c.valid_from, coalesce(c.valid_to, 'infinity'::date), '[]')
          && daterange(NEW.valid_from, coalesce(NEW.valid_to, 'infinity'::date), '[]')
  ) THEN
    RAISE EXCEPTION 'Bu makinenin bu tarihlerle çakışan aktif bir kapasite kaydı var; önce onu bitirin veya pasifleştirin.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS line_capacities_overlap ON line_capacities;
CREATE TRIGGER line_capacities_overlap BEFORE INSERT OR UPDATE ON line_capacities
  FOR EACH ROW EXECUTE FUNCTION public.guard_line_capacity_overlap();

-- Hatta tek değer olarak girilmiş kapasite varsa geçerlilik kaydına taşı
INSERT INTO line_capacities (line_id, capacity_kg_per_hour, valid_from, note)
SELECT id, capacity_kg_per_hour, date_trunc('year', now())::date, 'Hat kartından taşındı'
FROM production_lines WHERE capacity_kg_per_hour IS NOT NULL;

-- ─── Ürün / kalıp referans kapasitesi ───
CREATE TABLE IF NOT EXISTS reference_capacities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_group TEXT NOT NULL,
  diameter_mm NUMERIC NOT NULL CHECK (diameter_mm > 0),
  sdr NUMERIC CHECK (sdr > 0),
  capacity_kg_per_hour NUMERIC NOT NULL CHECK (capacity_kg_per_hour > 0),
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  source TEXT,
  approval TEXT NOT NULL DEFAULT 'approved' CHECK (approval IN ('approved', 'pending')),
  active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS reference_capacities_key
  ON reference_capacities (material_group, diameter_mm, coalesce(sdr, -1), year);

-- ─── Çalışma takvimi ───
CREATE TABLE IF NOT EXISTS calendar_holidays (
  day DATE PRIMARY KEY,
  name TEXT NOT NULL,
  off_hours NUMERIC NOT NULL DEFAULT 24 CHECK (off_hours > 0 AND off_hours <= 24),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE cost_parameters
  ADD COLUMN IF NOT EXISTS weekly_off_days INTEGER[] NOT NULL DEFAULT '{}',   -- 0 = Pazar … 6 = Cumartesi
  ADD COLUMN IF NOT EXISTS day_shift_start TIME NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS night_shift_start TIME NOT NULL DEFAULT '20:00';

-- ─── RLS: herkes okur, admin yazar ───
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['line_capacities', 'reference_capacities', 'calendar_holidays'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Okuma: aktif kullanıcı" ON public.%I FOR SELECT TO authenticated USING (public.app_role() IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY "Yazma: admin" ON public.%I FOR ALL TO authenticated USING (public.has_role(''admin'')) WITH CHECK (public.has_role(''admin''))', t);
  END LOOP;
END $$;

-- ─── Günlük kullanılabilir saat ───
CREATE OR REPLACE FUNCTION public.available_hours(p_from DATE, p_to DATE)
RETURNS TABLE (day DATE, hours NUMERIC)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT d::date,
         CASE WHEN extract(dow FROM d)::int = ANY (coalesce((SELECT weekly_off_days FROM cost_parameters LIMIT 1), '{}'))
              THEN 0
              ELSE greatest(24 - coalesce((SELECT h.off_hours FROM calendar_holidays h WHERE h.day = d::date), 0), 0)
         END
  FROM generate_series(p_from, p_to, interval '1 day') d;
$$;
REVOKE ALL ON FUNCTION public.available_hours(DATE, DATE) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.available_hours(DATE, DATE) TO authenticated;

-- ─── Analiz görünümü: kapasite giriş gününde geçerli kayıttan; referans kapasite eklendi ───
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
  s.shift_minutes AS planned_min,
  greatest(s.shift_minutes - e.downtime_min, 0) AS run_min,
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
CROSS JOIN (SELECT coalesce(max(shift_minutes), 720) AS shift_minutes FROM cost_parameters) s;

-- Tek değerli hat kapasitesi artık kullanılmıyor (geçerlilik tablosuna taşındı)
ALTER TABLE production_lines DROP COLUMN IF EXISTS capacity_kg_per_hour;

NOTIFY pgrst, 'reload schema';
