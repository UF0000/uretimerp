-- PP genel kod kuralı düzeltmesi: renk harfi atılır, İLK "."dan sonrası (firma/ek) atılır,
-- son rakamdan sonra ek kalmaz. V1A0320L4.UR.R → 1A0320L4, V1A032020.HENQ → 1A032020.
-- (Önceki kural son "."yı alıyordu: V1A0320L4.UR.R → 1A0320L4.UR — yanlıştı.)

CREATE OR REPLACE FUNCTION pp_variant_base(p_code text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN upper(trim(p_code)) ~ '^[A-Z]1[ABC][0-9]' THEN
      substring(regexp_replace(split_part(upper(trim(p_code)), '.', 1), '[^0-9]+$', '') FROM 2)
  END;
$$;

UPDATE products SET variant_code = pp_variant_base(code)
 WHERE group_code IN ('24', '25')
   AND pp_variant_base(code) IS NOT NULL
   AND variant_code IS DISTINCT FROM pp_variant_base(code);
