-- Create Document Type ENUM
CREATE TYPE stock_document_type AS ENUM (
  'in_purchase',
  'in_production',
  'in_count',
  'transfer',
  'out_sale',
  'out_consumption',
  'out_scrap',
  'out_count'
);

-- Create Stock Documents Table
CREATE TABLE stock_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no TEXT NOT NULL UNIQUE,
  type stock_document_type NOT NULL,
  document_date DATE NOT NULL,
  source_warehouse_id UUID REFERENCES warehouses(id),
  target_warehouse_id UUID REFERENCES warehouses(id),
  note TEXT,
  user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Modify Stock Movements to link to Documents
ALTER TABLE stock_movements
ADD COLUMN document_id UUID REFERENCES stock_documents(id) ON DELETE CASCADE;
