-- Reçetede fire/regrind'in stoka gireceği hurda ürünü (grade bazlı)
ALTER TABLE bom_extrusion
  ADD COLUMN IF NOT EXISTS scrap_product_id UUID REFERENCES products(id);

ALTER TABLE bom_injection
  ADD COLUMN IF NOT EXISTS scrap_product_id UUID REFERENCES products(id);

-- PostgREST şema önbelleğini yenile (yeni sütunlar hemen görünsün)
NOTIFY pgrst, 'reload schema';
