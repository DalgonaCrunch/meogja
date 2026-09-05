"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const HOLD_MS = 1200;
const FADE_MS = 450;

// 스토어 심사자·외부 링크가 곧장 보는 정적 문서 페이지에는 스플래시를 띄우지 않는다
const NO_SPLASH = ["/privacy", "/delete-account"];

export default function SplashScreen() {
  const pathname = usePathname();
  const skip = NO_SPLASH.includes(pathname);
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (skip) {
      setGone(true);
      return;
    }

    // 같은 세션에서 이미 봤다면 바로 제거 (inline script가 html.splash-seen 을 붙여둠)
    let seen = false;
    try {
      seen = sessionStorage.getItem("meogja_splash") === "1";
    } catch {
      seen = false;
    }
    if (seen) {
      setGone(true);
      return;
    }

    const t1 = setTimeout(() => setFading(true), HOLD_MS);
    const t2 = setTimeout(() => {
      setGone(true);
      try {
        sessionStorage.setItem("meogja_splash", "1");
      } catch {
        /* private mode 등에서 무시 */
      }
      document.documentElement.classList.add("splash-seen");
    }, HOLD_MS + FADE_MS);

    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      document.body.style.overflow = "";
    };
  }, [skip]);

  useEffect(() => {
    if (gone) document.body.style.overflow = "";
  }, [gone]);

  // skip 은 렌더 시점에 바로 걸러야 SSR 마크업에도 스플래시가 안 들어간다
  if (gone || skip) return null;

  return (
    <div
      className="meogja-splash"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#FDF6EE",
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <img
        src="/splash.jpg"
        alt="meogja — 오늘 뭐 먹지?"
        style={{
          display: "block",
          margin: "auto",
          maxWidth: "100%",
          maxHeight: "100%",
          width: "auto",
          height: "auto",
          objectFit: "contain",
          animation: "meogjaSplashPop 700ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        }}
      />
    </div>
  );
}
