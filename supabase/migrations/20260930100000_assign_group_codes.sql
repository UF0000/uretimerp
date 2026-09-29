-- Grup kodu boş ürünlere koddan otomatik grup kodu (KIRILIM listesi).
-- Kural lib/product-meta.ts → groupCodeFromCode ile aynıdır. Elle girilmiş grup kodlarına dokunulmaz.

-- PE / sifonik: son iki hane (harfli ara bölümler dahil: D.040.ENJ.21, D.110.HD.300.03, D.700.M10.13)
UPDATE products
   SET group_code = substring(upper(code) FROM '\.([0-9]{2})$')
 WHERE group_code IS NULL
   AND upper(code) ~ '^D\.[0-9A-Z.]+\.[0-9]{2}$';

-- Hammadde: ".27" ile biten kodlar
UPDATE products
   SET group_code = '27'
 WHERE group_code IS NULL
   AND code ~ '\.27$';

-- PP boru: renk harfi + 1A (V1A0420L4, A1A0311L4.20, M1A0111L4 …)
UPDATE products
   SET group_code = '24'
 WHERE group_code IS NULL
   AND upper(code) ~ '^[A-Z]1A[0-9]';

-- PP fitting: renk harfi + 1C / 1B (V1C012020.HENQ, V1C1321520 …)
UPDATE products
   SET group_code = '25'
 WHERE group_code IS NULL
   AND upper(code) ~ '^[A-Z]1[BC][0-9]';
