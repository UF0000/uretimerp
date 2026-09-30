-- 1) Aile: grup 01 (PE boru) ve 24 (PP boru) → "boru"
-- 2) PP genel stok kodu (varyant): ilk harf renk atılır, son "."dan sonrası (firma eki) atılır.
--    V1A032020.HENQ → 1A032020, V1A0320L4 → 1A0320L4. Kural lib/product-meta.ts → variantBaseFromCode ile aynı.
-- 3) Bundan sonra eklenen/güncellenen ürünlerde boşsa aynı kurallar otomatik uygulanır (Excel aktarımı dahil).

CREATE OR REPLACE FUNCTION pp_variant_base(p_code text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN upper(trim(p_code)) ~ '^[A-Z]1[ABC][0-9]' THEN
      substring(regexp_replace(upper(trim(p_code)), '\.[^.]*$', '') FROM 2)
  END;
$$;

UPDATE products SET category = 'boru'
 WHERE group_code IN ('01', '24') AND category IS DISTINCT FROM 'boru';

UPDATE products SET variant_code = pp_variant_base(code)
 WHERE group_code IN ('24', '25')
   AND pp_variant_base(code) IS NOT NULL
   AND variant_code IS DISTINCT FROM pp_variant_base(code);

CREATE OR REPLACE FUNCTION products_autofill() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.variant_code IS NULL OR NEW.variant_code = '' THEN
    NEW.variant_code := pp_variant_base(NEW.code);
  END IF;
  IF NEW.category IS NULL AND NEW.group_code IN ('01', '24') THEN
    NEW.category := 'boru';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_autofill ON products;
CREATE TRIGGER products_autofill
  BEFORE INSERT OR UPDATE OF code, group_code, category, variant_code ON products
  FOR EACH ROW EXECUTE FUNCTION products_autofill();
