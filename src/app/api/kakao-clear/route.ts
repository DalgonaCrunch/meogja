import { NextRequest, NextResponse } from "next/server";

// 카카오 OG 캐시 초기화 — 배포 후 또는 수동 호출
// GET /api/kakao-clear?url=https://meogja.vercel.app/groups/xxx
export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url") || "https://meogja.vercel.app";

  try {
    // Kakao OG scrapper 호출 (카카오 개발자 도구 내부 API)
    const res = await fetch(
      `https://developers.kakao.com/tool/clear/og?url=${encodeURIComponent(targetUrl)}`,
      { method: "GET", headers: { "User-Agent": "Mozilla/5.0" } }
    );

    return NextResponse.json({
      cleared: res.ok,
      url: targetUrl,
      status: res.status,
      tip: "카카오 캐시는 최대 24시간 유지됩니다. 변경 후 공유 시 자동 갱신됩니다.",
      manualClear: `https://developers.kakao.com/tool/clear/og?url=${encodeURIComponent(targetUrl)}`,
    });
  } catch {
    return NextResponse.json({
      cleared: false,
      url: targetUrl,
      tip: "수동 초기화: https://developers.kakao.com/tool/clear/og",
      manualClear: `https://developers.kakao.com/tool/clear/og?url=${encodeURIComponent(targetUrl)}`,
    });
  }
}
