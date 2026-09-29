-- ═══════════════════════════════════════════════════════════════════
-- Ürün kartı: paketleme bilgileri, teknik dokümanlar, hammadde tedarikçileri
-- ═══════════════════════════════════════════════════════════════════

-- ─── Paketleme ───
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS package_type TEXT,                                   -- koli, torba, rulo, demet…
  ADD COLUMN IF NOT EXISTS package_qty NUMERIC CHECK (package_qty > 0),         -- paket içi miktar (ürün biriminde)
  ADD COLUMN IF NOT EXISTS pallet_qty NUMERIC CHECK (pallet_qty > 0),           -- palet başına paket
  ADD COLUMN IF NOT EXISTS pipe_length_m NUMERIC CHECK (pipe_length_m > 0),     -- boru boy uzunluğu
  ADD COLUMN IF NOT EXISTS package_weight_kg NUMERIC CHECK (package_weight_kg > 0),
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS package_note TEXT;

-- ─── Teknik dokümanlar ───
CREATE TABLE IF NOT EXISTS product_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'diger',   -- cizim, belge, foy, test, diger
  title TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_documents_product_idx ON product_documents (product_id);

-- ─── Tedarikçiler ve alış fiyatı geçmişi ───
CREATE TABLE IF NOT EXISTS product_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  supplier_code TEXT,                        -- tedarikçinin ürün kodu
  lead_time_days INTEGER CHECK (lead_time_days >= 0),
  min_order_qty NUMERIC CHECK (min_order_qty >= 0),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (product_id, partner_id)
);
CREATE INDEX IF NOT EXISTS product_suppliers_product_idx ON product_suppliers (product_id);

CREATE TABLE IF NOT EXISTS supplier_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_supplier_id UUID NOT NULL REFERENCES product_suppliers(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'TRY' CHECK (currency IN ('TRY', 'USD', 'EUR')),
  valid_from DATE NOT NULL DEFAULT current_date,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supplier_prices_supplier_idx ON supplier_prices (product_supplier_id, valid_from DESC);

-- ─── RLS: aktif kullanıcı okur, admin yazar ───
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['product_documents', 'product_suppliers', 'supplier_prices'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Okuma: aktif kullanıcı" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Okuma: aktif kullanıcı" ON public.%I FOR SELECT TO authenticated USING (public.app_role() IS NOT NULL)', t);
    EXECUTE format('DROP POLICY IF EXISTS "Yazma: admin" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Yazma: admin" ON public.%I FOR ALL TO authenticated USING (public.has_role(''admin'')) WITH CHECK (public.has_role(''admin''))', t);
  END LOOP;
END $$;

-- ─── Doküman deposu (özel; indirme imzalı bağlantıyla) ───
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-documents', 'product-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Ürün dokümanı: okuma" ON storage.objects;
CREATE POLICY "Ürün dokümanı: okuma" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-documents' AND public.app_role() IS NOT NULL);
DROP POLICY IF EXISTS "Ürün dokümanı: ekleme" ON storage.objects;
CREATE POLICY "Ürün dokümanı: ekleme" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-documents' AND public.has_role('admin'));
DROP POLICY IF EXISTS "Ürün dokümanı: silme" ON storage.objects;
CREATE POLICY "Ürün dokümanı: silme" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-documents' AND public.has_role('admin'));

NOTIFY pgrst, 'reload schema';
