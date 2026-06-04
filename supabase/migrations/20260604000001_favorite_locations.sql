CREATE TABLE IF NOT EXISTS favorite_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE favorite_locations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='favorite_locations' AND policyname='Allow all for favorite_locations') THEN
    CREATE POLICY "Allow all for favorite_locations" ON favorite_locations FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
