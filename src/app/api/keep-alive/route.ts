import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase 무료 플랜은 7일간 요청이 없으면 프로젝트를 일시정지한다.
// Vercel Cron(vercel.json)이 하루 1번 이 라우트를 불러 가벼운 조회 한 번으로 깨워 둔다.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // CRON_SECRET 이 설정돼 있으면 Vercel Cron 이 보내는 Bearer 토큰만 받는다.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await supabase.from("app_settings").select("key").limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
