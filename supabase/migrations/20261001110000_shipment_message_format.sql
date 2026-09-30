-- Hata mesajlarında sayılar Türkçe biçimde (79.156 / 12,5)
CREATE OR REPLACE FUNCTION public.fmt_tr(v NUMERIC) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT translate(rtrim(to_char(round(v, 3), 'FM999G999G999G990D999'), '.'), ',.', '.,');
$$;

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
      RAISE EXCEPTION '% için depoda yeterli stok yok (mevcut %, sevk %)%.', v_code, public.fmt_tr(v_avail), public.fmt_tr(v_qty),
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

