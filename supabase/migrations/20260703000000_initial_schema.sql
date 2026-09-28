-- 1. Enum Types
CREATE TYPE product_type AS ENUM ('finished', 'raw', 'semi', 'regrind', 'scrap');
CREATE TYPE unit_type AS ENUM ('adet', 'kg', 'metre');
CREATE TYPE warehouse_type AS ENUM ('raw', 'finished', 'quarantine', 'scrap', 'regrind');
CREATE TYPE partner_type AS ENUM ('customer', 'supplier');
CREATE TYPE equipment_status AS ENUM ('active', 'maintenance', 'down');
CREATE TYPE reason_kind AS ENUM ('scrap', 'downtime');
CREATE TYPE production_type AS ENUM ('extrusion', 'injection');
CREATE TYPE order_status AS ENUM ('open', 'in_production', 'done', 'cancelled');
CREATE TYPE work_order_status AS ENUM ('planned', 'in_progress', 'done');
CREATE TYPE shift_type AS ENUM ('day', 'night');
CREATE TYPE movement_direction AS ENUM ('in', 'out');
CREATE TYPE movement_source_type AS ENUM ('production', 'sale', 'purchase', 'count', 'transfer', 'scrap');
CREATE TYPE qc_type AS ENUM ('incoming', 'process', 'final');
CREATE TYPE qc_result AS ENUM ('accept', 'reject', 'conditional');
CREATE TYPE ncr_status AS ENUM ('open', 'closed');
CREATE TYPE user_role AS ENUM ('operator', 'warehouse', 'quality', 'admin');

-- 2. Tables

CREATE TABLE profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'operator',
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type product_type NOT NULL,
  unit unit_type NOT NULL,
  category TEXT,
  material_grade TEXT,
  min_stock NUMERIC NOT NULL DEFAULT 0,
  critical_stock NUMERIC NOT NULL DEFAULT 0,
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type warehouse_type NOT NULL
);

CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type partner_type NOT NULL,
  phone TEXT,
  address TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE production_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  head_type TEXT,
  status equipment_status NOT NULL DEFAULT 'active'
);

CREATE TABLE molds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  product_id UUID REFERENCES products(id),
  cavity_count INTEGER NOT NULL,
  cycle_time_sec NUMERIC NOT NULL,
  total_shots INTEGER NOT NULL DEFAULT 0,
  maintenance_plan TEXT,
  last_maintenance DATE,
  status equipment_status NOT NULL DEFAULT 'active'
);

CREATE TABLE reason_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind reason_kind NOT NULL,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE boms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  production_type production_type NOT NULL,
  regrind_pct NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE bom_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID REFERENCES boms(id) NOT NULL,
  component_product_id UUID REFERENCES products(id) NOT NULL,
  quantity NUMERIC NOT NULL,
  unit unit_type NOT NULL,
  ratio_pct NUMERIC
);

CREATE TABLE bom_extrusion (
  bom_id UUID REFERENCES boms(id) PRIMARY KEY,
  line_id UUID REFERENCES production_lines(id),
  kg_per_meter NUMERIC,
  scrap_pct NUMERIC
);

CREATE TABLE bom_injection (
  bom_id UUID REFERENCES boms(id) PRIMARY KEY,
  mold_id UUID REFERENCES molds(id),
  cavity_count INTEGER,
  cycle_time_sec NUMERIC,
  parts_per_cycle INTEGER,
  runner_sprue_weight_g NUMERIC
);

CREATE TABLE bom_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID REFERENCES boms(id) NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no TEXT NOT NULL UNIQUE,
  partner_id UUID REFERENCES partners(id) NOT NULL,
  order_date DATE NOT NULL,
  delivery_date DATE,
  status order_status NOT NULL DEFAULT 'open'
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  quantity NUMERIC NOT NULL,
  delivered_qty NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no TEXT NOT NULL UNIQUE,
  product_id UUID REFERENCES products(id) NOT NULL,
  bom_id UUID REFERENCES boms(id) NOT NULL,
  planned_qty NUMERIC NOT NULL,
  line_id UUID REFERENCES production_lines(id),
  mold_id UUID REFERENCES molds(id),
  status work_order_status NOT NULL DEFAULT 'planned',
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  order_id UUID REFERENCES orders(id)
);

CREATE TABLE production_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES work_orders(id) NOT NULL,
  shift shift_type NOT NULL,
  produced_qty NUMERIC NOT NULL,
  scrap_qty NUMERIC NOT NULL DEFAULT 0,
  scrap_reason_code_id UUID REFERENCES reason_codes(id),
  downtime_min NUMERIC NOT NULL DEFAULT 0,
  downtime_reason_code_id UUID REFERENCES reason_codes(id),
  actual_cycle_time_sec NUMERIC,
  operator TEXT,
  entry_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  direction movement_direction NOT NULL,
  quantity NUMERIC NOT NULL,
  lot_no TEXT,
  source_type movement_source_type NOT NULL,
  source_id UUID,
  user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  note TEXT
);

CREATE TABLE lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_no TEXT NOT NULL UNIQUE,
  product_id UUID REFERENCES products(id) NOT NULL,
  production_date DATE NOT NULL,
  work_order_id UUID REFERENCES work_orders(id),
  parent_lot_ids UUID[]
);

CREATE TABLE quality_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type qc_type NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  lot_no TEXT,
  work_order_id UUID REFERENCES work_orders(id),
  standard TEXT,
  measurements JSONB,
  result qc_result NOT NULL,
  checked_by UUID REFERENCES profiles(id),
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ncr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no TEXT NOT NULL UNIQUE,
  product_id UUID REFERENCES products(id) NOT NULL,
  lot_no TEXT,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  quarantine_warehouse_id UUID REFERENCES warehouses(id),
  root_cause TEXT,
  corrective_action TEXT,
  status ncr_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE cost_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  labor_per_unit NUMERIC NOT NULL DEFAULT 0,
  energy_per_unit NUMERIC NOT NULL DEFAULT 0,
  overhead_pct NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Views

CREATE OR REPLACE VIEW v_stock AS
SELECT 
  product_id, 
  warehouse_id,
  SUM(CASE WHEN direction = 'in' THEN quantity ELSE -quantity END) as qty
FROM stock_movements 
GROUP BY product_id, warehouse_id;

-- 4. Row Level Security (RLS) Policies (Simplified placeholders, actual policies depend on auth flow)
-- Example RLS for products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all authenticated users" ON products FOR SELECT TO authenticated USING (true);
-- ... More policies to be added in Phase 1 ...
