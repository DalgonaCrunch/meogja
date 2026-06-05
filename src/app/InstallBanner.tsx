"use client";
import { useEffect, useState } from "react";

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 이미 설치됐는지 확인
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // iOS 체크
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    // Android Chrome install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS에서도 배너 표시 (2초 후)
    if (ios) {
      const dismissed = localStorage.getItem("meogja_install_dismissed");
      if (!dismissed) setTimeout(() => setShow(true), 2000);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isInstalled || !show) return null;

  async function handleInstall() {
    if (deferredPrompt) {
      (deferredPrompt as unknown as { prompt: () => void }).prompt();
      setShow(false);
    }
  }

  function dismiss() {
    setShow(false);
    localStorage.setItem("meogja_install_dismissed", "1");
  }

  return (
    <div style={{
      position: "fixed", bottom: "calc(var(--nav-h) + 10px)", left: 12, right: 12, zIndex: 45,
      background: "var(--surface)", borderRadius: 18, padding: "14px 16px",
      boxShadow: "0 8px 30px rgba(0,0,0,.18)", border: "1.5px solid var(--border)",
      display: "flex", alignItems: "center", gap: 12, animation: "slideUp .4s both",
    }}>
      <img src="/icon-192.png" alt="meogja" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 14, marginBottom: 2 }}>홈화면에 추가하기</p>
        <p style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.4 }}>
          {isIOS
            ? "Safari 하단 공유 버튼 → \"홈 화면에 추가\""
            : "앱처럼 빠르게 실행할 수 있어요"}
        </p>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {!isIOS && (
          <button className="tap" onClick={handleInstall} style={{
            padding: "8px 14px", borderRadius: "var(--r-pill)", border: "none",
            background: "var(--primary)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>추가</button>
        )}
        <button onClick={dismiss} style={{ background: "none", border: "none", color: "var(--text-3)", fontSize: 20, cursor: "pointer", padding: "0 4px" }}>✕</button>
      </div>
    </div>
  );
}
