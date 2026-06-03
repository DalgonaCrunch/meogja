import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query");
  const x = request.nextUrl.searchParams.get("x");
  const y = request.nextUrl.searchParams.get("y");
  const radius = request.nextUrl.searchParams.get("radius") || "1000";

  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

  const restKey = process.env.KAKAO_REST_KEY;
  if (!restKey) return NextResponse.json({ error: "Kakao API credentials not configured" }, { status: 500 });

  const params = new URLSearchParams({
    query: `${query}`,
    size: "5",
    sort: x && y ? "distance" : "accuracy",
  });

  if (x && y) {
    params.set("x", x);
    params.set("y", y);
    params.set("radius", radius); // 카카오는 radius 직접 지원 (미터 단위)
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

  return NextResponse.json({ items });
}
