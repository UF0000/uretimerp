-- GÜVENLİK: kendi kendine kayıt olan hesap otomatik aktif operatör oluyordu (tüm veriyi görüp üretim girebiliyordu).
-- Yeni hesaplar PASİF başlar; yönetici Yönetim → Kullanıcılar'dan aktif eder. Mevcut kullanıcılar etkilenmez.

ALTER TABLE profiles ALTER COLUMN active SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, name, email, active)
  VALUES (NEW.id, coalesce(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
