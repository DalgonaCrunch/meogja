"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithGoogle, signInWithKakao, setGuestUser, getCurrentUser } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
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

  // 소셜 로그인 표시 여부 (관리자 설정) — null: 로드 전
  const [showKakao, setShowKakao] = useState<boolean | null>(null);
  const [showNaver, setShowNaver] = useState<boolean | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // 간편가입/로그인
  const [simpleMode, setSimpleMode] = useState<"signup" | "login" | null>(null);
  const [simpleName, setSimpleName] = useState("");
  const [simplePassword, setSimplePassword] = useState("");
  const [simpleConfirm, setSimpleConfirm] = useState("");
  const [simpleError, setSimpleError] = useState("");
  const [simpleLoading, setSimpleLoading] = useState(false);

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u.type === "auth") router.replace(next);
    });
    const ua = navigator.userAgent;
    setIsWebView(/KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|MicroMessenger|WebView|wv\b/.test(ua));

    // 소셜 로그인 표시 설정 로드
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      setShowKakao(d.show_kakao_login === true);
      setShowNaver(d.show_naver_login === true);
      setSettingsLoaded(true);
    }).catch(() => {
      setShowKakao(false);
      setShowNaver(false);
      setSettingsLoaded(true);
    });

    function checkSession() {
      getCurrentUser().then((u) => {
        if (u.type === "auth") router.replace(next);
      });
    }
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkSession();
    });
    window.addEventListener("focus", checkSession);
    return () => {
      document.removeEventListener("visibilitychange", checkSession as EventListener);
      window.removeEventListener("focus", checkSession);
    };
  }, [router, next]);

  function openInExternalBrowser() {
    const url = window.location.href;
    if (/Android/.test(navigator.userAgent)) {
      const urlWithoutScheme = url.replace(/^https?:\/\//, "");
      window.location.href = `intent://${urlWithoutScheme}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
    } else if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      if (navigator.share) {
        navigator.share({ url, title: "meogja" }).catch(() => {
          navigator.clipboard?.writeText(url);
          toast("링크가 복사됐습니다!", "🔗");
        });
      } else {
        navigator.clipboard?.writeText(url);
        toast("링크가 복사됐습니다!", "🔗");
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

  async function handleSimple(e: React.FormEvent) {
    e.preventDefault();
    setSimpleError("");
    if (!simpleName.trim() || !simplePassword.trim()) {
      setSimpleError("이름과 비밀번호를 입력해주세요");
      return;
    }
    if (simpleName.trim().length < 2) { setSimpleError("이름은 2자 이상 입력해주세요"); return; }
    if (simpleMode === "signup" && simplePassword.length < 6) { setSimpleError("비밀번호는 6자 이상 입력해주세요"); return; }
    if (simpleMode === "signup" && simplePassword !== simpleConfirm) {
      setSimpleError("비밀번호가 일치하지 않습니다");
      return;
    }
    setSimpleLoading(true);
    try {
      const res = await fetch("/api/auth/simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: simpleMode, name: simpleName.trim(), password: simplePassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSimpleError(data.error || "오류가 발생했습니다");
        return;
      }
      // API가 반환한 pseudo-email로 Supabase 로그인 → 정식 auth 세션 획득
      const { error: signInError } = await getSupabase().auth.signInWithPassword({
        email: data.email,
        password: simplePassword,
      });
      if (signInError) {
        setSimpleError("로그인 처리 중 오류가 발생했습니다");
        return;
      }
      router.replace(next);
    } catch {
      setSimpleError("네트워크 오류가 발생했습니다");
    } finally {
      setSimpleLoading(false);
    }
  }

  const hasSocialLogin = showKakao || showNaver;

  if (!settingsLoaded) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh" }}>
        <img src="/meogja-logo.jpg" alt="meogja" style={{ height:60, width:"auto", objectFit:"contain", borderRadius:8 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 24, padding: "20px 16px" }}>
      <div style={{ textAlign: "center" }}>
        <img src="/meogja-logo.jpg" alt="meogja" style={{ height: 60, width: "auto", objectFit: "contain", display: "block", margin: "0 auto 12px", borderRadius: 8 }} />
        <p style={{ color: "var(--text-2)", fontSize: 15 }}>로그인하거나 이름만 입력해서 시작하세요</p>
      </div>

      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* WebView 경고 */}
        {isWebView && (
          <div style={{ padding: "16px", borderRadius: 16, background: "#FFF8E1", border: "1.5px solid #F5A623" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#E65100", marginBottom: 6 }}>⚠️ 인앱 브라우저 감지</p>
            <p style={{ fontSize: 12, color: "#795548", marginBottom: 12, lineHeight: 1.6 }}>
              카카오톡/앱 내 브라우저에서는 소셜 로그인이 차단됩니다.<br/>
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

        {/* ① 간편 가입/로그인 (최상단) */}
        {simpleMode === null ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setSimpleMode("signup")} style={{
              flex: 1, padding: "13px", borderRadius: 100, border: "none",
              background: "var(--primary)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 2px 8px rgba(255,122,69,.35)",
            }}>
              ✏️ 간편 가입
            </button>
            <button onClick={() => setSimpleMode("login")} style={{
              flex: 1, padding: "13px", borderRadius: 100, border: "1.5px solid var(--border)",
              background: "transparent", color: "var(--text)", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>
              🔓 계정 로그인
            </button>
          </div>
        ) : (
          <form onSubmit={handleSimple} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", textAlign: "center" }}>
              {simpleMode === "signup" ? "✏️ 간편 가입" : "🔓 계정 로그인"}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-2)", textAlign: "center", marginTop: -4 }}>
              {simpleMode === "signup"
                ? "이름과 비밀번호로 기기 간 유지되는 계정을 만들 수 있어요"
                : "가입했던 이름과 비밀번호를 입력하세요"}
            </p>
            <input
              autoFocus value={simpleName} onChange={(e) => setSimpleName(e.target.value)}
              placeholder="이름 (예: 홍길동)" maxLength={20}
              style={{ padding: "12px 18px", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 15, color: "var(--text)", outline: "none", textAlign: "center" }}
              onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
              onBlur={(e) => e.target.style.borderColor = "var(--border)"}
            />
            {simpleMode === "signup" && <p style={{ fontSize:11, color:"var(--text-3)", textAlign:"center", marginTop:-6 }}>이름 2~20자 / 비밀번호 6~30자</p>}
            <input
              type="password" value={simplePassword} onChange={(e) => setSimplePassword(e.target.value)}
              placeholder="비밀번호" maxLength={30}
              style={{ padding: "12px 18px", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 15, color: "var(--text)", outline: "none", textAlign: "center" }}
              onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
              onBlur={(e) => e.target.style.borderColor = "var(--border)"}
            />
            {simpleMode === "signup" && (
              <input
                type="password" value={simpleConfirm} onChange={(e) => setSimpleConfirm(e.target.value)}
                placeholder="비밀번호 확인" maxLength={30}
                style={{ padding: "12px 18px", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 15, color: "var(--text)", outline: "none", textAlign: "center" }}
                onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
                onBlur={(e) => e.target.style.borderColor = "var(--border)"}
              />
            )}
            {simpleError && <p style={{ fontSize: 12, color: "var(--red)", textAlign: "center" }}>{simpleError}</p>}
            <button type="submit" disabled={simpleLoading} style={{
              padding: "12px", borderRadius: 100, border: "none",
              background: simpleLoading ? "var(--text-3)" : "var(--primary)",
              color: "#fff", fontSize: 14, fontWeight: 700, cursor: simpleLoading ? "default" : "pointer",
            }}>
              {simpleLoading ? "처리 중…" : simpleMode === "signup" ? "가입하기 →" : "로그인 →"}
            </button>
            <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
              <button type="button" onClick={() => setSimpleMode(simpleMode === "signup" ? "login" : "signup")}
                style={{ background: "none", border: "none", color: "var(--primary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {simpleMode === "signup" ? "이미 계정이 있어요" : "계정 새로 만들기"}
              </button>
              <button type="button" onClick={() => { setSimpleMode(null); setSimpleError(""); setSimpleName(""); setSimplePassword(""); setSimpleConfirm(""); }}
                style={{ background: "none", border: "none", color: "var(--text-3)", fontSize: 12, cursor: "pointer" }}>← 취소</button>
            </div>
          </form>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 12, color: "var(--text-2)" }}>소셜 로그인</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {/* ② Google 로그인 */}
        <button onClick={handleGoogle} disabled={!!loadingProvider} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          padding: "14px 24px", borderRadius: 100, border: "1.5px solid var(--border)",
          background: "var(--surface)", color: "var(--text)", fontSize: 15, fontWeight: 600,
          cursor: loadingProvider ? "default" : "pointer", transition: "all 0.15s",
          opacity: loadingProvider && loadingProvider !== "google" ? 0.5 : 1, boxShadow: "var(--shadow)",
        }}
          onMouseOver={(e) => { if (!loadingProvider) e.currentTarget.style.borderColor = "var(--primary)"; }}
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

        {/* ③ 네이버 로그인 */}
        {showNaver && (
          <button onClick={(e) => {
            const btn = e.currentTarget;
            btn.innerHTML = '<span style="display:flex;align-items:center;gap:8px;justify-content:center">⏳ 네이버 연결 중…</span>';
            btn.style.opacity = "0.7";
            sessionStorage.setItem("meogja_pending_join", "");
            const nextParam = encodeURIComponent(next);
            setTimeout(() => { window.location.href = `/api/auth/naver?next=${nextParam}`; }, 100);
          }} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            padding: "14px 24px", borderRadius: 100,
            background: "#03C75A", border: "none", color: "#fff",
            fontSize: 15, fontWeight: 700, cursor: "pointer",
          }}>
            <span style={{ fontSize: 18, fontWeight: 900 }}>N</span>
            네이버로 로그인
          </button>
        )}

        {/* ④ 카카오 로그인 (심사 중) */}
        {showKakao && (
          <div style={{ position: "relative" }}>
            <button onClick={handleKakao} disabled={!!loadingProvider} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "14px 24px", borderRadius: 100,
              background: "#FEE500", border: "none", color: "#191919",
              fontSize: 15, fontWeight: 700, cursor: "default",
              opacity: 0.6,
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#191919" d="M9 1C4.582 1 1 3.77 1 7.2c0 2.197 1.456 4.127 3.65 5.24l-.93 3.47a.3.3 0 0 0 .44.334L8.18 13.9A9.9 9.9 0 0 0 9 13.4c4.418 0 8-2.77 8-6.2S13.418 1 9 1Z"/>
              </svg>
              카카오로 로그인
            </button>
            <span style={{ position: "absolute", top: -7, right: 14, background: "#E53935", color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 99 }}>심사 중 · 준비 중</span>
          </div>
        )}

        {/* 로그인 상태 유지 */}
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-2)" }}>
          <input type="checkbox" checked={stayLoggedIn} onChange={(e) => setStayLoggedIn(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--primary)", cursor: "pointer" }} />
          로그인 상태 유지
        </label>

        {/* 로그인 혜택 안내 */}
        <div style={{ padding: "12px 14px", borderRadius: 14, background: "var(--primary-light)", border: "1px solid var(--border)" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--primary)", marginBottom: 6 }}>🔑 로그인하면 저장돼요</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {["❤️ 좋아하는 음식 / 못먹는 음식", "👥 참여 모임 기록", "👤 닉네임 · 프로필 사진"].map((t) => (
              <p key={t} style={{ fontSize: 12, color: "var(--text-2)" }}>{t}</p>
            ))}
          </div>
        </div>

        {/* 게스트 이용 */}
        {simpleMode === null && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>저장 없이</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            {!showGuest ? (
              <button onClick={() => setShowGuest(true)} style={{
                padding: "13px 24px", borderRadius: 100, border: "1.5px dashed var(--border)",
                background: "transparent", color: "var(--text-2)", fontSize: 14, fontWeight: 500, cursor: "pointer",
              }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--text-2)"; e.currentTarget.style.color = "var(--text)"; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-2)"; }}
              >
                이름만 입력해서 시작
              </button>
            ) : (
              <form onSubmit={handleGuest} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 13, color: "var(--text-2)", textAlign: "center" }}>사용할 이름을 입력하세요</p>
                <input
                  autoFocus value={guestName} onChange={(e) => setGuestName(e.target.value)}
                  placeholder="이름 (예: 홍길동)"
                  style={{ padding: "12px 18px", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 15, color: "var(--text)", outline: "none", textAlign: "center" }}
                  onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                />
                <button type="submit" style={{ padding: "12px", borderRadius: 100, border: "none", background: "var(--text)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  시작하기 →
                </button>
                <button type="button" onClick={() => setShowGuest(false)} style={{ background: "none", border: "none", color: "var(--text-2)", fontSize: 13, cursor: "pointer" }}>← 취소</button>
              </form>
            )}
          </>
        )}
      </div>

      <p style={{ fontSize: 11, color: "var(--text-2)", textAlign: "center" }}>
        로그인 시 <a href="/privacy" style={{ color: "var(--primary)", textDecoration: "underline" }}>개인정보처리방침</a>에 동의하는 것으로 간주합니다
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: 60, color: "var(--text-2)" }}>로딩 중…</div>}>
      <LoginContent />
    </Suspense>
  );
}
