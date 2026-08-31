import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/adminAuth";
import { createClient } from "@supabase/supabase-js";
import { MENU_CATEGORIES } from "@/lib/menus";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  const supabase = getAdmin();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "menu_categories").single();
  if (data?.value) {
    try {
      return NextResponse.json({ categories: JSON.parse(data.value as string), source: "db" });
    } catch { /* fall through */ }
  }
  return NextResponse.json({ categories: MENU_CATEGORIES, source: "static" });
}

export async function POST(req: NextRequest) {
  /* 로그인 토큰으로 확인한다 — 헤더에 이메일만 적어 부르던 방식은 누구나 흉내낼 수
     있었다(NEXT_PUBLIC_ADMIN_EMAIL 은 브라우저 번들에 들어 있다). */
  if (!(await getAdminUser(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const { categories } = await req.json();
  if (!Array.isArray(categories)) {
    return NextResponse.json({ error: "categories must be array" }, { status: 400 });
  }

  const supabase = getAdmin();
  await supabase.from("app_settings").upsert(
    { key: "menu_categories", value: JSON.stringify(categories) },
    { onConflict: "key" }
  );

  return NextResponse.json({ ok: true });
}
