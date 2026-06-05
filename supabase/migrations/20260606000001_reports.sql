-- 신고 테이블
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_device_id TEXT,
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'group')),
  target_id TEXT NOT NULL,
  target_name TEXT,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 누구나 신고 가능
CREATE POLICY "reports_insert" ON reports
  FOR INSERT WITH CHECK (true);

-- 본인 신고만 조회 가능
CREATE POLICY "reports_select_own" ON reports
  FOR SELECT USING (reporter_user_id = auth.uid());
