# meogja 프로젝트 지침

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
