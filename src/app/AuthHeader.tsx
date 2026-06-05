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
                {profileImage && profileImage.startsWith("sprite:")
                  ? (() => { const [,r,c] = profileImage.split(":"); const COLS=12,ROWS=5; return <div style={{ backgroundImage:"url('/avatars/sprite.jpg')", backgroundSize:`${COLS*100}% ${ROWS*100}%`, backgroundPosition:`${parseInt(c)/(COLS-1)*100}% ${parseInt(r)/(ROWS-1)*100}%`, width:"100%", height:"100%" }} />; })()
                  : profileImage
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
