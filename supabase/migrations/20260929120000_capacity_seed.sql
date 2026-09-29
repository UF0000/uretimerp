-- ═══════════════════════════════════════════════════════════════════
-- Kapasite başlangıç verileri (kullanıcının verdiği güncel değerler)
--   Makine: PE ekstrüder 500 kg/sa, PPR ekstrüder 190 kg/sa (2026-01-01'den)
--   Referans: PE / PP-PPR çap × SDR × yıl tablosu
-- Tekrar çalışsa da aynı sonucu verir; sonraki değişiklikler Yönetim ekranından yapılır.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Makine kapasitesi: adı/kodu PPR içeren ekstrüder 190, PE (PPR olmayan) ekstrüder 500 ───
WITH targets AS (
  SELECT l.id,
         CASE
           WHEN (l.name || ' ' || l.code) ~* '(PPR|PP-R)' THEN 190
           WHEN (l.name || ' ' || l.code) ~* '(HDPE|\mPE\M)' THEN 500
         END AS kg
  FROM production_lines l
  WHERE l.line_type = 'extrusion'
)
INSERT INTO line_capacities (line_id, capacity_kg_per_hour, valid_from, note)
SELECT t.id, t.kg, DATE '2026-01-01', 'Başlangıç değeri'
FROM targets t
WHERE t.kg IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM line_capacities c
    WHERE c.line_id = t.id AND c.active
      AND DATE '2026-01-01' BETWEEN c.valid_from AND coalesce(c.valid_to, 'infinity'::date)
  );

-- Taşınan eski değer farklıysa güncel değerle düzelt (yalnızca 2026-01-01'de başlayan açık dönem)
UPDATE line_capacities c
   SET capacity_kg_per_hour = CASE WHEN (l.name || ' ' || l.code) ~* '(PPR|PP-R)' THEN 190 ELSE 500 END
  FROM production_lines l
 WHERE c.line_id = l.id AND c.active AND c.valid_to IS NULL AND c.valid_from = DATE '2026-01-01'
   AND l.line_type = 'extrusion'
   AND (l.name || ' ' || l.code) ~* '(PPR|PP-R|HDPE|\mPE\M)';

-- ─── Referans kapasiteler ───
INSERT INTO reference_capacities (material_group, diameter_mm, sdr, capacity_kg_per_hour, year, source, approval)
VALUES
  ('PE',      56, NULL,  86.23, 2025, 'Kapasite referansı', 'approved'),
  ('PE',      75, NULL, 116.87, 2025, 'Kapasite referansı', 'approved'),
  ('PE',      90, NULL, 165.87, 2025, 'Kapasite referansı', 'approved'),
  ('PE',     110, NULL, 246.00, 2025, 'Kapasite referansı', 'approved'),
  ('PE',     125, NULL, 299.20, 2025, 'Kapasite referansı', 'approved'),
  ('PE',     160, NULL, 276.60, 2025, 'Kapasite referansı', 'approved'),
  ('PE',     200, NULL, 326.02, 2025, 'Kapasite referansı', 'approved'),
  ('PE',     250, NULL, 282.00, 2025, 'Kapasite referansı', 'approved'),
  ('PP/PPR',  20,    6,  66.30, 2025, 'Kapasite referansı', 'approved'),
  ('PP/PPR',  20,    6,  85.90, 2024, 'Kapasite referansı', 'approved'),
  ('PP/PPR',  20,  7.4,  90.40, 2024, 'Kapasite referansı', 'approved'),
  ('PP/PPR',  25,    6,  88.60, 2025, 'Kapasite referansı', 'approved'),
  ('PP/PPR',  25,    6, 115.50, 2024, 'Kapasite referansı', 'approved'),
  ('PP/PPR',  25,  7.4,  73.30, 2025, 'Kapasite referansı', 'approved'),
  ('PP/PPR',  25,  7.4, 105.25, 2024, 'Kapasite referansı', 'approved'),
  ('PP/PPR',  32,    6,  93.20, 2025, 'Kapasite referansı', 'approved'),
  ('PP/PPR',  32,    6, 116.90, 2024, 'Kapasite referansı', 'approved'),
  ('PP/PPR',  32,  7.4, 108.20, 2025, 'Kapasite referansı', 'approved'),
  ('PP/PPR',  32,  7.4, 111.70, 2024, 'Kapasite referansı', 'approved'),
  ('PP/PPR',  40,    6,  86.20, 2025, 'Kapasite referansı', 'approved'),
  ('PP/PPR',  40,    6,  88.80, 2024, 'Kapasite referansı', 'approved'),
  ('PP/PPR',  40,  7.4,  88.07, 2025, 'Kapasite referansı', 'approved'),
  ('PP/PPR',  40,  7.4, 108.60, 2024, 'Kapasite referansı', 'approved'),
  ('PP/PPR',  63,  7.4, 101.16, 2025, 'Kapasite referansı', 'approved'),
  ('PP/PPR',  63,  7.4,  80.90, 2024, 'Kapasite referansı', 'approved'),
  ('PP/PPR',  75,   11,  82.05, 2024, 'Kapasite referansı', 'approved')
ON CONFLICT (material_group, diameter_mm, coalesce(sdr, -1), year)
DO UPDATE SET capacity_kg_per_hour = EXCLUDED.capacity_kg_per_hour, active = true, approval = 'approved';
