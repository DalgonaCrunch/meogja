-- 근처 멤버 찾기의 위치를 아무나 못 읽게 한다.
--
-- 기존 정책은 `FOR SELECT USING (true)` 였다. 즉 로그인한 누구나
-- **모든 사용자의 정확한 좌표**를 읽을 수 있었다. 화면에서 5분 필터를 걸긴 하지만
-- 그건 클라이언트 이야기라 API 를 직접 부르면 소용이 없다.
--
-- 이 기능의 목적은 "같은 모임 사람 중 근처에 있는 사람 찾기" 다.
-- 그러면 볼 수 있어야 하는 범위도 딱 그만큼이다.

DROP POLICY IF EXISTS "nearby_presence_read" ON nearby_presence;

CREATE POLICY "nearby_presence_read_group" ON nearby_presence
  FOR SELECT USING (
    -- 내 위치는 언제나 내가 본다
    user_id = auth.uid()
    OR (
      -- 5분이 지난 위치는 서버에서 잘라낸다 (화면 필터에 기대지 않는다)
      last_seen > now() - interval '5 minutes'
      AND EXISTS (
        SELECT 1
        FROM group_memberships mine
        JOIN group_memberships theirs ON theirs.group_id = mine.group_id
        WHERE mine.user_id = auth.uid()
          AND theirs.user_id = nearby_presence.user_id
      )
    )
  );
