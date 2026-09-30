-- Ana Veri'de yanlışlıkla toplu silinen (pasife alınan) sifonik ürünler geri alınır (2026-09-30, 272 kayıt).
-- Silme = active false olduğu için veri kaybı yok. Yalnızca D. ile başlayan sifonik kodlar;
-- eski deneme kayıtları (bb, rp2400, ZZ-TEST-*) pasif kalır.
UPDATE products SET active = true
 WHERE active = false
   AND code LIKE 'D.%';
