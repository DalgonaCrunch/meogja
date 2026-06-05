-- 1. groups 테이블: 가입 승인 필요 옵션
ALTER TABLE groups ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false;

-- 2. members 테이블: 가입 상태 (pending=승인 대기, approved=승인됨)
ALTER TABLE members ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending'));

-- 기존 멤버 모두 approved로 유지 (이미 DEFAULT approved이므로 불필요하나 명시)
UPDATE members SET status = 'approved' WHERE status IS NULL;
