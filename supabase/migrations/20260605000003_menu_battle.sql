-- 오늘의 메뉴 배틀 (홈화면 daily A vs B 투표)
CREATE TABLE IF NOT EXISTS menu_battles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_a TEXT NOT NULL,
  menu_b TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_battle_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id UUID REFERENCES menu_battles(id) ON DELETE CASCADE,
  choice TEXT NOT NULL CHECK (choice IN ('a', 'b')),
  voter_device_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE menu_battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_battle_votes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='menu_battles' AND policyname='Allow all for menu_battles') THEN
    CREATE POLICY "Allow all for menu_battles" ON menu_battles FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='menu_battle_votes' AND policyname='Allow all for menu_battle_votes') THEN
    CREATE POLICY "Allow all for menu_battle_votes" ON menu_battle_votes FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 오늘의 배틀 시드 데이터
INSERT INTO menu_battles (menu_a, menu_b, date) VALUES
  ('치킨', '피자', CURRENT_DATE)
ON CONFLICT DO NOTHING;
