"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, CurrentUser } from "@/lib/auth";

export default function AuthHeader() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser>({ type: "none" });

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      if (u.type === "auth") {
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        setIsAdmin(!!adminEmail && u.user.email === adminEmail);
      }
    });
  }, []);

  const displayName =
    user.type === "auth" ? (user.user.display_name || "나").split(" ")[0] :
    user.type === "guest" ? user.user.name : null;

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 40,
      background: "color-mix(in srgb, var(--bg) 82%, transparent)",
      backdropFilter: "blur(14px) saturate(1.4)",
      WebkitBackdropFilter: "blur(14px) saturate(1.4)",
      borderBottom: "1px solid color-mix(in srgb, var(--border) 70%, transparent)",
    }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 18px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/" style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          오늘 뭐 먹지?
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isAdmin && (
            <button className="tap" onClick={() => router.push("/admin")} style={{ padding: "6px 12px", borderRadius: "var(--r-pill)", border: "1px solid var(--border)", background: "#F3E5F5", color: "#6A1B9A", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              🛡️ 관리
            </button>
          )}
          {displayName ? (
            <button className="tap" onClick={() => router.push("/profile")} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 6px 6px 14px", borderRadius: "var(--r-pill)",
              border: "1.5px solid var(--border-2)", background: "var(--card)",
              color: "var(--text)", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 2px 8px -4px rgba(120,72,20,.18)",
            }}>
              {displayName}
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: user.type === "auth" ? "var(--accent)" : "var(--green)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
                {displayName[0]}
              </div>
            </button>
          ) : (
            <button className="tap" onClick={() => router.push("/login")} style={{
              padding: "9px 18px", borderRadius: "var(--r-pill)", border: "none",
              background: "var(--accent)", color: "var(--accent-ink)",
              fontFamily: "var(--font-display)", fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 8px 18px -8px var(--accent)",
            }}>
              로그인
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
