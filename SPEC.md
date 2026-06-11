# meogja 기능 명세서

> **사용법**: 이 문서에 새 기능을 추가하고 상태를 `[ ]`로 표시하면 구현 후 `[x]`로 업데이트됨.
> 
> 상태 표기: `[x]` 구현완료 · `[~]` 부분구현 · `[ ]` 미구현

---

## 서비스 개요

- **서비스명**: 먹자냥 (meogja)
- **슬로건**: 오늘 뭐 먹지?
- **목표**: 친구들과 메뉴를 *정하는* 서비스 (맛집 검색 아님)
- **핵심 가치**: 게임/놀이처럼 느껴지게 → "한번 눌러볼까?" 유도 → 바이럴 공유
- **URL**: https://meogja.vercel.app

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 15 App Router |
| 언어 | TypeScript (strict) |
| UI | shadcn/ui + Radix UI + Tailwind CSS v4 |
| 인증 | Supabase Auth + Google/Kakao/Naver OAuth |
| DB | Supabase (PostgreSQL + RLS) |
| 배포 | Vercel (Hobby, 100회/일) |
| 검색 API | Naver Local API + Kakao Local API |
| PWA | Service Worker + manifest.json |

---

## 인증 시스템

- [x] Google OAuth 로그인
- [x] Kakao OAuth 로그인
- [x] Naver OAuth 로그인 (커스텀 구현, `/api/auth/naver`)
- [x] Naver 로그인 후 모임 복귀 수정 (`/auth/callback?next=` 경유)
- [x] JoinModal 카카오 로그인 버튼 복원
- [x] 게스트 모드 (디바이스 ID 기반, localStorage)
- [x] 프로필 사진 업로드 + 크롭 편집기 (canvas 기반)
- [x] 아바타 선택 (먹자냥 캐릭터 46종)
- [x] 닉네임 설정
- [x] OAuth 로그인 후 pending_join 메커니즘 (모임 가입 세션 복원)
- [x] 홈 선택 메뉴 → 로그인/가입 → 모임 전환 시 preset 유지 (`meogja_preset_group_{id}` 백업)
- [x] 간편가입 ↔ 소셜 계정 연결 (linkIdentity + 충돌 시 데이터 이전)
- [x] 계정 이전 API (`/api/auth/migrate-account`): 모든 데이터 이전 후 구 계정 삭제

---

## 모임(그룹) 기능

### 모임 생성 / 관리
- [x] 모임 생성 (이름, 설명, 커버 이미지)
- [x] 공개 / 비공개 모임 (비밀번호 보호)
- [x] 모임 초대 링크 공유
- [x] 모임 삭제
- [x] 멤버 승인 시스템 (가입 신청 → 승인)
- [x] 모임 인원 제한 설정

### 멤버 관리
- [x] 멤버 참가 (자유 참가 / 승인 필요)
- [x] 비공개 모임 비밀번호 입력
- [x] 멤버 목록 조회
- [x] 멤버 강퇴

### 모임 채팅
- [x] 실시간 채팅 탭 (Supabase Realtime)
- [x] 채팅 메시지 전송 시 모임 멤버 푸시 알림

### 모임 메뉴 투표
- [x] 투표 생성 (제목, 메뉴 후보, 익명/공개, 마감시간)
- [x] 멤버 투표 참여 (메뉴 선택)
- [x] 투표 결과 실시간 표시 (바 차트, 득표수, 비율)
- [x] 공개 투표: 투표자 이름 표시
- [x] 익명 투표: 투표자 숨김
- [x] 모임장 투표 마감 처리
- [x] 만료시간 자동 마감
- [x] 투표 생성 시 모임 멤버 푸시 알림

---

## 음식 추천 시스템

- [x] 위치 기반 음식점 검색 (Naver Local API)
- [x] 위치 기반 음식점 검색 (Kakao Local API, 대체)
- [x] 주소 → 좌표 변환 (Kakao Geocode API)
- [x] 좌표 → 주소 변환 (Kakao Reverse Geocode API)
- [x] 즐겨찾기 위치 등록 / 사용
- [x] 음식 선호도 입력 (좋아함 / 싫어함)
- [x] 선호도 + 거리 기반 스코어링 알고리즘
- [x] 9개 카테고리 메뉴 분류 (고기, 국물, 일식, 양식, 치킨, 카페, 매운맛, 디저트, 중식)
- [x] 커스텀 메뉴 추가 (그룹별)
- [x] 위치 정보 헤더 통합 (`AuthHeader.tsx`) — 전 페이지 공유, `meogja_home_location` sessionStorage
- [x] 역지오코딩 주소 → Naver 검색 `location` 파라미터 전달 (지역 필터링)
- [x] 거리 표시 포맷: m 단위 정수, km 단위 소수점 1자리
- [x] 시간대 기반 추천 힌트 (새벽/아침/오전/점심/오후/저녁/야식 — 모임 추천탭 상단)
- [x] 나이대 기반 추천 힌트 (10대/20대/30대/40대+ — 프로필 age 필드 활용)
- [x] 분위기/상황 선택 → 검색 키워드 수식어 방식 (API 쿼리 앞에 modifier 텍스트 붙임)
  - 전체/전체(캐주얼): modifier 없음 (쿼리 그대로)
  - 데이트 → "분위기 좋은 {메뉴}", 비즈니스 → "정갈한 {메뉴}", 회식/모임 → "회식 {메뉴}", 혼밥 → "혼밥 {메뉴}"
- [x] 배달전용 제외 — 결과 후처리 필터링 단계 (API 검색 후 클라이언트 측)
  - 제목/카테고리에 "배달전문", "포장전문", "배달전용", "ghost kitchen" 포함 시 제거
  - 배민/쿠팡이츠는 키워드 제외 (매장 운영하면서 배달 병행하는 곳도 있어 오탈락 위험)
  - 일반 검색(searchNearby)과 추천 검색(handleRecommend) 양쪽에 모두 적용
- [x] IP 기반 레이트 리밋 (분당 10회/일당 100회, admin 설정 가능)
- [ ] AI 기반 추천 (사용 이력 학습)

---

## 투표 시스템

- [x] 기본 투표 (메뉴 선택)
- [x] 투표 결과 공유 카드 생성
- [x] 투표 이력 탭 조회
- [x] 메뉴 배틀 (1:1 토너먼트)
- [x] 월드컵 게임 (16강 → 8강 → 4강 → 결승)
- [ ] 투표 결과 실시간 동기화 (WebSocket / Supabase Realtime)
- [ ] 투표 결과 SNS 공유 이미지 자동 생성 (OG Image)

---

## 게임 / 배틀 모드

- [x] 배틀 페이지 (월드컵 / 메뉴배틀 선택)
- [x] 월드컵: 무작위 16개 메뉴 → 토너먼트
- [x] 메뉴배틀: 랜덤 1:1 매칭
- [x] 홈 Hero 카드 통합: 브랜드 이미지 제거, 위치+랜덤+AI추천+주변찾기 3버튼
- [x] "오늘의 추천" Netflix 스타일 섹션 (일치% 바, 다시 추천)
- [x] 실시간 인기 → 가로 스와이프 카드형 (🥇🥈🥉 뱃지)
- [x] 랜덤 추천 결과 → "이걸로 찾기" → 액션 시트 (모임에서 찾기 / 바로 주변 찾기)
- [x] MBTI별 음식 추천 탭 (게임탭 — 16가지 MBTI × 12개 음식 중 랜덤 4개 표시 + 새로고침)
- [x] MBTI 추천 음식 아이콘 표시 (로컬 food-icons 활용)
- [x] MBTI 프로필 저장 (user_profiles.mbti) + 게임탭 내 직접 선택 가능
- [x] 음식 랭킹 탭 (게임탭 — 월드컵 우승/선택 + 검색 + 클릭 종합 점수)
- [x] 음식 이벤트 통계 수집 (food_events — 검색/식당클릭 추적)
- [x] 월드컵 결과화면에 우승 횟수·선택 횟수 통계 표시
- [ ] 배틀 결과 리더보드
- [ ] 그룹 전체 배틀 (멤버 전원 동시 참여)

---

## 프로필 페이지

- [x] 프로필 사진 표시 (헤더)
- [x] 아바타 선택
- [x] 닉네임 편집
- [x] 내 모임 목록
- [x] 선호 음식 설정
- [x] 뱃지 시스템 (먹린이/단골손님/먹잘알/푸드파이터/먹자팟 마스터/결정왕/음식탐험가/월드컵 챔피언)
- [x] 닉네임 옆 대표 뱃지 표시 (본인 선택)
- [x] 공개 프로필 페이지 (/profile/[userId]) — 획득 뱃지 + 취향 TOP5 공개
- [ ] 내 투표 이력
- [ ] 먹은 음식 로그

---

## 리뷰 / 즐겨찾기

- [x] 음식점 즐겨찾기 추가 / 삭제
- [x] 즐겨찾기 위치 목록
- [x] 음식점 리뷰 작성 (DB 스키마 구현)
- [ ] 리뷰 목록 UI
- [ ] 리뷰 이미지 첨부
- [ ] 평점 시스템

---

## PWA / 앱 경험

- [x] PWA manifest.json
- [x] Service Worker (오프라인 캐시)
- [x] PWA 설치 배너 (홈 화면 추가 유도)
- [x] iOS Safari 대응
- [x] 삼성 브라우저 대응
- [x] Kakao WebView 앱추가 팝업 위치 수정
- [x] 푸시 알림 (투표 시작, 채팅 메시지, 쪽지 수신)
- [x] VAPID Web Push 설정 (`push_subscriptions` 테이블)
- [x] 프로필 페이지 알림 켜기/끄기 버튼

---

## 음식 아이콘 시스템

- [x] 음식 아이콘 140개 추출 (`public/food-icons/`)
  - 카테고리 아이콘 32개 (이미지1: 고기·한식·일식·중식 등)
  - 한식/아시안 요리 46개 (이미지2: 찌개·국밥·분식 등)
  - 일식/양식/중식/디저트 62개 (이미지3: 돈카스·파스타·마라탕 등)
  - 모두 200×200px RGBA PNG
- [x] 스프라이트 시트 자동 분리 스크립트 (`scripts/extract_food_icons.py`)
  - 행별 동적 컬럼 감지 (9~12열 가변 지원)
  - 레이블 텍스트 제외, 아이콘만 크롭
  - 새 스프라이트 시트 추가 시 재사용 가능
- [x] 아이콘 매핑 라이브러리 (`src/lib/foodIcons.ts`)
  - 150+ 음식명/카테고리 → 로컬 아이콘 매핑
  - 부분 일치 fallback (예: "돈가스·돈부리" → 돈카스.png)
- [x] 메뉴배틀 아이콘 교체: 이모지 → 로컬 음식 아이콘 이미지
- [x] 월드컵 게임 아이콘 교체: 이모지 → 로컬 음식 아이콘 이미지
- [x] 식당 카드 이미지: Naver 이미지 API 제거 → 로컬 아이콘으로 즉시 표시
- [ ] 월드컵: 실제 음식 사진 인터넷 스크래핑 (Step 2)

## 테마 / 디자인 시스템

- [x] 5가지 테마: cozy / pojang / modern / dark / mint
- [x] CSS 변수 기반 (`--bg`, `--text`, `--primary` 등)
- [x] 테마 스위처 (헤더)
- [x] 먹자냥 마스코트 통합 (아바타 46종, 포즈, 탭 아이콘)
- [x] 따뜻하고 재미있는 음식 중심 UX
- [ ] 다크모드 자동 감지 (시스템 설정 연동)

---

## 관리자 기능

- [x] 관리자 패널 (`/admin`)
- [x] 아바타 이미지 관리 (`/admin/images`)
- [x] 아바타 설정 저장 (용도/위치 지정, 크롭 이미지 저장 `cropped_url`)
- [x] 아바타 용도 적용: 프로필에서 `avatar` 용도만 선택 가능
- [x] 채팅 스티커 패널 DB 연동: `avatar`+`emotion` 용도 이미지 표시 (중복 없음)
- [x] 관리자 이메일 검증 (`NEXT_PUBLIC_ADMIN_EMAIL`)
- [x] 관리자 신고 관리 탭 (상태: 미처리/검토중/처리완료)
- [x] 관리자 메뉴 관리 페이지 (`/admin/menus`): 카테고리별 추가/숨김
- [x] 관리자 API 레이트 리밋 설정 (분당/일별 한도, 설정탭에서 조정)

---

## 공유 / 바이럴

- [x] 모임 초대 링크 공유
- [x] 신규 모임 초대 가이드 (모임장 혼자일 때 배너 표시)
- [x] 주변 식당 카드 → "같이 먹을 사람 구하기" 버튼 → 모임 빠른 생성 + 리다이렉트
- [x] 신고 기능: 사용자/모임 신고 (🚨 버튼, 사유 입력, meogja_cat_074 이미지)
- [x] 내 신고 내역 조회 (프로필 페이지)
- [ ] 투표 결과 카드 이미지 공유 (OG Image)
- [ ] "오늘의 메뉴" 공유 스티커
- [ ] 카카오 링크 공유
- [ ] 인스타그램 스토리 공유

---

## 데이터베이스 스키마

| 테이블 | 역할 | 상태 |
|--------|------|------|
| `groups` | 모임 정보 | ✅ |
| `members` | 사용자 프로필 | ✅ |
| `group_memberships` | 모임 멤버십 (가입 상태) | ✅ |
| `food_preferences` | 음식 선호도 | ✅ |
| `votes` | 투표 기록 | ✅ |
| `favorites` | 즐겨찾기 음식점 | ✅ |
| `favorite_locations` | 즐겨찾기 위치 | ✅ |
| `reviews` | 음식점 리뷰 | ✅ |
| `custom_menus` | 그룹 커스텀 메뉴 | ✅ |
| `menu_battles` | 메뉴 배틀 기록 | ✅ |
| `worldcup_games` | 월드컵 게임 기록 | ✅ |
| `app_settings` | 앱 전역 설정 | ✅ |
| `avatar_config` | 아바타 설정 | ✅ |
| `group_messages` | 모임 채팅 메시지 | ✅ |
| `direct_messages` | 1:1 쪽지 (DM) | ✅ |
| `menu_votes` | 모임 메뉴 투표 | ✅ |
| `menu_vote_responses` | 투표 응답 | ✅ |
| `push_subscriptions` | Web Push 구독 | ✅ |
| `rate_limits` | API 레이트 리밋 카운터 (IP+endpoint+시간창) | ✅ |

---

## API 엔드포인트

| 경로 | 메서드 | 역할 | 상태 |
|------|--------|------|------|
| `/api/auth/naver` | GET | Naver OAuth 시작 | ✅ |
| `/api/auth/naver/callback` | GET | Naver OAuth 콜백 | ✅ |
| `/api/search` | GET | Naver 음식점 검색 | ✅ |
| `/api/search-kakao` | GET | Kakao 음식점 검색 | ✅ |
| `/api/geocode` | GET | 주소 → 좌표 | ✅ |
| `/api/reverse-geocode` | GET | 좌표 → 주소 | ✅ |
| `/api/food-image` | GET | 음식 이미지 검색 | ✅ |
| `/api/kakao-clear` | GET | Kakao SDK 캐시 초기화 | ✅ |
| `/api/groups/verify` | POST | 비공개 그룹 비밀번호 검증 | ✅ |
| `/api/auth/migrate-account` | POST | 계정 데이터 이전 (간편→소셜) | ✅ |
| `/api/auth/delete-account` | DELETE | 계정 탈퇴 | ✅ |
| `/api/admin/avatar-config` | POST | 아바타 설정 저장 | ✅ |
| `/api/push/subscribe` | POST/DELETE | Web Push 구독 등록/해제 | ✅ |
| `/api/push/send` | POST | 특정 유저에게 푸시 발송 (관리자) | ✅ |
| `/api/push/notify-group` | POST | 모임 멤버 전체 푸시 발송 | ✅ |

---

## 라우트 구조

```
/                       홈 (모임 목록 + 최근 투표)
/login                  로그인 (Google / Kakao / Naver / 게스트)
/auth/callback          OAuth 콜백 처리
/groups                 모임 목록
/groups/[id]            모임 상세 (메인 기능)
/vote/[voteId]          투표 참여
/battle                 배틀 모드 (월드컵 / 메뉴배틀)
/search                 음식점 검색
/profile                프로필
/admin                  관리자 패널
/admin/images           아바타 이미지 관리
/privacy                개인정보보호 정책
```

---

## 향후 기능 (백로그)

> 아래 항목에서 구현할 기능을 골라 `[ ]` → `[x]` 로 바꾸고 요청하면 구현 진행.

- [ ] 실시간 투표 (Supabase Realtime)
- [ ] 투표 결과 OG Image 자동 생성
- [ ] 카카오링크 공유
- [ ] 푸시 알림 (투표 시작/결과)
- [ ] AI 추천 (Claude API 연동)
- [ ] 리뷰 UI + 이미지 첨부
- [ ] 배틀 리더보드
- [ ] 그룹 전체 동시 배틀
- [ ] 다크모드 시스템 자동 감지
- [ ] 인스타그램 스토리 공유
- [ ] 먹은 음식 로그 / 통계

---

*마지막 업데이트: 2026-06-10 (뱃지 시스템 — 8종 + 대표 뱃지 선택 + 공개 프로필 페이지)*
