import { NextRequest, NextResponse } from "next/server";
import { trackApiUsage } from "@/lib/apiTracker";
import { alertApiFailure } from "@/lib/adminAlert";

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

  /* 사진은 없어도 화면이 도니 사용자에겐 조용히 넘기고, 관리자에게만 알린다 */
  if (!res.ok) {
    await alertApiFailure("naver_image", res.status, await res.text().catch(() => ""));
    return NextResponse.json({ url: null });
  }

  const data = await res.json();
  const url = data.items?.[0]?.thumbnail || null;
  trackApiUsage("naver_image");
  return NextResponse.json({ url }, {
    headers: { "Cache-Control": "public, max-age=86400" }, // 하루 캐시
  });
}
