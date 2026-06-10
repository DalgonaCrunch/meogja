import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { trackApiUsage } from "@/lib/apiTracker";

export async function GET(request: NextRequest) {
  const limited = await checkRateLimit(request, "search-kakao", { perMinute: 10, perDay: 100 });
  if (limited) return limited;

  const query = request.nextUrl.searchParams.get("query");
  const x = request.nextUrl.searchParams.get("x");
  const y = request.nextUrl.searchParams.get("y");
  const radius = request.nextUrl.searchParams.get("radius") || "1000";
  const location = request.nextUrl.searchParams.get("location"); // 지역명 (네이버 방식 fallback)

  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

  const restKey = process.env.KAKAO_REST_KEY;
  if (!restKey) return NextResponse.json({ error: "Kakao API credentials not configured" }, { status: 500 });

  // 좌표 있으면 근거리 검색, 없으면 지역명 쿼리 포함
  const searchQuery = (!x || !y) && location ? `${location} ${query} 맛집` : `${query} 맛집`;

  const params = new URLSearchParams({
    query: searchQuery,
    size: "5",
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

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: "Kakao API error", detail: text }, { status: res.status });
  }

  const data = await res.json();
  const items = (data.documents || []).map((d: Record<string, string>) => ({
    title: d.place_name,
    category: d.category_name,
    address: d.road_address_name || d.address_name,
    mapx: d.x,
    mapy: d.y,
    link: d.place_url,
    distance: d.distance ? parseInt(d.distance) : null,
  }));

  trackApiUsage("kakao");
  return NextResponse.json({ items });
}
