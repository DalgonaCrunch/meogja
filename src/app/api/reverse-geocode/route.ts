import { NextRequest, NextResponse } from "next/server";

// 좌표 → 주소 변환 (카카오 Reverse Geocoding)
export async function GET(request: NextRequest) {
  const x = request.nextUrl.searchParams.get("x"); // longitude
  const y = request.nextUrl.searchParams.get("y"); // latitude
  if (!x || !y) return NextResponse.json({ address: null });

  const restKey = process.env.KAKAO_REST_KEY;
  if (!restKey) return NextResponse.json({ address: null });

  const res = await fetch(
    `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${x}&y=${y}&input_coord=WGS84`,
    { headers: { Authorization: `KakaoAK ${restKey}` } }
  );

  if (!res.ok) return NextResponse.json({ address: null });
  const data = await res.json();

  const doc = data.documents?.[0];
  if (!doc) return NextResponse.json({ address: null });

  // 도로명 주소 또는 지번 주소에서 시/구/동 추출
  const road = doc.road_address;
  const addr = doc.address;

  let district = null;
  if (road) {
    // "서울 강남구 역삼동" 형태 추출
    district = `${road.region_2depth_name} ${road.region_3depth_name}`;
  } else if (addr) {
    district = `${addr.region_2depth_name} ${addr.region_3depth_name}`;
  }

  return NextResponse.json({ address: district, full: road?.address_name || addr?.address_name });
}
