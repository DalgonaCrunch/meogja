import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "오늘 뭐 먹지? - 식사메뉴 추천",
  description: "참가자 선호도 기반 식사메뉴 추천 + 주변 맛집 검색",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b px-4 py-3">
          <nav className="max-w-4xl mx-auto flex items-center gap-6">
            <a href="/" className="text-lg font-bold">🍽️ 오늘 뭐 먹지?</a>
            <a href="/members" className="text-sm hover:underline">멤버 관리</a>
          </nav>
        </header>
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
