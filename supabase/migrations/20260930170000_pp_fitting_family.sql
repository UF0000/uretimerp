-- Grup 25 (PP fitting) → aile "baglanti_parcasi" (Fitting); tetikleyici boşsa bundan sonra da doldurur.

UPDATE products SET category = 'baglanti_parcasi'
 WHERE group_code = '25' AND category IS DISTINCT FROM 'baglanti_parcasi';

CREATE OR REPLACE FUNCTION products_autofill() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.variant_code IS NULL OR NEW.variant_code = '' THEN
    NEW.variant_code := pp_variant_base(NEW.code);
  END IF;
  IF NEW.category IS NULL THEN
    NEW.category := CASE
      WHEN NEW.group_code IN ('01', '24') THEN 'boru'
      WHEN NEW.group_code = '25' THEN 'baglanti_parcasi'
    END;
  END IF;
  RETURN NEW;
END;
$$;
