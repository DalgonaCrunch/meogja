"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithGoogle, signInWithKakao, setGuestUser, getCurrentUser } from "@/lib/auth";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [guestName, setGuestName] = useState("");
  const [showGuest, setShowGuest] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [isWebView, setIsWebView] = useState(false);

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
    // Android intent
    if (/Android/.test(navigator.userAgent)) {
      window.location.href = `intent:${url}#Intent;scheme=https;package=com.android.chrome;end`;
    } else {
      // iOS - copy link and instruct
      navigator.clipboard?.writeText(url).catch(() => {});
      alert("주소를 복사했습니다.\nSafari 또는 Chrome에서 붙여넣기 해서 열어주세요.");
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
    router.replace(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 32 }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 40, fontWeight: 600, marginBottom: 8 }}>🍽 뭐먹지</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 16 }}>로그인하거나 이름만 입력해서 시작하세요</p>
      </div>

      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* WebView 경고 */}
        {isWebView && (
          <div style={{ padding: "16px", borderRadius: 16, background: "#FFF8E1", border: "1.5px solid #F5A623" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#E65100", marginBottom: 6 }}>⚠️ 인앱 브라우저 감지</p>
            <p style={{ fontSize: 12, color: "#795548", marginBottom: 12, lineHeight: 1.6 }}>
              카카오톡/앱 내 브라우저에서는 Google 로그인이 차단됩니다.<br/>
              외부 브라우저(Chrome/Safari)에서 열어주세요.
            </p>
            <button onClick={openInExternalBrowser} style={{
              width: "100%", padding: "10px", borderRadius: 100, border: "none",
              background: "#FF6B35", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
              Chrome/Safari에서 열기 →
            </button>
          </div>
        )}

        {/* 카카오 로그인 */}
        <button onClick={handleKakao} disabled={!!loadingProvider} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          padding: "14px 24px", borderRadius: 100,
          background: "#FAE100", border: "none", color: "#3A1D1D",
          fontSize: 15, fontWeight: 700, cursor: loadingProvider ? "default" : "pointer",
          transition: "all 0.15s", opacity: loadingProvider === "google" ? 0.5 : 1,
          boxShadow: "0 2px 8px rgba(250,225,0,0.4)",
        }}
          onMouseOver={(e) => { if (!loadingProvider) e.currentTarget.style.background = "#F0D800"; }}
          onMouseOut={(e) => { e.currentTarget.style.background = "#FAE100"; }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#3A1D1D">
            <path d="M12 3C6.48 3 2 6.58 2 11c0 2.79 1.57 5.26 4 6.84V21l3.5-1.96c.82.23 1.69.36 2.5.36 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/>
          </svg>
          {loadingProvider === "kakao" ? "연결 중…" : "카카오로 로그인"}
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
