-- 휴대전화번호를 더 이상 받지 않는다.
--
-- 네이버 OAuth 스코프로 mobile 을 받아 user_profiles.mobile 에 저장하고 있었는데
-- 앱 어디에서도 쓰지 않았다. 쓰지 않는 개인정보를 갖고 있으면 구글 플레이
-- 데이터 보안 선언에 "전화번호 수집"을 적어야 하고, 최소수집 원칙에도 어긋난다.
--
-- 스코프와 저장 코드는 앱에서 제거했다. 여기서는 이미 쌓인 값을 지운다.
-- DROP COLUMN 자체가 값을 없애므로 따로 UPDATE 하지 않는다. 예전에는
-- 의도를 드러내려고 UPDATE ... SET mobile = NULL 을 앞에 뒀는데, 컬럼이
-- 이미 없는 데이터베이스에서는 그 줄이 에러를 내고 배치 전체를 멈춘다.
-- 두 번 실행해도 통과하는 것이 주석보다 중요하다.

ALTER TABLE user_profiles DROP COLUMN IF EXISTS mobile;
