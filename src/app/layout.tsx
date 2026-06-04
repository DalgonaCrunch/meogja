import type { Metadata } from "next";
import "./globals.css";
import AuthHeader from "./AuthHeader";

export const metadata: Metadata = {
  title: "오늘 뭐 먹지? 🍴",
  description: "모임원과 함께 취향 맞춰 주변 맛집을 추천받아요",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "뭐먹지" },
  themeColor: "#FF6B35",
  metadataBase: new URL("https://meogja.vercel.app"),
  openGraph: {
    title: "오늘 뭐 먹지? 🍴",
    description: "모임원과 함께 취향 맞춰 주변 맛집을 추천받아요",
    url: "https://meogja.vercel.app",
    siteName: "오늘 뭐 먹지?",
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "오늘 뭐 먹지? 🍴",
    description: "모임원과 함께 취향 맞춰 주변 맛집을 추천받아요",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#FF6B35" />
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')` }} />
      </head>
      <body className="min-h-full flex flex-col" style={{ background: "var(--bg)" }}>
        <AuthHeader />
        <main style={{ flex: 1, maxWidth: 860, margin: "0 auto", width: "100%", padding: "32px 20px" }}>
          {children}
        </main>
        <style>{`
          .nav-logo {
            font-family: var(--font-display);
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
