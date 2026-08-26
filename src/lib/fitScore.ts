/**
 * "이 모임에 맞는가" 를 숫자로.
 *
 * 왜 인기(리뷰·블로그·SNS) 대신 이것인가: 인기 지표는 전부 광고가 개입하는 축이고,
 * 그 축에서는 리뷰 수천만 건을 가진 곳을 이길 수 없다. 반면 "우리 모임 취향에
 * 맞는가" 는 **남이 돈으로 조작할 수 없고**, 사용자가 늘지 않아도 첫날부터 작동한다.
 * 우리 서비스는 맛집을 찾아주는 게 아니라 정해주는 것이므로 축이 여기에 있어야 맞다.
 *
 * 계산은 정직하게: 모임원 중 **몇 명의 좋아함이 이 가게 카테고리와 맞는가**.
 * 맞는 사람이 없으면 아무 숫자도 내놓지 않는다(0% 를 보여주면 가게를 깎아내리는 말이 된다).
 */

export type FitPref = {
  member_id: string;
  food_name: string;
  preference_type: "like" | "dislike";
  score?: number | null;
};

const norm = (s: string) => (s || "").replace(/\s+/g, "").toLowerCase();

/** 카테고리 문자열("음식점 > 일식 > 우동")에서 비교할 조각들 */
function categoryParts(category: string): string[] {
  return (category || "")
    .split(/[>·,]/)
    .map(p => norm(p))
    .filter(p => p.length >= 2 && p !== "음식점");
}

/** 이 이름이 가게 카테고리와 맞는가 (두 글자 이상 겹칠 때만) */
function matches(name: string, parts: string[], title: string): boolean {
  const n = norm(name);
  if (n.length < 2) return false;
  if (norm(title).includes(n)) return true;   // 가게 이름에 메뉴가 들어간 경우("역전우동")
  return parts.some(p => p.includes(n) || n.includes(p));
}

export type Fit = {
  /** 모임원 중 몇 %의 취향과 맞나 (맞는 사람이 없으면 null) */
  pct: number | null;
  /** 맞는 사람들의 member_id */
  likedBy: string[];
};

export function computeFit(
  restaurant: { title: string; category: string },
  prefs: FitPref[],
  participantIds: string[],
): Fit {
  if (participantIds.length === 0) return { pct: null, likedBy: [] };
  const parts = categoryParts(restaurant.category);

  const likedBy: string[] = [];
  for (const id of participantIds) {
    const mine = prefs.filter(p =>
      p.member_id === id &&
      (typeof p.score === "number" ? p.score > 0 : p.preference_type === "like"));
    if (mine.some(p => matches(p.food_name, parts, restaurant.title))) likedBy.push(id);
  }
  if (likedBy.length === 0) return { pct: null, likedBy: [] };
  return { pct: Math.round((likedBy.length / participantIds.length) * 100), likedBy };
}
