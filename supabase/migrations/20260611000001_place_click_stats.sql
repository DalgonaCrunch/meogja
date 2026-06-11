-- 식당 클릭 통계 테이블
CREATE TABLE IF NOT EXISTS place_click_stats (
  place_name TEXT PRIMARY KEY,
  clicks      INT NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE place_click_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON place_click_stats FOR SELECT USING (true);

-- 원자적 카운터 증가 함수
CREATE OR REPLACE FUNCTION upsert_place_click(p_name TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO place_click_stats (place_name, clicks, last_clicked_at)
  VALUES (p_name, 1, NOW())
  ON CONFLICT (place_name) DO UPDATE
  SET clicks = place_click_stats.clicks + 1,
      last_clicked_at = NOW();
$$;
