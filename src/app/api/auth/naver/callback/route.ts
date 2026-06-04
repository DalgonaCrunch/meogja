import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateRaw = request.nextUrl.searchParams.get("state");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://meogja.vercel.app";

  if (!code) return NextResponse.redirect(`${appUrl}/login?error=naver_no_code`);

  let next = "/";
  try {
    const state = JSON.parse(Buffer.from(stateRaw || "", "base64url").toString());
    next = state.next || "/";
    // 상대 경로만 허용
    if (!next.startsWith("/") || next.startsWith("//")) next = "/";
  } catch { /* ignore */ }

  try {
    // 1. 코드 → 액세스 토큰 교환
    const tokenRes = await fetch("https://nid.naver.com/oauth2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID!,
        client_secret: process.env.NAVER_CLIENT_SECRET!,
        code,
        state: stateRaw || "",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("No access token");

    // 2. 사용자 정보 조회
    const userRes = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();
    const naverUser = userData.response;
    if (!naverUser?.id) throw new Error("No user info");

    // 3. Supabase에서 사용자 찾기 또는 생성 (service role 사용)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const email = naverUser.email || `naver_${naverUser.id}@meogja.app`;
    const displayName = naverUser.name || naverUser.nickname || "네이버 사용자";

    // 기존 유저 조회
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    let userId: string | null = null;

    if (existingUsers?.users) {
      const found = existingUsers.users.find((u) =>
        u.email === email || u.user_metadata?.naver_id === naverUser.id
      );
      if (found) userId = found.id;
    }

    if (!userId) {
      // 새 유저 생성
      const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: displayName, naver_id: naverUser.id, provider: "naver" },
      });
      if (error || !newUser?.user) throw new Error("Failed to create user");
      userId = newUser.user.id;
    }

    // user_profiles 업데이트
    await supabaseAdmin.from("user_profiles").upsert({ id: userId, display_name: displayName }, { onConflict: "id" });

    // 4. 세션 생성 (magic link 방식)
    const { data: otpData } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${appUrl}${next}` },
    });

    if (otpData?.properties?.action_link) {
      return NextResponse.redirect(otpData.properties.action_link);
    }

    throw new Error("Failed to generate session link");
  } catch (err) {
    console.error("Naver auth error:", err);
    return NextResponse.redirect(`${appUrl}/login?error=naver_auth_failed`);
  }
}
