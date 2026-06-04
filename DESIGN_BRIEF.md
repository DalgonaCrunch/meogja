# 오늘 뭐 먹지? — UI 디자인 작업 지시서

## 서비스 개요
**앱명**: 오늘 뭐 먹지?  
**URL**: https://meogja.vercel.app  
**목적**: 그룹/팀 사람들이 함께 점심/저녁 메뉴를 결정할 때 사용. 멤버별 선호/불호 음식을 저장하고, 현재 위치 기반 주변 맛집을 추천.  
**대상 사용자**: 직장인, 친구 그룹, 가족  
**기술 스택**: Next.js 15 + TypeScript + Tailwind + Supabase + Vercel  
**현재 폰트**: Jua (한글 display), Noto Sans KR (body)  
**현재 색상**:
- 배경: `#FFF9F2` (크림)
- 포인트: `#FF6B35` (오렌지)
- 텍스트: `#2D1B00`
- 카드: `#FFFFFF`

---

## 페이지 구조 & 기능

### 1. 홈 (`/`)
- 서비스 Hero 타이틀 "오늘 뭐 먹지? 🍴"
- 모임 목록 (공개/비공개 구분, 그라데이션 아이콘 카드)
- 새 모임 만들기 버튼 → 폼 (공개/비공개, 로그인 전용 옵션)
- 로그인/프로필 헤더

### 2. 모임 상세 (`/groups/[id]`)
탭 3개:

**탭1: 🍽 추천**
- 참가자 선택 (컬러 아바타 pill 버튼)
- 분위기 선택 (캐주얼/데이트/비즈니스/회식/혼밥)
- 메뉴 종류 필터 (대/중/소 3단계: 식사>한식>김치찌개)
- 검색 위치 설정 (현재위치 자동감지 or 직접 지정)
- 검색 반경 (300m~5km)
- N/K 버튼 (네이버/카카오 중 선택 or 둘다)
- 검색 모드 2가지:
  - **식당 바로 찾기**: 주변 맛집 리스트 직접
  - **메뉴 먼저 고르기**: 추천 메뉴 pill 선택 → 해당 메뉴 식당 찾기
- 결과: 식당 카드 (음식사진, 이름, 거리, 카테고리, 모임별점, 선호일치 뱃지)
- 정렬: 거리순/선호순/모임별점순/카테고리별
- 카드 버튼: ★즐겨찾기, N지도, K지도, 🌐홈페이지(있을때만)
- 🔄 재검색 / 🗳️ 투표 시작

**탭2: 📋 기록**
- 히스토리: 추천 세션 기록 (날짜, 참가자, 식당 목록)
- 즐겨찾기: 저장된 식당 ★ 목록
- 리뷰: 별점(1~5) + 코멘트 + 작성자

**탭3: 👥 멤버**
- 모임장만 멤버 추가/삭제 가능
- 각 멤버: 선호음식(초록 뱃지), 불호음식(빨간 뱃지)
- 선호도 설정: 대/중/소 카테고리 클릭 or 직접 입력
- 음식 직접입력 시 DB에 저장 (자동완성 지원)

**상단 공통**:
- ← 뒤로가기
- 모임명 (Jua 폰트, 크게)
- 👑 모임장 이름 뱃지
- 참여 중 / 미참여 상태 뱃지
- 🙌 참여하기 버튼 (미참여자)
- ✏️ 내 선호음식 설정 버튼 (참여자)
- 🔗 공유, 삭제 버튼

### 3. 참여하기 모달 (`JoinModal`)
- Bottom Sheet 형태
- 카카오 로그인 / Google 로그인 / 이름만 입력 3가지 선택
- 참여 후 → 선호도 설정 안내

### 4. 투표 페이지 (`/vote/[voteId]`)
- 이름 입력 (미로그인 시)
- 식당 후보 카드 선택 (탭)
- 투표 후 결과 화면 (막대 그래프 + 🏆 최다득표)

### 5. 로그인 (`/login`)
- 카카오 로그인 (노란 버튼, 우선)
- Google 로그인 (흰 버튼)
- 이름만 입력 (게스트)
- WebView 감지 시 외부 브라우저 안내 배너

### 6. 프로필 (`/profile`)
- 내 정보 (이름, 이메일)
- 내가 만든 모임 목록
- 참여 중인 모임 목록 + 나가기

---

## 현재 디자인 시스템 (참고)

```css
--bg: #FFF9F2         /* 크림 배경 */
--bg-card: #FFFFFF    /* 카드 */
--text: #2D1B00       /* 다크 브라운 텍스트 */
--text-muted: #8B6E52 /* 뮤트 텍스트 */
--accent: #FF6B35     /* 오렌지 포인트 */
--accent-soft: #FFF0EA
--green: #2E9E6B      /* 좋아함 색상 */
--green-soft: #E8F8F0
--red: #E53935        /* 못먹음 색상 */
--red-soft: #FDECEA
--border: #F0E4D4
```

---

## 디자인 작업 지시 프롬프트

```
You are a senior UI/UX designer. Design a complete visual identity and UI system for a Korean group meal recommendation web app called "오늘 뭐 먹지?" (What should we eat today?).

## App Context
- Purpose: Groups of friends/coworkers decide where to eat together
- Users: Korean office workers & friend groups, mobile-first
- Key flow: Select members → filter preferences → get nearby restaurant recommendations → vote → go eat
- PWA (installable on home screen)
- Tech: Next.js, inline styles (no CSS framework)

## Current State
- Font: Jua (cute, rounded Korean display font) + Noto Sans KR body
- Color: Warm cream background (#FFF9F2), orange accent (#FF6B35)
- Already implemented: all logic, need visual redesign

## Design Requirements

### 1. Overall Aesthetic
Create a distinctive, memorable design that feels:
- Warm, appetizing, food-forward
- Playful but professional enough for workplace use
- Korean-native feel, not generic western SaaS
- Mobile-first, touch-friendly
- NOT generic: avoid flat minimal SaaS, avoid generic food app look

Pick ONE strong design direction and commit fully. Options to consider:
- "Korean street food stall" — vibrant, energetic, hand-drawn touches
- "Premium restaurant menu" — sophisticated, editorial, elegant  
- "Cozy izakaya" — warm, intimate, rich textures
- Or propose your own unexpected direction

### 2. Typography
- Keep Jua for Korean headings (it's the brand font)
- Propose a complementary font pair for body/UI
- Establish clear type scale: display, heading, body, caption, label

### 3. Color System
Expand on the current warm palette:
- Primary: orange (#FF6B35) — keep this
- Build 6-8 semantic color tokens
- Ensure good contrast for accessibility
- Add depth with subtle gradients/tints

### 4. Component Design
Design these key components:

**A. Group Card (Home)**
- Shows: group name, public/private status, member count, creation date
- States: default, hover, pressed
- Special: "로그인 전용" badge variant

**B. Restaurant Result Card**
- Shows: food image/icon (60px), name, distance badge, category, preference match badge, review stars
- Buttons: ★ favorite, N map, K map, 🌐 homepage
- States: highlighted (high match score), normal

**C. Member Avatar Pills (participant selector)**
- Shows: initials avatar + name
- States: selected (colored border + tinted bg), unselected
- Each member gets a unique color

**D. Category Pills (food preference)**
- 3 levels: 대분류 → 중분류 → 소분류
- States: selected (accent), hover, default
- Like vs Dislike toggle above

**E. Join Modal (bottom sheet)**
- Bottom sheet on mobile
- Login options: KakaoTalk (yellow), Google (white+border), name-only (dashed outline)
- Friendly, welcoming tone

**F. Vote Page**
- Restaurant candidate cards (selectable)
- Results: animated progress bars, winner highlighted with trophy
- Clean and shareable aesthetic

**G. Header/Nav**
- Sticky, blur backdrop
- Logo: "오늘 뭐 먹지?" in Jua
- Auth state: login button or user avatar

### 5. Mobile UX Patterns
- Bottom navigation or tab bar for the 3 tabs in group page
- Swipe-friendly cards
- Touch targets minimum 44px
- Bottom sheets for modals (not center dialogs on mobile)
- Floating action button consideration

### 6. Micro-interactions
- Button press feedback (scale down on tap)
- Card hover lift with shadow
- Preference pill color pop on toggle
- Restaurant card slide-in on results load
- Vote result bar animate-in

### 7. Empty States & Loading
- Design friendly empty states for: no groups, no members, no results, no history
- Loading skeleton for restaurant cards

## Deliverables
1. CSS design token system (variables)
2. Updated globals.css with new design system
3. Redesigned components for the 6 key components above
4. Color + typography documentation

## Constraints
- Inline styles (no Tailwind classes needed)
- Korean language UI
- Keep Jua font for display headings
- Keep orange as primary accent
- Must work on both iOS Safari and Android Chrome
```

---

## 현재 실제 앱 URL
https://meogja.vercel.app

## GitHub
https://github.com/DalgonaCrunch/meogja
