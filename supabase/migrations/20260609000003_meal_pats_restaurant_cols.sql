-- 먹자팟에 식당 주소/링크 컬럼 추가
ALTER TABLE meal_pats ADD COLUMN IF NOT EXISTS restaurant_address text;
ALTER TABLE meal_pats ADD COLUMN IF NOT EXISTS restaurant_link text;
