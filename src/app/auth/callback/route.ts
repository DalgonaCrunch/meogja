import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { session } } = await supabase.auth.exchangeCodeForSession(code);

    // 로그인 후 user_profiles에 display_name 저장
    if (session?.user) {
      const user = session.user;
      const displayName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.preferred_username ||
        user.email?.split("@")[0] || "";

      await supabase.from("user_profiles").upsert(
        { id: user.id, display_name: displayName },
        { onConflict: "id" }
      );
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
