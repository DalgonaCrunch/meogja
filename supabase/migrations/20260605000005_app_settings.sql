-- 앱 설정 (관리자가 이미지 선택 등 설정 관리)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_settings' AND policyname='Read all app_settings') THEN
    CREATE POLICY "Read all app_settings" ON app_settings FOR SELECT USING (true);
  END IF;
END $$;

-- 기본 아바타 목록 초기값 (관리자가 나중에 수정 가능)
INSERT INTO app_settings (key, value) VALUES (
  'default_avatars',
  '["1","2","3","4","5","6","7","8","9","10"]'
) ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value) VALUES (
  'mascot_name',
  '"먹자냥"'
) ON CONFLICT (key) DO NOTHING;
