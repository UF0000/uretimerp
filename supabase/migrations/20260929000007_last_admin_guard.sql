-- Son aktif admin rolünden çıkarılamaz, pasife alınamaz veya silinemez
-- (aksi halde kimse kullanıcı/rol yönetemez ve sistem kilitlenir).

CREATE OR REPLACE FUNCTION public.guard_last_admin()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role = 'admin' AND OLD.active
     AND (TG_OP = 'DELETE' OR NEW.role <> 'admin' OR NOT NEW.active)
     AND NOT EXISTS (
       SELECT 1 FROM profiles WHERE id <> OLD.id AND role = 'admin' AND active
     ) THEN
    RAISE EXCEPTION 'Sistemde en az bir aktif yönetici kalmalı; son yöneticinin rolü değiştirilemez veya pasife alınamaz.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DROP TRIGGER IF EXISTS profiles_last_admin_guard ON profiles;
CREATE TRIGGER profiles_last_admin_guard
  BEFORE UPDATE OF role, active OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_last_admin();
