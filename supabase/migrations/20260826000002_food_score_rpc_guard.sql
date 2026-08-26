-- increment_food_score 가 남의 점수를 고칠 수 있던 것을 막는다. (2026-08-26)
--
-- 이 함수는 SECURITY DEFINER 인데 p_user_id 를 인자로 받기만 하고 호출자가 그 사람인지
-- 확인하지 않았다. 로그인한 사용자라면 누구든 다른 사람의 음식 점수를 바꿀 수 있었다
-- (테이블 RLS 는 SECURITY DEFINER 함수 안에서는 적용되지 않는다).
--
-- 앞으로 행동 기반 점수 적립을 여러 곳에서 부르게 되므로, 그 전에 막아 둔다.

CREATE OR REPLACE FUNCTION increment_food_score(p_user_id UUID, p_food_name TEXT, p_delta INT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not allowed: 자기 점수만 바꿀 수 있다';
  END IF;

  INSERT INTO user_food_scores (user_id, food_name, score, updated_at)
  VALUES (p_user_id, p_food_name, p_delta, now())
  ON CONFLICT (user_id, food_name)
  DO UPDATE SET score = user_food_scores.score + p_delta, updated_at = now();
END;
$$;
