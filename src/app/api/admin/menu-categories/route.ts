import { NextRequest, NextResponse } from "next/server";
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
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const authHeader = req.headers.get("x-admin-email");
  if (!adminEmail || authHeader !== adminEmail) {
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
