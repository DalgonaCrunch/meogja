import { FoodPreference } from "./supabase";

const MENU_CATEGORIES: Record<string, string[]> = {
  한식: ["김치찌개", "된장찌개", "비빔밥", "불고기", "삼겹살", "냉면", "칼국수", "떡볶이", "김밥", "제육볶음", "순두부찌개", "갈비탕", "설렁탕", "닭갈비", "보쌈"],
  중식: ["짜장면", "짬뽕", "탕수육", "마파두부", "볶음밥", "양장피", "깐풍기", "마라탕", "훠궈"],
  일식: ["초밥", "라멘", "우동", "돈카츠", "사시미", "오코노미야끼", "카레", "규동", "소바"],
  양식: ["파스타", "피자", "스테이크", "햄버거", "리조또", "샌드위치", "샐러드"],
  분식: ["떡볶이", "순대", "라면", "김밥", "튀김", "어묵"],
  동남아: ["쌀국수", "팟타이", "카오팟", "나시고렝", "분짜", "반미"],
  기타: ["치킨", "족발", "곱창", "삼계탕", "해물탕", "수제비"],
};

export function getRecommendations(
  preferences: FoodPreference[],
  participantIds: string[],
  count: number = 5
): { menu: string; category: string; score: number }[] {
  const participantPrefs = preferences.filter((p) =>
    participantIds.includes(p.member_id)
  );

  const dislikes = new Set(
    participantPrefs
      .filter((p) => p.preference_type === "dislike")
      .map((p) => p.food_name)
  );

  const likeCounts: Record<string, number> = {};
  participantPrefs
    .filter((p) => p.preference_type === "like")
    .forEach((p) => {
      likeCounts[p.food_name] = (likeCounts[p.food_name] || 0) + 1;
    });

  const candidates: { menu: string; category: string; score: number }[] = [];

  for (const [category, menus] of Object.entries(MENU_CATEGORIES)) {
    for (const menu of menus) {
      if (dislikes.has(menu) || dislikes.has(category)) continue;
      const score = likeCounts[menu] || likeCounts[category] || 0;
      candidates.push({ menu, category, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score || Math.random() - 0.5);

  return candidates.slice(0, count);
}

export function getAllMenuItems(): string[] {
  const items: string[] = [];
  for (const menus of Object.values(MENU_CATEGORIES)) {
    items.push(...menus);
  }
  return [...new Set(items)];
}

export function getAllCategories(): string[] {
  return Object.keys(MENU_CATEGORIES);
}
