CREATE TABLE IF NOT EXISTS custom_menus (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE custom_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all for custom_menus" ON custom_menus FOR ALL USING (true) WITH CHECK (true);
