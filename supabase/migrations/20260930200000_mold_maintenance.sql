-- Kalıp bakımı: atış sayısına göre periyodik bakım uyarısı + bakım kayıtları.
-- Bakımdan beri atış = total_shots − shots_at_last_maintenance; aralığın %80'i "yaklaşıyor", %100'ü "gecikti".

ALTER TABLE molds
  ADD COLUMN IF NOT EXISTS maintenance_interval_shots INTEGER CHECK (maintenance_interval_shots IS NULL OR maintenance_interval_shots > 0),
  ADD COLUMN IF NOT EXISTS shots_at_last_maintenance BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS mold_maintenances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mold_id UUID NOT NULL REFERENCES molds(id),
  done_on DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Istanbul')::date,
  kind TEXT NOT NULL DEFAULT 'periyodik' CHECK (kind IN ('periyodik', 'ariza', 'revizyon')),
  shots_at BIGINT NOT NULL DEFAULT 0,          -- bakım anındaki atış sayacı (otomatik)
  description TEXT,
  performed_by TEXT,                           -- bakımı yapan kişi / firma
  downtime_hours NUMERIC CHECK (downtime_hours IS NULL OR downtime_hours >= 0),
  cost NUMERIC CHECK (cost IS NULL OR cost >= 0),
  created_by UUID REFERENCES profiles(id) DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mold_maintenances_mold_idx ON mold_maintenances (mold_id, done_on DESC);

-- Bakım kaydı girilince: sayaç anlık değer, kalıp kartında son bakım + sayaç sıfır noktası, bakımdaysa aktife döner
CREATE OR REPLACE FUNCTION mold_maintenance_apply() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_shots BIGINT;
BEGIN
  SELECT total_shots INTO v_shots FROM molds WHERE id = NEW.mold_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kalıp bulunamadı.';
  END IF;
  NEW.shots_at := coalesce(v_shots, 0);
  UPDATE molds
     SET last_maintenance = GREATEST(coalesce(last_maintenance, NEW.done_on), NEW.done_on),
         shots_at_last_maintenance = NEW.shots_at,
         status = CASE WHEN status = 'maintenance' THEN 'active' ELSE status END
   WHERE id = NEW.mold_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS mold_maintenance_apply ON mold_maintenances;
CREATE TRIGGER mold_maintenance_apply BEFORE INSERT ON mold_maintenances
  FOR EACH ROW EXECUTE FUNCTION mold_maintenance_apply();

-- Bakım kayıtları değiştirilmez (yanlış giriş yönetici tarafından silinebilir; işlem geçmişinde kalır)
ALTER TABLE mold_maintenances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Okuma: aktif kullanıcı" ON mold_maintenances;
CREATE POLICY "Okuma: aktif kullanıcı" ON mold_maintenances
  FOR SELECT TO authenticated USING (public.app_role() IS NOT NULL);
DROP POLICY IF EXISTS "Ekleme: operatör/admin" ON mold_maintenances;
CREATE POLICY "Ekleme: operatör/admin" ON mold_maintenances
  FOR INSERT TO authenticated WITH CHECK (public.has_role('operator', 'admin'));
DROP POLICY IF EXISTS "Silme: admin" ON mold_maintenances;
CREATE POLICY "Silme: admin" ON mold_maintenances
  FOR DELETE TO authenticated USING (public.has_role('admin'));

-- İşlem geçmişi
DROP TRIGGER IF EXISTS audit_row ON mold_maintenances;
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON mold_maintenances
  FOR EACH ROW EXECUTE FUNCTION audit_row();

-- Bakım durumu görünümü (panel + kalıp listesi)
CREATE OR REPLACE VIEW v_mold_maintenance
WITH (security_invoker = true) AS
SELECT
  m.id AS mold_id,
  m.code,
  m.name,
  m.status,
  m.total_shots,
  m.maintenance_interval_shots AS interval_shots,
  m.last_maintenance,
  greatest(m.total_shots - m.shots_at_last_maintenance, 0) AS shots_since,
  CASE WHEN m.maintenance_interval_shots > 0
    THEN round(greatest(m.total_shots - m.shots_at_last_maintenance, 0)::numeric / m.maintenance_interval_shots * 100, 1)
  END AS used_pct,
  CASE
    WHEN m.maintenance_interval_shots IS NULL THEN 'tanimsiz'
    WHEN m.total_shots - m.shots_at_last_maintenance >= m.maintenance_interval_shots THEN 'gecikti'
    WHEN m.total_shots - m.shots_at_last_maintenance >= m.maintenance_interval_shots * 0.8 THEN 'yaklasiyor'
    ELSE 'uygun'
  END AS state
FROM molds m;
