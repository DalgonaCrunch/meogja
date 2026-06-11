export type Badge = {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  rarity: "common" | "rare" | "epic";
};

export const BADGES: Badge[] = [
  { id: "beginner",    emoji: "🍼", name: "먹린이",       desc: "첫 번째 투표 참여",       rarity: "common" },
  { id: "regular",     emoji: "🍽️", name: "단골손님",     desc: "모임 5회 참여",            rarity: "common" },
  { id: "expert",      emoji: "🧠", name: "먹잘알",       desc: "투표 20회 참여",           rarity: "rare"   },
  { id: "fighter",     emoji: "💪", name: "푸드파이터",   desc: "투표 50회 참여",           rarity: "epic"   },
  { id: "creator",     emoji: "👑", name: "먹자팟 마스터", desc: "모임 3개 직접 만들기",    rarity: "rare"   },
  { id: "decider",     emoji: "🎯", name: "결정왕",       desc: "결정 투표 10회 만들기",    rarity: "rare"   },
  { id: "foodie",      emoji: "🌮", name: "음식탐험가",   desc: "10가지 음식 선호도 등록",  rarity: "common" },
  { id: "worldcup",    emoji: "🏆", name: "월드컵 챔피언", desc: "음식 월드컵 10회 완료",   rarity: "rare"   },
];

export const BADGE_MAP = Object.fromEntries(BADGES.map(b => [b.id, b]));

export function getBadge(id: string): Badge | undefined {
  return BADGE_MAP[id];
}

export const RARITY_COLOR: Record<string, string> = {
  common: "var(--text-3)",
  rare:   "var(--primary)",
  epic:   "#a855f7",
};
