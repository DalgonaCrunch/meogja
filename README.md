# 오늘 뭐 먹지? (meogja)

> 친구들과 메뉴를 **정하는** 서비스 — 맛집 검색이 아닌 결정 도우미

**meogja.vercel.app**

---

## 서비스 소개

"오늘 뭐 먹지?" — 모임에서 메뉴 하나 정하는 데 30분 걸리는 문제를 해결합니다.

- 모임을 만들고 링크를 공유하면 멤버들이 참여
- 각자 먹고 싶은 메뉴를 투표
- 결과 카드를 공유하면 끝

게임처럼 재밌어야 한 번 써보고 싶어진다는 원칙 아래 디자인했습니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| 🍱 모임 투표 | 모임 생성 → 링크 공유 → 메뉴 투표 → 결과 공유 |
| 🎯 메뉴 월드컵 | 음식 1:1 토너먼트로 최애 메뉴 결정 |
| ⚔️ 오늘의 배틀 | 두 메뉴 중 하나 선택, 전국 실시간 투표 |
| 🎰 메뉴 룰렛 | 정하기 귀찮을 때 랜덤 추천 |
| 🔥 지금 가장 잘 맞는 메뉴 | 시간대 + 나이대 + 날씨 + 네이버 트렌드 기반 랭킹 |
| 👤 개인 프로필 | 성별·연령대·MBTI·싫어하는 음식 설정 |
| 🗺️ 주변 맛집 찾기 | 선택한 메뉴로 카카오맵 연동 |

---

## 기술 스택

- **Frontend**: Next.js 15 (App Router), TypeScript strict mode
- **Styling**: CSS-in-JS (inline styles + CSS variables), 테마 시스템
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Auth**: Google OAuth, 네이버 OAuth, 카카오 OAuth, 간편가입(이름+비밀번호), 게스트
- **배포**: Vercel (Hobby Plan)
- **외부 API**: 네이버 DataLab (검색 트렌드), 카카오맵, wttr.in (날씨)

---

## 로컬 개발

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env.local  # 직접 작성 필요

# 개발 서버
npm run dev

# 빌드
npx next build

# DB 마이그레이션
supabase db push --linked

# 배포
vercel --prod
```

### 필요한 환경변수

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_ADMIN_EMAIL=
NEXT_PUBLIC_NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
NEXT_PUBLIC_KAKAO_APP_KEY=
NEXT_PUBLIC_KAKAO_REST_API_KEY=
```

---

## 디자인 원칙

- **따뜻하고, 재미있고, 음식이 먼저, 감성적**
- 큰 음식 사진 > 텍스트
- 애니메이션·게임 요소 적극 활용
- 모든 결과는 공유 유도 포함

---

## 라이선스

Private — All rights reserved
