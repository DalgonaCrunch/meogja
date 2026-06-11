-- 사용자별 음식 선호 점수 (월드컵 결과 누적)
CREATE TABLE IF NOT EXISTS user_food_scores (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, food_name)
);

ALTER TABLE user_food_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_food_scores_owner" ON user_food_scores
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_food_scores_user_score ON user_food_scores (user_id, score DESC);

-- 원자적 점수 증가 함수
CREATE OR REPLACE FUNCTION increment_food_score(p_user_id UUID, p_food_name TEXT, p_delta INT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_food_scores (user_id, food_name, score, updated_at)
  VALUES (p_user_id, p_food_name, p_delta, now())
  ON CONFLICT (user_id, food_name)
  DO UPDATE SET score = user_food_scores.score + p_delta, updated_at = now();
END;
$$;
