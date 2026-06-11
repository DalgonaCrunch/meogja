-- user_badges: 획득한 뱃지 목록
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_badges' AND policyname='Allow all for user_badges') THEN
    CREATE POLICY "Allow all for user_badges" ON user_badges FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 대표 뱃지 선택 컬럼 추가
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS active_badge_id TEXT;
