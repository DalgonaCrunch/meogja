"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { Suspense } from "react";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("로그인 처리 중…");

  useEffect(() => {
    const code = searchParams.get("code");
    const rawNext = searchParams.get("next") || "/";
    const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

    async function handleCallback() {
      try {
        if (code) {
          // 클라이언트 사이드 교환: code_verifier가 localStorage에 있어야 함
          const { data, error } = await getSupabase().auth.exchangeCodeForSession(code);
          if (error) throw error;

          if (data.session?.user) {
            const user = data.session.user;
            const displayName =
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.user_metadata?.preferred_username ||
              user.email?.split("@")[0] || "";
            const profileImage = user.user_metadata?.avatar_url || "/avatars/avatar-1.jpg";

            // user_profiles 행 없으면 생성 (RLS: USING true)
            const { data: existing } = await getSupabase()
              .from("user_profiles").select("id").eq("id", user.id).single();
            if (!existing) {
              await getSupabase().from("user_profiles").insert({
                id: user.id,
                display_name: displayName,
                profile_image: profileImage,
              });
            }
          }
        }
        setStatus("완료! 이동 중…");
        router.replace(next);
      } catch (err) {
        console.error("Auth callback error:", err);
        setStatus("오류가 발생했습니다. 다시 시도해주세요.");
        setTimeout(() => router.replace("/login"), 2000);
      }
    }

    handleCallback();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "80vh", gap: 20,
    }}>
      <img src="/meogja-logo.jpg" alt="meogja" style={{ width: 64, borderRadius: 12 }} />
      <div style={{ display: "flex", gap: 8 }}>
        {[0, 0.2, 0.4].map((delay, i) => (
          <div key={i} style={{
            width: 10, height: 10, borderRadius: "50%", background: "var(--primary)",
            animation: "p 0.8s ease-in-out infinite",
            animationDelay: `${delay}s`,
          }} />
        ))}
      </div>
      <p style={{ color: "var(--text-2)", fontSize: 16 }}>{status}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh" }}>
        <p style={{ color: "var(--text-2)" }}>로딩 중…</p>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
