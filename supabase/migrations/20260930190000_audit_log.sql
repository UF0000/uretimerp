-- İşlem geçmişi: kim, ne zaman, hangi kaydı ekledi / değiştirdi / sildi.
-- Kayıtlar veritabanı tetikleyicisiyle yazılır (ekran, Excel aktarımı, toplu işlem, fonksiyonlar dahil);
-- istemci yazamaz, değiştiremez, silemez. Yalnızca yönetici okur.
-- Aynı işlemdeki (transaction) kayıtlar txid ile gruplanır: "272 ürün silindi" tek satırda görünür.

ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS table_name TEXT,
  ADD COLUMN IF NOT EXISTS record_id TEXT,
  ADD COLUMN IF NOT EXISTS record_label TEXT,
  ADD COLUMN IF NOT EXISTS operation TEXT,           -- insert | update | delete | deactivate | restore
  ADD COLUMN IF NOT EXISTS changes JSONB,            -- güncellemede {alan: [eski, yeni]}, eklemede/silmede tüm satır
  ADD COLUMN IF NOT EXISTS txid BIGINT;

CREATE INDEX IF NOT EXISTS activity_log_created_idx ON activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_table_idx ON activity_log (table_name, record_id);
CREATE INDEX IF NOT EXISTS activity_log_user_idx ON activity_log (user_id);
CREATE INDEX IF NOT EXISTS activity_log_txid_idx ON activity_log (txid);

-- İstemci doğrudan yazamaz: yalnızca tetikleyici (SECURITY DEFINER)
DROP POLICY IF EXISTS "Ekleme: kendi adına" ON activity_log;

-- Append-only: geçmiş değiştirilemez / silinemez
CREATE OR REPLACE FUNCTION activity_log_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'İşlem geçmişi değiştirilemez veya silinemez.';
END;
$$;
DROP TRIGGER IF EXISTS activity_log_immutable ON activity_log;
CREATE TRIGGER activity_log_immutable BEFORE UPDATE OR DELETE ON activity_log
  FOR EACH ROW EXECUTE FUNCTION activity_log_immutable();

CREATE OR REPLACE FUNCTION audit_row() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old JSONB := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  v_new JSONB := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  v_row JSONB := coalesce(v_new, v_old);
  v_changes JSONB := '{}'::jsonb;
  v_op TEXT := lower(TG_OP);
  k TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT jsonb_object_keys(v_new) LOOP
      -- Sayaç / zaman damgası gibi gürültülü alanlar
      CONTINUE WHEN k IN ('updated_at', 'created_at', 'total_shots');
      IF v_new -> k IS DISTINCT FROM v_old -> k THEN
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_array(v_old -> k, v_new -> k));
      END IF;
    END LOOP;
    IF v_changes = '{}'::jsonb THEN
      RETURN NULL;
    END IF;
    -- Pasife alma = silme, tekrar aktif = geri alma
    IF v_changes ? 'active' THEN
      v_op := CASE WHEN (v_new ->> 'active')::boolean THEN 'restore' ELSE 'deactivate' END;
    END IF;
  ELSE
    v_changes := v_row;
  END IF;

  INSERT INTO activity_log (user_id, action, detail, table_name, record_id, record_label, operation, changes, txid)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME || '.' || v_op,
    NULL,
    TG_TABLE_NAME,
    coalesce(v_row ->> 'id', v_row ->> 'code', v_row ->> 'day'),
    coalesce(v_row ->> 'code', v_row ->> 'no', v_row ->> 'lot_no', v_row ->> 'document_no', v_row ->> 'name', v_row ->> 'full_name', v_row ->> 'day', v_row ->> 'material_group'),
    v_op,
    v_changes,
    txid_current()
  );
  RETURN NULL;
END;
$$;

-- İzlenen tablolar (işlem geçmişinin kendisi hariç)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products', 'product_groups', 'product_documents', 'product_suppliers', 'supplier_prices',
    'boms', 'bom_items', 'bom_extrusion', 'bom_injection', 'bom_parameters',
    'work_orders', 'production_entries', 'production_entry_scraps', 'production_entry_downtimes',
    'stock_movements', 'stock_documents', 'lots',
    'orders', 'order_items', 'partners',
    'molds', 'production_lines', 'warehouses', 'operators', 'reason_codes',
    'quality_checks', 'ncr',
    'cost_parameters', 'line_capacities', 'reference_capacities', 'calendar_holidays',
    'profiles'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_row ON %I', t);
      EXECUTE format('CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_row()', t);
    END IF;
  END LOOP;
END;
$$;
