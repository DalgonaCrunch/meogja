-- 메뉴 월드컵 선택 기록 (인기 메뉴 통계 반영용)
CREATE TABLE IF NOT EXISTS worldcup_selections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  winner TEXT NOT NULL,
  loser TEXT NOT NULL,
  is_final BOOLEAN DEFAULT false,  -- 최종 우승 여부
  device_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE worldcup_selections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='worldcup_selections' AND policyname='Allow all for worldcup_selections') THEN
    CREATE POLICY "Allow all for worldcup_selections" ON worldcup_selections FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
