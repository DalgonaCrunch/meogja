import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "meogja_salt").digest("hex");
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const { action, name, password } = await req.json() as { action: string; name: string; password: string };
  if (!name?.trim() || !password?.trim()) {
    return NextResponse.json({ error: "이름과 비밀번호를 입력해주세요" }, { status: 400 });
  }
  const trimName = name.trim();
  const hashed = hashPassword(password);
  const supabase = getAdmin();

  if (action === "signup") {
    // 중복 이름 체크
    const { data: existing } = await supabase.from("guest_accounts").select("id").eq("name", trimName).single();
    if (existing) return NextResponse.json({ error: "이미 사용 중인 이름입니다" }, { status: 409 });

    // Supabase auth 계정 생성 (pseudo-email, 이메일 인증 스킵)
    const pseudoEmail = `${crypto.randomUUID()}@meogja.app`;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: pseudoEmail,
      password,
      email_confirm: true,
      user_metadata: { display_name: trimName, simple_account: true },
    });
    if (authError || !authData.user) {
      return NextResponse.json({ error: "계정 생성 실패: " + authError?.message }, { status: 500 });
    }

    // guest_accounts에 매핑 저장
    await supabase.from("guest_accounts").insert({
      id: authData.user.id,
      name: trimName,
      password: hashed,
    });

    // user_profiles 생성
    await supabase.from("user_profiles").insert({
      id: authData.user.id,
      display_name: trimName,
      profile_image: "/mascot/avatars/cat-00.png",
    });

    return NextResponse.json({ email: pseudoEmail });
  }

  if (action === "login") {
    // guest_accounts에서 이름으로 찾기
    const { data, error } = await supabase.from("guest_accounts")
      .select("id, name, password").eq("name", trimName).single();
    if (error || !data) return NextResponse.json({ error: "이름 또는 비밀번호가 맞지 않습니다" }, { status: 401 });
    if (data.password !== hashed) return NextResponse.json({ error: "이름 또는 비밀번호가 맞지 않습니다" }, { status: 401 });

    // Supabase auth에서 이메일 조회
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(data.id);
    if (userError || !userData.user?.email) return NextResponse.json({ error: "계정 정보를 찾을 수 없습니다" }, { status: 500 });

    return NextResponse.json({ email: userData.user.email });
  }

  return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
}
