"use client";

import { useEffect, useState } from "react";
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

  function applyUser(u: CurrentUser) {
    setUser(u);
    if (u.type === "auth") {
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      setIsAdmin(!!adminEmail && u.user.email === adminEmail);
      // 프로필 이미지 로드
      getSupabase().from("user_profiles").select("profile_image").eq("id", u.user.id).single().then(({ data }) => {
        setProfileImage(data?.profile_image || null);
      });
    } else {
      setIsAdmin(false);
      setProfileImage(null);
    }
  }

  useEffect(() => {
    getCurrentUser().then(applyUser);
    // PWA 설치 감지
    if (!window.matchMedia("(display-mode: standalone)").matches) {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      setIsIOS(ios);
      if (ios) setCanInstall(true);
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
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("meogja-auth-change", handleGuestChange);
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", height: 52 }}>
        {/* 로고 */}
        <button className="tap" onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <img src="/meogja-logo.jpg" alt="meogja" style={{ height: 36, width: "auto", objectFit: "contain", display: "block", borderRadius: 4 }} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* 앱 추가 — 미설치 시만 */}
          {canInstall && (
            <button className="tap" onClick={async () => {
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
            <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:80 }}
              onClick={() => setShowIOSGuide(false)}>
              <div onClick={(e) => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"24px 24px 0 0", padding:"24px 22px 40px", width:"100%", maxWidth:480, animation:"sheetUp .3s both" }}>
                <div style={{ width:40, height:5, borderRadius:99, background:"var(--border)", margin:"0 auto 20px" }} />
                <p style={{ fontFamily:"var(--font-display)", fontSize:18, marginBottom:16 }}>홈화면에 추가하기</p>
                {[["1","Safari 하단 공유 버튼(□↑) 탭"],["2",'"홈 화면에 추가" 선택'],["3",'"추가" 버튼 탭']].map(([n,t]) => (
                  <div key={n} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                    <div style={{ width:32, height:32, borderRadius:10, background:"var(--primary-light)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, color:"var(--primary)", fontSize:14, flexShrink:0 }}>{n}</div>
                    <p style={{ fontSize:14, color:"var(--text-2)" }}>{t}</p>
                  </div>
                ))}
                <button className="tap" onClick={() => setShowIOSGuide(false)} style={{ marginTop:8, width:"100%", padding:"13px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:15, cursor:"pointer" }}>확인</button>
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
    </header>
  );
}
