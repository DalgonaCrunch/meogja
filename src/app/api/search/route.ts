import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query");
  const x = request.nextUrl.searchParams.get("x"); // longitude (decimal degrees)
  const y = request.nextUrl.searchParams.get("y"); // latitude (decimal degrees)
  const radius = request.nextUrl.searchParams.get("radius") || "1000";

  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

  const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.json({ error: "Naver API credentials not configured" }, { status: 500 });

  const params = new URLSearchParams({
    query: `${query} 맛집`,
    display: "5",
    sort: x && y ? "random" : "comment",
  });

  if (x && y) {
    params.set("x", x); // decimal degrees
    params.set("y", y);
  }

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
  const radiusM = parseInt(radius);

  const items = (data.items || [])
    .map((d: Record<string, string>) => {
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
    })
    .filter((item: { distance: number | null }) => !userLng || item.distance === null || item.distance <= radiusM);

  items.sort((a: { distance: number | null }, b: { distance: number | null }) => {
    if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
    return 0;
  });

  return NextResponse.json({ items });
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
