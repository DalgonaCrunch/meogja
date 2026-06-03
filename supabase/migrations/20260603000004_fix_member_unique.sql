-- members.name 전역 유니크 제거 → (group_id, name) 모임별 유니크로 변경
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_name_key;
ALTER TABLE members ADD CONSTRAINT IF NOT EXISTS members_group_name_key UNIQUE (group_id, name);
