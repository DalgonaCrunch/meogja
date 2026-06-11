-- user_profiles에 disliked_foods 컬럼 추가
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS disliked_foods TEXT;
