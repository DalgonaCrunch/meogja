import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateRaw = request.nextUrl.searchParams.get("state");
  const appUrl = "https://meogja.vercel.app";

  if (!code) return NextResponse.redirect(`${appUrl}/login?error=naver_no_code`);

  let next = "/";
  let callbackMode = "";
  try {
    const state = JSON.parse(Buffer.from(stateRaw || "", "base64url").toString());
    next = state.next || "/";
    callbackMode = state.mode || "";
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

    let email = naverUser.email || `naver_${naverUser.id}@meogja.app`;
    // 닉네임 우선, 없으면 이름
    const displayName = naverUser.nickname || naverUser.name || "네이버 사용자";

    // 기존 유저 조회
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    let userId: string | null = null;

    if (existingUsers?.users) {
      const found = existingUsers.users.find((u) =>
        u.email === email || u.user_metadata?.naver_id === naverUser.id
      );
      if (found) {
        // 탈퇴 여부는 user_profiles.is_deleted로 확인 (banned_until은 신뢰 불가)
        const { data: foundProfile } = await supabaseAdmin
          .from("user_profiles").select("is_deleted").eq("id", found.id).single();
        const isDeleted = foundProfile?.is_deleted === true;
        if (!isDeleted) {
          userId = found.id;
          email = found.email || email; // suffix 이메일로 magic link 생성
        }
      }
    }

    if (!userId) {
      // 재가입: 탈퇴 계정과 email 충돌 방지 — suffix 추가
      let createEmail = email;
      const emailExists = existingUsers?.users?.some(u => u.email === email);
      if (emailExists) {
        createEmail = `naver_${naverUser.id}_${Date.now()}@meogja.app`;
      }
      const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
        email: createEmail,
        email_confirm: true,
        user_metadata: { full_name: displayName, naver_id: naverUser.id, provider: "naver", original_email: naverUser.email || null },
      });
      if (error || !newUser?.user) throw new Error("Failed to create user");
      userId = newUser.user.id;
      email = createEmail;
    }

    // 기존 프로필 확인 — 첫 로그인만 저장, 이후엔 사용자 수정 유지
    const { data: existingProfile } = await supabaseAdmin
      .from("user_profiles").select("id, display_name").eq("id", userId).single();

    if (!existingProfile) {
      // 첫 로그인: 네이버 정보로 초기 세팅
      const profileData: Record<string, string | null> = { id: userId, display_name: displayName };
      if (naverUser.name) profileData.name = naverUser.name;
      if (naverUser.email) profileData.email = naverUser.email;
      if (naverUser.nickname) profileData.nickname = naverUser.nickname;
      if (naverUser.profile_image) profileData.profile_image = naverUser.profile_image;
      if (naverUser.gender) profileData.gender = naverUser.gender === "M" ? "남성" : naverUser.gender === "F" ? "여성" : naverUser.gender;
      if (naverUser.birthday) profileData.birthday = naverUser.birthday;
      if (naverUser.age) {
        // Naver format: "20-29", "30-39", "0-9", "10-19" etc.
        const ageNum = parseInt(naverUser.age.split("-")[0]);
        const decade = Math.floor(ageNum / 10) * 10;
        profileData.age = decade === 0 ? "10대 미만" : decade >= 60 ? "60대 이상" : `${decade}대`;
      } else if (naverUser.birthyear) {
        const year = parseInt(naverUser.birthyear);
        const ageNum = new Date().getFullYear() - year;
        const decade = Math.floor(ageNum / 10) * 10;
        profileData.age = decade >= 60 ? "60대 이상" : `${Math.max(10, Math.min(decade, 50))}대`;
      }
      if (naverUser.mobile) profileData.mobile = naverUser.mobile;
      if (naverUser.birthyear) profileData.birthyear = naverUser.birthyear;
      await supabaseAdmin.from("user_profiles").insert(profileData);
    }
    // 이후 로그인: 아무것도 덮어쓰지 않음 (사용자 수정 유지)

    // 4. migrate 모드: 기존 Naver 계정에 이미 프로필 데이터 있으면 차단
    // (userId가 listUsers에 이미 존재했다 = 다른 계정에서 이미 사용 중인 Naver 계정)
    if (callbackMode === "migrate") {
      const wasExistingUser = !!(existingUsers?.users?.find(u => u.id === userId));
      if (wasExistingUser && existingProfile) {
        return NextResponse.redirect(`${appUrl}/profile?naver_conflict=1`);
      }
    }

    // 5. 세션 생성 (magic link 방식)
    const redirectParams = new URLSearchParams({ next });
    if (callbackMode) redirectParams.set("mode", callbackMode);
    const { data: otpData } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${appUrl}/auth/callback?${redirectParams}` },
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
