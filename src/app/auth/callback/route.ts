import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") || "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { session } } = await supabase.auth.exchangeCodeForSession(code);

    if (session?.user) {
      const user = session.user;
      const displayName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.preferred_username ||
        user.email?.split("@")[0] || "";
      await supabase.from("user_profiles").upsert(
        { id: user.id, display_name: displayName, profile_image: "/avatars/avatar-1.jpg" },
        { onConflict: "id", ignoreDuplicates: true }
      );
    }
  }

  // 로딩 중 화면을 잠깐 보여주고 이동 (blank 화면 방지)
  const redirectUrl = new URL(next, request.url).toString();
  return new NextResponse(
    `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${redirectUrl}"><style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#FFF8F1;font-family:sans-serif;flex-direction:column;gap:16px}.dots{display:flex;gap:8px}.dot{width:10px;height:10px;border-radius:50%;background:#FF7A45;animation:p 0.8s ease-in-out infinite}.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}@keyframes p{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}</style></head><body><img src="/meogja-logo.jpg" style="width:64px;border-radius:12px"><div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div><p style="color:#7A7A7A;font-size:16px">로그인 중…</p></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
