export type ThemeId = "cozy" | "pojang" | "modern" | "dark" | "mint" | "ocean";

export const THEMES: Record<ThemeId, { label: string; preview: string; themeColor: string; vars: Record<string, string> }> = {
  cozy: {
    label: "🧡 따뜻한",
    preview: "#FF7A45",
    themeColor: "#FF7A45",
    vars: {
      "--bg": "#FFF8F1", "--bg-2": "#FFF1E8", "--surface": "#FFFFFF",
      "--text": "#2B2B2B", "--text-2": "#7A7A7A", "--text-3": "#ADADAD",
      "--primary": "#FF7A45", "--primary-light": "#FFF1E8",
      "--border": "#F0E6DC", "--border-2": "#E8DACE",
      "--hero-gradient": "linear-gradient(135deg, #FF6B1A 0%, #FF9A45 60%, #FFB347 100%)",
      "--hero-shadow": "rgba(255,107,26,.40)",
    },
  },
  pojang: {
    label: "🍻 활기찬",
    preview: "#E85D04",
    themeColor: "#E85D04",
    vars: {
      "--bg": "#FFF4E6", "--bg-2": "#FFE6CC", "--surface": "#FFFDFB",
      "--text": "#2A1400", "--text-2": "#9A6A3C", "--text-3": "#C39A6E",
      "--primary": "#E85D04", "--primary-light": "#FFEBD9",
      "--border": "#F4DCC0", "--border-2": "#E8C49E",
      "--hero-gradient": "linear-gradient(135deg, #E85D04 0%, #FF8000 60%, #FFA040 100%)",
      "--hero-shadow": "rgba(232,93,4,.40)",
    },
  },
  modern: {
    label: "🖤 모던",
    preview: "#1B1813",
    themeColor: "#1B1813",
    vars: {
      "--bg": "#FAFAF7", "--bg-2": "#F0EEE8", "--surface": "#FFFFFF",
      "--text": "#1B1813", "--text-2": "#857F73", "--text-3": "#ABA493",
      "--primary": "#1B1813", "--primary-light": "#F0EEE8",
      "--border": "#ECE7DC", "--border-2": "#E0DACB",
      "--hero-gradient": "linear-gradient(135deg, #2C2C2C 0%, #4A4035 100%)",
      "--hero-shadow": "rgba(27,24,19,.40)",
    },
  },
  dark: {
    label: "🌙 다크",
    preview: "#FF7A45",
    themeColor: "#1A1A1A",
    vars: {
      "--bg": "#1A1A1A", "--bg-2": "#242424", "--surface": "#2C2C2C",
      "--text": "#F0F0F0", "--text-2": "#A0A0A0", "--text-3": "#606060",
      "--primary": "#FF7A45", "--primary-light": "#3D2519",
      "--border": "#383838", "--border-2": "#404040",
      "--hero-gradient": "linear-gradient(135deg, #CC4A00 0%, #FF6B1A 60%, #FF9A45 100%)",
      "--hero-shadow": "rgba(255,122,69,.30)",
    },
  },
  mint: {
    label: "🌿 민트",
    preview: "#2E9E6B",
    themeColor: "#2E9E6B",
    vars: {
      "--bg": "#F0FAF5", "--bg-2": "#E0F5EA", "--surface": "#FFFFFF",
      "--text": "#0D2E1E", "--text-2": "#4A7A5E", "--text-3": "#8AB09C",
      "--primary": "#2E9E6B", "--primary-light": "#E0F5EA",
      "--border": "#C8E8D8", "--border-2": "#B8DCC8",
      "--hero-gradient": "linear-gradient(135deg, #1A8A50 0%, #2EBF7A 60%, #40D490 100%)",
      "--hero-shadow": "rgba(46,158,107,.40)",
    },
  },
  ocean: {
    label: "🌊 오션",
    preview: "#1A6EBF",
    themeColor: "#1A6EBF",
    vars: {
      "--bg": "#F0F6FF", "--bg-2": "#E0EEFF", "--surface": "#FFFFFF",
      "--text": "#0D1F3C", "--text-2": "#4A6A9A", "--text-3": "#8AAAC8",
      "--primary": "#1A6EBF", "--primary-light": "#E0EEFF",
      "--border": "#C8DCEE", "--border-2": "#B0CADE",
      "--hero-gradient": "linear-gradient(135deg, #0A4F9A 0%, #1A7FD4 60%, #3AAEF0 100%)",
      "--hero-shadow": "rgba(26,110,191,.40)",
    },
  },
};

const THEME_KEY = "meogja_theme";

export function applyTheme(id: ThemeId) {
  const theme = THEMES[id];
  if (!theme) return;
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  // 브라우저 상단 status bar 색상 동적 변경
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute("content", theme.themeColor);
  localStorage.setItem(THEME_KEY, id);
}

export function loadSavedTheme() {
  if (typeof window === "undefined") return;
  const saved = localStorage.getItem(THEME_KEY) as ThemeId | null;
  if (saved && THEMES[saved]) applyTheme(saved);
}

export function getSavedTheme(): ThemeId {
  if (typeof window === "undefined") return "cozy";
  return (localStorage.getItem(THEME_KEY) as ThemeId) || "cozy";
}
