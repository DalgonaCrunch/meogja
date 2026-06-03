"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, CurrentUser } from "@/lib/auth";

export default function AuthHeader() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser>({ type: "none" });

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  const displayName =
    user.type === "auth" ? user.user.display_name || "내 계정" :
    user.type === "guest" ? user.user.name : null;

  return (
    <header style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
      <nav style={{ maxWidth: 860, margin: "0 auto", padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/" className="nav-logo">
          <span style={{ fontSize: 22 }}>🍽</span> 뭐먹지
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {displayName ? (
            <button onClick={() => router.push("/profile")} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 100,
              border: "1.5px solid var(--border)", background: "transparent",
              color: "var(--text)", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
            }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
              onMouseOut={(e) => e.currentTarget.style.borderColor = "var(--border)"}
            >
              <span style={{ fontSize: 16 }}>{user.type === "auth" ? "👤" : "🙋"}</span>
              {displayName}
            </button>
          ) : (
            <button onClick={() => router.push("/login")} style={{
              padding: "7px 18px", borderRadius: 100, border: "none",
              background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
              로그인
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
