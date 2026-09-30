-- Stok sayımı: depo (+ filtre) için lot bazında sayım listesi → sayılan miktarlar → tamamlanınca farklar
-- sayım fazlası (in_count) / sayım eksiği (out_count) fişleriyle stoğa işlenir.
-- Fark = sayılan − TAMAMLAMA ANINDAKİ stok (sayım sırasında olan hareketler yanlış düzeltme yaratmasın).
-- Sayılmayan satırlar (counted_qty boş) düzeltilmez.

CREATE SEQUENCE IF NOT EXISTS stock_count_seq;

CREATE TABLE IF NOT EXISTS stock_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no TEXT NOT NULL UNIQUE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  count_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Istanbul')::date,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled')),
  scope TEXT,                                   -- listeyi daraltan filtrelerin açıklaması
  note TEXT,
  created_by UUID REFERENCES profiles(id) DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES profiles(id),
  in_document_id UUID REFERENCES stock_documents(id),
  out_document_id UUID REFERENCES stock_documents(id)
);

CREATE TABLE IF NOT EXISTS stock_count_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  lot_no TEXT,
  system_qty NUMERIC NOT NULL DEFAULT 0,        -- liste oluşturulduğundaki stok
  counted_qty NUMERIC CHECK (counted_qty IS NULL OR counted_qty >= 0),
  adjusted_qty NUMERIC,                         -- tamamlamada işlenen fark (+ fazla / − eksik)
  added_manually BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  counted_by UUID REFERENCES profiles(id),
  counted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS stock_count_lines_count_idx ON stock_count_lines (count_id);
CREATE UNIQUE INDEX IF NOT EXISTS stock_count_lines_key ON stock_count_lines (count_id, product_id, coalesce(lot_no, ''));

CREATE OR REPLACE FUNCTION stock_count_number() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.no IS NULL OR NEW.no = '' THEN
    NEW.no := 'SAY-' || to_char(now() AT TIME ZONE 'Europe/Istanbul', 'YYYY') || '-' || lpad(nextval('stock_count_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS stock_count_number ON stock_counts;
CREATE TRIGGER stock_count_number BEFORE INSERT ON stock_counts FOR EACH ROW EXECUTE FUNCTION stock_count_number();

-- Tamamlanmış / iptal sayımın satırları değişmez
CREATE OR REPLACE FUNCTION stock_count_lines_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM stock_counts WHERE id = coalesce(NEW.count_id, OLD.count_id);
  IF v_status <> 'open' AND current_setting('app.completing_count', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Tamamlanmış veya iptal edilmiş sayım değiştirilemez.';
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS stock_count_lines_guard ON stock_count_lines;
CREATE TRIGGER stock_count_lines_guard BEFORE INSERT OR UPDATE OR DELETE ON stock_count_lines
  FOR EACH ROW EXECUTE FUNCTION stock_count_lines_guard();

-- Sayımı tamamla: farkları fişlerle stoğa işle
CREATE OR REPLACE FUNCTION complete_stock_count(p_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_count stock_counts%ROWTYPE;
  v_line stock_count_lines%ROWTYPE;
  v_current NUMERIC;
  v_diff NUMERIC;
  v_in UUID;
  v_out UUID;
  v_plus INT := 0;
  v_minus INT := 0;
BEGIN
  IF NOT public.has_role('warehouse', 'admin') THEN
    RAISE EXCEPTION 'Sayım için Depo veya Yönetici yetkisi gerekir.';
  END IF;
  SELECT * INTO v_count FROM stock_counts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sayım bulunamadı.'; END IF;
  IF v_count.status <> 'open' THEN RAISE EXCEPTION 'Yalnızca açık sayım tamamlanabilir.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM stock_count_lines WHERE count_id = p_id AND counted_qty IS NOT NULL) THEN
    RAISE EXCEPTION 'Hiç sayım girilmemiş.';
  END IF;

  PERFORM set_config('app.completing_count', 'on', true);

  FOR v_line IN SELECT * FROM stock_count_lines WHERE count_id = p_id AND counted_qty IS NOT NULL LOOP
    SELECT coalesce(sum(CASE WHEN direction = 'in' THEN quantity ELSE -quantity END), 0) INTO v_current
      FROM stock_movements
     WHERE product_id = v_line.product_id AND warehouse_id = v_count.warehouse_id
       AND lot_no IS NOT DISTINCT FROM v_line.lot_no;
    v_diff := round(v_line.counted_qty - v_current, 4);
    UPDATE stock_count_lines SET adjusted_qty = v_diff WHERE id = v_line.id;
    CONTINUE WHEN v_diff = 0;

    IF v_diff > 0 THEN
      IF v_in IS NULL THEN
        INSERT INTO stock_documents (no, type, document_date, target_warehouse_id, note, user_id)
        VALUES (v_count.no || '-FAZLA', 'in_count', v_count.count_date, v_count.warehouse_id, 'Sayım ' || v_count.no || ' fazlaları', auth.uid())
        RETURNING id INTO v_in;
      END IF;
      INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, lot_no, source_type, source_id, document_id, user_id, note)
      VALUES (v_line.product_id, v_count.warehouse_id, 'in', v_diff, v_line.lot_no, 'count', v_line.id, v_in, auth.uid(), v_count.no);
      v_plus := v_plus + 1;
    ELSE
      IF v_out IS NULL THEN
        INSERT INTO stock_documents (no, type, document_date, source_warehouse_id, note, user_id)
        VALUES (v_count.no || '-EKSIK', 'out_count', v_count.count_date, v_count.warehouse_id, 'Sayım ' || v_count.no || ' eksikleri', auth.uid())
        RETURNING id INTO v_out;
      END IF;
      INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, lot_no, source_type, source_id, document_id, user_id, note)
      VALUES (v_line.product_id, v_count.warehouse_id, 'out', -v_diff, v_line.lot_no, 'count', v_line.id, v_out, auth.uid(), v_count.no);
      v_minus := v_minus + 1;
    END IF;
  END LOOP;

  UPDATE stock_counts
     SET status = 'completed', completed_at = now(), completed_by = auth.uid(), in_document_id = v_in, out_document_id = v_out
   WHERE id = p_id;
  PERFORM set_config('app.completing_count', 'off', true);
  RETURN jsonb_build_object('fazla', v_plus, 'eksik', v_minus, 'in_document_id', v_in, 'out_document_id', v_out);
END;
$$;
REVOKE ALL ON FUNCTION complete_stock_count(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION complete_stock_count(UUID) TO authenticated;

-- RLS: herkes okur; sayım depo / yönetici
ALTER TABLE stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_count_lines ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['stock_counts', 'stock_count_lines'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Okuma: aktif kullanıcı" ON %I', t);
    EXECUTE format('CREATE POLICY "Okuma: aktif kullanıcı" ON %I FOR SELECT TO authenticated USING (public.app_role() IS NOT NULL)', t);
    EXECUTE format('DROP POLICY IF EXISTS "Yazma: depo/yönetici" ON %I', t);
    EXECUTE format('CREATE POLICY "Yazma: depo/yönetici" ON %I FOR ALL TO authenticated USING (public.has_role(''warehouse'', ''admin'')) WITH CHECK (public.has_role(''warehouse'', ''admin''))', t);
    EXECUTE format('DROP TRIGGER IF EXISTS audit_row ON %I', t);
    EXECUTE format('CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_row()', t);
  END LOOP;
END;
$$;
