-- 우승 점수 3→2 변경에 맞게 허용 delta 업데이트
CREATE OR REPLACE FUNCTION increment_food_score(p_food_name TEXT, p_delta INT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;
  IF p_delta NOT IN (1, 2, 3) THEN RAISE EXCEPTION 'invalid delta'; END IF;
  INSERT INTO public.user_food_scores (user_id, food_name, score, updated_at)
  VALUES (v_user_id, p_food_name, p_delta, now())
  ON CONFLICT (user_id, food_name)
  DO UPDATE SET score = public.user_food_scores.score + p_delta, updated_at = now();
END;
$$;
