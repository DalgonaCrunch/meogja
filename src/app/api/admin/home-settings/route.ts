import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export interface HomeSettings {
  // 섹션 표시 여부
  show_roulette: boolean;
  show_battle: boolean;
  show_ranking: boolean;
  show_trending_bar: boolean;
  // 추천 가중치 (0~100, 100=최대 효과)
  weight_time: number;
  weight_age: number;
  weight_weather: number;
  weight_trend: number;
  weight_app: number;
  weight_nearby_search: number;
  // 수동 고정 메뉴 (최대 3개, 빈 배열=사용 안 함)
  pinned_menus: string[];
}

export const DEFAULT_HOME_SETTINGS: HomeSettings = {
  show_roulette: true,
  show_battle: true,
  show_ranking: true,
  show_trending_bar: true,
  weight_time: 100,
  weight_age: 100,
  weight_weather: 100,
  weight_trend: 100,
  weight_app: 100,
  weight_nearby_search: 100,
  pinned_menus: [],
};

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  const supabase = getAdmin();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "home_settings")
    .single();

  if (data?.value) {
    try {
      return NextResponse.json({ ...DEFAULT_HOME_SETTINGS, ...JSON.parse(data.value) });
    } catch { /* fall through */ }
  }
  return NextResponse.json(DEFAULT_HOME_SETTINGS);
}

export async function POST(req: NextRequest) {
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const authHeader = req.headers.get("x-admin-email");
  if (!adminEmail || authHeader !== adminEmail) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const supabase = getAdmin();
  const body = await req.json();
  const merged: HomeSettings = { ...DEFAULT_HOME_SETTINGS, ...body };

  await supabase.from("app_settings").upsert(
    { key: "home_settings", value: JSON.stringify(merged) },
    { onConflict: "key" }
  );

  return NextResponse.json({ ok: true });
}
