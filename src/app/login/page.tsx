"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithGoogle, setGuestUser, getCurrentUser } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [guestName, setGuestName] = useState("");
  const [showGuest, setShowGuest] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u.type !== "none") router.replace("/");
    });
  }, [router]);

  async function handleGoogle() {
    setLoading(true);
    try { await signInWithGoogle(); }
    catch { setLoading(false); }
  }

  function handleGuest(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) return;
    setGuestUser(guestName.trim());
    router.replace("/");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 32 }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 40, fontWeight: 600, marginBottom: 8 }}>🍽 뭐먹지</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 16 }}>로그인하거나 이름만 입력해서 시작하세요</p>
      </div>

      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Google 로그인 */}
        <button onClick={handleGoogle} disabled={loading} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          padding: "14px 24px", borderRadius: 100, border: "1.5px solid var(--border)",
          background: "var(--bg-card)", color: "var(--text)", fontSize: 15, fontWeight: 600,
          cursor: loading ? "default" : "pointer", transition: "all 0.15s",
          boxShadow: "var(--shadow)",
        }}
          onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
          onMouseOut={(e) => e.currentTarget.style.borderColor = "var(--border)"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? "연결 중…" : "Google로 로그인"}
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
            background: "transparent", color: "var(--text-muted)", fontSize: 14, fontWeight: 500,
            cursor: "pointer", transition: "all 0.15s",
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
              autoFocus
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
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
