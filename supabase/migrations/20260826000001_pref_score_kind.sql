-- 선호도에 세기(score)와 종류(kind)를 붙인다. (2026-08-26)
--
-- 왜: 지금은 like/dislike 두 값뿐이어서
--   1) "최고" 와 "그냥 좋아" 를 구분할 수 없고
--   2) 알레르기(못 먹음)와 "별로" 를 같은 무게로 다루게 된다
--   3) 저장된 이름이 재료인지 메뉴인지 카테고리인지 알 수 없다
--
-- ⚠️ preference_type 은 **건드리지 않는다.** 프로필·모임·홈 화면이 전부 그 값을 읽는다.
--    컬럼만 더한다 → 옛 코드는 무시하고, 새 코드만 본다.
--
-- 점수 약속:
--    +3 최고 / +2 좋아 / -1 별로 / -9 못 먹음(= 아예 제외)
--    -5 이하를 "제외" 로 본다.

ALTER TABLE food_preferences      ADD COLUMN IF NOT EXISTS score SMALLINT;
ALTER TABLE food_preferences      ADD COLUMN IF NOT EXISTS kind  TEXT;
ALTER TABLE user_food_preferences ADD COLUMN IF NOT EXISTS score SMALLINT;
ALTER TABLE user_food_preferences ADD COLUMN IF NOT EXISTS kind  TEXT;

-- 기존 행 메우기.
-- 🔴 기존 dislike 는 화면에서 "🚫 못먹음" 으로 받은 것이다 → -9(제외)로 본다.
--    -1(별로)로 두면 남이 적어 둔 알레르기가 조용히 풀린다.
UPDATE food_preferences
   SET score = CASE WHEN preference_type = 'dislike' THEN -9 ELSE 2 END
 WHERE score IS NULL;

UPDATE user_food_preferences
   SET score = CASE WHEN preference_type = 'dislike' THEN -9 ELSE 2 END
 WHERE score IS NULL;

-- 종류 메우기: 프로필의 '재료/알레르기' 프리셋에 있는 이름은 재료다.
UPDATE food_preferences
   SET kind = 'ingredient'
 WHERE kind IS NULL
   AND food_name IN ('고수','땅콩','견과류','새우','조개','오징어','낙지','문어','굴',
                     '생선회','마라','청양고추','양파','버섯','파','마늘','곱창','순대',
                     '선지','내장');

UPDATE user_food_preferences
   SET kind = 'ingredient'
 WHERE kind IS NULL
   AND food_name IN ('고수','땅콩','견과류','새우','조개','오징어','낙지','문어','굴',
                     '생선회','마라','청양고추','양파','버섯','파','마늘','곱창','순대',
                     '선지','내장');

-- 남은 것은 메뉴 또는 카테고리. 구분이 필요할 때 코드가 MENU_DATA 로 판단한다.
UPDATE food_preferences      SET kind = 'menu' WHERE kind IS NULL;
UPDATE user_food_preferences SET kind = 'menu' WHERE kind IS NULL;

-- 점수 범위 확인용 제약(느슨하게 — 나중에 값을 늘릴 수 있게)
ALTER TABLE food_preferences      DROP CONSTRAINT IF EXISTS food_preferences_score_range;
ALTER TABLE food_preferences      ADD  CONSTRAINT food_preferences_score_range      CHECK (score IS NULL OR (score BETWEEN -9 AND 9));
ALTER TABLE user_food_preferences DROP CONSTRAINT IF EXISTS user_food_preferences_score_range;
ALTER TABLE user_food_preferences ADD  CONSTRAINT user_food_preferences_score_range CHECK (score IS NULL OR (score BETWEEN -9 AND 9));

CREATE INDEX IF NOT EXISTS idx_food_prefs_member_score ON food_preferences (member_id, score);
CREATE INDEX IF NOT EXISTS idx_user_food_prefs_score   ON user_food_preferences (user_id, score);
