import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const supabase = getClient();
  // 월드컵 우승 횟수
  const { data: winsRaw } = await supabase
    .from("worldcup_selections")
    .select("winner")
    .eq("is_final", true);

  // 월드컵 전체 선택 횟수
  const { data: selectsRaw } = await supabase
    .from("worldcup_selections")
    .select("winner");

  // 검색 횟수
  const { data: searchRaw } = await supabase
    .from("food_events")
    .select("food_name")
    .eq("event_type", "search");

  // 식당 클릭 횟수
  const { data: clickRaw } = await supabase
    .from("food_events")
    .select("food_name")
    .eq("event_type", "restaurant_click");

  // 맛집찾기 실행 횟수
  const { data: nearbySearchRaw } = await supabase
    .from("food_events")
    .select("food_name")
    .eq("event_type", "nearby_search");

  // weight_nearby_search 계수 로드
  let nearbySearchCoef = 2;
  try {
    const { data: settingsRow } = await supabase.from("app_settings").select("value").eq("key", "home_settings").single();
    if (settingsRow?.value) {
      const s = JSON.parse(settingsRow.value);
      if (typeof s.weight_nearby_search === "number") nearbySearchCoef = s.weight_nearby_search / 100 * 2;
    }
  } catch { /* use default */ }

  function tally(rows: { winner?: string; food_name?: string }[] | null, key: "winner" | "food_name") {
    const m: Record<string, number> = {};
    for (const r of rows ?? []) {
      const n = r[key];
      if (n) m[n] = (m[n] || 0) + 1;
    }
    return m;
  }

  const wins = tally(winsRaw as { winner: string }[], "winner");
  const selects = tally(selectsRaw as { winner: string }[], "winner");
  const searches = tally(searchRaw as { food_name: string }[], "food_name");
  const clicks = tally(clickRaw as { food_name: string }[], "food_name");
  const nearbySearches = tally(nearbySearchRaw as { food_name: string }[], "food_name");

  // 종합 스코어 (가중치: 우승 5점, 선택 2점, 검색 1점, 클릭 3점, 맛집찾기 계수×2점)
  const allFoods = new Set([
    ...Object.keys(wins),
    ...Object.keys(selects),
    ...Object.keys(searches),
    ...Object.keys(clicks),
    ...Object.keys(nearbySearches),
  ]);

  const ranking = Array.from(allFoods).map(food => ({
    food,
    wins: wins[food] || 0,
    selects: selects[food] || 0,
    searches: searches[food] || 0,
    clicks: clicks[food] || 0,
    nearby_searches: nearbySearches[food] || 0,
    score: (wins[food] || 0) * 5 + (selects[food] || 0) * 2 + (searches[food] || 0) * 1 + (clicks[food] || 0) * 3 + (nearbySearches[food] || 0) * nearbySearchCoef,
  })).sort((a, b) => b.score - a.score).slice(0, 30);

  return NextResponse.json({ ranking });
}

export async function POST(req: NextRequest) {
  const supabase = getClient();
  const { food_name, event_type, device_id, user_id } = await req.json();
  if (!food_name || !event_type) return NextResponse.json({ error: "missing fields" }, { status: 400 });

  await supabase.from("food_events").insert({ food_name, event_type, device_id: device_id || null, user_id: user_id || null });
  return NextResponse.json({ ok: true });
}
