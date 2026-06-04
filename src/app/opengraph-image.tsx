import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "오늘 뭐 먹지?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%", height: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #FF8C5A 0%, #FF5722 100%)",
        fontFamily: "sans-serif",
        position: "relative",
      }}
    >
      {/* 배경 장식 */}
      <div style={{ position: "absolute", right: -30, top: -40, fontSize: 300, opacity: 0.1, display: "flex" }}>🍴</div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, position: "relative", zIndex: 1 }}>
        {/* 아이콘 영역 */}
        <div style={{
          width: 120, height: 120, borderRadius: 32,
          background: "rgba(255,255,255,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 64,
        }}>
          🍽️
        </div>
        {/* 타이틀 */}
        <div style={{ fontSize: 72, fontWeight: 700, color: "#fff", letterSpacing: "-2px", display: "flex" }}>
          오늘 뭐 먹지?
        </div>
        {/* 서브타이틀 */}
        <div style={{ fontSize: 30, color: "rgba(255,255,255,0.88)", display: "flex" }}>
          모임별 선호도 기반 식사메뉴 추천
        </div>
        {/* URL 배지 */}
        <div style={{
          marginTop: 8, padding: "10px 28px", borderRadius: 999,
          background: "rgba(255,255,255,0.2)",
          fontSize: 22, color: "rgba(255,255,255,0.9)",
          display: "flex",
        }}>
          meogja.vercel.app
        </div>
      </div>
    </div>,
    { ...size }
  );
}
