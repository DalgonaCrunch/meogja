import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { items } = body as { items: { id: string; purpose: string; object_position: string; label: string }[] };

  // 어드민 이메일 검증은 클라이언트에서 이미 처리. 서버에선 service role로 저장.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.from("avatar_config").upsert(
    items.map(item => ({ ...item, updated_at: new Date().toISOString() })),
    { onConflict: "id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
