-- ═══════════════════════════════════════════════════════════════════
-- NCR (uygunsuzluk raporu): açma, karantina, kapatma
--
-- create_ncr : NCR-YYYY-#### numarası verir; istenirse şüpheli miktarı aynı
--              işlemde karantina deposuna transfer eder (lot korunur).
-- close_ncr  : kök neden + düzeltici faaliyet zorunlu; karantinadaki mal
--              serbest bırakılır (depoya döner) veya imha edilir (fire çıkışı).
-- Stok hareketleri source_id = NCR id ile izlenir.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE ncr
  ADD COLUMN IF NOT EXISTS source_warehouse_id UUID REFERENCES warehouses(id),
  ADD COLUMN IF NOT EXISTS quality_check_id UUID REFERENCES quality_checks(id),
  ADD COLUMN IF NOT EXISTS disposition TEXT CHECK (disposition IN ('release', 'scrap')),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES profiles(id);

CREATE OR REPLACE FUNCTION public.create_ncr(
  p_product_id UUID,
  p_description TEXT,
  p_quantity NUMERIC,
  p_lot_no TEXT DEFAULT NULL,
  p_quality_check_id UUID DEFAULT NULL,
  p_source_warehouse_id UUID DEFAULT NULL,
  p_quarantine_warehouse_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_year TEXT := to_char(now() AT TIME ZONE 'Europe/Istanbul', 'YYYY');
  v_no TEXT;
  v_id UUID;
  v_available NUMERIC;
  v_lot TEXT := nullif(trim(p_lot_no), '');
BEGIN
  IF NOT public.has_role('quality', 'admin') THEN
    RAISE EXCEPTION 'NCR açmak için Kalite veya Admin yetkisi gerekir.';
  END IF;
  IF coalesce(trim(p_description), '') = '' THEN RAISE EXCEPTION 'Uygunsuzluk açıklaması zorunludur.'; END IF;
  IF coalesce(p_quantity, 0) <= 0 THEN RAISE EXCEPTION 'Miktar 0''dan büyük olmalıdır.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id) THEN RAISE EXCEPTION 'Ürün bulunamadı.'; END IF;

  IF p_quarantine_warehouse_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = p_quarantine_warehouse_id AND type = 'quarantine') THEN
      RAISE EXCEPTION 'Seçilen depo karantina tipli değil.';
    END IF;
    IF p_source_warehouse_id IS NULL OR p_source_warehouse_id = p_quarantine_warehouse_id THEN
      RAISE EXCEPTION 'Karantinaya alınacak malın bulunduğu kaynak depo seçilmelidir.';
    END IF;
    SELECT coalesce(sum(qty), 0) INTO v_available
    FROM v_stock WHERE product_id = p_product_id AND warehouse_id = p_source_warehouse_id;
    IF v_available < p_quantity THEN
      RAISE EXCEPTION 'Kaynak depoda yeterli stok yok (mevcut: %).', replace(round(v_available, 2)::text, '.', ',');
    END IF;
  END IF;

  -- Yıllık sıra numarası (eşzamanlı açılışlara karşı kilitli)
  PERFORM pg_advisory_xact_lock(hashtext('ncr_no_' || v_year));
  SELECT 'NCR-' || v_year || '-' || lpad((count(*) + 1)::text, 4, '0') INTO v_no
  FROM ncr WHERE no LIKE 'NCR-' || v_year || '-%';

  INSERT INTO ncr (no, product_id, lot_no, description, quantity, quarantine_warehouse_id,
                   source_warehouse_id, quality_check_id, status, created_by)
  VALUES (v_no, p_product_id, v_lot, trim(p_description), p_quantity, p_quarantine_warehouse_id,
          p_source_warehouse_id, p_quality_check_id, 'open', v_uid)
  RETURNING id INTO v_id;

  IF p_quarantine_warehouse_id IS NOT NULL THEN
    INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, lot_no, source_type, source_id, user_id, note)
    VALUES
      (p_product_id, p_source_warehouse_id, 'out', p_quantity, v_lot, 'transfer', v_id, v_uid, v_no || ' karantinaya alındı'),
      (p_product_id, p_quarantine_warehouse_id, 'in', p_quantity, v_lot, 'transfer', v_id, v_uid, v_no || ' karantinaya alındı');
  END IF;

  RETURN jsonb_build_object('id', v_id, 'no', v_no, 'quarantined', p_quarantine_warehouse_id IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION public.close_ncr(
  p_id UUID,
  p_root_cause TEXT,
  p_corrective_action TEXT,
  p_disposition TEXT DEFAULT NULL,
  p_release_warehouse_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ncr ncr%ROWTYPE;
  v_target UUID;
BEGIN
  IF NOT public.has_role('quality', 'admin') THEN
    RAISE EXCEPTION 'NCR kapatmak için Kalite veya Admin yetkisi gerekir.';
  END IF;
  IF coalesce(trim(p_root_cause), '') = '' THEN RAISE EXCEPTION 'Kök neden zorunludur.'; END IF;
  IF coalesce(trim(p_corrective_action), '') = '' THEN RAISE EXCEPTION 'Düzeltici faaliyet zorunludur.'; END IF;

  SELECT * INTO v_ncr FROM ncr WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NCR bulunamadı.'; END IF;
  IF v_ncr.status = 'closed' THEN RAISE EXCEPTION 'Bu NCR zaten kapalı.'; END IF;

  IF v_ncr.quarantine_warehouse_id IS NOT NULL THEN
    IF p_disposition IS NULL OR p_disposition NOT IN ('release', 'scrap') THEN
      RAISE EXCEPTION 'Karantinadaki mal için karar seçilmelidir: serbest bırak veya imha.';
    END IF;
    IF p_disposition = 'release' THEN
      v_target := coalesce(p_release_warehouse_id, v_ncr.source_warehouse_id);
      IF v_target IS NULL OR v_target = v_ncr.quarantine_warehouse_id
         OR NOT EXISTS (SELECT 1 FROM warehouses WHERE id = v_target AND type NOT IN ('quarantine', 'scrap')) THEN
        RAISE EXCEPTION 'Serbest bırakılan malın gireceği geçerli bir depo seçilmelidir.';
      END IF;
      INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, lot_no, source_type, source_id, user_id, note)
      VALUES
        (v_ncr.product_id, v_ncr.quarantine_warehouse_id, 'out', v_ncr.quantity, v_ncr.lot_no, 'transfer', v_ncr.id, v_uid, v_ncr.no || ' serbest bırakıldı'),
        (v_ncr.product_id, v_target, 'in', v_ncr.quantity, v_ncr.lot_no, 'transfer', v_ncr.id, v_uid, v_ncr.no || ' serbest bırakıldı');
    ELSE
      INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, lot_no, source_type, source_id, user_id, note)
      VALUES (v_ncr.product_id, v_ncr.quarantine_warehouse_id, 'out', v_ncr.quantity, v_ncr.lot_no, 'scrap', v_ncr.id, v_uid, v_ncr.no || ' imha');
    END IF;
  END IF;

  UPDATE ncr
     SET status = 'closed',
         root_cause = trim(p_root_cause),
         corrective_action = trim(p_corrective_action),
         disposition = CASE WHEN v_ncr.quarantine_warehouse_id IS NOT NULL THEN p_disposition END,
         closed_at = now(),
         closed_by = v_uid
   WHERE id = v_ncr.id;
END $$;

REVOKE ALL ON FUNCTION public.create_ncr(UUID, TEXT, NUMERIC, TEXT, UUID, UUID, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_ncr(UUID, TEXT, NUMERIC, TEXT, UUID, UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.close_ncr(UUID, TEXT, TEXT, TEXT, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.close_ncr(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
