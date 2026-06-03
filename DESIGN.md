# 뭐먹지 — 서비스 확장 설계 문서

## PWA란?
Progressive Web App. 웹앱을 네이티브 앱처럼 홈화면에 설치 가능.
- 앱스토어 심사 없이 배포
- 오프라인 캐시, 푸시 알림 가능
- 안드로이드/iOS 홈화면 아이콘으로 설치

---

## 신규 기능 목록

### 1. 소셜 공유
- 모임 URL 복사 (공개 모임은 링크 공유)
- 카카오톡 공유 (카카오 SDK)
- 추천 결과 공유 (식당 이름 + 지도 링크)

### 2. 방문 기록 / 즐겨찾기
- 식당 방문 기록 저장 (모임별)
- 즐겨찾기 (식당 고정)
- 재방문 여부 표시

### 3. 모임별 결정 히스토리
- 매 추천 결과 저장 (날짜 + 선택된 식당)
- 히스토리 목록 조회
- 최근 N회 방문한 식당 제외 옵션

### 4. 투표 기능
- 추천 결과에서 여러 후보 선정
- 참가자별 투표 링크 공유
- 실시간 투표 결과 집계

### 5. 리뷰/별점
- 방문 후 별점 (1~5)
- 한 줄 코멘트
- 모임 내 평균 점수 표시
- 낮은 점수 식당 추천 제외 옵션

### 6. PWA 앱 설치
- manifest.json (앱 아이콘, 이름, 색상)
- Service Worker (오프라인 캐시)
- 홈화면 설치 배너

### 7. 예약 연동
- 네이버 플레이스 예약 링크 연결
- 카카오맵 길찾기 딥링크

---

## DB 스키마 추가

```sql
-- 모임 히스토리 (추천 세션)
CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  participant_ids TEXT[], -- member id 배열
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 세션별 선택된 식당
CREATE TABLE session_picks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  restaurant_name TEXT NOT NULL,
  restaurant_address TEXT,
  restaurant_link TEXT,
  map_provider TEXT, -- 'naver' | 'kakao'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 즐겨찾기
CREATE TABLE favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  restaurant_name TEXT NOT NULL,
  restaurant_address TEXT,
  restaurant_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, restaurant_name)
);

-- 리뷰
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  restaurant_name TEXT NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 투표
CREATE TABLE votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  restaurant_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, member_id)
);
```

---

## 구현 순서 (우선순위)

### Phase 1 — 핵심 UX (1일)
1. **히스토리** — 추천 결과 저장, 최근 방문 제외
2. **즐겨찾기** — ★ 버튼으로 식당 고정
3. **리뷰/별점** — 방문 후 평점 입력

### Phase 2 — 참여형 (1일)
4. **투표** — 추천 결과에서 후보 선정 → 링크로 멤버 투표
5. **소셜 공유** — URL 복사 + 카카오톡 공유

### Phase 3 — 앱화 (0.5일)
6. **PWA** — manifest + service worker + 설치 배너

### Phase 4 — 연동 (0.5일)
7. **예약/길찾기** — 네이버/카카오 딥링크 강화

---

## 페이지 구조 변경

```
/                     홈 — 모임 목록
/groups/[id]          모임 — 탭 구조
  탭1: 추천           현재 위치 기반 맛집 추천 + 투표
  탭2: 히스토리       과거 방문 기록 + 즐겨찾기
  탭3: 멤버           멤버 관리 + 선호도
/groups/[id]/vote/[sessionId]  투표 페이지 (공유 링크)
```

---

## 수익화 연동

| 방법 | 적합 트래픽 | 예상 수익 |
|------|------------|---------|
| 구글 애드센스 | 월 5,000+ UV | 월 $5~50 |
| 카카오 플레이스 예약 CPA | 모든 트래픽 | 예약당 ₩500~2,000 |
| 네이버 플레이스 광고 | - | 클릭당 ₩50~200 |
| 프리미엄 플랜 (Stripe) | 충성 유저 | 월 ₩2,900/유저 |

**추천 수익화 순서**: 카카오 예약 연동 → PWA 배포 → 애드센스 신청 → 프리미엄

---

## 기술 스택 추가

- `next-pwa` — PWA 설정
- Kakao SDK — 소셜 공유
- `@supabase/realtime` — 실시간 투표
- `next-seo` — SEO 최적화 (애드센스 승인 조건)
