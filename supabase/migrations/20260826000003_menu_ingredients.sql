-- 메뉴 ↔ 재료 표를 DB 로 옮긴다. (2026-08-26)
--
-- 왜: 지금 표는 코드 안에 있어서, 새 메뉴(사용자가 만든 커스텀 메뉴, API 가 주는
-- 카테고리)에는 손을 쓸 수 없다. 배포 없이 늘릴 수 있어야 하고, 사용자가
-- "이거 새우 들어있어요" 하고 알려준 것도 쌓여야 한다.
--
-- 코드는 이 테이블이 비어 있거나 못 읽어도 동작한다 — lib/ingredients.ts 의 표가
-- 씨앗 겸 대비책으로 남아 있다. DB 에 있는 것은 그 위에 더해진다.

CREATE TABLE IF NOT EXISTS menu_ingredients (
  menu_name  TEXT NOT NULL,
  ingredient TEXT NOT NULL,
  -- hard: 그 메뉴를 아예 제외 / soft: 점수만 깎기(양파·마늘처럼 흔한 것)
  severity   TEXT NOT NULL DEFAULT 'hard' CHECK (severity IN ('hard','soft')),
  -- seed: 코드에서 옮겨온 것 / admin: 관리자가 넣은 것 / report: 사용자 제보
  source     TEXT NOT NULL DEFAULT 'seed' CHECK (source IN ('seed','admin','report')),
  -- 제보는 여러 사람이 같은 말을 해야 쓰인다
  report_count INT NOT NULL DEFAULT 0,
  confirmed  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (menu_name, ingredient)
);

CREATE INDEX IF NOT EXISTS idx_menu_ingredients_ing ON menu_ingredients (ingredient) WHERE confirmed;

ALTER TABLE menu_ingredients ENABLE ROW LEVEL SECURITY;

-- 읽기는 누구나(게스트도 추천을 받는다). 쓰기는 아래 함수로만 한다.
DROP POLICY IF EXISTS "menu_ingredients_read" ON menu_ingredients;
CREATE POLICY "menu_ingredients_read" ON menu_ingredients FOR SELECT USING (true);

-- 사용자 제보. 같은 메뉴·재료에 여러 번 쌓이면 확정된다(3명).
-- 🔴 아무나 확정시킬 수 있으면 장난으로 메뉴를 지울 수 있다 → 제보는 confirmed=false 로
--    시작하고, 3명이 모여야 추천에서 쓰인다. 이미 확정된 행은 건드리지 않는다.
CREATE OR REPLACE FUNCTION report_menu_ingredient(p_menu TEXT, p_ingredient TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not allowed: 로그인이 필요하다';
  END IF;
  IF p_menu IS NULL OR p_ingredient IS NULL OR length(trim(p_menu)) = 0 OR length(trim(p_ingredient)) = 0 THEN
    RAISE EXCEPTION 'invalid input';
  END IF;

  INSERT INTO menu_ingredients (menu_name, ingredient, severity, source, report_count, confirmed)
  VALUES (trim(p_menu), trim(p_ingredient), 'hard', 'report', 1, false)
  ON CONFLICT (menu_name, ingredient) DO UPDATE
    SET report_count = menu_ingredients.report_count + 1,
        confirmed    = menu_ingredients.confirmed OR (menu_ingredients.report_count + 1) >= 3;
END;
$$;

-- 코드에 있던 표를 씨앗으로 넣는다(재료 15종 hard + 5종 soft).
INSERT INTO menu_ingredients (menu_name, ingredient, severity, source, confirmed) VALUES
  ('팟타이', '땅콩', 'hard', 'seed', true),
  ('쏨땀', '땅콩', 'hard', 'seed', true),
  ('분짜', '땅콩', 'hard', 'seed', true),
  ('월남쌈', '땅콩', 'hard', 'seed', true),
  ('팟씨유', '땅콩', 'hard', 'seed', true),
  ('나시고렝', '땅콩', 'hard', 'seed', true),
  ('미고렝', '땅콩', 'hard', 'seed', true),
  ('견과류', '땅콩', 'hard', 'seed', true),
  ('강정', '땅콩', 'hard', 'seed', true),
  ('견과류', '견과류', 'hard', 'seed', true),
  ('그래놀라', '견과류', 'hard', 'seed', true),
  ('아사이볼', '견과류', 'hard', 'seed', true),
  ('마카롱', '견과류', 'hard', 'seed', true),
  ('휘낭시에', '견과류', 'hard', 'seed', true),
  ('마들렌', '견과류', 'hard', 'seed', true),
  ('브라우니', '견과류', 'hard', 'seed', true),
  ('팟타이', '견과류', 'hard', 'seed', true),
  ('쏨땀', '견과류', 'hard', 'seed', true),
  ('약과', '견과류', 'hard', 'seed', true),
  ('강정', '견과류', 'hard', 'seed', true),
  ('깐소새우', '새우', 'hard', 'seed', true),
  ('새우구이', '새우', 'hard', 'seed', true),
  ('해산물모듬', '새우', 'hard', 'seed', true),
  ('해물탕', '새우', 'hard', 'seed', true),
  ('매운탕', '새우', 'hard', 'seed', true),
  ('팟타이', '새우', 'hard', 'seed', true),
  ('똠얌꿍', '새우', 'hard', 'seed', true),
  ('딤섬', '새우', 'hard', 'seed', true),
  ('텐동', '새우', 'hard', 'seed', true),
  ('튀김', '새우', 'hard', 'seed', true),
  ('월남쌈', '새우', 'hard', 'seed', true),
  ('반쎄오', '새우', 'hard', 'seed', true),
  ('팔보채', '새우', 'hard', 'seed', true),
  ('유산슬', '새우', 'hard', 'seed', true),
  ('해물파전', '새우', 'hard', 'seed', true),
  ('짬뽕', '새우', 'hard', 'seed', true),
  ('짬뽕밥', '새우', 'hard', 'seed', true),
  ('삼선볶음밥', '새우', 'hard', 'seed', true),
  ('나시고렝', '새우', 'hard', 'seed', true),
  ('미고렝', '새우', 'hard', 'seed', true),
  ('조개구이', '조개', 'hard', 'seed', true),
  ('봉골레파스타', '조개', 'hard', 'seed', true),
  ('클램차우더', '조개', 'hard', 'seed', true),
  ('해물탕', '조개', 'hard', 'seed', true),
  ('매운탕', '조개', 'hard', 'seed', true),
  ('해산물모듬', '조개', 'hard', 'seed', true),
  ('짬뽕', '조개', 'hard', 'seed', true),
  ('짬뽕밥', '조개', 'hard', 'seed', true),
  ('해물파전', '조개', 'hard', 'seed', true),
  ('칼국수', '조개', 'hard', 'seed', true),
  ('오징어볶음', '오징어', 'hard', 'seed', true),
  ('오징어튀김', '오징어', 'hard', 'seed', true),
  ('꼴뚜기', '오징어', 'hard', 'seed', true),
  ('짬뽕', '오징어', 'hard', 'seed', true),
  ('짬뽕밥', '오징어', 'hard', 'seed', true),
  ('해물파전', '오징어', 'hard', 'seed', true),
  ('해산물모듬', '오징어', 'hard', 'seed', true),
  ('삼선볶음밥', '오징어', 'hard', 'seed', true),
  ('팔보채', '오징어', 'hard', 'seed', true),
  ('유산슬', '오징어', 'hard', 'seed', true),
  ('해물탕', '오징어', 'hard', 'seed', true),
  ('낙지볶음', '낙지', 'hard', 'seed', true),
  ('낙지', '낙지', 'hard', 'seed', true),
  ('해물탕', '낙지', 'hard', 'seed', true),
  ('매운탕', '낙지', 'hard', 'seed', true),
  ('해산물모듬', '낙지', 'hard', 'seed', true),
  ('타코야끼', '문어', 'hard', 'seed', true),
  ('해산물모듬', '문어', 'hard', 'seed', true),
  ('해물탕', '문어', 'hard', 'seed', true),
  ('해산물모듬', '굴', 'hard', 'seed', true),
  ('해물탕', '굴', 'hard', 'seed', true),
  ('매운탕', '굴', 'hard', 'seed', true),
  ('회', '생선회', 'hard', 'seed', true),
  ('광어회', '생선회', 'hard', 'seed', true),
  ('연어회', '생선회', 'hard', 'seed', true),
  ('참치회', '생선회', 'hard', 'seed', true),
  ('초밥', '생선회', 'hard', 'seed', true),
  ('사시미', '생선회', 'hard', 'seed', true),
  ('오마카세', '생선회', 'hard', 'seed', true),
  ('롤', '생선회', 'hard', 'seed', true),
  ('캘리포니아롤', '생선회', 'hard', 'seed', true),
  ('해산물모듬', '생선회', 'hard', 'seed', true),
  ('마라탕', '마라', 'hard', 'seed', true),
  ('마라샹궈', '마라', 'hard', 'seed', true),
  ('마라롱샤', '마라', 'hard', 'seed', true),
  ('훠궈', '마라', 'hard', 'seed', true),
  ('쌀국수', '고수', 'hard', 'seed', true),
  ('분짜', '고수', 'hard', 'seed', true),
  ('반미', '고수', 'hard', 'seed', true),
  ('월남쌈', '고수', 'hard', 'seed', true),
  ('분보후에', '고수', 'hard', 'seed', true),
  ('팟타이', '고수', 'hard', 'seed', true),
  ('똠얌꿍', '고수', 'hard', 'seed', true),
  ('쏨땀', '고수', 'hard', 'seed', true),
  ('반쎄오', '고수', 'hard', 'seed', true),
  ('마라탕', '고수', 'hard', 'seed', true),
  ('마라샹궈', '고수', 'hard', 'seed', true),
  ('훠궈', '고수', 'hard', 'seed', true),
  ('케밥', '고수', 'hard', 'seed', true),
  ('샤와르마', '고수', 'hard', 'seed', true),
  ('곱창', '곱창', 'hard', 'seed', true),
  ('소곱창', '곱창', 'hard', 'seed', true),
  ('막창', '곱창', 'hard', 'seed', true),
  ('대창', '곱창', 'hard', 'seed', true),
  ('순대', '순대', 'hard', 'seed', true),
  ('순대국', '순대', 'hard', 'seed', true),
  ('순대볶음', '순대', 'hard', 'seed', true),
  ('해장국', '선지', 'hard', 'seed', true),
  ('육개장', '선지', 'hard', 'seed', true),
  ('곱창', '내장', 'hard', 'seed', true),
  ('소곱창', '내장', 'hard', 'seed', true),
  ('막창', '내장', 'hard', 'seed', true),
  ('대창', '내장', 'hard', 'seed', true),
  ('순대', '내장', 'hard', 'seed', true),
  ('순대국', '내장', 'hard', 'seed', true),
  ('순대볶음', '내장', 'hard', 'seed', true),
  ('짜장면', '양파', 'soft', 'seed', true),
  ('볶음밥', '양파', 'soft', 'seed', true),
  ('제육볶음', '양파', 'soft', 'seed', true),
  ('불고기', '양파', 'soft', 'seed', true),
  ('탕수육', '양파', 'soft', 'seed', true),
  ('카레', '양파', 'soft', 'seed', true),
  ('카오팟', '양파', 'soft', 'seed', true),
  ('나시고렝', '양파', 'soft', 'seed', true),
  ('마늘치킨', '마늘', 'soft', 'seed', true),
  ('파닭', '마늘', 'soft', 'seed', true),
  ('제육볶음', '마늘', 'soft', 'seed', true),
  ('불고기', '마늘', 'soft', 'seed', true),
  ('감바스', '마늘', 'soft', 'seed', true),
  ('봉골레파스타', '마늘', 'soft', 'seed', true),
  ('파전', '파', 'soft', 'seed', true),
  ('해물파전', '파', 'soft', 'seed', true),
  ('파닭', '파', 'soft', 'seed', true),
  ('설렁탕', '파', 'soft', 'seed', true),
  ('곰탕', '파', 'soft', 'seed', true),
  ('국밥', '파', 'soft', 'seed', true),
  ('돼지국밥', '파', 'soft', 'seed', true),
  ('소머리국밥', '파', 'soft', 'seed', true),
  ('샤부샤부', '버섯', 'soft', 'seed', true),
  ('스키야키', '버섯', 'soft', 'seed', true),
  ('유산슬', '버섯', 'soft', 'seed', true),
  ('된장찌개', '버섯', 'soft', 'seed', true),
  ('칼국수', '버섯', 'soft', 'seed', true),
  ('떡볶이', '청양고추', 'soft', 'seed', true),
  ('짬뽕', '청양고추', 'soft', 'seed', true),
  ('육개장', '청양고추', 'soft', 'seed', true),
  ('감자탕', '청양고추', 'soft', 'seed', true),
  ('낙지볶음', '청양고추', 'soft', 'seed', true),
  ('오징어볶음', '청양고추', 'soft', 'seed', true),
  ('매운탕', '청양고추', 'soft', 'seed', true),
  ('제육볶음', '청양고추', 'soft', 'seed', true)
ON CONFLICT (menu_name, ingredient) DO NOTHING;
