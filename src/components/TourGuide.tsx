"use client";
import { useEffect, useState, useCallback } from "react";

type Rect = { left: number; top: number; width: number; height: number };

export const TOUR_KEY = "meogja_tour_v1";

const STEPS: Array<{
  targetId: string | null;
  emoji: string;
  title: string;
  desc: string;
  cta: string;
}> = [
  { targetId: null, emoji: "👋", title: "환영해요!", desc: "먹자냥 30초 투어! 주요 기능을 빠르게 알려드릴게요.", cta: "시작하기" },
  { targetId: "tour-roulette", emoji: "🎲", title: "메뉴 뽑기", desc: "고민될 땐 여기! 랜덤으로 오늘 메뉴를 추천해드려요.", cta: "다음" },
  { targetId: "tour-ranking", emoji: "🔥", title: "지금 추천 메뉴", desc: "시간대·날씨·나이에 맞는 메뉴를 실시간으로 알려줘요.", cta: "다음" },
  { targetId: "tour-group-btn", emoji: "👥", title: "모임 만들기", desc: "친구와 함께 메뉴를 결정하려면 모임을 만들어요!", cta: "다음" },
  { targetId: "tour-nav-play", emoji: "🏆", title: "음식 월드컵", desc: "좋아하는 음식끼리 붙여서 내 취향을 발견해봐요.", cta: "다음" },
  { targetId: null, emoji: "🍽️", title: "준비 완료!", desc: "이제 직접 눌러보면서 즐겨보세요 😊", cta: "시작하기!" },
];

const PAD = 10;

export default function TourGuide({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vw, setVw] = useState(390);
  const [vh, setVh] = useState(844);

  const current = STEPS[step];

  const measureTarget = useCallback(() => {
    const id = STEPS[step]?.targetId;
    if (!id) { setRect(null); return; }
    const el = document.querySelector(`[data-tour-id="${id}"]`) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTimeout(() => {
      const r = el.getBoundingClientRect();
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    }, 350);
  }, [step]);

  useEffect(() => {
    setVw(window.innerWidth);
    setVh(window.innerHeight);
    measureTarget();
    const onResize = () => { setVw(window.innerWidth); setVh(window.innerHeight); measureTarget(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measureTarget]);

  function advance() {
    if (step >= STEPS.length - 1) finish();
    else setStep(s => s + 1);
  }

  function finish() {
    try { localStorage.setItem(TOUR_KEY, "1"); } catch {}
    onDone();
  }

  const hasTarget = !!current.targetId && !!rect;

  // Tooltip position
  const ttWidth = Math.min(vw - 32, 360);
  const ttLeft = Math.max(16, Math.min((vw - ttWidth) / 2, vw - ttWidth - 16));
  let ttTop = hasTarget ? (rect!.top + rect!.height + PAD + 16) : vh / 2 - 90;
  let tooltipBelow = true;
  if (ttTop + 160 > vh - 20) {
    ttTop = hasTarget ? Math.max(60, rect!.top - PAD - 160) : vh / 2 - 90;
    tooltipBelow = false;
  }

  // Arrow x offset relative to tooltip
  const arrowX = hasTarget
    ? Math.min(Math.max((rect!.left + rect!.width / 2) - ttLeft - 10, 16), ttWidth - 36)
    : ttWidth / 2 - 10;

  return (
    <>
      {/* Dark backdrop — tap anywhere to advance */}
      <div
        onClick={advance}
        style={{
          position: "fixed", inset: 0, zIndex: 9990,
          background: "rgba(0,0,0,0.65)",
          cursor: "pointer",
        }}
      />

      {/* SVG cutout around target */}
      {hasTarget && rect && (
        <svg
          style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 9991, pointerEvents: "none" }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <mask id="tour-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={rect.left - PAD} y={rect.top - PAD}
                width={rect.width + PAD * 2} height={rect.height + PAD * 2}
                rx="14" fill="black"
              />
            </mask>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.65)" mask="url(#tour-mask)" />
        </svg>
      )}

      {/* Glow border + click zone over target */}
      {hasTarget && rect && (
        <div
          onClick={advance}
          style={{
            position: "fixed",
            left: rect.left - PAD, top: rect.top - PAD,
            width: rect.width + PAD * 2, height: rect.height + PAD * 2,
            borderRadius: 14,
            border: "2.5px solid rgba(255,255,255,0.9)",
            boxShadow: "0 0 0 4px rgba(255,255,255,0.15), 0 0 24px rgba(255,255,255,0.2)",
            zIndex: 9992,
            cursor: "pointer",
            animation: "tourGlow 1.6s ease-in-out infinite",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        style={{
          position: "fixed",
          left: ttLeft, top: ttTop,
          width: ttWidth,
          zIndex: 9993,
          background: "var(--surface)",
          borderRadius: 20,
          padding: "18px 18px 14px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
          border: "1.5px solid rgba(255,255,255,0.1)",
        }}
      >
        {/* Arrow */}
        {hasTarget && (
          <div style={{
            position: "absolute",
            [tooltipBelow ? "top" : "bottom"]: -9,
            left: arrowX,
            width: 0, height: 0,
            borderLeft: "9px solid transparent",
            borderRight: "9px solid transparent",
            ...(tooltipBelow
              ? { borderBottom: "9px solid var(--surface)" }
              : { borderTop: "9px solid var(--surface)" }),
          }} />
        )}

        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>{current.emoji}</span>
          <div>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 16, marginBottom: 4 }}>{current.title}</p>
            <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55 }}>{current.desc}</p>
          </div>
        </div>

        {/* Step dots */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 18 : 6, height: 6, borderRadius: 3,
              background: i === step ? "var(--primary)" : "var(--border)",
              transition: "all .25s",
            }} />
          ))}
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-3)" }}>
            {step + 1} / {STEPS.length}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); finish(); }}
            style={{
              padding: "9px 14px", borderRadius: "var(--r-pill)",
              border: "1.5px solid var(--border)", background: "transparent",
              color: "var(--text-2)", fontSize: 13, cursor: "pointer",
            }}
          >건너뛰기</button>
          <button
            className="tap"
            onClick={(e) => { e.stopPropagation(); advance(); }}
            style={{
              flex: 1, padding: "9px 14px", borderRadius: "var(--r-pill)",
              border: "none", background: "var(--primary)", color: "#fff",
              fontFamily: "var(--font-display)", fontSize: 14, cursor: "pointer",
            }}
          >{current.cta}</button>
        </div>
      </div>

      <style>{`
        @keyframes tourGlow {
          0%, 100% { box-shadow: 0 0 0 4px rgba(255,255,255,0.15), 0 0 24px rgba(255,255,255,0.2); }
          50% { box-shadow: 0 0 0 7px rgba(255,255,255,0.22), 0 0 36px rgba(255,255,255,0.3); }
        }
      `}</style>
    </>
  );
}
