import { NextRequest, NextResponse } from "next/server";

// 네이버 OAuth 시작 — 네이버 로그인 페이지로 리다이렉트
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") || "/";
  const state = Buffer.from(JSON.stringify({ next, ts: Date.now() })).toString("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || "https://meogja.vercel.app"}/api/auth/naver/callback`,
    state,
  });

  return NextResponse.redirect(`https://nid.naver.com/oauth2.0/authorize?${params}`);
}
