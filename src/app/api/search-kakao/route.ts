import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { trackApiUsage } from "@/lib/apiTracker";

type Item = {
  title: string; category: string; address: string;
  mapx: string; mapy: string; link: string; distance: number | null;
};

/** 한 번에 받을 수 있는 검색어 개수 */
const MAX_QUERIES = 8;

export async function GET(request: NextRequest) {
  /* 🔴 검색어 하나당 요청 하나였다 — 모임 추천 한 번이 7요청이라 분당 10회 제한에
     바로 걸렸다. 여러 검색어를 한 요청으로 받아 제한을 1회로 센다. */
  const limited = await checkRateLimit(request, "search-kakao", { perMinute: 10, perDay: 100 });
  if (limited) return limited;

  const sp = request.nextUrl.searchParams;
  const single = sp.get("query");
  const multi = sp.get("queries");
  const queries = (multi ? multi.split("|") : single ? [single] : [])
    .map((q) => q.trim()).filter(Boolean).slice(0, MAX_QUERIES);
  const x = sp.get("x");
  const y = sp.get("y");
  const radius = sp.get("radius") || "1000";
  const location = sp.get("location"); // 지역명 (네이버 방식 fallback)
  // 카카오 size 허용 범위 1~15. 미지정 시 5 (모임 추천 화면 기존 동작 유지)
  const size = Math.min(15, Math.max(1, parseInt(sp.get("size") || "5") || 5));

  if (queries.length === 0) return NextResponse.json({ error: "query required" }, { status: 400 });

  const restKey = process.env.KAKAO_REST_KEY;
  if (!restKey) return NextResponse.json({ error: "Kakao API credentials not configured" }, { status: 500 });

  async function runOne(query: string): Promise<{ items: Item[]; error?: string; status?: number }> {
    // 좌표 있으면 근거리 검색, 없으면 지역명 쿼리 포함
    const searchQuery = (!x || !y) && location ? `${location} ${query} 맛집` : `${query} 맛집`;
    const params = new URLSearchParams({
      query: searchQuery,
      size: String(size),
      sort: x && y ? "distance" : "accuracy",
    });
    if (x && y) {
      params.set("x", x);
      params.set("y", y);
      params.set("radius", radius);
    }

    const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${params}`, {
      headers: { Authorization: `KakaoAK ${restKey}` },
    });
    if (!res.ok) return { items: [], error: await res.text(), status: res.status };

    const data = await res.json();
    const items: Item[] = (data.documents || []).map((d: Record<string, string>) => ({
      title: d.place_name,
      category: d.category_name,
      address: d.road_address_name || d.address_name,
      mapx: d.x,
      mapy: d.y,
      link: d.place_url,
      distance: d.distance ? parseInt(d.distance) : null,
    }));
    return { items };
  }

  const results = await Promise.all(queries.map(runOne));

  const firstErr = results.find((r) => r.error);
  if (firstErr && results.every((r) => r.items.length === 0)) {
    return NextResponse.json({ error: "Kakao API error", detail: firstErr.error }, { status: firstErr.status || 502 });
  }

  const seen = new Set<string>();
  const items = results.flatMap((r) => r.items).filter((it) => {
    const key = (it.title || "") + (it.address || "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  queries.forEach(() => trackApiUsage("kakao"));
  return NextResponse.json({ items });
}
