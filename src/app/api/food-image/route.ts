import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query");
  if (!query) return NextResponse.json({ url: null }, { status: 400 });

  const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.json({ url: null });

  const res = await fetch(
    `https://openapi.naver.com/v1/search/image.json?query=${encodeURIComponent(query + " 음식")}&display=1&sort=sim`,
    { headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret } }
  );

  if (!res.ok) return NextResponse.json({ url: null });

  const data = await res.json();
  const url = data.items?.[0]?.thumbnail || null;
  return NextResponse.json({ url }, {
    headers: { "Cache-Control": "public, max-age=86400" }, // 하루 캐시
  });
}
