CREATE TABLE IF NOT EXISTS group_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_name TEXT,
  reason TEXT,
  banned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  banned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_group_bans_group_user ON group_bans(group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_group_bans_group_guest ON group_bans(group_id, guest_name);

ALTER TABLE group_bans ENABLE ROW LEVEL SECURITY;

-- 모임장이 자신의 모임 차단 목록 조회/추가/삭제
CREATE POLICY "owner_manage_bans" ON group_bans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM groups WHERE groups.id = group_bans.group_id AND groups.owner_id = auth.uid()
    )
  );

-- 로그인 유저는 자신이 차단됐는지 조회 가능
CREATE POLICY "user_read_own_ban" ON group_bans
  FOR SELECT USING (user_id = auth.uid());

-- 비로그인(게스트) 조회는 anon으로 허용 (game check용)
CREATE POLICY "anon_read_bans" ON group_bans
  FOR SELECT USING (true);
