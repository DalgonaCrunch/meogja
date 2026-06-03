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
    user.type === "auth" ? (user.user.display_name || "내 계정").split(" ")[0] :
    user.type === "guest" ? user.user.name : null;

  return (
    <header style={{
      borderBottom: "1.5px solid var(--border)",
      background: "rgba(255,249,242,0.95)",
      backdropFilter: "blur(12px)",
      position: "sticky", top: 0, zIndex: 40,
    }}>
      <nav style={{
        maxWidth: 860, margin: "0 auto", padding: "0 20px",
        height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <a href="/" style={{
          fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text)",
          textDecoration: "none", display: "flex", alignItems: "center", gap: 8,
          transition: "transform 0.2s",
        }}
          onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.03)"}
          onMouseOut={(e) => e.currentTarget.style.transform = ""}
        >
          <span style={{ fontSize: 28 }}>🍽️</span>
          오늘 뭐 먹지?
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {displayName ? (
            <button onClick={() => router.push("/profile")} style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "7px 16px", borderRadius: 100,
              border: "1.5px solid var(--border)", background: "var(--bg-card)",
              color: "var(--text)", fontSize: 13, fontWeight: 600, cursor: "pointer",
              transition: "all 0.2s", boxShadow: "var(--shadow-card)",
            }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = ""; }}
            >
              <span style={{ fontSize: 16 }}>{user.type === "auth" ? "😊" : "🙋"}</span>
              {displayName}
            </button>
          ) : (
            <button onClick={() => router.push("/login")} style={{
              padding: "8px 20px", borderRadius: 100, border: "none",
              background: "var(--accent)", color: "#fff",
              fontFamily: "var(--font-display)", fontSize: 14,
              cursor: "pointer", transition: "all 0.2s",
              boxShadow: "0 4px 14px rgba(255,107,53,0.3)",
            }}
              onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(255,107,53,0.4)"; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 14px rgba(255,107,53,0.3)"; }}
            >
              로그인 🔑
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
