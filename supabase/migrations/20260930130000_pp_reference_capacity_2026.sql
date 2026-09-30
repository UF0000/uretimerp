-- PP/PPR boru referans kapasiteleri — 2026 (yıl başından bugüne üretilen boruların ortalama saatlik kapasitesi, kg/sa)
-- Kaynak: SDR_Degerleri.xlsx (SDR 6 / 7,4 / 11 sayfaları). "yok" olan çaplar eklenmedi.
-- Rehber kuralı değişmez: aynı çap × SDR için yıllar içindeki EN YÜKSEK kapasite esas alınır
-- (v_production_analytics + Yönetim → Kapasite); düşük kalan yıllar gizlenir, silinmez.

INSERT INTO reference_capacities (material_group, diameter_mm, sdr, capacity_kg_per_hour, year, source, approval)
VALUES
  ('PP/PPR',  20,    6,  82, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  25,    6,  89, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  32,    6, 111, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  40,    6,  94, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  50,    6,  87, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  63,    6,  98, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  75,    6,  96, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  90,    6, 101, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR', 110,    6, 115, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  20,  7.4,  65, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  25,  7.4,  86, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  32,  7.4, 109, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  40,  7.4,  97, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  50,  7.4,  83, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  63,  7.4, 107, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  75,  7.4,  93, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  90,  7.4, 101, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR', 110,  7.4,  86, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  32,   11,  93, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  50,   11,  89, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  63,   11,  95, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  75,   11,  86, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR',  90,   11, 101, 2026, '2026 ortalama üretim', 'approved'),
  ('PP/PPR', 110,   11,  92, 2026, '2026 ortalama üretim', 'approved')
ON CONFLICT (material_group, diameter_mm, coalesce(sdr, -1), year)
DO UPDATE SET capacity_kg_per_hour = EXCLUDED.capacity_kg_per_hour, source = EXCLUDED.source, active = true, approval = 'approved';
