CREATE TABLE IF NOT EXISTS custom_menus (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE custom_menus ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='custom_menus' AND policyname='Allow all for custom_menus') THEN
    CREATE POLICY "Allow all for custom_menus" ON custom_menus FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
