-- 음식 이벤트 로그 (검색, 식당 클릭)
CREATE TABLE IF NOT EXISTS food_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  food_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('search', 'restaurant_click')),
  device_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE food_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "food_events_all" ON food_events FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS food_events_name_type ON food_events (food_name, event_type);
