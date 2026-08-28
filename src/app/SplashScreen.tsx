"use client";

import { useEffect, useState } from "react";

const HOLD_MS = 1200;
const FADE_MS = 450;

export default function SplashScreen() {
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (gone) document.body.style.overflow = "";
  }, [gone]);

  if (gone) return null;

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
        background: "linear-gradient(180deg, #FFF9ED 0%, #FFF8EE 45%, #FFF4E2 100%)",
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <img
        src="/splash.jpg"
        alt="meogja — 오늘 뭐 먹지?"
        style={{
          position: "relative",
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
