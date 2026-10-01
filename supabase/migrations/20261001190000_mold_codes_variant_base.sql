-- ═══════════════════════════════════════════════════════════════════
-- Kalıp kodları ürün ana koduyla (kullanıcı kararı, 2026-10-01): PP kalıplarındaki ilk harf renk
-- kodudur, kalıp renkten bağımsızdır → KLP-V1C032520 → KLP-1C032520 (22 kalıp). Sifonik (KLP-D.…) aynı kalır.
-- A1C062025.HENQ (DIA'da "ADAPTOR FEMALE 25x3/4 MAVİ") İD nipel 25x3/4 ürünüdür → genel kod 1C012525
-- (KLP-1C012525 kalıbında basılır).
-- ═══════════════════════════════════════════════════════════════════

UPDATE molds m
   SET code = regexp_replace(m.code, '^KLP-[A-Z](1[A-Z][0-9])', 'KLP-\1')
 WHERE m.code ~ '^KLP-[A-Z]1[A-Z][0-9]'
   AND NOT EXISTS (
     SELECT 1 FROM molds x WHERE x.code = regexp_replace(m.code, '^KLP-[A-Z](1[A-Z][0-9])', 'KLP-\1')
   );

UPDATE products SET variant_code = '1C012525' WHERE code = 'A1C062025.HENQ';
