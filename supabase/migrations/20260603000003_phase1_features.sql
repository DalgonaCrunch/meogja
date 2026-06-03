-- 추천 세션 (히스토리)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  participant_names TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 세션별 선택 식당
CREATE TABLE IF NOT EXISTS session_picks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  restaurant_name TEXT NOT NULL,
  restaurant_address TEXT,
  restaurant_category TEXT,
  restaurant_link TEXT,
  map_provider TEXT DEFAULT 'naver',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 즐겨찾기
CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  restaurant_name TEXT NOT NULL,
  restaurant_address TEXT,
  restaurant_category TEXT,
  restaurant_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, restaurant_name)
);

-- 리뷰/별점
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  restaurant_name TEXT NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  visited_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sessions' AND policyname='Allow all for sessions') THEN
    CREATE POLICY "Allow all for sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='session_picks' AND policyname='Allow all for session_picks') THEN
    CREATE POLICY "Allow all for session_picks" ON session_picks FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='favorites' AND policyname='Allow all for favorites') THEN
    CREATE POLICY "Allow all for favorites" ON favorites FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='Allow all for reviews') THEN
    CREATE POLICY "Allow all for reviews" ON reviews FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
