-- API 레이트 리밋 테이블 (IP + endpoint + 시간창 단위 카운터)
CREATE TABLE IF NOT EXISTS rate_limits (
  ip text NOT NULL,
  endpoint text NOT NULL,
  window_key text NOT NULL,
  count int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (ip, endpoint, window_key)
);

-- 만료된 row 주기적으로 정리할 수 있도록 인덱스
CREATE INDEX IF NOT EXISTS rate_limits_expires_at_idx ON rate_limits (expires_at);

-- 서비스 롤만 접근 가능 (RLS 활성화, 일반 유저 차단)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- 아무 정책도 없으면 anon/authenticated 접근 불가 (service_role은 RLS 우회)

-- Atomic increment RPC: INSERT ON CONFLICT DO UPDATE + RETURNING count
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_ip text,
  p_endpoint text,
  p_window_key text,
  p_expires_at timestamptz
) RETURNS int
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO rate_limits (ip, endpoint, window_key, count, expires_at)
  VALUES (p_ip, p_endpoint, p_window_key, 1, p_expires_at)
  ON CONFLICT (ip, endpoint, window_key)
  DO UPDATE SET count = rate_limits.count + 1
  RETURNING count;
$$;

-- 만료된 rate limit row 정리 함수 (필요 시 cron 또는 수동 실행)
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM rate_limits WHERE expires_at < now();
$$;
