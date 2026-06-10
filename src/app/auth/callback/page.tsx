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
    const mode = searchParams.get("mode"); // "link" | "migrate" | null
    const rawNext = searchParams.get("next") || "/";
    const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

    async function handleCallback() {
      try {
        if (code) {
          const { data, error } = await getSupabase().auth.exchangeCodeForSession(code);

          // mode=link: 소셜 계정 연결 콜백
          if (mode === "link") {
            if (error) {
              // 이미 다른 계정에 연결된 소셜 계정
              if (error.message?.toLowerCase().includes("already") || (error as { code?: string }).code === "identity_already_exists") {
                router.replace("/profile?link_conflict=1");
              } else {
                router.replace("/profile?link_error=" + encodeURIComponent(error.message));
              }
              return;
            }
            // 연결 성공
            localStorage.removeItem("meogja_link_from");
            localStorage.removeItem("meogja_link_provider");
            setStatus("소셜 계정 연결 완료!");
            router.replace("/profile?link_success=1");
            return;
          }

          // mode=migrate: 구 간편가입 → 새 소셜 계정 데이터 이전
          if (mode === "migrate") {
            if (error) throw error;
            const toUserId = data.session?.user?.id;
            const fromUserId = localStorage.getItem("meogja_migrate_from");
            if (!fromUserId) {
              // 세션 만료 or 재시도: 그냥 로그인 처리
              setStatus("이전 세션 정보 없음. 다시 시도해주세요.");
              setTimeout(() => router.replace("/profile"), 2000);
              return;
            }
            if (toUserId && fromUserId !== toUserId) {
              setStatus("데이터 이전 중…");
              const { data: { session } } = await getSupabase().auth.getSession();
              const token = session?.access_token;
              const keepSourceProfile = localStorage.getItem("meogja_migrate_keep_source") === "true";
              const res = await fetch("/api/auth/migrate-account", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ fromUserId, toUserId, keepSourceProfile }),
              });
              const result = await res.json();
              localStorage.removeItem("meogja_migrate_from");
              localStorage.removeItem("meogja_link_from");
              localStorage.removeItem("meogja_link_provider");
              localStorage.removeItem("meogja_migrate_keep_source");
              if (!result.ok) {
                setStatus("이전 오류: " + result.error);
                setTimeout(() => router.replace("/login"), 3000);
                return;
              }
              setStatus("계정 이전 완료!");
              router.replace("/profile?migrated=1");
            } else {
              router.replace("/profile");
            }
            return;
          }

          // 일반 로그인
          if (error) throw error;
          if (data.session?.user) {
            const user = data.session.user;
            const displayName =
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.user_metadata?.preferred_username ||
              user.email?.split("@")[0] || "";
            const profileImage = user.user_metadata?.avatar_url || "/mascot/avatars/cat-00.png";
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
        } else {
          // Implicit / magic-link 플로우 (Naver) 또는 OAuth 에러 콜백
          const errorParam = searchParams.get("error");
          const errorDesc = searchParams.get("error_description");

          // mode=link: code 없이 돌아온 경우 = OAuth 실패/취소 또는 WebView 차단
          if (mode === "link") {
            if (errorParam) {
              router.replace("/profile?link_error=" + encodeURIComponent(errorDesc || errorParam));
            } else {
              router.replace("/profile");
            }
            return;
          }

          await getSupabase().auth.getSession();

          if (mode === "migrate") {
            const { data: { session } } = await getSupabase().auth.getSession();
            const toUserId = session?.user?.id;
            const fromUserId = localStorage.getItem("meogja_migrate_from");
            if (!fromUserId) {
              setStatus("이전 세션 정보 없음. 다시 시도해주세요.");
              setTimeout(() => router.replace("/profile"), 2000);
              return;
            }
            if (toUserId && fromUserId !== toUserId) {
              setStatus("데이터 이전 중…");
              const token = session?.access_token;
              const keepSourceProfile = localStorage.getItem("meogja_migrate_keep_source") === "true";
              const res = await fetch("/api/auth/migrate-account", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ fromUserId, toUserId, keepSourceProfile }),
              });
              const result = await res.json();
              localStorage.removeItem("meogja_migrate_from");
              localStorage.removeItem("meogja_link_from");
              localStorage.removeItem("meogja_link_provider");
              localStorage.removeItem("meogja_migrate_keep_source");
              if (!result.ok) {
                setStatus("이전 오류: " + result.error);
                setTimeout(() => router.replace("/login"), 3000);
                return;
              }
              setStatus("계정 이전 완료!");
              router.replace("/profile?migrated=1");
              return;
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
