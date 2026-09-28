-- Supabase panelinden elle eklenmiş, migration'larda olmayan sütunlar.
-- Canlı veritabanında zaten var (IF NOT EXISTS → no-op); sıfırdan kurulumda şemayı tamamlar.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TRY';

ALTER TABLE molds
  ADD COLUMN IF NOT EXISTS product_weight_g NUMERIC,
  ADD COLUMN IF NOT EXISTS sprue_weight_g NUMERIC;

ALTER TABLE bom_injection
  ADD COLUMN IF NOT EXISTS product_weight_g NUMERIC;

ALTER TABLE cost_parameters
  ADD COLUMN IF NOT EXISTS usd_rate NUMERIC DEFAULT 33.00,
  ADD COLUMN IF NOT EXISTS eur_rate NUMERIC DEFAULT 35.50;
