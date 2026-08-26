import { FoodPreference } from "./supabase";
import { expandDislikes } from "./ingredients";

export type MenuItem = {
  name: string;
  large: string;
  medium: string;
};

export type MediumCategory = {
  name: string;
  items: string[];
};

export type LargeCategory = {
  name: string;
  medium: MediumCategory[];
};

export const MENU_DATA: LargeCategory[] = [
  {
    name: "식사",
    medium: [
      {
        name: "한식",
        items: [
          "김치찌개", "된장찌개", "순두부찌개", "부대찌개", "청국장",
          "비빔밥", "돌솥비빔밥", "콩나물밥", "쌈밥",
          "불고기", "제육볶음", "닭갈비", "낙지볶음", "오징어볶음", "소불고기",
          "삼겹살", "목살", "항정살", "갈비",
          "냉면", "물냉면", "비빔냉면", "막국수",
          "칼국수", "수제비", "떡국", "만둣국", "설렁탕", "갈비탕", "곰탕", "육개장", "해장국", "감자탕", "순대국",
          "보쌈", "족발", "수육",
          "삼계탕", "백숙",
          "생선구이", "고등어조림", "갈치조림", "조기구이",
          "두부김치", "김치전", "파전", "해물파전", "빈대떡",
          "국밥", "돼지국밥", "소머리국밥",
        ],
      },
      {
        name: "중식",
        items: [
          "짜장면", "짬뽕", "볶음밥", "짬뽕밥",
          "탕수육", "깐풍기", "깐소새우", "유린기",
          "마파두부", "양장피", "유산슬", "팔보채",
          "마라탕", "마라샹궈", "훠궈", "딤섬", "마라롱샤",
          "중화비빔밥", "삼선볶음밥",
        ],
      },
      {
        name: "일식",
        items: [
          "초밥", "사시미", "오마카세",
          "라멘", "쇼유라멘", "미소라멘", "돈코츠라멘", "츠케멘",
          "우동", "소바", "냉우동",
          "돈카츠", "카츠동", "오야코동", "규동", "텐동",
          "오코노미야끼", "타코야끼",
          "스키야키", "샤부샤부",
          "카레", "일본카레",
          "롤", "캘리포니아롤",
        ],
      },
      {
        name: "양식",
        items: [
          "파스타", "크림파스타", "토마토파스타", "봉골레파스타", "까르보나라",
          "피자", "마르게리타", "페퍼로니피자",
          "스테이크", "립스테이크", "안심스테이크", "등심스테이크",
          "햄버거", "치즈버거", "베이컨버거",
          "리조또", "샐러드", "시저샐러드",
          "수프", "클램차우더", "미네스트로네",
          "브런치", "에그베네딕트", "오믈렛", "프렌치토스트",
          "샌드위치", "BLT", "클럽샌드위치",
          "그라탱", "라자냐", "뇨키",
        ],
      },
      {
        name: "동남아식",
        items: [
          "쌀국수", "분짜", "반미", "월남쌈",
          "팟타이", "카오팟", "나시고렝", "팟씨유",
          "그린카레", "레드카레", "마사만카레",
          "똠얌꿍", "쏨땀",
          "반쎄오", "분보후에",
          "나시르막", "미고렝",
        ],
      },
      {
        name: "분식",
        items: [
          "떡볶이", "로제떡볶이", "크림떡볶이", "궁중떡볶이",
          "순대", "순대볶음",
          "라면", "신라면", "짜파게티",
          "김밥", "참치김밥", "치즈김밥", "야채김밥",
          "튀김", "오징어튀김", "고구마튀김",
          "어묵", "어묵탕",
          "핫도그", "옥수수핫도그",
          "토스트",
        ],
      },
      {
        name: "패스트푸드",
        items: [
          "치킨버거", "맥도날드", "롯데리아", "버거킹",
          "타코", "부리토",
          "서브웨이",
          "케밥",
        ],
      },
      {
        name: "인도/중동식",
        items: [
          "인도카레", "버터치킨카레", "난",
          "비리야니", "탄두리치킨",
          "팔라펠", "후무스",
          "샤와르마",
        ],
      },
    ],
  },
  {
    name: "술안주",
    medium: [
      {
        name: "치킨/닭",
        items: [
          "후라이드치킨", "양념치킨", "간장치킨", "마늘치킨", "파닭",
          "닭발", "닭꼬치", "닭강정",
          "순살치킨", "반반치킨",
        ],
      },
      {
        name: "고기류",
        items: [
          "삼겹살", "목살", "갈비", "양꼬치",
          "곱창", "막창", "대창", "소곱창",
          "항정살", "가브리살",
          "스테이크", "육회",
        ],
      },
      {
        name: "해산물",
        items: [
          "회", "광어회", "연어회", "참치회",
          "초밥", "해산물모듬",
          "조개구이", "새우구이", "꼴뚜기", "낙지",
          "킹크랩", "대게", "랍스터",
          "해물탕", "매운탕",
        ],
      },
      {
        name: "안주류",
        items: [
          "피자", "치즈피자",
          "감자튀김", "치즈볼", "포테이토스킨",
          "나초", "팝콘치킨",
          "두부김치", "김치전", "파전",
          "과자안주", "견과류",
          "족발", "보쌈",
          "편의점안주",
        ],
      },
    ],
  },
  {
    name: "디저트",
    medium: [
      {
        name: "빵/케이크",
        items: [
          "크로와상", "베이글", "소금빵", "마들렌", "휘낭시에",
          "케이크", "티라미수", "치즈케이크", "크레이프케이크",
          "마카롱", "에클레어", "슈크림",
          "도넛", "시나몬롤",
          "와플", "팬케이크",
        ],
      },
      {
        name: "아이스크림/빙수",
        items: [
          "아이스크림", "소프트아이스크림", "젤라또",
          "빙수", "팥빙수", "망고빙수", "딸기빙수",
          "설빙", "쉐이크", "프라푸치노",
        ],
      },
      {
        name: "한식디저트",
        items: [
          "떡", "인절미", "약식", "경단",
          "식혜", "수정과", "호떡",
          "붕어빵", "계란빵", "국화빵",
          "약과", "강정",
        ],
      },
      {
        name: "과일/건강",
        items: [
          "과일샐러드", "아사이볼",
          "그래놀라", "요거트",
          "스무디",
        ],
      },
    ],
  },
  {
    name: "카페/음료",
    medium: [
      {
        name: "커피",
        items: [
          "아메리카노", "라떼", "카푸치노", "플랫화이트",
          "에스프레소", "콜드브루", "더치커피",
          "바닐라라떼", "카라멜마끼아또", "모카",
        ],
      },
      {
        name: "논커피",
        items: [
          "녹차라떼", "말차라떼", "유자차", "캐모마일",
          "아이스티", "레모네이드", "에이드",
          "초코라떼", "딸기라떼",
          "스무디", "주스",
        ],
      },
      {
        name: "카페음식",
        items: [
          "샌드위치", "크로크무슈", "아보카도토스트",
          "스콘", "쿠키", "브라우니",
        ],
      },
    ],
  },
];

export function getAllLargeCategories(): string[] {
  return MENU_DATA.map((l) => l.name);
}

export function getMediumCategories(large: string): string[] {
  return MENU_DATA.find((l) => l.name === large)?.medium.map((m) => m.name) ?? [];
}

export function getMenuItems(large: string, medium: string): string[] {
  return (
    MENU_DATA.find((l) => l.name === large)
      ?.medium.find((m) => m.name === medium)
      ?.items ?? []
  );
}

// 카테고리 이름에 속하는 모든 하위 항목 반환 (대분류→모든 중+소, 중분류→모든 소)
export function getCategorySubItems(name: string): string[] {
  const items: string[] = [];
  for (const large of MENU_DATA) {
    if (large.name === name) {
      for (const medium of large.medium) {
        items.push(medium.name);
        items.push(...medium.items);
      }
      return items;
    }
    for (const medium of large.medium) {
      if (medium.name === name) {
        items.push(...medium.items);
        return items;
      }
    }
  }
  return items;
}

export function getAllMenuItems(): string[] {
  const items: string[] = [];
  for (const large of MENU_DATA) {
    for (const medium of large.medium) {
      items.push(...medium.items);
    }
  }
  return [...new Set(items)];
}

export function getAllMediumCategories(): string[] {
  const cats: string[] = [];
  for (const large of MENU_DATA) {
    cats.push(...large.medium.map((m) => m.name));
  }
  return cats;
}

export function getAllCategories(): string[] {
  return [...getAllLargeCategories(), ...getAllMediumCategories()];
}

/* ── 점수 약속 (마이그레이션 20260826000001 과 같은 값) ────────────────
   +3 최고 / +2 좋아 / -1 별로 / -9 못 먹음. -5 이하는 "아예 제외". */
const HARD_LIMIT = -5;
const DEFAULT_LIKE = 2;
const DEFAULT_DISLIKE = -9;

function prefScore(p: FoodPreference): number {
  if (typeof p.score === "number") return p.score;
  return p.preference_type === "dislike" ? DEFAULT_DISLIKE : DEFAULT_LIKE; // 옛 행
}

/** 문자열 → 32비트 해시. 같은 씨앗이면 같은 순서가 나오게 하는 데 쓴다. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — 씨앗이 같으면 늘 같은 수열. Math.random 을 비교 함수 안에서
 *  쓰면 안 된다(비교가 흔들려 정렬 결과가 엔진에 따라 달라지고, 새로 그릴 때마다
 *  순서가 바뀌어 사용자가 신뢰를 잃는다). */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Recommendation = {
  menu: string;
  large: string;
  medium: string;
  score: number;
  likedByIds: string[];
  /** 참여자 전원이 좋아하는가 */
  likedByAll: boolean;
};

export type RecommendResult = {
  items: Recommendation[];
  /** 제외 조건이 너무 세서 아무것도 안 남아 어쩔 수 없이 되살린 경우 */
  relaxed: boolean;
  /** 제외로 사라진 후보 수 (안내 문구용) */
  excludedCount: number;
};

/**
 * 모임원들의 선호로 메뉴를 고른다.
 *
 * 규칙:
 *  1. 누구든 **못 먹는 것(-5 이하)** 은 먼저 뺀다. 재료로 표시한 것은 `expandDislikes`
 *     가 실제 메뉴 목록으로 펼친다(마라 → 마라탕·마라샹궈·훠궈…).
 *  2. 좋아함은 **구체적인 쪽에 무게를 더** 준다(메뉴 x3 / 중분류 x2 / 대분류 x1).
 *     예전에는 "한식 좋아요" 와 "김치찌개 좋아요" 가 같은 1점이었다.
 *  3. **전원이 좋아하는 것**을 먼저 올린다. 그다음 점수.
 *  4. 같은 입력에 늘 같은 1등만 나오지 않도록 아주 작은 흔들림을 준다. 단 씨앗을
 *     받아서 흔든다 — 같은 씨앗이면 결과가 같다(새로고침해도 순서가 안 바뀐다).
 *  5. 다 빼서 아무것도 안 남으면 빈 화면 대신 되살려 주고 `relaxed` 로 알린다.
 */
export function getRecommendationsDetailed(
  preferences: FoodPreference[],
  participantIds: string[],
  count: number = 5,
  seed?: string
): RecommendResult {
  const participantPrefs = preferences.filter((p) => participantIds.includes(p.member_id));

  // 1. 못 먹는 것 — 이름을 실제 메뉴로 펼친다
  const dislikeNames = participantPrefs.filter(p => prefScore(p) <= HARD_LIMIT).map(p => p.food_name);
  const { hard, soft } = expandDislikes(dislikeNames);
  // 별로(-1 등)는 빼지 않고 점수만 깎는다
  const mildPenalty = new Map<string, number>();
  participantPrefs
    .filter(p => { const s = prefScore(p); return s < 0 && s > HARD_LIMIT; })
    .forEach(p => mildPenalty.set(p.food_name, (mildPenalty.get(p.food_name) ?? 0) + 1));

  // 2. 좋아함 — 이름별로 누가 좋아하는지 + 세기
  type Like = { by: Set<string>; sum: number };
  const likes: Record<string, Like> = {};
  participantPrefs.filter(p => prefScore(p) > 0).forEach(p => {
    const e = likes[p.food_name] ?? (likes[p.food_name] = { by: new Set(), sum: 0 });
    e.by.add(p.member_id);
    e.sum += prefScore(p);
  });

  const rand = seededRandom(hashSeed(seed ?? participantIds.join(",")));
  const items: Recommendation[] = [];
  let excludedCount = 0;

  for (const large of MENU_DATA) {
    for (const medium of large.medium) {
      for (const menu of medium.items) {
        if (hard.has(menu) || hard.has(medium.name) || hard.has(large.name)) { excludedCount++; continue; }

        const lMenu = likes[menu], lMed = likes[medium.name], lLarge = likes[large.name];
        const likedBy = new Set<string>([
          ...(lMenu?.by ?? []), ...(lMed?.by ?? []), ...(lLarge?.by ?? []),
        ]);
        // 구체적인 쪽에 무게를 더 준다
        let score = (lMenu?.sum ?? 0) * 3 + (lMed?.sum ?? 0) * 2 + (lLarge?.sum ?? 0);
        score -= (mildPenalty.get(menu) ?? 0) * 3;
        score -= (mildPenalty.get(medium.name) ?? 0) * 2;
        score -= (mildPenalty.get(large.name) ?? 0);
        score -= (soft.get(menu) ?? 0) * 1.5; // 양파·마늘처럼 흔한 재료는 뒤로만 밀기

        items.push({
          menu, large: large.name, medium: medium.name,
          score, likedByIds: Array.from(likedBy),
          likedByAll: participantIds.length > 0 && likedBy.size === participantIds.length,
        });
      }
    }
  }

  // 4. 흔들림은 정렬 전에 한 번만 계산한다(비교 함수 안에서 난수를 쓰면 안 된다)
  const jitter = new Map<string, number>();
  items.forEach(it => jitter.set(it.menu, rand() * 1.2));

  const sorted = [...items].sort((a, b) => {
    if (a.likedByAll !== b.likedByAll) return a.likedByAll ? -1 : 1;
    const sa = a.score + (jitter.get(a.menu) ?? 0);
    const sb = b.score + (jitter.get(b.menu) ?? 0);
    return sb - sa;
  });

  // 5. 다 빠졌으면 빈 화면 대신 되살린다
  if (sorted.length === 0) {
    const fallback: Recommendation[] = [];
    for (const large of MENU_DATA) {
      for (const medium of large.medium) {
        for (const menu of medium.items) {
          fallback.push({ menu, large: large.name, medium: medium.name, score: 0, likedByIds: [], likedByAll: false });
        }
      }
    }
    fallback.sort(() => rand() - 0.5);
    return { items: fallback.slice(0, count), relaxed: true, excludedCount };
  }

  return { items: sorted.slice(0, count), relaxed: false, excludedCount };
}

/** 예전 형태 그대로 쓰는 화면을 위한 얇은 껍데기 */
export function getRecommendations(
  preferences: FoodPreference[],
  participantIds: string[],
  count: number = 5,
  seed?: string
): { menu: string; large: string; medium: string; score: number; likedByIds: string[] }[] {
  return getRecommendationsDetailed(preferences, participantIds, count, seed).items;
}
