-- 2026 Türkiye resmi tatilleri (2429 sayılı Ulusal Bayram ve Genel Tatiller Kanunu).
-- Arife günleri yarım gün: 13:00'ten sonrası tatil → 11 saat.
-- Elle girilmiş kayıt varsa üzerine yazılmaz.

INSERT INTO calendar_holidays (day, name, off_hours) VALUES
  ('2026-01-01', 'Yılbaşı', 24),
  ('2026-03-19', 'Ramazan Bayramı arifesi (yarım gün)', 11),
  ('2026-03-20', 'Ramazan Bayramı 1. gün', 24),
  ('2026-03-21', 'Ramazan Bayramı 2. gün', 24),
  ('2026-03-22', 'Ramazan Bayramı 3. gün', 24),
  ('2026-04-23', 'Ulusal Egemenlik ve Çocuk Bayramı', 24),
  ('2026-05-01', 'Emek ve Dayanışma Günü', 24),
  ('2026-05-19', 'Atatürk''ü Anma, Gençlik ve Spor Bayramı', 24),
  ('2026-05-26', 'Kurban Bayramı arifesi (yarım gün)', 11),
  ('2026-05-27', 'Kurban Bayramı 1. gün', 24),
  ('2026-05-28', 'Kurban Bayramı 2. gün', 24),
  ('2026-05-29', 'Kurban Bayramı 3. gün', 24),
  ('2026-05-30', 'Kurban Bayramı 4. gün', 24),
  ('2026-07-15', 'Demokrasi ve Milli Birlik Günü', 24),
  ('2026-08-30', 'Zafer Bayramı', 24),
  ('2026-10-28', 'Cumhuriyet Bayramı arifesi (yarım gün)', 11),
  ('2026-10-29', 'Cumhuriyet Bayramı', 24)
ON CONFLICT (day) DO NOTHING;
