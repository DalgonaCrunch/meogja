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
- 작업 시작 전 확인 응답 먼저 보내기
- 판단이 필요한 경우 선택지를 메시지로 제시하고 답변 기다리기
- 중간에 멈추지 말고 끝까지 진행

## 개발 워크플로우
- 배포: `vercel --prod` (Hobby 플랜 100회/일 제한). CLI 인증이 만료된 경우 `git push` → Vercel Git 연동 배포
- DB 마이그레이션: `supabase db push --linked`
- 빌드 확인: `npx next build`

## 브라우저 테스트 규칙 (중요)
- **화면 확인은 `scripts/check-*.mjs` 로 한다.** 이 스크립트들은 `scripts/_browser.mjs` 를 쓰고,
  기본 headless 라 창이 뜨지 않으며 예외·Ctrl+C 로 끝나도 **자기가 띄운 브라우저만** 닫는다.
- 눈으로 봐야 할 때만 `HEADED=1 node scripts/check-....mjs` — 창을 화면 밖(-4000,-4000)에 띄운다.
- MCP playwright(`browser_navigate` 등)는 창이 남는다. 쓸 일이 있으면 **끝나고 `browser_close`**,
  그래도 프로세스가 남으면 `ms-playwright-mcp` user-data-dir 을 가진 PID 만 종료한다
  (사용자가 열어 둔 브라우저는 절대 건드리지 않는다).
- 테스트용 dev/prod 서버(`next start -p ...`)도 확인이 끝나면 종료한다.

## 기능 명세 문서 (SPEC.md)
- `SPEC.md` = 살아있는 기능 설계 문서
- 기능 구현 완료 시 `[ ]` → `[x]` 자동 업데이트 (Claude가 직접)
- 새 기능 추가 시 SPEC.md에 항목 추가 후 구현
- 작업마다 하단 `마지막 업데이트` 날짜 갱신
- 사용자는 텔레그램으로 기능 요청만 하면 됨 (문서 직접 편집 불필요)

## 보안
- SUPABASE_SERVICE_ROLE_KEY 클라이언트 노출 금지
- 관리자 기능은 NEXT_PUBLIC_ADMIN_EMAIL 검증 필수
- .token, .env.local 커밋 금지

## 코드 스타일
- TypeScript 엄격 모드
- CSS-in-JS (inline styles with CSS variables)
- CSS variables: var(--primary), var(--surface), var(--text) 등 사용
