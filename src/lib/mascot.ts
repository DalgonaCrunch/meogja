// 먹자냥 이미지 카탈로그

export const MASCOT_NAME = "먹자냥";

// 아바타 목록 (얼굴 표정) — 총 46개
export const AVATAR_COUNT = 46;
export function avatarUrl(n: number) {
  return `/mascot/avatars/cat-${String(n).padStart(2,"0")}.png`;
}
export const ALL_AVATARS = Array.from({ length: AVATAR_COUNT }, (_, i) => avatarUrl(i + 1));

// 기본 노출 아바타 (처음 보여줄 12개)
export const DEFAULT_AVATARS = ALL_AVATARS.slice(0, 12);

// 탭 아이콘
export const TAB_ICONS = {
  home:      "/mascot/tabs/home.png",
  community: "/mascot/tabs/community.png",
  game:      "/mascot/tabs/game.png",
  profile:   "/mascot/tabs/profile.png",
  event:     "/mascot/tabs/event.png",
  search:    "/mascot/tabs/search.png",
  notes:     "/mascot/tabs/notes.png",
  chat:      "/mascot/tabs/chat.png",
  discount:  "/mascot/tabs/discount.png",
  warning:   "/mascot/tabs/warning.png",
};

// 포즈 (손흔들기 등)
export const POSE_WAVE = "/mascot/poses/wave-01.png";
export const HANDSUP_POSES = Array.from({ length: 7 }, (_, i) => `/mascot/poses/handsup-${String(i+2).padStart(2,"0")}.png`);

// UI 아이콘
export const UI_LOCATION = "/mascot/ui/location.png";
