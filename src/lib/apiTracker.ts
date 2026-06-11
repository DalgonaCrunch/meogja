import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function dateKeys() {
  const now = new Date();
  return {
    day: now.toISOString().slice(0, 10),
    month: now.toISOString().slice(0, 7),
  };
}

export function trackApiUsage(apiName: string): void {
  const { day, month } = dateKeys();
  const admin = getAdmin();
  const keys = [`${apiName}_daily_${day}`, `${apiName}_monthly_${month}`];

  keys.forEach(async (key) => {
    try {
      const { data } = await admin.from("app_settings").select("value").eq("key", key).single();
      const current = parseInt(String(data?.value || "0")) || 0;
      await admin.from("app_settings").upsert(
        { key, value: String(current + 1) },
        { onConflict: "key" }
      );
    } catch { /* non-blocking */ }
  });
}

export type ApiStat = {
  name: string;
  label: string;
  dailyUsed: number;
  dailyLimit: number | null;
  monthlyUsed: number;
  monthlyLimit: number | null;
  usages: string[];
};

const API_LIMITS: Record<string, { label: string; dailyLimit: number | null; monthlyLimit: number | null; usages: string[] }> = {
  kakao:        { label: "카카오 로컬 API",       dailyLimit: 300000, monthlyLimit: null, usages: ["주변맛집 (카카오 설정 시)", "주변식당찾기 (카카오 설정 시)", "주소 역지오코딩"] },
  naver_search: { label: "네이버 지역검색 API",   dailyLimit: 25000,  monthlyLimit: null, usages: ["주변식당찾기 (네이버 설정 시)"] },
  naver_image:  { label: "네이버 이미지검색 API", dailyLimit: 25000,  monthlyLimit: null, usages: ["식당 카드 이미지 (주변맛집, 주변식당찾기)"] },
  naver_trends: { label: "네이버 데이터랩 API",   dailyLimit: 1000,   monthlyLimit: null, usages: ["홈화면 트렌딩 메뉴 차트", "추천 알고리즘 가중치"] },
  google_places:{ label: "Google Places API",     dailyLimit: null,   monthlyLimit: 3000, usages: ["주변맛집 (구글 설정 시)", "주변식당찾기 (구글 설정 시)"] },
};

export async function getApiStats(): Promise<ApiStat[]> {
  const { day, month } = dateKeys();
  const admin = getAdmin();

  const allKeys = Object.keys(API_LIMITS).flatMap(name => [
    `${name}_daily_${day}`,
    `${name}_monthly_${month}`,
  ]);

  const { data } = await admin.from("app_settings").select("key, value").in("key", allKeys);
  const map: Record<string, number> = {};
  (data || []).forEach((r: { key: string; value: string }) => {
    map[r.key] = parseInt(String(r.value)) || 0;
  });

  const monthlyLimitSetting = await admin.from("app_settings").select("value").eq("key", "google_places_monthly_limit").single();
  const googleMonthlyLimit = parseInt(String(monthlyLimitSetting.data?.value || "3000")) || 3000;

  return Object.entries(API_LIMITS).map(([name, info]) => ({
    name,
    label: info.label,
    dailyUsed: map[`${name}_daily_${day}`] || 0,
    dailyLimit: info.dailyLimit,
    monthlyUsed: map[`${name}_monthly_${month}`] || 0,
    monthlyLimit: name === "google_places" ? googleMonthlyLimit : info.monthlyLimit,
    usages: info.usages,
  }));
}
