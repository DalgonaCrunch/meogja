"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabase, Group, Member, FoodPreference } from "@/lib/supabase";
import { getAllLargeCategories, getMediumCategories, getMenuItems, getCategorySubItems, getAllMediumCategories } from "@/lib/recommend";
import HistoryTab from "./tabs/HistoryTab";

const MEMBER_COLORS = ["#F4631E","#3D7A5A","#6B5CE7","#E7975C","#2E86AB","#C94040","#7B8C42","#A35CB0"];

function categoryEmoji(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("한식") || c.includes("국밥") || c.includes("찌개")) return "🍲";
  if (c.includes("중식") || c.includes("중국")) return "🥡";
  if (c.includes("일식") || c.includes("초밥") || c.includes("라멘")) return "🍱";
  if (c.includes("양식") || c.includes("파스타") || c.includes("피자") || c.includes("스테이크")) return "🍝";
  if (c.includes("치킨") || c.includes("닭")) return "🍗";
  if (c.includes("고기") || c.includes("삼겹") || c.includes("갈비") || c.includes("구이")) return "🥩";
  if (c.includes("분식") || c.includes("떡볶이")) return "🌮";
  if (c.includes("해산물") || c.includes("회") || c.includes("해물")) return "🦞";
  if (c.includes("카페") || c.includes("커피")) return "☕";
  if (c.includes("디저트") || c.includes("케이크") || c.includes("베이커리")) return "🧁";
  if (c.includes("술") || c.includes("bar") || c.includes("포차")) return "🍺";
  if (c.includes("동남아") || c.includes("태국") || c.includes("베트남")) return "🍜";
  return "🍽️";
}

function formatDistance(m: number | null): string {
  if (m === null) return "";
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

type ScoredRestaurant = {
  title: string;
  category: string;
  address: string;
  mapx: string;
  mapy: string;
  link: string;
  score: number;
  matchedLikes: string[];
  distance: number | null;
  _provider?: string;
};

export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tab, setTab] = useState<"recommend" | "history" | "members">("recommend");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [reviewAvgs, setReviewAvgs] = useState<Record<string, number>>({});
  const [foodImages, setFoodImages] = useState<Record<string, string>>({});

  // 추천 탭
  const [selected, setSelected] = useState<string[]>([]);
  const [scoredRestaurants, setScoredRestaurants] = useState<ScoredRestaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [providers, setProviders] = useState<Set<"naver" | "kakao">>(new Set(["naver"]));
  const [location, setLocation] = useState<{ lat: number; lng: number; label?: string; address?: string } | null>(null);
  const [radius, setRadius] = useState(1000);
  const [sortBy, setSortBy] = useState<"distance" | "rating" | "score" | "category">("distance");
  const [locationMode, setLocationMode] = useState<"auto" | "manual">("auto");
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<{ name: string; address: string; lat: number; lng: number }[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);

  // 멤버 관리 탭
  const [newName, setNewName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [memberPrefs, setMemberPrefs] = useState<FoodPreference[]>([]);
  const [prefType, setPrefType] = useState<"like" | "dislike">("like");
  const [customMenus, setCustomMenus] = useState<string[]>([]);
  const [selectedLarge, setSelectedLarge] = useState("");
  const [selectedMedium, setSelectedMedium] = useState("");
  const [customInput, setCustomInput] = useState("");

  const largeCategories = getAllLargeCategories();
  const mediumCategories = selectedLarge ? getMediumCategories(selectedLarge) : [];
  const menuItems = selectedLarge && selectedMedium ? getMenuItems(selectedLarge, selectedMedium) : [];

  useEffect(() => {
    loadGroup();
    loadMembers();
    loadCustomMenus();
    loadFavorites();
    loadReviewAvgs();
    requestAutoLocation();
  }, [id]);

  async function loadReviewAvgs() {
    const { data } = await getSupabase().from("reviews").select("restaurant_name, rating").eq("group_id", id);
    if (!data) return;
    const map: Record<string, number[]> = {};
    data.forEach((r) => {
      if (!map[r.restaurant_name]) map[r.restaurant_name] = [];
      map[r.restaurant_name].push(r.rating);
    });
    const avgs: Record<string, number> = {};
    Object.entries(map).forEach(([name, ratings]) => {
      avgs[name] = ratings.reduce((s, r) => s + r, 0) / ratings.length;
    });
    setReviewAvgs(avgs);
  }

  async function loadFavorites() {
    const { data } = await getSupabase().from("favorites").select("restaurant_name").eq("group_id", id);
    if (data) setFavorites(new Set(data.map((f) => f.restaurant_name)));
  }

  async function toggleFavorite(r: ScoredRestaurant) {
    const isFav = favorites.has(r.title);
    if (isFav) {
      await getSupabase().from("favorites").delete().eq("group_id", id).eq("restaurant_name", r.title);
      setFavorites((prev) => { const next = new Set(prev); next.delete(r.title); return next; });
    } else {
      await getSupabase().from("favorites").upsert({ group_id: id, restaurant_name: r.title, restaurant_address: r.address, restaurant_category: r.category, restaurant_link: r.link }, { onConflict: "group_id,restaurant_name", ignoreDuplicates: true });
      setFavorites((prev) => new Set([...prev, r.title]));
    }
  }

  async function saveSession(participants: string[], picks: ScoredRestaurant[]) {
    if (picks.length === 0) return;
    const participantNames = members.filter((m) => selected.includes(m.id)).map((m) => m.name);
    const { data: session } = await getSupabase().from("sessions").insert({ group_id: id, participant_names: participantNames }).select().single();
    if (!session) return;
    await getSupabase().from("session_picks").insert(
      picks.map((p) => ({ session_id: session.id, restaurant_name: p.title, restaurant_address: p.address, restaurant_category: p.category, restaurant_link: p.link, map_provider: [...providers][0] || "naver" }))
    );
  }

  function requestAutoLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "현재 위치" }); setLocating(false); },
      () => setLocating(false)
    );
  }

  async function searchLocation() {
    if (!locationQuery.trim()) return;
    setSearchingLocation(true);
    const res = await fetch(`/api/geocode?query=${encodeURIComponent(locationQuery)}`);
    const data = await res.json();
    setLocationResults(data.places || []);
    setSearchingLocation(false);
  }

  function selectLocation(place: { name: string; address: string; lat: number; lng: number }) {
    setLocation({ lat: place.lat, lng: place.lng, label: place.name, address: place.address });
    setLocationResults([]);
    setLocationQuery("");
  }

  async function loadCustomMenus() {
    const { data } = await getSupabase().from("custom_menus").select("name").order("created_at", { ascending: false });
    if (data) setCustomMenus(data.map((d) => d.name));
  }

  async function loadGroup() {
    const { data } = await getSupabase().from("groups").select("*").eq("id", id).single();
    if (!data) { router.push("/"); return; }
    setGroup(data);
  }

  async function loadMembers() {
    const { data } = await getSupabase().from("members").select("*").eq("group_id", id).order("name");
    if (data) setMembers(data);
  }

  // 추천 탭 함수들
  function toggleMember(memberId: string) {
    setSelected((prev) => prev.includes(memberId) ? prev.filter((x) => x !== memberId) : [...prev, memberId]);
  }

  async function searchNearbyFromProvider(query: string, provider: "naver" | "kakao"): Promise<ScoredRestaurant[]> {
    const endpoint = provider === "naver" ? "/api/search" : "/api/search-kakao";
    const params = new URLSearchParams({ query, radius: String(radius) });
    if (location) {
      params.set("x", String(location.lng));
      params.set("y", String(location.lat));
      // 네이버는 지역명을 쿼리에 포함하는 방식
      if (provider === "naver" && location.label) {
        params.set("location", location.label);
      }
    }
    try {
      const res = await fetch(`${endpoint}?${params}`);
      const data = await res.json();
      return (data.items || []).map((r: Record<string, string | number | null>) => ({
        ...r, score: 0, matchedLikes: [], distance: r.distance ?? null, _provider: provider,
      }));
    } catch { return []; }
  }

  async function searchNearby(query: string): Promise<ScoredRestaurant[]> {
    const providerList = [...providers];
    const results = await Promise.all(providerList.map((p) => searchNearbyFromProvider(query, p)));
    return results.flat();
  }

  async function handleRecommend() {
    if (selected.length === 0) return;
    setLoading(true);
    setScoredRestaurants([]);

    const { data: prefs } = await getSupabase().from("food_preferences").select("*").in("member_id", selected);
    const likes = prefs?.filter((p) => p.preference_type === "like").map((p) => p.food_name) ?? [];
    const dislikes = new Set(prefs?.filter((p) => p.preference_type === "dislike").map((p) => p.food_name) ?? []);

    // 검색 쿼리: 좋아하는 음식 + 기본 카테고리 (좋아하는 게 없으면)
    const DEFAULT_QUERIES = ["한식", "중식", "일식", "양식", "분식"];
    const queries = likes.length > 0
      ? [...new Set(likes)].slice(0, 6)
      : DEFAULT_QUERIES;

    // 병렬 검색
    const results = await Promise.all(queries.map((q) => searchNearby(q)));
    const all = results.flat();

    // 중복 제거 (title+address 기준)
    const seen = new Set<string>();
    const unique = all.filter((r) => {
      const key = r.title + r.address;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // dislike 필터링 — 식당 카테고리에 못먹는 키워드 포함 시 제외
    const filtered = unique.filter((r) => {
      const cat = (r.category || "").toLowerCase();
      for (const d of dislikes) {
        if (cat.includes(d.toLowerCase())) return false;
      }
      return true;
    });

    // 선호도 스코어링
    const allMedium = getAllMediumCategories();
    const scored: ScoredRestaurant[] = filtered.map((r) => {
      const cat = (r.category || "").toLowerCase();
      const matchedLikes: string[] = [];
      let score = 0;
      for (const like of likes) {
        if (cat.includes(like.toLowerCase()) || like.toLowerCase().includes(cat)) {
          matchedLikes.push(like);
          score += 2;
        }
      }
      // 중분류 매칭 가산점
      for (const medium of allMedium) {
        if (cat.includes(medium.toLowerCase())) score += 1;
      }
      return { ...r, score, matchedLikes: [...new Set(matchedLikes)] };
    });

    // 기본 정렬: 거리순
    scored.sort((a, b) => {
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
      return b.score - a.score;
    });
    setSortBy("distance");
    const top = scored.slice(0, 15);
    setScoredRestaurants(top);
    saveSession(selected, top.slice(0, 5));
    setLoading(false);

    // 카테고리별 이미지 비동기 페치 (중복 제거)
    const uniqueCategories = [...new Set(top.map((r) => {
      const parts = r.category.split(">");
      return parts[parts.length - 1]?.trim() || r.category;
    }))];
    uniqueCategories.forEach(async (cat) => {
      if (foodImages[cat]) return;
      const res = await fetch(`/api/food-image?query=${encodeURIComponent(cat)}`);
      const data = await res.json();
      if (data.url) setFoodImages((prev) => ({ ...prev, [cat]: data.url }));
    });
  }

  // 멤버 관리 함수들
  async function addMember() {
    const name = newName.trim();
    if (!name) return;
    await getSupabase().from("members").insert({ name, group_id: id });
    setNewName("");
    loadMembers();
  }

  async function deleteMember(memberId: string) {
    await getSupabase().from("members").delete().eq("id", memberId);
    if (expandedId === memberId) setExpandedId(null);
    loadMembers();
  }

  async function toggleExpand(memberId: string) {
    if (expandedId === memberId) { setExpandedId(null); return; }
    setExpandedId(memberId);
    await loadMemberPrefs(memberId);
  }

  async function loadMemberPrefs(memberId: string) {
    const { data } = await getSupabase().from("food_preferences").select("*").eq("member_id", memberId).order("preference_type");
    if (data) setMemberPrefs(data);
  }

  async function addPreference(foodName: string, isCustomInput = false) {
    if (!expandedId || !foodName.trim()) return;
    const trimmed = foodName.trim();
    const oppositeType = prefType === "like" ? "dislike" : "like";

    // 이미 같은 타입으로 등록된 경우 skip
    if (memberPrefs.find((p) => p.food_name === trimmed && p.preference_type === prefType)) return;

    // 삭제 대상: 반대 타입의 동일 음식 + 카테고리 하위 항목들
    const subItems = getCategorySubItems(trimmed);
    const coverageSet = new Set([trimmed, ...subItems]);
    const toDelete = memberPrefs.filter((p) => coverageSet.has(p.food_name) && p.preference_type === oppositeType);
    if (toDelete.length > 0) {
      await getSupabase().from("food_preferences").delete().in("id", toDelete.map((p) => p.id));
    }

    await getSupabase().from("food_preferences").insert({ member_id: expandedId, food_name: trimmed, preference_type: prefType });

    if (isCustomInput) {
      await getSupabase().from("custom_menus").upsert({ name: trimmed }, { onConflict: "name", ignoreDuplicates: true });
      setCustomMenus((prev) => prev.includes(trimmed) ? prev : [trimmed, ...prev]);
    }
    await loadMemberPrefs(expandedId);
    setCustomInput("");
  }

  async function removePreference(prefId: string) {
    await getSupabase().from("food_preferences").delete().eq("id", prefId);
    setMemberPrefs((prev) => prev.filter((p) => p.id !== prefId));
  }

  const memberLikes = memberPrefs.filter((p) => p.preference_type === "like");
  const memberDislikes = memberPrefs.filter((p) => p.preference_type === "dislike");

  const sortedRestaurants = [...scoredRestaurants].sort((a, b) => {
    switch (sortBy) {
      case "distance":
        if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
        return 0;
      case "rating": {
        const ra = reviewAvgs[a.title] ?? 0;
        const rb = reviewAvgs[b.title] ?? 0;
        return rb - ra;
      }
      case "score":
        return b.score - a.score;
      case "category":
        return (a.category || "").localeCompare(b.category || "");
      default:
        return 0;
    }
  });

  if (!group) return <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>불러오는 중…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* 헤더 */}
      <div className="fade-up" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => router.push("/")} style={{ width: 36, height: 36, borderRadius: "50%", border: "1.5px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>←</button>
        <div>
          <h1 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(24px,4vw,36px)", fontWeight: 600, lineHeight: 1.1 }}>
            {group.is_private ? "🔒 " : "🌐 "}{group.name}
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{members.length}명의 멤버</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="fade-up fade-up-1" style={{ display: "flex", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 100, padding: 4, gap: 4, width: "fit-content" }}>
        {([["recommend", "🍽 추천"], ["history", "📋 기록"], ["members", "👥 멤버"]] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 22px", borderRadius: 100, border: "none", fontSize: 14, fontWeight: 600,
            background: tab === t ? "var(--text)" : "transparent",
            color: tab === t ? "#fff" : "var(--text-muted)",
            cursor: "pointer", transition: "all 0.15s",
          }}>{label}</button>
        ))}
      </div>

      {/* ── 메뉴 추천 탭 ── */}
      {tab === "recommend" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* 참가자 선택 */}
          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 22, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>오늘 참가자</p>
            {members.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                멤버가 없습니다.{" "}
                <button onClick={() => setTab("members")} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: 14 }}>멤버를 추가</button>해주세요.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {members.map((m, i) => {
                  const isSelected = selected.includes(m.id);
                  const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
                  return (
                    <button key={m.id} onClick={() => toggleMember(m.id)} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "7px 16px", borderRadius: 100,
                      border: isSelected ? `2px solid ${color}` : "2px solid var(--border)",
                      background: isSelected ? color + "18" : "transparent",
                      color: isSelected ? color : "var(--text)",
                      fontWeight: isSelected ? 600 : 400, fontSize: 14, cursor: "pointer", transition: "all 0.15s",
                    }}>
                      <span style={{ width: 26, height: 26, borderRadius: "50%", background: isSelected ? color : "var(--border)", color: isSelected ? "#fff" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, transition: "all 0.15s" }}>
                        {m.name[0]}
                      </span>
                      {m.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 위치 설정 */}
          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 22, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>검색 위치</p>

            {/* 현재 위치 / 직접 지정 토글 */}
            <div style={{ display: "flex", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 100, padding: 3, gap: 3, marginBottom: 14, width: "fit-content" }}>
              <button onClick={() => { setLocationMode("auto"); requestAutoLocation(); }} style={{
                padding: "6px 18px", borderRadius: 100, border: "none", fontSize: 13, fontWeight: 600,
                background: locationMode === "auto" ? "var(--text)" : "transparent",
                color: locationMode === "auto" ? "#fff" : "var(--text-muted)",
                cursor: "pointer", transition: "all 0.15s",
              }}>📍 현재 위치</button>
              <button onClick={() => setLocationMode("manual")} style={{
                padding: "6px 18px", borderRadius: 100, border: "none", fontSize: 13, fontWeight: 600,
                background: locationMode === "manual" ? "var(--text)" : "transparent",
                color: locationMode === "manual" ? "#fff" : "var(--text-muted)",
                cursor: "pointer", transition: "all 0.15s",
              }}>🔍 직접 지정</button>
            </div>

            {/* 반경 선택 */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>검색 반경</p>
              <div style={{ display: "flex", gap: 6 }}>
                {[300, 500, 1000, 2000, 5000].map((r) => (
                  <button key={r} onClick={() => setRadius(r)} style={{
                    padding: "5px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600,
                    border: radius === r ? "2px solid var(--accent)" : "1.5px solid var(--border)",
                    background: radius === r ? "var(--accent-soft)" : "transparent",
                    color: radius === r ? "var(--accent)" : "var(--text-muted)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {r >= 1000 ? `${r/1000}km` : `${r}m`}
                  </button>
                ))}
              </div>
            </div>

            {/* 현재 위치 상태 */}
            {locationMode === "auto" && (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {locating && <span style={{ color: "var(--accent)" }}>위치 확인 중…</span>}
                {location && !locating && <span style={{ color: "var(--green)" }}>✓ {location.label}</span>}
                {!location && !locating && (
                  <span>
                    위치 권한이 없습니다.{" "}
                    <button onClick={requestAutoLocation} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: 13 }}>다시 시도</button>
                    {" "}또는{" "}
                    <button onClick={() => setLocationMode("manual")} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: 13 }}>직접 지정</button>
                  </span>
                )}
              </div>
            )}

            {/* 직접 지정 입력 */}
            {locationMode === "manual" && (
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") searchLocation(); }}
                    placeholder="장소명 또는 주소 입력 (예: 강남역, 판교테크노밸리)"
                    style={{ flex: 1, padding: "9px 16px", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 13, color: "var(--text)", outline: "none" }}
                    onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
                    onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                  />
                  <button onClick={searchLocation} disabled={searchingLocation} style={{ padding: "9px 18px", borderRadius: 100, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {searchingLocation ? "…" : "검색"}
                  </button>
                </div>
                {/* 검색 결과 */}
                {locationResults.length > 0 && (
                  <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                    {locationResults.map((p, i) => (
                      <button key={i} onClick={() => selectLocation(p)} style={{
                        display: "block", width: "100%", padding: "10px 14px", textAlign: "left",
                        background: "transparent", border: "none", borderBottom: i < locationResults.length - 1 ? "1px solid var(--border)" : "none",
                        cursor: "pointer", transition: "background 0.1s",
                      }}
                        onMouseOver={(e) => e.currentTarget.style.background = "var(--bg)"}
                        onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{p.name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{p.address}</p>
                      </button>
                    ))}
                  </div>
                )}
                {location && locationMode === "manual" && (
                  <p style={{ fontSize: 12, color: "var(--green)", marginTop: 8 }}>✓ {location.label} ({location.address || ""})</p>
                )}
              </div>
            )}
          </div>

          {/* 액션 바 */}
          {selected.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button onClick={handleRecommend} disabled={loading} style={{
                background: loading ? "var(--border)" : "var(--accent)", color: loading ? "var(--text-muted)" : "#fff",
                border: "none", borderRadius: 100, padding: "12px 28px", fontSize: 15, fontWeight: 600,
                cursor: loading ? "default" : "pointer", transition: "all 0.15s",
              }}>
                {loading ? "주변 식당 검색 중…" : `${selected.length}명 기준 주변 맛집 추천 →`}
              </button>
              <div style={{ display: "flex", gap: 6 }}>
                {(["naver", "kakao"] as const).map((p) => {
                  const isOn = providers.has(p);
                  const color = p === "naver" ? "#03C75A" : "#FAE100";
                  const textColor = p === "naver" ? "#fff" : "#3A1D1D";
                  return (
                    <button key={p} onClick={() => {
                      setProviders((prev) => {
                        const next = new Set(prev);
                        if (next.has(p) && next.size > 1) next.delete(p);
                        else next.add(p);
                        return next;
                      });
                    }} style={{
                      padding: "7px 16px", borderRadius: 100, border: `2px solid ${isOn ? color : "var(--border)"}`,
                      background: isOn ? color : "transparent",
                      color: isOn ? textColor : "var(--text-muted)",
                      fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                    }}>
                      {p === "naver" ? "N 네이버" : "K 카카오"}
                    </button>
                  );
                })}
              </div>
              {location && <span style={{ fontSize: 12, color: "var(--green)" }}>📍 {location.label || "위치 설정됨"}</span>}
              {!location && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>📍 위치 미설정 (거리 무관 검색)</span>}
            </div>
          )}

          {/* 추천 식당 결과 */}
          {scoredRestaurants.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <p style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600 }}>
                  주변 추천 맛집
                  <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)", marginLeft: 10 }}>{scoredRestaurants.length}곳</span>
                </p>
                <div style={{ display: "flex", gap: 5 }}>
                  {([["distance","📍 거리순"],["score","👍 선호순"],["rating","★ 별점순"],["category","🏷 카테고리"]] as const).map(([s, label]) => (
                    <button key={s} onClick={() => setSortBy(s)} style={{
                      padding: "5px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600,
                      border: sortBy === s ? "2px solid var(--accent)" : "1.5px solid var(--border)",
                      background: sortBy === s ? "var(--accent-soft)" : "transparent",
                      color: sortBy === s ? "var(--accent)" : "var(--text-muted)",
                      cursor: "pointer", transition: "all 0.15s",
                    }}>{label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sortedRestaurants.map((r, i) => (
                  <div key={i} style={{
                    background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)",
                    boxShadow: "var(--shadow)", overflow: "hidden",
                    borderLeft: `4px solid ${r.score > 0 ? MEMBER_COLORS[i % MEMBER_COLORS.length] : "var(--border)"}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", gap: 12 }}>
                      {/* 음식 사진 */}
                      {(() => {
                        const catKey = r.category.split(">").pop()?.trim() || r.category;
                        const imgUrl = foodImages[catKey];
                        return (
                          <div style={{ width: 56, height: 56, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: "var(--bg)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {imgUrl
                              ? <img src={imgUrl} alt={catKey} style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" />
                              : <span style={{ fontSize: 26 }}>{categoryEmoji(r.category)}</span>
                            }
                          </div>
                        );
                      })()}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                          <a href={r.link} target="_blank" rel="noopener noreferrer"
                            style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 600, color: "var(--text)", textDecoration: "none" }}>
                            {r.title}
                          </a>
                          {r.distance !== null && (
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: "var(--green-soft)", color: "var(--green)", fontWeight: 600, flexShrink: 0 }}>
                              📍 {formatDistance(r.distance)}
                            </span>
                          )}
                          {reviewAvgs[r.title] && (
                            <span style={{ fontSize: 12, color: "#F5A623", fontWeight: 700, flexShrink: 0 }}>
                              ★ {reviewAvgs[r.title].toFixed(1)}
                            </span>
                          )}
                          {r.score > 0 && (
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: "#FFF8E1", color: "#C77800", fontWeight: 600, flexShrink: 0 }}>
                              👍 선호
                            </span>
                          )}
                          {r.matchedLikes.slice(0, 1).map((like) => (
                            <span key={like} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 500, flexShrink: 0 }}>{like}</span>
                          ))}
                        </div>
                        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.category}</p>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{r.address}</p>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                        <button onClick={() => toggleFavorite(r)} style={{ width: 34, height: 34, borderRadius: "50%", fontSize: 16, background: favorites.has(r.title) ? "#FFF8E1" : "var(--bg)", border: `1.5px solid ${favorites.has(r.title) ? "#F5A623" : "var(--border)"}`, color: favorites.has(r.title) ? "#F5A623" : "var(--text-muted)", cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {favorites.has(r.title) ? "★" : "☆"}
                        </button>
                        <a href={`https://map.naver.com/p/search/${encodeURIComponent(r.title + " " + r.address)}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ width: 34, height: 34, borderRadius: "50%", background: "#03C75A", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", flexShrink: 0 }}
                          title="네이버지도">
                          <span style={{ color: "#fff", fontWeight: 900, fontSize: 13 }}>N</span>
                        </a>
                        <a href={`https://map.kakao.com/link/search/${encodeURIComponent(r.title)}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ width: 34, height: 34, borderRadius: "50%", background: "#FAE100", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", flexShrink: 0 }}
                          title="카카오맵">
                          <span style={{ color: "#3A1D1D", fontWeight: 900, fontSize: 13 }}>K</span>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 기록 탭 ── */}
      {tab === "history" && (
        <HistoryTab groupId={id} members={members} mapProvider={[...providers][0] || "naver"} />
      )}

      {/* ── 멤버 관리 탭 ── */}
      {tab === "members" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* 멤버 추가 */}
          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 22, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>새 멤버</p>
            <form onSubmit={(e) => { e.preventDefault(); addMember(); }} style={{ display: "flex", gap: 8 }}>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="이름 입력" style={{ flex: 1, padding: "10px 16px", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 14, color: "var(--text)", outline: "none" }} onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
              <button type="submit" style={{ padding: "10px 20px", borderRadius: 100, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>추가</button>
            </form>
          </div>

          {/* 멤버 목록 */}
          {members.map((m, idx) => {
            const color = MEMBER_COLORS[idx % MEMBER_COLORS.length];
            const isExpanded = expandedId === m.id;
            return (
              <div key={m.id} style={{ background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow)", overflow: "hidden", borderLeft: `4px solid ${color}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{m.name[0]}</div>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{m.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => toggleExpand(m.id)} style={{ padding: "5px 14px", borderRadius: 100, fontSize: 12, fontWeight: 500, border: "1.5px solid var(--border)", background: isExpanded ? "var(--text)" : "transparent", color: isExpanded ? "#fff" : "var(--text-muted)", cursor: "pointer", transition: "all 0.15s" }}>
                      {isExpanded ? "접기" : "선호도"}
                    </button>
                    <button onClick={() => deleteMember(m.id)} style={{ padding: "5px 12px", borderRadius: 100, fontSize: 12, border: "1.5px solid var(--border)", background: "transparent", color: "var(--red)", cursor: "pointer" }}>삭제</button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "18px" }}>
                    {/* 토글 */}
                    <div style={{ display: "flex", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 100, padding: 3, gap: 3, marginBottom: 18, width: "fit-content" }}>
                      {(["like", "dislike"] as const).map((t) => (
                        <button key={t} onClick={() => setPrefType(t)} style={{
                          padding: "6px 18px", borderRadius: 100, border: "none", fontSize: 13, fontWeight: 600,
                          background: prefType === t ? (t === "like" ? "var(--green)" : "var(--red)") : "transparent",
                          color: prefType === t ? "#fff" : "var(--text-muted)",
                          cursor: "pointer", transition: "all 0.15s",
                        }}>{t === "like" ? "👍 좋아함" : "🚫 못먹음"}</button>
                      ))}
                    </div>

                    {/* 대분류 */}
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 7 }}>대분류</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {largeCategories.map((cat) => (
                          <button key={cat} onClick={() => { setSelectedLarge(cat === selectedLarge ? "" : cat); setSelectedMedium(""); }} style={{ padding: "5px 14px", borderRadius: 100, fontSize: 12, fontWeight: 500, border: selectedLarge === cat ? "2px solid var(--accent)" : "1.5px solid var(--border)", background: selectedLarge === cat ? "var(--accent-soft)" : "transparent", color: selectedLarge === cat ? "var(--accent)" : "var(--text)", cursor: "pointer", transition: "all 0.15s" }}>{cat}</button>
                        ))}
                      </div>
                    </div>

                    {/* 중분류 */}
                    {selectedLarge && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 7 }}>중분류</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {mediumCategories.map((cat) => (
                            <button key={cat} onClick={() => setSelectedMedium(cat === selectedMedium ? "" : cat)} style={{ padding: "5px 14px", borderRadius: 100, fontSize: 12, fontWeight: 500, border: selectedMedium === cat ? "2px solid var(--accent)" : "1.5px solid var(--border)", background: selectedMedium === cat ? "var(--accent-soft)" : "transparent", color: selectedMedium === cat ? "var(--accent)" : "var(--text)", cursor: "pointer", transition: "all 0.15s" }}>{cat}</button>
                          ))}
                          <button onClick={() => addPreference(selectedLarge)} style={{ padding: "5px 14px", borderRadius: 100, fontSize: 12, border: "1.5px dashed var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>+ {selectedLarge} 전체</button>
                        </div>
                      </div>
                    )}

                    {/* 소분류 */}
                    {selectedMedium && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 7 }}>메뉴</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 150, overflowY: "auto" }}>
                          {menuItems.map((item) => {
                            const liked = memberPrefs.find((p) => p.food_name === item && p.preference_type === "like");
                            const disliked = memberPrefs.find((p) => p.food_name === item && p.preference_type === "dislike");
                            return (
                              <button key={item} onClick={() => addPreference(item)} style={{ padding: "4px 12px", borderRadius: 100, fontSize: 12, fontWeight: 500, border: liked ? "1.5px solid var(--green)" : disliked ? "1.5px solid var(--red)" : "1.5px solid var(--border)", background: liked ? "var(--green-soft)" : disliked ? "var(--red-soft)" : "transparent", color: liked ? "var(--green)" : disliked ? "var(--red)" : "var(--text)", cursor: "pointer", transition: "all 0.1s" }}>{item}</button>
                            );
                          })}
                          <button onClick={() => addPreference(selectedMedium)} style={{ padding: "4px 12px", borderRadius: 100, fontSize: 12, border: "1.5px dashed var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>+ {selectedMedium} 전체</button>
                        </div>
                      </div>
                    )}

                    {/* 직접 입력 */}
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 7 }}>직접 입력</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input value={customInput} onChange={(e) => setCustomInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPreference(customInput, true); } }} placeholder="음식명 직접 입력" list="custom-menu-suggestions" style={{ flex: 1, padding: "7px 14px", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 13, outline: "none" }} onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
                        <datalist id="custom-menu-suggestions">
                          {customMenus.map((m) => <option key={m} value={m} />)}
                        </datalist>
                        <button onClick={() => addPreference(customInput, true)} style={{ padding: "7px 16px", borderRadius: 100, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>등록</button>
                      </div>
                    </div>

                    {/* 등록된 선호도 */}
                    {memberDislikes.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--red)", marginBottom: 6 }}>🚫 못먹는 음식</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {memberDislikes.map((p) => (
                            <button key={p.id} onClick={() => removePreference(p.id)} style={{ padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 500, background: "var(--red-soft)", border: "1px solid var(--red)", color: "var(--red)", cursor: "pointer" }}>{p.food_name} ✕</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {memberLikes.length > 0 && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--green)", marginBottom: 6 }}>❤️ 좋아하는 음식</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {memberLikes.map((p) => (
                            <button key={p.id} onClick={() => removePreference(p.id)} style={{ padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 500, background: "var(--green-soft)", border: "1px solid var(--green)", color: "var(--green)", cursor: "pointer" }}>{p.food_name} ✕</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {memberLikes.length === 0 && memberDislikes.length === 0 && (
                      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>아직 등록된 선호도가 없습니다</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
