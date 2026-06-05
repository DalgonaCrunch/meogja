"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithGoogle, signInWithKakao, setGuestUser, getCurrentUser } from "@/lib/auth";
import { toast } from "@/lib/dialog";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [guestName, setGuestName] = useState("");
  const [showGuest, setShowGuest] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [isWebView, setIsWebView] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u.type !== "none") router.replace(next);
    });
    // WebView 감지 (카카오톡, 인스타그램, 라인 등 인앱브라우저)
    const ua = navigator.userAgent;
    const webview = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|MicroMessenger|WebView|wv\b/.test(ua);
    setIsWebView(webview);
  }, [router, next]);

  function openInExternalBrowser() {
    const url = window.location.href;
    if (/Android/.test(navigator.userAgent)) {
      // package 미지정 → Android 앱 선택 다이얼로그 (삼성/크롬/네이버 등 선택 가능)
      const urlWithoutScheme = url.replace(/^https?:\/\//, "");
      window.location.href = `intent://${urlWithoutScheme}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
    } else if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      // iOS — Web Share API 우선 (기본 브라우저 앱 선택 가능)
      if (navigator.share) {
        navigator.share({ url, title: "meogja" }).catch(() => {
          navigator.clipboard?.writeText(url);
          toast("링크가 복사됐습니다!", "🔗")
        });
      } else {
        navigator.clipboard?.writeText(url);
        toast("링크가 복사됐습니다!", "🔗")
      }
    }
  }

  async function handleKakao() {
    setLoadingProvider("kakao");
    try { await signInWithKakao(); }
    catch { setLoadingProvider(null); }
  }

  async function handleGoogle() {
    setLoadingProvider("google");
    try { await signInWithGoogle(); }
    catch { setLoadingProvider(null); }
  }

  function handleGuest(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) return;
    setGuestUser(guestName.trim());
    if (!stayLoggedIn) sessionStorage.setItem("meogja_session_only", "1");
    router.replace(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 32 }}>
      <div style={{ textAlign: "center" }}>
        <img src="/meogja-logo.jpg" alt="meogja" style={{ height: 60, width: "auto", objectFit: "contain", display: "block", margin: "0 auto 12px", borderRadius: 8 }} />
        <p style={{ color: "var(--text-2)", fontSize: 15 }}>로그인하거나 이름만 입력해서 시작하세요</p>
      </div>

      {/* 로그인 혜택 안내 */}
      <div style={{ width: "100%", maxWidth: 360, padding: "14px 16px", borderRadius: 16, background: "var(--primary-light)", border: "1px solid var(--border)" }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--primary)", marginBottom: 8 }}>🔑 로그인하면 이런 게 저장돼요</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {["❤️ 좋아하는 음식 / 못먹는 음식 저장", "👥 참여 모임 기록 유지", "📋 추천 히스토리 보관", "👤 닉네임 · 프로필 사진 설정"].map((t) => (
            <p key={t} style={{ fontSize: 13, color: "var(--text-2)" }}>{t}</p>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>게스트는 이 정보가 저장되지 않아요</p>
      </div>

      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* WebView 경고 */}
        {isWebView && (
          <div style={{ padding: "16px", borderRadius: 16, background: "#FFF8E1", border: "1.5px solid #F5A623" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#E65100", marginBottom: 6 }}>⚠️ 인앱 브라우저 감지</p>
            <p style={{ fontSize: 12, color: "#795548", marginBottom: 12, lineHeight: 1.6 }}>
              카카오톡/앱 내 브라우저에서는 Google 로그인이 차단됩니다.<br/>
              다른 브라우저 앱에서 열어주세요. (삼성 브라우저, Chrome, Safari 등)
            </p>
            <button onClick={openInExternalBrowser} style={{
              width: "100%", padding: "10px", borderRadius: 100, border: "none",
              background: "#FF6B35", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
              다른 브라우저로 열기 →
            </button>
          </div>
        )}

        {/* 카카오 로그인 — 비즈앱 심사 완료 후 활성화 예정 */}
        {/* <button onClick={handleKakao} ...>카카오로 로그인</button> */}

        {/* 네이버 로그인 */}
        <button onClick={(e) => {
          const btn = e.currentTarget;
          btn.innerHTML = '<span style="display:flex;align-items:center;gap:8px;justify-content:center">⏳ 네이버 연결 중…</span>';
          btn.style.opacity = "0.8";
          sessionStorage.setItem("meogja_pending_join", "");
          const nextParam = encodeURIComponent(next);
          setTimeout(() => { window.location.href = `/api/auth/naver?next=${nextParam}`; }, 100);
        }} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          padding: "14px 24px", borderRadius: 100,
          background: "#03C75A", border: "none", color: "#fff",
          fontSize: 15, fontWeight: 700, cursor: "pointer",
          boxShadow: "0 2px 8px rgba(3,199,90,0.35)",
        }}>
          <span style={{ fontSize: 18, fontWeight: 900 }}>N</span>
          네이버로 로그인
        </button>

        {/* Google 로그인 */}
        <button onClick={handleGoogle} disabled={!!loadingProvider} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          padding: "14px 24px", borderRadius: 100, border: "1.5px solid var(--border)",
          background: "var(--bg-card)", color: "var(--text)", fontSize: 15, fontWeight: 600,
          cursor: loadingProvider ? "default" : "pointer", transition: "all 0.15s",
          opacity: loadingProvider === "kakao" ? 0.5 : 1, boxShadow: "var(--shadow)",
        }}
          onMouseOver={(e) => { if (!loadingProvider) e.currentTarget.style.borderColor = "var(--accent)"; }}
          onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loadingProvider === "google" ? "연결 중…" : "Google로 로그인"}
        </button>

        {/* 로그인 상태 유지 */}
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-2)" }}>
          <input type="checkbox" checked={stayLoggedIn} onChange={(e) => setStayLoggedIn(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--primary)", cursor: "pointer" }} />
          로그인 상태 유지
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>또는</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {/* 로그인 없이 이용 */}
        {!showGuest ? (
          <button onClick={() => setShowGuest(true)} style={{
            padding: "14px 24px", borderRadius: 100, border: "1.5px dashed var(--border)",
            background: "transparent", color: "var(--text-muted)", fontSize: 14, fontWeight: 500, cursor: "pointer",
          }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--text-muted)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            로그인 없이 이용하기
          </button>
        ) : (
          <form onSubmit={handleGuest} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>사용할 이름을 입력하세요</p>
            <input
              autoFocus value={guestName} onChange={(e) => setGuestName(e.target.value)}
              placeholder="이름 (예: 홍길동)"
              style={{ padding: "12px 18px", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 15, color: "var(--text)", outline: "none", textAlign: "center" }}
              onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
              onBlur={(e) => e.target.style.borderColor = "var(--border)"}
            />
            <button type="submit" style={{ padding: "12px", borderRadius: 100, border: "none", background: "var(--text)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              시작하기 →
            </button>
            <button type="button" onClick={() => setShowGuest(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>← 취소</button>
          </form>
        )}
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", maxWidth: 300 }}>
        로그인 없이 이용 시 공개 모임만 참여 가능합니다
      </p>
      <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
        로그인 시 <a href="/privacy" style={{ color: "var(--primary)", textDecoration: "underline" }}>개인정보처리방침</a>에 동의하는 것으로 간주합니다
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>로딩 중…</div>}>
      <LoginContent />
    </Suspense>
  );
}
