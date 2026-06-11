-- 모임 메뉴 투표
CREATE TABLE IF NOT EXISTS menu_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '오늘 메뉴 투표',
  options JSONB NOT NULL DEFAULT '[]', -- [{name, emoji}]
  is_anonymous BOOLEAN DEFAULT FALSE,  -- 비공개(익명) 투표
  ends_at TIMESTAMPTZ,                 -- NULL = 무제한
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_vote_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vote_id UUID NOT NULL REFERENCES menu_votes(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  voter_name TEXT NOT NULL,
  chosen_option TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vote_id, voter_id)           -- 유저당 1표 (비로그인은 voter_id NULL → 중복 가능)
);

CREATE INDEX IF NOT EXISTS idx_menu_votes_group ON menu_votes(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vote_responses_vote ON menu_vote_responses(vote_id);

ALTER TABLE menu_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu_votes_all" ON menu_votes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE menu_vote_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vote_responses_all" ON menu_vote_responses FOR ALL USING (true) WITH CHECK (true);

-- Web Push 구독 저장
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_subscriptions_all" ON push_subscriptions FOR ALL USING (true) WITH CHECK (true);
