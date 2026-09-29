-- ═══════════════════════════════════════════════════════════════════
-- Ürün kartı: yeni türler, grup kodu, varyant, boyut, görsel deposu
--
-- Grup kodu : ürün türünü (ör. 03 = 45° dirsek, 05 = çatal) gösterir; stok kodundan
--             bağımsız karta yazılır. PE kodlarında (D.110.090.03) son iki hane,
--             PP kodlarında kodda yer olmadığından elle girilir.
-- Varyant   : aynı "genel stok kodu"nu (variant_code) taşıyan ürünler birbirinin
--             varyantıdır; toplam üretim/satış/stok bu kod üzerinden izlenir.
--             PP kuralı: ilk harf renk, "." sonrası firma eki → V1A012020.HENQ → 1A012020.
-- ═══════════════════════════════════════════════════════════════════

ALTER TYPE product_type ADD VALUE IF NOT EXISTS 'trade';
ALTER TYPE product_type ADD VALUE IF NOT EXISTS 'service';

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS group_code TEXT,
  ADD COLUMN IF NOT EXISTS variant_code TEXT,
  ADD COLUMN IF NOT EXISTS wall_thickness_mm NUMERIC CHECK (wall_thickness_mm > 0),
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS products_group_code_idx ON products (group_code);
CREATE INDEX IF NOT EXISTS products_variant_code_idx ON products (variant_code);

-- ─── Grup kodu tanımları ───
CREATE TABLE IF NOT EXISTS product_groups (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Okuma: aktif kullanıcı" ON product_groups;
CREATE POLICY "Okuma: aktif kullanıcı" ON product_groups FOR SELECT TO authenticated USING (public.app_role() IS NOT NULL);
DROP POLICY IF EXISTS "Yazma: admin" ON product_groups;
CREATE POLICY "Yazma: admin" ON product_groups FOR ALL TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

INSERT INTO product_groups (code, name) VALUES
  ('03', '45° dirsek'),
  ('05', 'Çatal')
ON CONFLICT (code) DO NOTHING;

-- PE kodlarından grup kodu: D.110.090.03 → 03
UPDATE products
   SET group_code = substring(code FROM '\.([0-9]{2})$')
 WHERE group_code IS NULL
   AND code ~ '^D\.[0-9]+(\.[0-9]+)*\.[0-9]{2}$';

-- Kodda borunun et kalınlığı varsa doldur: "PIPE 20 x 2.8 mm"
UPDATE products
   SET wall_thickness_mm = replace((regexp_match(name, '\d+(?:[.,]\d+)?\s*[xX]\s*(\d+(?:[.,]\d+)?)'))[1], ',', '.')::numeric
 WHERE wall_thickness_mm IS NULL
   AND name ~* '(PIPE|BORU)'
   AND name ~ '\d+(?:[.,]\d+)?\s*[xX]\s*\d';

-- Örnek varyant grupları (en fazla 3): PP kuralına göre aynı genel kodu paylaşan ürünler
WITH pp AS (
  SELECT id, substring(split_part(code, '.', 1) FROM 2) AS base
  FROM products
  WHERE active AND variant_code IS NULL AND code ~ '^[A-Za-z][0-9][A-Za-z0-9]+'
),
groups AS (
  SELECT base FROM pp GROUP BY base HAVING count(*) >= 2 ORDER BY base LIMIT 3
)
UPDATE products p
   SET variant_code = pp.base
  FROM pp JOIN groups g ON g.base = pp.base
 WHERE p.id = pp.id;

-- ─── Ürün görselleri (Storage) ───
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Ürün görseli: okuma" ON storage.objects;
CREATE POLICY "Ürün görseli: okuma" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images');
DROP POLICY IF EXISTS "Ürün görseli: ekleme" ON storage.objects;
CREATE POLICY "Ürün görseli: ekleme" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.has_role('admin'));
DROP POLICY IF EXISTS "Ürün görseli: güncelleme" ON storage.objects;
CREATE POLICY "Ürün görseli: güncelleme" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role('admin'));
DROP POLICY IF EXISTS "Ürün görseli: silme" ON storage.objects;
CREATE POLICY "Ürün görseli: silme" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role('admin'));

NOTIFY pgrst, 'reload schema';
