-- Örnek olarak eklenen grup kodu adları kaldırılıyor (gerçek liste kullanıcıdan gelecek).
-- Ürünlerdeki grup kodu değerleri (PE kodunun son iki hanesi) korunur.
DELETE FROM product_groups
 WHERE (code = '03' AND name = '45° dirsek')
    OR (code = '05' AND name = 'Çatal');
