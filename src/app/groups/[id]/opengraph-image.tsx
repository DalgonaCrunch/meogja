import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GROUP_EMOJIS = ["🍱","🍜","🍗","🍕","🍣","🥘","🌮","🍻","🥗","🍰"];

export default async function Image({ params }: { params: { id: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: group } = await supabase.from("groups").select("name, description, is_private").eq("id", params.id).single();

  const name = group?.name || "뭐먹지 모임";
  const description = group?.description || "모임원과 함께 오늘의 식사를 결정하세요";
  const isPrivate = group?.is_private ?? false;
  const emoji = GROUP_EMOJIS[(name.charCodeAt(0) || 0) % GROUP_EMOJIS.length];
  const hue = 20 + ((name.charCodeAt(0) || 0) % 6) * 18;

  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%",
      display: "flex",
      background: "#FFF9F2",
      fontFamily: "sans-serif",
    }}>
      {/* 좌측 컬러 사이드바 */}
      <div style={{
        width: 220, height: "100%",
        background: `linear-gradient(180deg, hsl(${hue} 88% 64%) 0%, hsl(${(hue+26)%360} 90% 52%) 100%)`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
      }}>
        <div style={{ fontSize: 80, display: "flex" }}>{emoji}</div>
        <div style={{ fontSize: 20, color: "rgba(255,255,255,0.8)", display: "flex" }}>
          {isPrivate ? "🔒 비공개" : "🌍 공개"}
        </div>
      </div>

      {/* 우측 컨텐츠 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px 70px", gap: 20 }}>
        {/* 앱 이름 */}
        <div style={{ fontSize: 26, color: "#FF6B35", fontWeight: 700, display: "flex" }}>🍽️ 오늘 뭐 먹지?</div>
        {/* 모임 이름 */}
        <div style={{ fontSize: 68, fontWeight: 800, color: "#2D1B00", lineHeight: 1.1, display: "flex" }}>
          {name}
        </div>
        {/* 설명 */}
        <div style={{ fontSize: 32, color: "#8B6E52", display: "flex" }}>
          {description}
        </div>
        {/* 참여 버튼 힌트 */}
        <div style={{
          marginTop: 16, display: "inline-flex", alignItems: "center", gap: 12,
          padding: "14px 30px", borderRadius: 999,
          background: "#FF6B35", color: "#fff", fontSize: 28, fontWeight: 700,
          width: "fit-content",
        }}>
          🙌 모임 참여하기
        </div>
      </div>
    </div>,
    { ...size }
  );
}
