-- Satın alma siparişi: taslak → sipariş verildi → (kısmi) teslim → kapandı / iptal.
-- Teslim alma = satın alma giriş fişi (in_purchase) + stok hareketleri; hareketin source_id'si sipariş satırıdır.
-- Teslim alınan miktar hareketlerden hesaplanır (fiş iptal edilirse ters kayıtla kendiliğinden düşer).

CREATE SEQUENCE IF NOT EXISTS purchase_order_seq;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no TEXT NOT NULL UNIQUE,
  partner_id UUID NOT NULL REFERENCES partners(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'closed', 'cancelled')),
  order_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Istanbul')::date,
  expected_date DATE,
  currency TEXT NOT NULL DEFAULT 'TRY',
  note TEXT,
  created_by UUID REFERENCES profiles(id) DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ordered_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC CHECK (unit_price IS NULL OR unit_price >= 0),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS purchase_order_items_po_idx ON purchase_order_items (purchase_order_id);
CREATE INDEX IF NOT EXISTS stock_movements_purchase_idx ON stock_movements (source_id) WHERE source_type = 'purchase';

-- Sipariş numarası: SA-2026-0001
CREATE OR REPLACE FUNCTION purchase_order_number() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.no IS NULL OR NEW.no = '' THEN
    NEW.no := 'SA-' || to_char(now() AT TIME ZONE 'Europe/Istanbul', 'YYYY') || '-' || lpad(nextval('purchase_order_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS purchase_order_number ON purchase_orders;
CREATE TRIGGER purchase_order_number BEFORE INSERT ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION purchase_order_number();

-- Satır başına teslim alınan (giriş − ters kayıt) ve kalan
CREATE OR REPLACE VIEW v_purchase_order_items
WITH (security_invoker = true) AS
SELECT
  i.id,
  i.purchase_order_id,
  i.product_id,
  i.quantity,
  i.unit_price,
  i.note,
  coalesce(r.received, 0) AS received_qty,
  greatest(i.quantity - coalesce(r.received, 0), 0) AS remaining_qty
FROM purchase_order_items i
LEFT JOIN (
  SELECT source_id, sum(CASE WHEN direction = 'in' THEN quantity ELSE -quantity END) AS received
  FROM stock_movements
  WHERE source_type = 'purchase' AND source_id IS NOT NULL
  GROUP BY source_id
) r ON r.source_id = i.id;

-- Teslim alma: tek işlemde giriş fişi + hareketler. p_lines: [{item_id, qty, lot_no?}]
CREATE OR REPLACE FUNCTION receive_purchase_order(p_po_id UUID, p_warehouse_id UUID, p_date DATE, p_lines JSONB, p_note TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_po purchase_orders%ROWTYPE;
  v_doc_id UUID;
  v_line JSONB;
  v_item purchase_order_items%ROWTYPE;
  v_qty NUMERIC;
  v_lot TEXT;
  v_count INT := 0;
BEGIN
  IF NOT public.has_role('warehouse', 'admin') THEN
    RAISE EXCEPTION 'Teslim almak için Depo veya Yönetici yetkisi gerekir.';
  END IF;
  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Satın alma siparişi bulunamadı.'; END IF;
  IF v_po.status <> 'ordered' THEN
    RAISE EXCEPTION 'Yalnızca "sipariş verildi" durumundaki siparişler teslim alınabilir.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = p_warehouse_id) THEN
    RAISE EXCEPTION 'Depo bulunamadı.';
  END IF;

  INSERT INTO stock_documents (no, type, document_date, target_warehouse_id, note, user_id)
  VALUES ('GIR-' || v_po.no || '-' || to_char(now(), 'HH24MISS'), 'in_purchase', coalesce(p_date, current_date), p_warehouse_id,
          coalesce(p_note, v_po.no || ' teslim alma'), auth.uid())
  RETURNING id INTO v_doc_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) LOOP
    v_qty := nullif(v_line ->> 'qty', '')::numeric;
    CONTINUE WHEN v_qty IS NULL OR v_qty <= 0;
    SELECT * INTO v_item FROM purchase_order_items WHERE id = (v_line ->> 'item_id')::uuid AND purchase_order_id = p_po_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Sipariş satırı bulunamadı.'; END IF;
    -- Lot: girilmezse sipariş no (hammadde izlenebilirliği için)
    v_lot := coalesce(nullif(trim(v_line ->> 'lot_no'), ''), v_po.no);
    INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, lot_no, source_type, source_id, document_id, user_id, note)
    VALUES (v_item.product_id, p_warehouse_id, 'in', v_qty, v_lot, 'purchase', v_item.id, v_doc_id, auth.uid(), v_po.no);
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Teslim alınacak miktar girilmedi.';
  END IF;

  -- Hepsi geldiyse sipariş kapanır
  IF NOT EXISTS (SELECT 1 FROM v_purchase_order_items WHERE purchase_order_id = p_po_id AND remaining_qty > 0) THEN
    UPDATE purchase_orders SET status = 'closed', closed_at = now() WHERE id = p_po_id;
  END IF;
  RETURN v_doc_id;
END;
$$;

-- RLS: herkes okur; sipariş oluşturma/düzenleme yönetici; teslim alma fonksiyonla (depo/yönetici)
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['purchase_orders', 'purchase_order_items'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Okuma: aktif kullanıcı" ON %I', t);
    EXECUTE format('CREATE POLICY "Okuma: aktif kullanıcı" ON %I FOR SELECT TO authenticated USING (public.app_role() IS NOT NULL)', t);
    EXECUTE format('DROP POLICY IF EXISTS "Yazma: yönetici" ON %I', t);
    EXECUTE format('CREATE POLICY "Yazma: yönetici" ON %I FOR ALL TO authenticated USING (public.has_role(''admin'')) WITH CHECK (public.has_role(''admin''))', t);
    EXECUTE format('DROP TRIGGER IF EXISTS audit_row ON %I', t);
    EXECUTE format('CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_row()', t);
  END LOOP;
END;
$$;

-- Teslim alma depocu tarafından da yapılır; sipariş kapanışı (status güncellemesi) için ayrı politika
DROP POLICY IF EXISTS "Kapanış: depo" ON purchase_orders;
CREATE POLICY "Kapanış: depo" ON purchase_orders
  FOR UPDATE TO authenticated USING (public.has_role('warehouse')) WITH CHECK (public.has_role('warehouse') AND status IN ('ordered', 'closed'));
