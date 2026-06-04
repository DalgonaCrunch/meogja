import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") || "/";
  const state = Buffer.from(JSON.stringify({ next, ts: Date.now() })).toString("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID!,
    redirect_uri: `https://meogja.vercel.app/api/auth/naver/callback`,
    state,
    // 모든 선택 제공 항목 요청
    scope: "name email nickname profile_image gender birthday age mobile birthyear",
  });

  return NextResponse.redirect(`https://nid.naver.com/oauth2.0/authorize?${params}`);
}
