import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const supabase = getAdmin();
  const { data } = await supabase.from("app_settings").select("key, value")
    .in("key", ["show_kakao_login", "show_naver_login", "rate_limit_per_minute", "rate_limit_per_day", "search_provider"]);
  const result: Record<string, boolean | number | string> = {
    show_kakao_login: true, show_naver_login: true,
    rate_limit_per_minute: 10, rate_limit_per_day: 100,
    search_provider: "kakao",
  };
  (data ?? []).forEach((row: { key: string; value: string | boolean }) => {
    if (row.key === "search_provider") {
      result[row.key] = String(row.value);
    } else if (row.key.startsWith("rate_limit_")) {
      result[row.key] = parseInt(String(row.value)) || 0;
    } else {
      result[row.key] = row.value === true || row.value === "true" || row.value === "1";
    }
  });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Record<string, boolean>;
  const supabase = getAdmin();
  const upserts = Object.entries(body).map(([key, value]) => ({
    key,
    value: value as unknown as Record<string, never>,
    updated_at: new Date().toISOString(),
  }));
  await supabase.from("app_settings").upsert(upserts, { onConflict: "key" });
  return NextResponse.json({ ok: true });
}
