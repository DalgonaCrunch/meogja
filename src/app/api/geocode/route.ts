import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query");
  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

  const restKey = process.env.KAKAO_REST_KEY;
  if (!restKey) return NextResponse.json({ error: "Kakao key not configured" }, { status: 500 });

  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`,
    { headers: { Authorization: `KakaoAK ${restKey}` } }
  );

  if (!res.ok) return NextResponse.json({ error: "Kakao geocode error" }, { status: res.status });

  const data = await res.json();
  const places = (data.documents || []).map((d: Record<string, string>) => ({
    name: d.place_name,
    address: d.road_address_name || d.address_name,
    lat: parseFloat(d.y),
    lng: parseFloat(d.x),
  }));

  return NextResponse.json({ places });
}
