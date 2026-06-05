-- guest_accounts에 device_id 추가 (기기별 게스트 식별)
ALTER TABLE guest_accounts ADD COLUMN IF NOT EXISTS device_id TEXT;
