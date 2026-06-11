-- avatar_config: 관리자가 저장한 크롭 이미지 URL 컬럼 추가
ALTER TABLE avatar_config ADD COLUMN IF NOT EXISTS cropped_url TEXT;
