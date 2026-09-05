import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") || "/";
  const mode = request.nextUrl.searchParams.get("mode") || "";
  const state = Buffer.from(JSON.stringify({ next, mode, ts: Date.now() })).toString("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID!,
    redirect_uri: `https://meogja.vercel.app/api/auth/naver/callback`,
    state,
    // 휴대전화번호는 앱에서 쓰는 곳이 없어 받지 않는다 (최소수집)
    scope: "name email nickname profile_image gender birthday age birthyear",
  });

  // reprompt=1: 재시도 시 Naver 로그인 화면 강제 표시 (다른 계정 선택 가능)
  if (request.nextUrl.searchParams.get("reprompt") === "1") {
    params.set("auth_type", "reprompt");
  }

  return NextResponse.redirect(`https://nid.naver.com/oauth2.0/authorize?${params}`);
}
