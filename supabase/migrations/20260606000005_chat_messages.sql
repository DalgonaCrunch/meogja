-- 모임 채팅
CREATE TABLE IF NOT EXISTS group_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  profile_image TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON group_messages(group_id, created_at DESC);

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_messages_all" ON group_messages FOR ALL USING (true) WITH CHECK (true);

-- 계정 간 쪽지 (로그인 유저만)
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_receiver ON direct_messages(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id, created_at DESC);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm_select" ON direct_messages FOR SELECT USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);
CREATE POLICY "dm_insert" ON direct_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
);
CREATE POLICY "dm_update" ON direct_messages FOR UPDATE USING (
  auth.uid() = receiver_id
);
