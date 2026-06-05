# meogja 프로젝트 지침

## 서비스 목표
- **핵심**: 친구들과 메뉴를 *정하는* 서비스 — 맛집 검색이 아님
- 공유 가능한 결과 생성이 핵심 성장 수단
- 게임/놀이처럼 느껴져야 함 → "한번 눌러볼까?" 유도
- 바이럴 기능 우선 (결과 카드, 공유, 배틀, 월드컵)

## 디자인 원칙
- **따뜻하고(warm), 재미있고(playful), 음식이 먼저(food first), 감성적(emotional)**
- 큰 음식 사진 > 텍스트
- 애니메이션·게임 요소 적극 활용
- 모든 결과는 공유 유도 포함

## 절대 하지 말 것
- 관리자·설정 느낌 UI (버튼 나열, 폼 위주)
- 텍스트만 있는 카드 (이미지/이모지 없음)
- 사용자에게 여러 옵션 고르게 하는 흐름 (결정 피로)
- 화면 전환 없이 alert/confirm 남발

## 실행 환경
- 텔레그램봇을 통해서만 동작하는 세션
- 사용자에게 선택 요구 금지 — 모든 의사결정 스스로
- 작업 시작 전 텔레그램으로 확인 응답 먼저 보내기
- 중간에 멈추지 말고 끝까지 진행

## 개발 워크플로우
- 배포: `vercel --prod` (Hobby 플랜 100회/일 제한)
- DB 마이그레이션: `supabase db push --linked`
- 빌드 확인: `npx next build`

## 보안
- SUPABASE_SERVICE_ROLE_KEY 클라이언트 노출 금지
- 관리자 기능은 NEXT_PUBLIC_ADMIN_EMAIL 검증 필수
- .token, .env.local 커밋 금지

## 코드 스타일
- TypeScript 엄격 모드
- CSS-in-JS (inline styles with CSS variables)
- CSS variables: var(--primary), var(--surface), var(--text) 등 사용
