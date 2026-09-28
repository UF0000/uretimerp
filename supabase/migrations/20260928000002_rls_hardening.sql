-- ═══════════════════════════════════════════════════════════════════
-- RLS sağlamlaştırma + append-only stok defteri
--
-- Önceki durum (panelden elle eklenmişti): her tabloda
--   "Enable all access for authenticated users" (ALL, true)
-- profiles anon'a açık, v_stock RLS'i atlıyor, lots ve stock_documents
-- tablolarında hiç politika yok (tamamen kilitli).
--
-- Rol matrisi lib/auth.ts ile aynıdır:
--   okuma            → aktif profili olan her kullanıcı
--   ana veri/reçete  → admin
--   sipariş          → admin
--   iş emri/üretim   → operator, admin
--   stok             → warehouse, admin (+ üretimden gelen hareketler için operator)
--   kalite/NCR       → quality, admin
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Rol yardımcıları ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.app_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND active;
$$;

CREATE OR REPLACE FUNCTION public.has_role(VARIADIC roles user_role[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(public.app_role() = ANY(roles), false);
$$;

REVOKE ALL ON FUNCTION public.app_role() FROM anon, public;
REVOKE ALL ON FUNCTION public.has_role(user_role[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(user_role[]) TO authenticated;

-- ─── 2. Eski "herkese her şey" politikalarını kaldır ──────────────

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ─── 3. Tüm tablolarda RLS açık + standart politikalar ───────────

-- tablo → yazma yetkisi olan roller (select/insert/update/delete)
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('products',         'admin'),
    ('warehouses',       'admin'),
    ('partners',         'admin'),
    ('production_lines', 'admin'),
    ('molds',            'admin'),
    ('reason_codes',     'admin'),
    ('boms',             'admin'),
    ('bom_items',        'admin'),
    ('bom_extrusion',    'admin'),
    ('bom_injection',    'admin'),
    ('bom_parameters',   'admin'),
    ('cost_parameters',  'admin'),
    ('orders',           'admin'),
    ('order_items',      'admin'),
    ('work_orders',      'operator,admin'),
    ('quality_checks',   'quality,admin'),
    ('ncr',              'quality,admin')
  ) AS v(tbl, roles)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tbl);
    EXECUTE format(
      'CREATE POLICY "Okuma: aktif kullanıcı" ON public.%I FOR SELECT TO authenticated USING (public.app_role() IS NOT NULL)',
      t.tbl);
    EXECUTE format(
      'CREATE POLICY "Yazma: yetkili rol" ON public.%I FOR ALL TO authenticated USING (public.has_role(VARIADIC %L::user_role[])) WITH CHECK (public.has_role(VARIADIC %L::user_role[]))',
      t.tbl, '{' || t.roles || '}', '{' || t.roles || '}');
  END LOOP;
END $$;

-- production_entries: operatör ekler, düzeltme/silme sadece admin
ALTER TABLE production_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Okuma: aktif kullanıcı" ON production_entries
  FOR SELECT TO authenticated USING (public.app_role() IS NOT NULL);
CREATE POLICY "Ekleme: operatör/admin" ON production_entries
  FOR INSERT TO authenticated WITH CHECK (public.has_role('operator', 'admin'));
CREATE POLICY "Düzeltme: admin" ON production_entries
  FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "Silme: admin" ON production_entries
  FOR DELETE TO authenticated USING (public.has_role('admin'));

-- lots: üretim ve depo lot açabilir; lotlar silinmez/değişmez
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Okuma: aktif kullanıcı" ON lots
  FOR SELECT TO authenticated USING (public.app_role() IS NOT NULL);
CREATE POLICY "Ekleme: operatör/depo/admin" ON lots
  FOR INSERT TO authenticated WITH CHECK (public.has_role('operator', 'warehouse', 'admin'));

-- profiles: sadece giriş yapmış kullanıcılar görür, sadece admin değiştirir
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Okuma: giriş yapmış kullanıcı" ON profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Yönetim: admin" ON profiles
  FOR ALL TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

-- activity_log: herkes kendi adına yazar, admin okur
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Okuma: admin" ON activity_log
  FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "Ekleme: kendi adına" ON activity_log
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.app_role() IS NOT NULL);

-- ─── 4. Stok defteri: append-only ────────────────────────────────

-- Ters kayıt bağlantısı: bir hareket en fazla bir kez ters çevrilebilir
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS reverses_id UUID REFERENCES stock_movements(id);
CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_reverses_id_key
  ON stock_movements(reverses_id) WHERE reverses_id IS NOT NULL;
ALTER TABLE stock_movements ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_quantity_positive CHECK (quantity > 0) NOT VALID;

-- Fiş silinmez, iptal edilir. Silme cascade'i artık hareketleri silmesin.
ALTER TABLE stock_documents
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES profiles(id);
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_document_id_fkey;
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_document_id_fkey
  FOREIGN KEY (document_id) REFERENCES stock_documents(id);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Okuma: aktif kullanıcı" ON stock_movements
  FOR SELECT TO authenticated USING (public.app_role() IS NOT NULL);
CREATE POLICY "Ekleme: operatör/depo/admin" ON stock_movements
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND public.has_role('operator', 'warehouse', 'admin')
    -- ters kayıt ve fişe bağlı hareket sadece depo/admin
    AND ((reverses_id IS NULL AND document_id IS NULL) OR public.has_role('warehouse', 'admin'))
  );
-- UPDATE / DELETE politikası yok → kimse yapamaz.

ALTER TABLE stock_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Okuma: aktif kullanıcı" ON stock_documents
  FOR SELECT TO authenticated USING (public.app_role() IS NOT NULL);
CREATE POLICY "Ekleme: depo/admin" ON stock_documents
  FOR INSERT TO authenticated WITH CHECK (public.has_role('warehouse', 'admin'));
CREATE POLICY "İptal: depo/admin" ON stock_documents
  FOR UPDATE TO authenticated USING (public.has_role('warehouse', 'admin')) WITH CHECK (public.has_role('warehouse', 'admin'));
-- DELETE politikası yok → fiş silinemez.

-- Son savunma hattı: RLS'i atlayan roller (service_role, postgres) için de
CREATE OR REPLACE FUNCTION public.forbid_stock_movement_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Stok hareketleri değiştirilemez veya silinemez; ters kayıt kullanın.';
END $$;

DROP TRIGGER IF EXISTS stock_movements_append_only ON stock_movements;
CREATE TRIGGER stock_movements_append_only
  BEFORE UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.forbid_stock_movement_change();

-- Ters kayıt: seçilen hareketlerin karşı yönde kopyasını ekler.
-- SECURITY INVOKER → çağıranın RLS yetkileri geçerli. Tek işlemde çalışır.
CREATE OR REPLACE FUNCTION public.reverse_stock_movements(p_ids UUID[], p_note TEXT DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  INSERT INTO stock_movements
    (product_id, warehouse_id, direction, quantity, lot_no, source_type, source_id, user_id, note, reverses_id)
  SELECT m.product_id, m.warehouse_id,
         CASE WHEN m.direction = 'in' THEN 'out'::movement_direction ELSE 'in'::movement_direction END,
         m.quantity, m.lot_no, m.source_type, m.source_id, auth.uid(),
         coalesce(p_note, 'Ters kayıt'), m.id
  FROM stock_movements m
  WHERE m.id = ANY(p_ids)
    AND m.reverses_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM stock_movements r WHERE r.reverses_id = m.id);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Fiş iptali: fişi iptal olarak işaretler ve tüm hareketlerini ters çevirir.
CREATE OR REPLACE FUNCTION public.cancel_stock_document(p_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_no text; v_ids uuid[];
BEGIN
  UPDATE stock_documents
     SET cancelled_at = now(), cancelled_by = auth.uid()
   WHERE id = p_id AND cancelled_at IS NULL
  RETURNING no INTO v_no;

  IF v_no IS NULL THEN
    RAISE EXCEPTION 'Fiş bulunamadı, zaten iptal edilmiş veya yetkiniz yok.';
  END IF;

  SELECT array_agg(id) INTO v_ids FROM stock_movements WHERE document_id = p_id;
  PERFORM public.reverse_stock_movements(coalesce(v_ids, '{}'), 'Fiş iptali: ' || v_no);
END $$;

REVOKE ALL ON FUNCTION public.reverse_stock_movements(UUID[], TEXT) FROM anon, public;
REVOKE ALL ON FUNCTION public.cancel_stock_document(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.reverse_stock_movements(UUID[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_stock_document(UUID) TO authenticated;

-- ─── 5. v_stock: çağıranın RLS'ine uysun (anon artık okuyamaz) ───

ALTER VIEW v_stock SET (security_invoker = true);
REVOKE ALL ON v_stock FROM anon;

-- ─── 6. Yeni kullanıcıya otomatik profil (varsayılan rol: operator) ─

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, name, email)
  VALUES (NEW.id, coalesce(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';
