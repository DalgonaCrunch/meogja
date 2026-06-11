-- 사용자 개인 음식 선호도 (그룹 멤버와 무관하게 전역 설정)
CREATE TABLE IF NOT EXISTS user_food_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  preference_type TEXT NOT NULL CHECK (preference_type IN ('like', 'dislike')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, food_name, preference_type)
);

CREATE INDEX IF NOT EXISTS idx_user_food_prefs_user ON user_food_preferences(user_id, preference_type);

ALTER TABLE user_food_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_food_prefs_own" ON user_food_preferences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
