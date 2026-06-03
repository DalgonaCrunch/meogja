import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "뭐먹지 — 식사메뉴 추천",
  description: "참가자 선호도 기반 식사메뉴 추천 + 주변 맛집 검색",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: "var(--bg)" }}>
        <header style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
          <nav style={{ maxWidth: 860, margin: "0 auto", padding: "0 20px", height: 56, display: "flex", alignItems: "center", gap: 28 }}>
            <a href="/" className="nav-logo">
              <span style={{ fontSize: 22 }}>🍽</span> 뭐먹지
            </a>
          </nav>
        </header>
        <main style={{ flex: 1, maxWidth: 860, margin: "0 auto", width: "100%", padding: "32px 20px" }}>
          {children}
        </main>
        <style>{`
          .nav-logo {
            font-family: 'Fraunces', serif;
            font-weight: 600;
            font-size: 20px;
            color: var(--text);
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .nav-link {
            font-size: 14px;
            color: var(--text-muted);
            text-decoration: none;
            font-weight: 500;
            transition: color 0.15s;
          }
          .nav-link:hover { color: var(--accent); }
        `}</style>
      </body>
    </html>
  );
}
