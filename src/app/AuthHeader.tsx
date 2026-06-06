"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/dialog";
import { useRouter } from "next/navigation";
import { getCurrentUser, CurrentUser, getGuestUser } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export default function AuthHeader() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser>({ type: "none" });
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isWebView, setIsWebView] = useState(false);

  // 위치
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  function applyUser(u: CurrentUser) {
    setUser(u);
    if (u.type === "auth") {
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      setIsAdmin(!!adminEmail && u.user.email === adminEmail);
      getSupabase().from("user_profiles").select("profile_image").eq("id", u.user.id).single().then(({ data }) => {
        setProfileImage(data?.profile_image || null);
      });
    } else {
      setIsAdmin(false);
      setProfileImage(null);
    }
  }

  function requestLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let label = "현재 위치";
        try {
          const res = await fetch(`/api/reverse-geocode?x=${lng}&y=${lat}`);
          const data = await res.json();
          if (data.address) label = data.address;
        } catch { /* fallback */ }
        const loc = { lat, lng, label };
        setLocationLabel(label);
        sessionStorage.setItem("meogja_home_location", JSON.stringify(loc));
        window.dispatchEvent(new CustomEvent("meogja-location-change", { detail: loc }));
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000, enableHighAccuracy: false }
    );
  }

  useEffect(() => {
    getCurrentUser().then(applyUser);
    if (!window.matchMedia("(display-mode: standalone)").matches) {
      const ua = navigator.userAgent;
      const ios = /iPad|iPhone|iPod/.test(ua);
      const webview = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|MicroMessenger|WebView|wv\b/.test(ua);
      setIsIOS(ios);
      setIsWebView(webview);
      if (ios || webview) setCanInstall(true);
      const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); setCanInstall(true); };
      window.addEventListener("beforeinstallprompt", handler);
    }
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        getCurrentUser().then(applyUser);
      } else {
        const guest = getGuestUser();
        if (guest) applyUser({ type: "guest", user: guest });
        else applyUser({ type: "none" });
      }
    });
    const handleGuestChange = () => getCurrentUser().then(applyUser);
    window.addEventListener("meogja-auth-change", handleGuestChange);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") getCurrentUser().then(applyUser);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // 저장된 위치 먼저 읽기, 없으면 자동 감지
    const saved = sessionStorage.getItem("meogja_home_location");
    if (saved) {
      try {
        const loc = JSON.parse(saved);
        if (loc.label) setLocationLabel(loc.label);
      } catch { /* ignore */ }
    } else {
      requestLocation();
    }

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("meogja-auth-change", handleGuestChange);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayName =
    user.type === "auth" ? (user.user.display_name || "나").split(" ")[0] :
    user.type === "guest" ? user.user.name : null;

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 40,
      background: "rgba(255,248,241,0.95)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--border)",
      maxWidth: 480, margin: "0 auto", width: "100%",
    }}>
      {/* 메인 행 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", height: 52 }}>
        {/* 로고 */}
        <button className="tap" onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <img src="/meogja-logo.jpg" alt="meogja" style={{ height: 36, width: "auto", objectFit: "contain", display: "block", borderRadius: 4 }} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {canInstall && (
            <button className="tap" onClick={async () => {
              if (isWebView) { setShowIOSGuide(true); return; }
              if (isIOS) { setShowIOSGuide(true); return; }
              if (installPrompt) {
                (installPrompt as unknown as { prompt: () => void }).prompt();
                setCanInstall(false);
              }
            }} style={{
              padding: "7px 13px", borderRadius: "var(--r-pill)",
              border: "1.5px solid var(--border)", background: "var(--surface)",
              color: "var(--text-2)", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
              앱 추가
            </button>
          )}
          {showIOSGuide && (
            <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:80 }}
              onClick={() => setShowIOSGuide(false)}>
              <div onClick={(e) => e.stopPropagation()} style={{
                position:"absolute", bottom:0, left:0, right:0,
                background:"var(--surface)", borderRadius:"24px 24px 0 0",
                padding:"24px 22px", paddingBottom:"max(40px, env(safe-area-inset-bottom, 20px))",
                maxWidth:480, margin:"0 auto", maxHeight:"80vh", overflowY:"auto",
                animation:"sheetUp .3s both",
              }}>
                <div style={{ width:40, height:5, borderRadius:99, background:"var(--border)", margin:"0 auto 20px" }} />
                {isWebView ? (
                  <>
                    <p style={{ fontFamily:"var(--font-display)", fontSize:18, marginBottom:8 }}>홈화면에 추가하기</p>
                    <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:16, lineHeight:1.6 }}>
                      카카오톡 내 브라우저에서는 앱 설치가 불가합니다.<br/>
                      외부 브라우저(Chrome, Safari 등)에서 열어주세요.
                    </p>
                    {[["1","아래 버튼으로 링크 복사"],["2","Chrome 또는 Safari 열기"],["3","주소창에 붙여넣기 후 이동"],["4","앱 추가 버튼 탭"]].map(([n,t]) => (
                      <div key={n} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                        <div style={{ width:32, height:32, borderRadius:10, background:"var(--primary-light)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, color:"var(--primary)", fontSize:14, flexShrink:0 }}>{n}</div>
                        <p style={{ fontSize:14, color:"var(--text-2)" }}>{t}</p>
                      </div>
                    ))}
                    <button className="tap" onClick={() => {
                      navigator.clipboard?.writeText(window.location.href).catch(() => {});
                      toast("링크 복사됨! Chrome/Safari에 붙여넣기 하세요", "🔗");
                    }} style={{ marginTop:8, width:"100%", padding:"13px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:15, cursor:"pointer" }}>
                      링크 복사하기
                    </button>
                    <button className="tap" onClick={() => setShowIOSGuide(false)} style={{ marginTop:8, width:"100%", padding:"10px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-2)", fontSize:14, cursor:"pointer" }}>
                      닫기
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ fontFamily:"var(--font-display)", fontSize:18, marginBottom:16 }}>홈화면에 추가하기</p>
                    {[["1","Safari 하단 공유 버튼(□↑) 탭"],["2",'"홈 화면에 추가" 선택'],["3",'"추가" 버튼 탭']].map(([n,t]) => (
                      <div key={n} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                        <div style={{ width:32, height:32, borderRadius:10, background:"var(--primary-light)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, color:"var(--primary)", fontSize:14, flexShrink:0 }}>{n}</div>
                        <p style={{ fontSize:14, color:"var(--text-2)" }}>{t}</p>
                      </div>
                    ))}
                    <button className="tap" onClick={() => setShowIOSGuide(false)} style={{ marginTop:8, width:"100%", padding:"13px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:15, cursor:"pointer" }}>확인</button>
                  </>
                )}
              </div>
            </div>
          )}
          {isAdmin && (
            <button className="tap" onClick={() => router.push("/admin")} style={{ padding: "5px 10px", borderRadius: "var(--r-pill)", border: "1px solid var(--border)", background: "#F3E5F5", color: "#6A1B9A", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              🛡️
            </button>
          )}
          {displayName ? (
            <button className="tap" onClick={() => router.push("/profile")} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 5px 5px 12px", borderRadius: "var(--r-pill)",
              border: "1.5px solid var(--border)", background: "var(--surface)",
              color: "var(--text)", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
              {displayName}
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: user.type === "auth" ? "var(--primary)" : "var(--green)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, overflow: "hidden", flexShrink: 0 }}>
                {profileImage
                  ? <img src={profileImage} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : displayName[0]}
              </div>
            </button>
          ) : (
            <button className="tap" onClick={() => router.push("/login")} style={{
              padding: "7px 16px", borderRadius: "var(--r-pill)", border: "none",
              background: "var(--primary)", color: "#fff",
              fontFamily: "var(--font-display)", fontSize: 13,
              cursor: "pointer",
            }}>
              로그인
            </button>
          )}
        </div>
      </div>

      {/* 위치 스트립 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px", height: 28, borderTop: "1px solid var(--border)" }}>
        <img src="/mascot/ui/location.png" alt="" style={{ width: 14, height: 14, objectFit: "contain", flexShrink: 0, opacity: locating ? 0.5 : 1 }} />
        <span style={{ fontSize: 12, color: locationLabel ? "var(--text-2)" : "var(--text-3)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {locating ? "위치 확인 중…" : locationLabel || "위치 권한을 허용해 주세요"}
        </span>
        <button onClick={requestLocation} disabled={locating} style={{ background: "none", border: "none", cursor: locating ? "default" : "pointer", padding: "2px 4px", fontSize: 13, color: "var(--text-3)", flexShrink: 0, lineHeight: 1 }}>
          ↺
        </button>
      </div>
    </header>
  );
}
