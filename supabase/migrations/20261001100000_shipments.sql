-- Sevkiyat / irsaliye: müşteri siparişine karşı stoktan çıkış (satış çıkış fişi) + yazdırılabilir sevk irsaliyesi.
-- Hareket: source_type = 'sale', source_id = sipariş satırı. Sipariş satırındaki delivered_qty hareketlerle güncellenir
-- (çıkış +, fiş iptalindeki ters kayıt −); hepsi sevk edilince sipariş "done" olur.

CREATE SEQUENCE IF NOT EXISTS shipment_seq;

CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no TEXT NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES orders(id),
  partner_id UUID NOT NULL REFERENCES partners(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  document_id UUID REFERENCES stock_documents(id),
  ship_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Istanbul')::date,
  delivery_address TEXT,
  vehicle_plate TEXT,
  driver_name TEXT,
  note TEXT,
  created_by UUID REFERENCES profiles(id) DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_by UUID REFERENCES profiles(id)
);
CREATE INDEX IF NOT EXISTS shipments_order_idx ON shipments (order_id);
CREATE INDEX IF NOT EXISTS stock_movements_sale_idx ON stock_movements (source_id) WHERE source_type = 'sale';

CREATE OR REPLACE FUNCTION shipment_number() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.no IS NULL OR NEW.no = '' THEN
    NEW.no := 'IRS-' || to_char(now() AT TIME ZONE 'Europe/Istanbul', 'YYYY') || '-' || lpad(nextval('shipment_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS shipment_number ON shipments;
CREATE TRIGGER shipment_number BEFORE INSERT ON shipments
  FOR EACH ROW EXECUTE FUNCTION shipment_number();

-- Satış hareketi → sipariş satırı teslim miktarı ve sipariş durumu
CREATE OR REPLACE FUNCTION order_item_delivery_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order UUID;
BEGIN
  IF NEW.source_type <> 'sale' OR NEW.source_id IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE order_items
     SET delivered_qty = delivered_qty + CASE WHEN NEW.direction = 'out' THEN NEW.quantity ELSE -NEW.quantity END
   WHERE id = NEW.source_id
  RETURNING order_id INTO v_order;
  IF v_order IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE orders o
     SET status = CASE
       WHEN NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.delivered_qty < i.quantity) THEN 'done'::order_status
       WHEN o.status = 'done' THEN 'open'::order_status
       ELSE o.status
     END
   WHERE o.id = v_order AND o.status <> 'cancelled';
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS order_item_delivery_sync ON stock_movements;
CREATE TRIGGER order_item_delivery_sync AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION order_item_delivery_sync();

-- Sevk et: stok kontrolü + satış çıkış fişi + hareketler + irsaliye kaydı (tek işlem). p_lines: [{item_id, qty, lot_no?}]
CREATE OR REPLACE FUNCTION create_shipment(
  p_order_id UUID, p_warehouse_id UUID, p_date DATE, p_lines JSONB,
  p_address TEXT DEFAULT NULL, p_vehicle TEXT DEFAULT NULL, p_driver TEXT DEFAULT NULL, p_note TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_ship_id UUID;
  v_ship_no TEXT;
  v_doc_id UUID;
  v_line JSONB;
  v_item order_items%ROWTYPE;
  v_qty NUMERIC;
  v_lot TEXT;
  v_avail NUMERIC;
  v_code TEXT;
  v_count INT := 0;
BEGIN
  IF NOT public.has_role('warehouse', 'admin') THEN
    RAISE EXCEPTION 'Sevkiyat için Depo veya Yönetici yetkisi gerekir.';
  END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sipariş bulunamadı.'; END IF;
  IF v_order.status = 'cancelled' THEN RAISE EXCEPTION 'İptal edilmiş siparişe sevkiyat yapılamaz.'; END IF;

  INSERT INTO shipments (no, order_id, partner_id, warehouse_id, ship_date, delivery_address, vehicle_plate, driver_name, note)
  VALUES ('', p_order_id, v_order.partner_id, p_warehouse_id, coalesce(p_date, current_date),
          nullif(trim(p_address), ''), nullif(upper(trim(p_vehicle)), ''), nullif(trim(p_driver), ''), nullif(trim(p_note), ''))
  RETURNING id, no INTO v_ship_id, v_ship_no;

  INSERT INTO stock_documents (no, type, document_date, source_warehouse_id, note, user_id)
  VALUES (v_ship_no, 'out_sale', coalesce(p_date, current_date), p_warehouse_id, 'Sipariş ' || v_order.no || ' sevkiyatı', auth.uid())
  RETURNING id INTO v_doc_id;
  UPDATE shipments SET document_id = v_doc_id WHERE id = v_ship_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) LOOP
    v_qty := nullif(v_line ->> 'qty', '')::numeric;
    CONTINUE WHEN v_qty IS NULL OR v_qty <= 0;
    SELECT * INTO v_item FROM order_items WHERE id = (v_line ->> 'item_id')::uuid AND order_id = p_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Sipariş satırı bulunamadı.'; END IF;
    v_lot := nullif(trim(v_line ->> 'lot_no'), '');
    SELECT code INTO v_code FROM products WHERE id = v_item.product_id;

    -- Stok yetmiyorsa sevk edilmez (lot seçildiyse o lottaki stok)
    SELECT coalesce(sum(CASE WHEN direction = 'in' THEN quantity ELSE -quantity END), 0) INTO v_avail
      FROM stock_movements
     WHERE product_id = v_item.product_id AND warehouse_id = p_warehouse_id
       AND (v_lot IS NULL OR lot_no = v_lot);
    IF v_avail < v_qty THEN
      RAISE EXCEPTION '% için depoda yeterli stok yok (mevcut %, sevk %)%.', v_code, round(v_avail, 3), round(v_qty, 3),
        CASE WHEN v_lot IS NULL THEN '' ELSE ' — lot ' || v_lot END;
    END IF;

    INSERT INTO stock_movements (product_id, warehouse_id, direction, quantity, lot_no, source_type, source_id, document_id, user_id, note)
    VALUES (v_item.product_id, p_warehouse_id, 'out', v_qty, v_lot, 'sale', v_item.id, v_doc_id, auth.uid(), v_ship_no);
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Sevk edilecek miktar girilmedi.';
  END IF;
  RETURN v_ship_id;
END;
$$;

-- İrsaliye iptali: fiş iptal (ters kayıt → teslim miktarı geri düşer) + irsaliye iptal işareti
CREATE OR REPLACE FUNCTION cancel_shipment(p_id UUID) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_doc UUID;
BEGIN
  IF NOT public.has_role('warehouse', 'admin') THEN
    RAISE EXCEPTION 'İrsaliye iptali için Depo veya Yönetici yetkisi gerekir.';
  END IF;
  UPDATE shipments SET cancelled_at = now(), cancelled_by = auth.uid()
   WHERE id = p_id AND cancelled_at IS NULL
  RETURNING document_id INTO v_doc;
  IF NOT FOUND THEN RAISE EXCEPTION 'İrsaliye bulunamadı veya zaten iptal edilmiş.'; END IF;
  IF v_doc IS NOT NULL THEN
    PERFORM public.cancel_stock_document(v_doc);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION create_shipment(UUID, UUID, DATE, JSONB, TEXT, TEXT, TEXT, TEXT) FROM anon, public;
REVOKE ALL ON FUNCTION cancel_shipment(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION create_shipment(UUID, UUID, DATE, JSONB, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_shipment(UUID) TO authenticated;

-- RLS: herkes okur; kayıt / iptal depo ve yönetici (fonksiyonlar üzerinden)
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Okuma: aktif kullanıcı" ON shipments;
CREATE POLICY "Okuma: aktif kullanıcı" ON shipments FOR SELECT TO authenticated USING (public.app_role() IS NOT NULL);
DROP POLICY IF EXISTS "Yazma: depo/yönetici" ON shipments;
CREATE POLICY "Yazma: depo/yönetici" ON shipments FOR ALL TO authenticated
  USING (public.has_role('warehouse', 'admin')) WITH CHECK (public.has_role('warehouse', 'admin'));

DROP TRIGGER IF EXISTS audit_row ON shipments;
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON shipments FOR EACH ROW EXECUTE FUNCTION audit_row();
