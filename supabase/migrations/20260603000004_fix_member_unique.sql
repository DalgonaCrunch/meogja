-- members.name 전역 유니크 제거 → (group_id, name) 모임별 유니크로 변경
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_name_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_group_name_key') THEN
    ALTER TABLE members ADD CONSTRAINT members_group_name_key UNIQUE (group_id, name);
  END IF;
END $$;
