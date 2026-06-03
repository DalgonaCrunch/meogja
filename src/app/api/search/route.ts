import { NextRequest, NextResponse } from "next/server";

// 네이버 Local Search API는 좌표 기반 반경 필터 미지원 (전국 검색)
// 대신 location 파라미터(지역명)를 쿼리에 포함해 근처 결과 유도
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query");
  const x = request.nextUrl.searchParams.get("x"); // longitude (decimal degrees)
  const y = request.nextUrl.searchParams.get("y"); // latitude (decimal degrees)
  const location = request.nextUrl.searchParams.get("location"); // 지역명 (ex: 강남역)

  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

  const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.json({ error: "Naver API credentials not configured" }, { status: 500 });

  // 지역명이 있으면 쿼리에 포함 (ex: "강남역 한식 맛집")
  const searchQuery = location ? `${location} ${query} 맛집` : `${query} 맛집`;

  const params = new URLSearchParams({
    query: searchQuery,
    display: "5",
    sort: "comment",
  });

  const res = await fetch(`https://openapi.naver.com/v1/search/local.json?${params}`, {
    headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: "Naver API error", detail: text }, { status: res.status });
  }

  const data = await res.json();
  const userLng = x ? parseFloat(x) : null;
  const userLat = y ? parseFloat(y) : null;

  const items = (data.items || []).map((d: Record<string, string>) => {
    // 네이버 mapx/mapy는 * 1e7 형태
    const itemLng = parseInt(d.mapx) / 1e7;
    const itemLat = parseInt(d.mapy) / 1e7;
    let distance: number | null = null;
    if (userLng && userLat && itemLng && itemLat) {
      distance = haversine(userLat, userLng, itemLat, itemLng);
    }
    return {
      title: d.title?.replace(/<[^>]*>/g, ""),
      category: d.category,
      address: d.roadAddress || d.address,
      mapx: d.mapx,
      mapy: d.mapy,
      link: d.link,
      distance,
    };
  });

  // 거리 정보 있으면 가까운 순 정렬
  if (userLng && userLat) {
    items.sort((a: { distance: number | null }, b: { distance: number | null }) => {
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
      return 0;
    });
  }

  return NextResponse.json({ items });
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
