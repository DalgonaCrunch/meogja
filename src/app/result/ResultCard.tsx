"use client";

import { useRouter } from "next/navigation";
import { getFoodIconUrl } from "@/lib/foodIcons";
import { shareResult, sharePlace } from "@/lib/shareResult";
import { catShort } from "@/lib/foodCategory";
import { toast } from "@/lib/dialog";

type Props = {
  menus: string[]; who: string[]; groupName: string;
  /** 가게를 공유한 경우 — 주인공이 메뉴가 아니라 가게가 된다 */
  place?: string; category?: string; address?: string;
};

export default function ResultCard({ menus, who, groupName, place, category, address }: Props) {
  const router = useRouter();
  const isPlace = !!place;
  const menu = menus[0] || "오늘 메뉴";
  const subject = isPlace ? place! : menu;
  /* 가게는 이름만으로 무슨 음식인지 알 수 없다("할머니집") → 카테고리로 그림을 고른다 */
  const icon = isPlace
    ? (getFoodIconUrl(catShort(category || "")) ?? getFoodIconUrl(place!))
    : getFoodIconUrl(menu);

  /** 이 메뉴로 주변 식당 찾기 — 정해진 다음이 이어져야 서비스가 완결된다 */
  function findNearby() {
    try {
      sessionStorage.setItem("meogja_preset_menus", JSON.stringify(menus.length ? menus : [menu]));
    } catch { /* 사생활 모드 */ }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          try {
            sessionStorage.setItem("meogja_search_location",
              JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
          } catch { /* ignore */ }
          router.push("/search");
        },
        () => router.push("/search"),
        { timeout: 5000 },
      );
    } else router.push("/search");
  }

  return (
    <div style={{ padding: "28px 20px 40px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <p style={{ fontSize: 13, color: "var(--text-3)", margin: "0 0 6px" }}>
        {groupName ? `${groupName}의 결정` : "오늘의 결정"}
      </p>

      {/* 큰 그림이 먼저 — 글자보다 음식이 먼저 보여야 한다 */}
      <div style={{
        width: "min(62vw, 220px)", height: "min(62vw, 220px)", borderRadius: 36,
        background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", marginBottom: 14, boxShadow: "0 10px 30px rgba(0,0,0,.12)",
      }}>
        {icon
          ? <img src={icon} alt={subject} style={{ width: "78%", height: "78%", objectFit: "contain" }} />
          : <span style={{ fontSize: 92 }}>🍽️</span>}
      </div>

      <p style={{ fontFamily: "var(--font-display)", fontSize: isPlace ? 28 : 32, margin: "0 0 4px" }}>{subject}</p>
      {isPlace && (category || address) && (
        <p style={{ fontSize: 13, color: "var(--text-3)", margin: "0 0 8px", lineHeight: 1.5 }}>
          {[catShort(category || ""), address].filter(Boolean).join(" · ")}
        </p>
      )}
      {!isPlace && menus.length > 1 && (
        <p style={{ fontSize: 13.5, color: "var(--text-2)", margin: "0 0 8px" }}>
          그리고 {menus.slice(1).join(" · ")}
        </p>
      )}

      {/* 누가 골랐는지 — 이게 있어야 받은 사람이 "나도" 하고 눌러본다 */}
      {who.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", margin: "10px 0 4px" }}>
          {who.map(n => (
            <span key={n} style={{ padding: "6px 13px", borderRadius: "var(--r-pill)", background: "var(--primary)", color: "#fff", fontSize: 13, fontWeight: 700 }}>
              👍 {n}
            </span>
          ))}
        </div>
      )}
      <p style={{ fontSize: 13, color: "var(--text-3)", margin: "12px 0 24px", lineHeight: 1.6, maxWidth: 300 }}>
        {isPlace
          ? "먹자냥이 취향을 모아 고른 가게예요."
          : who.length > 0
            ? "모두가 먹을 수 있는 메뉴로 골랐어요. 못 먹는 건 빼고요."
            : "취향을 모으면 모두가 먹을 수 있는 메뉴를 골라드려요."}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320 }}>
        {isPlace ? (
          <a href={`https://map.kakao.com/link/search/${encodeURIComponent(place!)}`}
            target="_blank" rel="noopener noreferrer" style={{
              padding: "14px", borderRadius: "var(--r-pill)",
              background: "var(--primary)", color: "#fff", fontFamily: "var(--font-display)",
              fontSize: 15.5, textDecoration: "none", textAlign: "center",
            }}>📍 지도에서 보기</a>
        ) : (
          <button className="tap" onClick={findNearby} style={{
            padding: "14px", borderRadius: "var(--r-pill)", border: "none",
            background: "var(--primary)", color: "#fff", fontFamily: "var(--font-display)", fontSize: 15.5, cursor: "pointer",
          }}>📍 이 메뉴로 주변 찾기</button>
        )}
        <button className="tap" onClick={() => router.push("/")} style={{
          padding: "13px", borderRadius: "var(--r-pill)", border: "1.5px solid var(--primary)",
          background: "transparent", color: "var(--primary)", fontSize: 14.5, fontWeight: 700, cursor: "pointer",
        }}>🎲 우리도 정해보기</button>
        <button className="tap" onClick={async () => {
          const r = isPlace
            ? await sharePlace({ name: place!, category, address, groupName: groupName || undefined })
            : await shareResult({ menus, groupName: groupName || undefined, who });
          if (r === "copied") toast("링크를 복사했어요");
        }} style={{
          padding: "12px", borderRadius: "var(--r-pill)", border: "none",
          background: "transparent", color: "var(--text-3)", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
        }}>다시 공유하기</button>
      </div>
    </div>
  );
}
