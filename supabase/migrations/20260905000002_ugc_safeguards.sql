-- 구글 플레이 UGC 정책 대응: 사용자 차단 + 메시지 신고
--
-- 구글은 사용자끼리 글이 오가는 앱에 세 가지를 요구한다.
--   ① 부적절한 콘텐츠를 앱 안에서 신고할 수 있을 것
--   ② 다른 사용자를 앱 안에서 차단할 수 있을 것
--   ③ 신고된 것을 검토·조치할 것
--
-- meogja 는 ①(모임·멤버 신고)과 ③(관리자 신고 큐 + 강퇴·정지)은 이미 있었다.
-- 없던 것이 ② 개인 차단, 그리고 ① 중 **채팅 메시지 신고** 다. 그 둘을 채운다.

-- ── 1. 개인 차단 ────────────────────────────────────────────────────────
-- 모임장의 강퇴(group_bans)는 모임 단위이고 모임장만 쓸 수 있다.
-- 여기서 필요한 것은 "내가 저 사람을 안 보겠다"는 개인 단위 차단이다.
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- 내 차단 목록만 보고 고칠 수 있다. 남이 나를 차단했는지는 알 수 없어야 한다
-- (알 수 있으면 보복의 빌미가 된다).
DROP POLICY IF EXISTS "user_blocks_own" ON user_blocks;
CREATE POLICY "user_blocks_own" ON user_blocks
  FOR ALL USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());

-- ── 2. 신고 대상에 채팅 메시지를 추가 ───────────────────────────────────
-- 기존 CHECK 는 ('user','group') 만 허용한다. 메시지 신고가 막혀 있었다.
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE reports ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('user', 'group', 'message'));

-- 신고 본문을 남길 자리. 메시지는 지워지거나 바뀔 수 있어서
-- target_id 만으로는 관리자가 무엇을 검토해야 할지 알 수 없다.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_content TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS group_id UUID;

CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at DESC);
