import { FoodPreference } from "./supabase";

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

export function getRecommendations(
  preferences: FoodPreference[],
  participantIds: string[],
  count: number = 5
): { menu: string; large: string; medium: string; score: number; likedByIds: string[] }[] {
  const participantPrefs = preferences.filter((p) =>
    participantIds.includes(p.member_id)
  );

  const dislikes = new Set(
    participantPrefs
      .filter((p) => p.preference_type === "dislike")
      .map((p) => p.food_name)
  );

  const likesByFood: Record<string, Set<string>> = {};
  participantPrefs
    .filter((p) => p.preference_type === "like")
    .forEach((p) => {
      if (!likesByFood[p.food_name]) likesByFood[p.food_name] = new Set();
      likesByFood[p.food_name].add(p.member_id);
    });

  const candidates: { menu: string; large: string; medium: string; score: number; likedByIds: string[] }[] = [];

  for (const large of MENU_DATA) {
    if (dislikes.has(large.name)) continue;
    for (const medium of large.medium) {
      if (dislikes.has(medium.name)) continue;
      for (const menu of medium.items) {
        if (dislikes.has(menu)) continue;
        const likedByIds = Array.from(new Set([
          ...(likesByFood[menu] ?? []),
          ...(likesByFood[medium.name] ?? []),
          ...(likesByFood[large.name] ?? []),
        ])).filter(id => participantIds.includes(id));
        candidates.push({ menu, large: large.name, medium: medium.name, score: likedByIds.length, likedByIds });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score || Math.random() - 0.5);
  return candidates.slice(0, count);
}
