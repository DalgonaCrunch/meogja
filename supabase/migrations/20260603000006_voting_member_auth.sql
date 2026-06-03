-- 멤버에 user_id, guest_name 추가
ALTER TABLE members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE members ADD COLUMN IF NOT EXISTS guest_name TEXT;

-- 투표 테이블
CREATE TABLE IF NOT EXISTS group_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  title TEXT DEFAULT '오늘의 식당 투표',
  restaurants JSONB NOT NULL,
  created_by TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vote_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vote_id UUID REFERENCES group_votes(id) ON DELETE CASCADE,
  voter_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  chosen_restaurant TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vote_id, voter_name)
);

ALTER TABLE group_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_responses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_votes' AND policyname='Allow all for group_votes') THEN
    CREATE POLICY "Allow all for group_votes" ON group_votes FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vote_responses' AND policyname='Allow all for vote_responses') THEN
    CREATE POLICY "Allow all for vote_responses" ON vote_responses FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
