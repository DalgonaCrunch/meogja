-- 아바타 개별 설정 (관리자가 용도/표시여부/위치 조정)
CREATE TABLE IF NOT EXISTS avatar_config (
  id TEXT PRIMARY KEY,           -- 'cat-01', 'cat-02' 등
  visible BOOLEAN DEFAULT true,  -- 아바타 목록 표시 여부
  purpose TEXT DEFAULT 'avatar' CHECK (purpose IN ('avatar','emotion','hidden')),
  -- avatar: 프로필 아바타용, emotion: 감정표현용, hidden: 비활성
  object_position TEXT DEFAULT 'center', -- CSS object-position 값
  label TEXT,                    -- 감정 표현 레이블 (예: "기쁨", "슬픔")
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE avatar_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='avatar_config' AND policyname='Read all avatar_config') THEN
    CREATE POLICY "Read all avatar_config" ON avatar_config FOR SELECT USING (true);
  END IF;
END $$;

-- 서비스 롤로만 수정 가능 (관리자 API 통해서)
