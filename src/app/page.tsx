"use client";

import { useEffect, useState } from "react";
import { getSupabase, Member, FoodPreference } from "@/lib/supabase";
import { getRecommendations } from "@/lib/recommend";

type Restaurant = {
  title: string;
  category: string;
  address: string;
  mapx: string;
  mapy: string;
  link: string;
};

type Recommendation = {
  menu: string;
  large: string;
  medium: string;
  score: number;
};

const MEMBER_COLORS = [
  "#F4631E","#3D7A5A","#6B5CE7","#E7975C","#2E86AB","#C94040","#7B8C42","#A35CB0"
];

export default function Home() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<FoodPreference[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [restaurants, setRestaurants] = useState<Record<string, Restaurant[]>>({});
  const [loading, setLoading] = useState(false);
  const [mapProvider, setMapProvider] = useState<"naver" | "kakao">("naver");
  const [searchingMenu, setSearchingMenu] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    loadMembers();
    // 페이지 로드 시 위치 자동 요청
    if (navigator.geolocation) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocating(false);
        },
        () => setLocating(false)
      );
    }
  }, []);

  async function loadMembers() {
    const { data } = await getSupabase().from("members").select("*").order("name");
    if (data) setMembers(data);
  }

  function toggleMember(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleRecommend() {
    if (selected.length === 0) return;
    setLoading(true);
    setRecommendations([]);
    setRestaurants({});
    const { data: prefs } = await getSupabase()
      .from("food_preferences")
      .select("*")
      .in("member_id", selected);
    if (prefs) {
      setPreferences(prefs);
      setRecommendations(getRecommendations(prefs, selected, 5));
    }
    setLoading(false);
  }

  async function searchRestaurants(menu: string) {
    setSearchingMenu(menu);
    const endpoint = mapProvider === "naver" ? "/api/search" : "/api/search-kakao";
    const params = new URLSearchParams({ query: menu });
    if (location) {
      if (mapProvider === "naver") {
        // 네이버: mapx/mapy = 경도/위도 * 10^7 (정수)
        params.set("x", String(Math.round(location.lng * 1e7)));
        params.set("y", String(Math.round(location.lat * 1e7)));
      } else {
        // 카카오: x=경도, y=위도 (소수점)
        params.set("x", String(location.lng));
        params.set("y", String(location.lat));
      }
    }
    const res = await fetch(`${endpoint}?${params}`);
    const data = await res.json();
    setRestaurants((prev) => ({ ...prev, [menu]: data.items || [] }));
    setSearchingMenu(null);
  }

  const selectedDislikes = [...new Set(
    preferences.filter((p) => selected.includes(p.member_id) && p.preference_type === "dislike")
      .map((p) => p.food_name)
  )];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

      {/* Hero */}
      <div className="fade-up">
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(36px,6vw,56px)", fontWeight: 600, lineHeight: 1.1, color: "var(--text)", marginBottom: 8 }}>
          오늘 뭐 먹지?
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
          함께 먹을 사람을 고르면 모두가 만족할 메뉴를 찾아드려요
          {locating && <span style={{ fontSize: 12, color: "var(--accent)", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block", animation: "pulse-dot 1s infinite" }} />
            위치 확인 중
          </span>}
          {location && !locating && <span style={{ fontSize: 12, color: "var(--green)", display: "flex", alignItems: "center", gap: 4 }}>
            📍 현재 위치 기반 검색
          </span>}
        </p>
      </div>

      {/* 멤버 선택 */}
      <div className="fade-up fade-up-1" style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 16 }}>
          참가자 선택
        </p>
        {members.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            등록된 멤버가 없습니다.{" "}
            <a href="/members" style={{ color: "var(--accent)", textDecoration: "underline" }}>멤버를 추가</a>해주세요.
          </p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {members.map((m, i) => {
              const isSelected = selected.includes(m.id);
              const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
              return (
                <button
                  key={m.id}
                  onClick={() => toggleMember(m.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 16px", borderRadius: 100,
                    border: isSelected ? `2px solid ${color}` : "2px solid var(--border)",
                    background: isSelected ? color + "18" : "transparent",
                    color: isSelected ? color : "var(--text)",
                    fontWeight: isSelected ? 600 : 400,
                    fontSize: 14, cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: isSelected ? color : "var(--border)",
                    color: isSelected ? "#fff" : "var(--text-muted)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                    transition: "all 0.15s ease",
                  }}>
                    {m.name[0]}
                  </span>
                  {m.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 액션 바 */}
      {selected.length > 0 && (
        <div className="fade-up" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={handleRecommend}
            disabled={loading}
            style={{
              background: loading ? "var(--border)" : "var(--accent)",
              color: loading ? "var(--text-muted)" : "#fff",
              border: "none", borderRadius: 100,
              padding: "12px 28px", fontSize: 15, fontWeight: 600,
              cursor: loading ? "default" : "pointer",
              transition: "all 0.15s ease",
              display: "flex", alignItems: "center", gap: 8,
            }}
            onMouseOver={(e) => { if (!loading) e.currentTarget.style.background = "var(--accent-hover)"; }}
            onMouseOut={(e) => { if (!loading) e.currentTarget.style.background = "var(--accent)"; }}
          >
            {loading ? (
              <>
                <span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #ccc", borderTopColor: "#999", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                추천 중...
              </>
            ) : (
              <>{selected.length}명으로 추천받기 →</>
            )}
          </button>

          {/* 지도 제공자 선택 */}
          <div style={{ display: "flex", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 100, padding: 3, gap: 2 }}>
            {(["naver", "kakao"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setMapProvider(p)}
                style={{
                  padding: "6px 16px", borderRadius: 100, border: "none", fontSize: 13, fontWeight: 500,
                  background: mapProvider === p ? "var(--text)" : "transparent",
                  color: mapProvider === p ? "#fff" : "var(--text-muted)",
                  cursor: "pointer", transition: "all 0.15s ease",
                }}
              >
                {p === "naver" ? "네이버" : "카카오"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 제외 음식 */}
      {selectedDislikes.length > 0 && (
        <div className="fade-up" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 4 }}>🚫 제외</span>
          {selectedDislikes.map((food) => (
            <span key={food} style={{ padding: "3px 10px", borderRadius: 100, background: "var(--red-soft)", color: "var(--red)", fontSize: 12, fontWeight: 500 }}>
              {food}
            </span>
          ))}
        </div>
      )}

      {/* 추천 결과 */}
      {recommendations.length > 0 && (
        <div>
          <p style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600, marginBottom: 16 }}>
            추천 메뉴
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className={`fade-up fade-up-${Math.min(i + 1, 5)}`}
                style={{
                  background: "var(--bg-card)", borderRadius: 16,
                  border: "1px solid var(--border)", boxShadow: "var(--shadow)",
                  overflow: "hidden",
                }}
              >
                {/* 티켓 헤더 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderLeft: `4px solid ${MEMBER_COLORS[i % MEMBER_COLORS.length]}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600 }}>{rec.menu}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>{rec.large}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 500 }}>{rec.medium}</span>
                    {rec.score > 0 && (
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: "#FFF8E1", color: "#C77800", fontWeight: 600 }}>
                        👍 {rec.score}명 선호
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => searchRestaurants(rec.menu)}
                    disabled={searchingMenu === rec.menu}
                    style={{
                      padding: "7px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600,
                      border: "1.5px solid var(--accent)", background: "transparent",
                      color: "var(--accent)", cursor: "pointer", whiteSpace: "nowrap",
                      transition: "all 0.15s ease", flexShrink: 0,
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.color = "#fff"; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--accent)"; }}
                  >
                    {searchingMenu === rec.menu ? "검색중…" : `${mapProvider === "naver" ? "N" : "K"} 맛집 찾기`}
                  </button>
                </div>

                {/* 식당 목록 */}
                {restaurants[rec.menu] && (
                  <div style={{ borderTop: "1px solid var(--border)" }}>
                    {restaurants[rec.menu].length === 0 ? (
                      <p style={{ padding: "12px 20px", fontSize: 13, color: "var(--text-muted)" }}>검색 결과 없음</p>
                    ) : (
                      restaurants[rec.menu].map((r, j) => (
                        <div key={j} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "12px 20px",
                          borderBottom: j < restaurants[rec.menu].length - 1 ? "1px solid var(--border)" : "none",
                          background: j % 2 === 0 ? "transparent" : "#FAFAFA",
                        }}>
                          <div>
                            <a href={r.link} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", textDecoration: "none" }}
                              onMouseOver={(e) => e.currentTarget.style.color = "var(--accent)"}
                              onMouseOut={(e) => e.currentTarget.style.color = "var(--text)"}
                            >
                              {r.title}
                            </a>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{r.address}</p>
                          </div>
                          <a
                            href={mapProvider === "naver"
                              ? `https://map.naver.com/v5/search/${encodeURIComponent(r.title + " " + r.address)}`
                              : `https://map.kakao.com/link/search/${encodeURIComponent(r.title)}`}
                            target="_blank" rel="noopener noreferrer"
                            style={{
                              padding: "5px 12px", borderRadius: 8, fontSize: 12,
                              background: "var(--bg)", border: "1px solid var(--border)",
                              color: "var(--text-muted)", textDecoration: "none", flexShrink: 0,
                              transition: "all 0.15s ease",
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                            onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                          >
                            🗺️ 지도
                          </a>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
