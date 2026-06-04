import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 비공개 모임 비밀번호 서버측 검증 — 클라이언트에 비밀번호 노출 안 함
export async function POST(request: NextRequest) {
  const { groupId, password } = await request.json();
  if (!groupId || !password) return NextResponse.json({ valid: false });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .from("groups").select("password, is_private").eq("id", groupId).single();

  if (!data || !data.is_private) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: data.password === password });
}
