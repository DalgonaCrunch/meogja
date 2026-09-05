-- 휴대전화번호를 더 이상 받지 않는다.
--
-- 네이버 OAuth 스코프로 mobile 을 받아 user_profiles.mobile 에 저장하고 있었는데
-- 앱 어디에서도 쓰지 않았다. 쓰지 않는 개인정보를 갖고 있으면 구글 플레이
-- 데이터 보안 선언에 "전화번호 수집"을 적어야 하고, 최소수집 원칙에도 어긋난다.
--
-- 스코프와 저장 코드는 앱에서 제거했다. 여기서는 이미 쌓인 값을 지운다.
-- 먼저 비우고 컬럼을 떨어뜨린다 (컬럼만 떨어뜨려도 값은 사라지지만,
-- 순서를 명시해 두면 나중에 로그를 볼 때 의도가 분명하다).

UPDATE user_profiles SET mobile = NULL WHERE mobile IS NOT NULL;

ALTER TABLE user_profiles DROP COLUMN IF EXISTS mobile;
