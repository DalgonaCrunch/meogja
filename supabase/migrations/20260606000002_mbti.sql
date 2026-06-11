-- user_profiles에 mbti 컬럼 추가
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS mbti TEXT;
