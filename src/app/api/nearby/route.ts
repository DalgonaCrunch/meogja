import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { trackApiUsage } from "@/lib/apiTracker";

export async function GET(request: NextRequest) {
  const limited = await checkRateLimit(request, "nearby", { perMinute: 10, perDay: 100 });
  if (limited) return limited;
  const x = request.nextUrl.searchParams.get("x");
  const y = request.nextUrl.searchParams.get("y");
  const radius = request.nextUrl.searchParams.get("radius") || "1000";
  const sort = request.nextUrl.searchParams.get("sort") || "distance";

  if (!x || !y) return NextResponse.json({ error: "x, y required" }, { status: 400 });

  const restKey = process.env.KAKAO_REST_KEY;
  if (!restKey) return NextResponse.json({ error: "Kakao API key not configured" }, { status: 500 });

  const params = new URLSearchParams({
    category_group_code: "FD6",
    x, y, radius,
    sort,
    size: "15",
  });

  const res = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?${params}`, {
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
    phone: d.phone,
  }));

  trackApiUsage("kakao");
  return NextResponse.json({ items, total: data.meta?.total_count });
}
