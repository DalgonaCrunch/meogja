"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "@/lib/dialog";
import { useRouter } from "next/navigation";
import { getCurrentUser, CurrentUser, getGuestUser } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

interface NotifThread { userId: string; name: string; image: string | null; count: number; lastMsg: string; }

export default function AuthHeader() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser>({ type: "none" });
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isSamsungBrowser, setIsSamsungBrowser] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const iosGuideOpenedAt = useRef(0);
  const [isWebView, setIsWebView] = useState(false);

  // 알림
  const [notifCount, setNotifCount] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [notifThreads, setNotifThreads] = useState<NotifThread[]>([]);

  // 위치
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  async function loadNotifs(userId: string) {
    const { data } = await getSupabase()
      .from("direct_messages")
      .select("sender_id, content, created_at")
      .eq("receiver_id", userId)
      .eq("is_read", false)
      .order("created_at", { ascending: false });
    if (!data || data.length === 0) { setNotifCount(0); setNotifThreads([]); return; }

    // sender별 그룹핑
    const map: Record<string, { count: number; lastMsg: string }> = {};
    for (const msg of data) {
      if (!map[msg.sender_id]) map[msg.sender_id] = { count: 0, lastMsg: msg.content };
      map[msg.sender_id].count++;
    }
    const senderIds = Object.keys(map);
    const { data: profiles } = await getSupabase()
      .from("user_profiles").select("id, display_name, profile_image").in("id", senderIds);
    const pMap: Record<string, { display_name: string; profile_image: string | null }> = {};
    profiles?.forEach(p => { pMap[p.id] = p; });

    const threads: NotifThread[] = senderIds.map(sid => ({
      userId: sid,
      name: pMap[sid]?.display_name || "알 수 없음",
      image: pMap[sid]?.profile_image || null,
      count: map[sid].count,
      lastMsg: map[sid].lastMsg,
    }));
    setNotifCount(threads.reduce((s, t) => s + t.count, 0));
    setNotifThreads(threads);
  }

  function applyUser(u: CurrentUser) {
    setUser(u);
    if (u.type === "auth") {
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      setIsAdmin(!!adminEmail && u.user.email === adminEmail);
      getSupabase().from("user_profiles").select("profile_image").eq("id", u.user.id).single().then(({ data }) => {
        setProfileImage(data?.profile_image || null);
      });
      loadNotifs(u.user.id);
    } else {
      setIsAdmin(false);
      setProfileImage(null);
      setNotifCount(0);
      setNotifThreads([]);
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
      const android = /Android/.test(ua);
      const webview = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|MicroMessenger|WebView|wv\b/.test(ua);
      const samsung = /SamsungBrowser/.test(ua);
      setIsIOS(ios);
      setIsAndroid(android);
      setIsWebView(webview);
      setIsSamsungBrowser(samsung);
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

  async function markAllRead() {
    if (user.type !== "auth") return;
    await getSupabase().from("direct_messages")
      .update({ is_read: true })
      .eq("receiver_id", user.user.id).eq("is_read", false);
    setNotifCount(0);
    setNotifThreads([]);
  }

  const notifPanel = showNotif && typeof document !== "undefined" ? createPortal(
    <>
      {/* 바깥 클릭 닫기 */}
      <div style={{ position:"fixed", inset:0, zIndex:9998 }} onClick={() => setShowNotif(false)} />
      {/* 드롭다운 패널 */}
      <div style={{
        position:"fixed", top:82, left:"50%", transform:"translateX(-50%)",
        width:"calc(100% - 32px)", maxWidth:440, zIndex:9999,
        background:"var(--surface)", borderRadius:20,
        boxShadow:"0 8px 32px rgba(0,0,0,.18)", border:"1px solid var(--border)",
        overflow:"hidden",
        animation:"fadeDown .2s both",
      }}>
        {/* 헤더 */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px 10px", borderBottom:"1px solid var(--border)" }}>
          <span style={{ fontFamily:"var(--font-display)", fontSize:15 }}>🔔 알림</span>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {notifThreads.length > 0 && (
              <button onClick={markAllRead} style={{ background:"none", border:"none", color:"var(--primary)", fontSize:12, fontWeight:600, cursor:"pointer", padding:"2px 6px" }}>
                모두 읽음
              </button>
            )}
            <button onClick={() => setShowNotif(false)} style={{ background:"none", border:"none", color:"var(--text-3)", fontSize:18, cursor:"pointer", lineHeight:1, padding:"0 2px" }}>✕</button>
          </div>
        </div>
        {/* 내용 */}
        <div style={{ maxHeight:"60vh", overflowY:"auto" }}>
          {notifThreads.length === 0 ? (
            <div style={{ padding:"32px 20px", textAlign:"center" }}>
              <p style={{ fontSize:28, marginBottom:8 }}>🔕</p>
              <p style={{ fontSize:13, color:"var(--text-2)" }}>새 알림이 없어요</p>
            </div>
          ) : (
            notifThreads.map(t => (
              <button key={t.userId} className="tap" onClick={() => {
                setShowNotif(false);
                router.push(`/messages?with=${t.userId}`);
              }} style={{
                width:"100%", display:"flex", gap:12, alignItems:"center",
                padding:"12px 16px", border:"none", borderBottom:"1px solid var(--border)",
                background:"var(--surface)", cursor:"pointer", textAlign:"left",
              }}>
                <div style={{ width:38, height:38, borderRadius:"50%", overflow:"hidden", background:"var(--bg-2)", display:"grid", placeItems:"center", flexShrink:0 }}>
                  {t.image
                    ? <img src={t.image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    : <span style={{ fontSize:17 }}>👤</span>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                    <span style={{ fontWeight:700, fontSize:13, color:"var(--text)" }}>{t.name}</span>
                    <span style={{ fontSize:11, padding:"1px 7px", borderRadius:99, background:"var(--primary)", color:"#fff", fontWeight:700 }}>{t.count}</span>
                  </div>
                  <p style={{ fontSize:12, color:"var(--text-2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>✉️ {t.lastMsg}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>,
    document.body
  ) : null;

  const installGuidePanel = showIOSGuide && typeof document !== "undefined" ? createPortal(
    <>
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:9996 }}
        onClick={() => setShowIOSGuide(false)} />
      <div style={{
        position:"fixed", bottom:0, left:0, right:0,
        background:"var(--surface)", borderRadius:"24px 24px 0 0",
        padding:"24px 22px", paddingBottom:"max(40px, env(safe-area-inset-bottom, 20px))",
        maxWidth:480, margin:"0 auto", maxHeight:"80vh", overflowY:"auto",
        zIndex:9997, animation:"sheetUp .3s both",
      }}>
        <div style={{ width:40, height:5, borderRadius:99, background:"var(--border)", margin:"0 auto 20px" }} />
        {isSamsungBrowser ? (
          <>
            <p style={{ fontFamily:"var(--font-display)", fontSize:18, marginBottom:8 }}>앱 받기</p>
            <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:16, lineHeight:1.6 }}>
              Chrome에서 받으면 더 안정적이에요! 👍
            </p>
            <button className="tap" onClick={() => {
              const url = window.location.href;
              const host = url.replace(/^https?:\/\//, "");
              window.location.href = `intent://${host}#Intent;scheme=https;package=com.android.chrome;end`;
            }} style={{ width:"100%", padding:"14px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:10, boxShadow:"0 4px 16px rgba(255,122,69,.35)" }}>
              🌐 Chrome에서 받기 (권장)
            </button>
            <p style={{ fontSize:11, color:"var(--text-3)", textAlign:"center", marginBottom:12, lineHeight:1.5 }}>
              Chrome이 열리면 상단 <strong>앱 추가</strong> 버튼을 눌러주세요
            </p>
            <button className="tap" onClick={async () => {
              const p = installPrompt as unknown as { prompt: () => Promise<{ outcome: string }> } | null;
              if (p) {
                await p.prompt();
                setCanInstall(false);
              }
              setShowIOSGuide(false);
            }} style={{ width:"100%", padding:"13px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", fontFamily:"var(--font-display)", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:4 }}>
              이 브라우저에서 받기
            </button>
            <p style={{ fontSize:11, color:"var(--text-3)", textAlign:"center", marginBottom:12, lineHeight:1.6 }}>
              차단되면 <strong>세부정보 더보기 → 무시하고 설치</strong>를 눌러주세요
            </p>
            <button className="tap" onClick={() => setShowIOSGuide(false)} style={{ width:"100%", padding:"10px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-2)", fontSize:13, cursor:"pointer" }}>
              닫기
            </button>
          </>
        ) : isWebView ? (
          <>
            <p style={{ fontFamily:"var(--font-display)", fontSize:18, marginBottom:8 }}>홈화면에 추가하기</p>
            <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:20, lineHeight:1.6 }}>
              현재 앱 내 브라우저에서는 설치가 불가해요.<br/>
              Chrome에서 열어 앱을 추가해주세요.
            </p>
            <button className="tap" onClick={() => {
              const url = window.location.href;
              if (isAndroid) {
                const host = url.replace(/^https?:\/\//, "");
                window.location.href = `intent://${host}#Intent;scheme=https;package=com.android.chrome;end`;
              } else {
                window.location.href = `googlechromes://${url.replace(/^https?:\/\//, "")}`;
              }
            }} style={{ width:"100%", padding:"13px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              🌐 Chrome에서 열기
            </button>
            {!isAndroid && (
              <button className="tap" onClick={() => {
                navigator.clipboard?.writeText(window.location.href).catch(() => {});
                toast("링크 복사됨! Safari 주소창에 붙여넣기 하세요", "🔗");
              }} style={{ marginTop:10, width:"100%", padding:"13px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", fontFamily:"var(--font-display)", fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                🔗 링크 복사 (Safari용)
              </button>
            )}
            <p style={{ fontSize:11, color:"var(--text-3)", textAlign:"center", marginTop:14, lineHeight:1.5 }}>
              Chrome 또는 삼성 브라우저에서 앱 추가 가능 (Chrome 권장)
            </p>
            <button className="tap" onClick={() => setShowIOSGuide(false)} style={{ marginTop:10, width:"100%", padding:"10px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-2)", fontSize:14, cursor:"pointer" }}>
              닫기
            </button>
          </>
        ) : isAndroid ? (
          <>
            <p style={{ fontFamily:"var(--font-display)", fontSize:18, marginBottom:8 }}>앱 받기</p>
            <button className="tap" onClick={async () => {
              const p = installPrompt as unknown as { prompt: () => Promise<{ outcome: string }> } | null;
              if (p) {
                await p.prompt();
                setCanInstall(false);
              }
              setShowIOSGuide(false);
            }} style={{ width:"100%", padding:"14px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:8, boxShadow:"0 4px 16px rgba(255,122,69,.35)" }}>
              📲 설치하기
            </button>
            <p style={{ fontSize:11, color:"var(--text-3)", textAlign:"center", marginBottom:12, lineHeight:1.6 }}>
              차단되면 <strong>세부정보 더보기 → 무시하고 설치</strong>를 눌러주세요
            </p>
            <button className="tap" onClick={() => setShowIOSGuide(false)} style={{ width:"100%", padding:"10px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-3)", fontSize:13, cursor:"pointer" }}>닫기</button>
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
    </>,
    document.body
  ) : null;

  return (
    <>
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
              setTimeout(() => { iosGuideOpenedAt.current = Date.now(); setShowIOSGuide(true); }, 200);
            }} style={{
              padding: "7px 13px", borderRadius: "var(--r-pill)",
              border: "1.5px solid var(--border)", background: "var(--surface)",
              color: "var(--text-2)", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
              앱 추가
            </button>
          )}
          {/* install guide는 portal로 렌더 */}
          {/* 알림 벨 */}
          {user.type === "auth" && (
            <button className="tap" onClick={() => setShowNotif(true)} style={{
              position: "relative", width: 34, height: 34, borderRadius: "50%",
              border: "1.5px solid var(--border)", background: "var(--surface)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", padding: 0, flexShrink: 0,
            }}>
              <img src="/mascot/tabs/bell.png" alt="알림" style={{ width: 20, height: 20, objectFit: "contain" }} />
              {notifCount > 0 && (
                <span style={{
                  position: "absolute", top: -2, right: -2,
                  minWidth: 16, height: 16, borderRadius: 99,
                  background: "var(--primary)", color: "#fff",
                  fontSize: 10, fontWeight: 800, lineHeight: "16px",
                  padding: "0 4px", textAlign: "center",
                }}>{notifCount > 99 ? "99+" : notifCount}</span>
              )}
            </button>
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
    {notifPanel}
    {installGuidePanel}
    </>
  );
}
