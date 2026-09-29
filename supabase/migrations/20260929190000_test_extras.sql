-- ═══════════════════════════════════════════════════════════════════
-- TEST VERİSİ (ürün kartı yeni bölümleri): paketleme, tedarikçi + fiyat geçmişi, açık sipariş
-- Cariler: "TEST Tedarikçi A.Ş.", "TEST Müşteri Ltd."; sipariş TEST-SIP-001. Sonra pasife alınacak.
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_sup UUID;
  v_cust UUID;
  v_ps UUID;
  v_order UUID;
  v_ham UUID := (SELECT id FROM products WHERE code = 'TEST-HAM-PPR');
  v_metal UUID := (SELECT id FROM products WHERE code = 'TEST-MTL-01');
  v_boru UUID := (SELECT id FROM products WHERE code = 'V9TEST01');
BEGIN
  IF v_boru IS NULL OR EXISTS (SELECT 1 FROM partners WHERE name = 'TEST Tedarikçi A.Ş.') THEN
    RETURN; -- test ürünleri yok ya da zaten eklenmiş
  END IF;

  -- Paketleme
  UPDATE products SET package_type = 'Demet', package_qty = 100, pallet_qty = 30, pipe_length_m = 4, package_weight_kg = 17.2, barcode = '8690000000017'
   WHERE code IN ('V9TEST01', 'A9TEST01.HENQ');
  UPDATE products SET package_type = 'Koli', package_qty = 40, pallet_qty = 48, package_weight_kg = 6.1, barcode = '8690000000024', package_note = 'Koli içi naylon torbalı'
   WHERE code = 'D.990.063.99';
  UPDATE products SET package_type = 'Koli', package_qty = 500, pallet_qty = 60
   WHERE code = 'TEST-MTL-01';
  UPDATE products SET package_type = 'Torba', package_qty = 25, pallet_qty = 55, package_weight_kg = 25
   WHERE code = 'TEST-HAM-PPR';

  -- Tedarikçi ve fiyat geçmişi
  INSERT INTO partners (name, type) VALUES ('TEST Tedarikçi A.Ş.', 'supplier') RETURNING id INTO v_sup;

  INSERT INTO product_suppliers (product_id, partner_id, is_primary, supplier_code, lead_time_days, min_order_qty, note)
  VALUES (v_ham, v_sup, true, 'RCT-450', 21, 5000, 'TEST') RETURNING id INTO v_ps;
  INSERT INTO supplier_prices (product_supplier_id, price, currency, valid_from, note) VALUES
    (v_ps, 1.38, 'USD', current_date - 240, 'TEST teklif 1'),
    (v_ps, 1.52, 'USD', current_date - 120, 'TEST teklif 2'),
    (v_ps, 1.45, 'USD', current_date - 20, 'TEST teklif 3');

  INSERT INTO product_suppliers (product_id, partner_id, is_primary, supplier_code, lead_time_days, min_order_qty, note)
  VALUES (v_metal, v_sup, true, 'INS-12', 30, 10000, 'TEST') RETURNING id INTO v_ps;
  INSERT INTO supplier_prices (product_supplier_id, price, currency, valid_from, note) VALUES
    (v_ps, 0.31, 'USD', current_date - 200, 'TEST'),
    (v_ps, 0.35, 'USD', current_date - 45, 'TEST');

  -- Açık sipariş (kullanılabilir stok hesabını görmek için)
  INSERT INTO partners (name, type) VALUES ('TEST Müşteri Ltd.', 'customer') RETURNING id INTO v_cust;
  INSERT INTO orders (no, partner_id, order_date, delivery_date, status)
  VALUES ('TEST-SIP-001', v_cust, current_date - 5, current_date + 12, 'open') RETURNING id INTO v_order;
  INSERT INTO order_items (order_id, product_id, quantity, delivered_qty) VALUES (v_order, v_boru, 12000, 2000);
END $$;
