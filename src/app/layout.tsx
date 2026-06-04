import type { Metadata } from "next";
import "./globals.css";
import AuthHeader from "./AuthHeader";
import BottomNav from "./BottomNav";

export const metadata: Metadata = {
  title: "오늘 뭐 먹지? — meogja",
  description: "모임원과 함께 취향 맞춰 주변 맛집을 추천받아요",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "meogja" },
  themeColor: "#FF7A45",
  metadataBase: new URL("https://meogja.vercel.app"),
  openGraph: {
    title: "오늘 뭐 먹지? — meogja",
    description: "모임원과 함께 취향 맞춰 주변 맛집을 추천받아요",
    url: "https://meogja.vercel.app",
    siteName: "meogja",
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: "https://meogja.vercel.app/meogja-brand.jpg",
        width: 1280,
        height: 720,
        alt: "오늘 뭐 먹지? meogja",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "오늘 뭐 먹지? — meogja",
    description: "모임원과 함께 취향 맞춰 주변 맛집을 추천받아요",
    images: ["https://meogja.vercel.app/meogja-brand.jpg"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#FF7A45" />
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')` }} />
      </head>
      <body className="min-h-full flex flex-col" style={{ background: "var(--bg)" }}>
        <AuthHeader />
        <main style={{ flex: 1, maxWidth: 480, margin: "0 auto", width: "100%", padding: "0 0 8px" }}>
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
