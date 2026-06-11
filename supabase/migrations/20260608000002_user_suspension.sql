-- 계정 정지 기능
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
ALTER TABLE guest_accounts ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
