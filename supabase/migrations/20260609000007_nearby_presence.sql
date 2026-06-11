-- 근처 친구 찾기: 일시적 위치 공유 (5분 TTL)
CREATE TABLE IF NOT EXISTS nearby_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  profile_image TEXT,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  last_seen TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE nearby_presence ENABLE ROW LEVEL SECURITY;

-- 본인만 insert/update/delete
CREATE POLICY "nearby_presence_own" ON nearby_presence
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 전체 조회 가능 (근처 탐색용)
CREATE POLICY "nearby_presence_read" ON nearby_presence
  FOR SELECT USING (true);
