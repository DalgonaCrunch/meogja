"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { trackPlaceClick, fetchPlaceClickStats, getClickCount } from "@/lib/placeClicks";
import LoadingCat from "@/components/LoadingCat";
import MapPanel, { ViewToggle } from "@/components/MapPanel";
import type { MapPlace } from "@/components/NearbyMap";
import { normalizeCoord, cleanTitle } from "@/lib/foodCategory";

type Restaurant = {
  title: string;
  address: string;
  category: string;
  distance?: number;
  mapx?: string;
  mapy?: string;
  roadAddress?: string;
  telephone?: string;
  link?: string;
};

function normalizePlaceName(name: string): string {
  return name
    .replace(/\s/g, "")
    .replace(/(본점|지점|분점|직영점|[가-힣]{1,4}점)$/, "")
    .toLowerCase();
}

function SearchContent() {
  const router = useRouter();
  const [menus, setMenus] = useState<string[]>([]);
  const [results, setResults] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const EMPTY_CATS = ["cat-31","cat-16","cat-32"];
  const [emptyCat] = useState(() => EMPTY_CATS[Math.floor(Math.random() * EMPTY_CATS.length)]);
  const [location, setLocation] = useState<{lat:number;lng:number;label?:string}|null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [searchProvider, setSearchProvider] = useState<"naver" | "kakao" | "google">("kakao");
  const [providerReady, setProviderReady] = useState(false);
  const [findGroupModal, setFindGroupModal] = useState<Restaurant | null>(null);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [groupCreating, setGroupCreating] = useState(false);
  const [patRestaurant, setPatRestaurant] = useState<Record<string, number>>({});
  const [patMenu, setPatMenu] = useState<Record<string, number>>({});
  const [myGroups, setMyGroups] = useState<{id:string;name:string;emoji:string|null;image_url:string|null}[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [placeClicks, setPlaceClicks] = useState<Record<string, number>>({});
  const [usedRadius, setUsedRadius] = useState<number>(1000);
  const [expandedRadius, setExpandedRadius] = useState(false);
  /* 홈에서 바로 들어오는 이 화면에도 지도를 붙였다(예전에는 /nearby 에만 있었다).
     지도를 기본으로 두고, SDK·도메인 문제로 안 뜰 때를 위해 목록 전환을 남긴다. */
  const [view, setView] = useState<"list" | "map">("map");
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);
  /* 지도를 못 띄우는 환경(키 없음·도메인 미등록)에서 결과가 안 보이면 안 된다 →
     한 번은 자동으로 목록으로 되돌린다. */
  const [mapBroken, setMapBroken] = useState(false);

  useEffect(() => {
    getSupabase().from("meal_pats").select("restaurant_name,menu").eq("status", "open")
      .then(({ data }) => {
        if (!data) return;
        const byRest: Record<string, number> = {};
        const byMenu: Record<string, number> = {};
        data.forEach((r: { restaurant_name: string | null; menu: string }) => {
          if (r.restaurant_name) {
            const k = normalizePlaceName(r.restaurant_name);
            if (k) byRest[k] = (byRest[k] || 0) + 1;
          }
          if (r.menu) {
            const k = r.menu.trim();
            byMenu[k] = (byMenu[k] || 0) + 1;
          }
        });
        setPatRestaurant(byRest);
        setPatMenu(byMenu);
      });
  }, []);

  useEffect(() => {
    if (!findGroupModal) return;
    setLoadingGroups(true);
    getCurrentUser().then(async (u) => {
      if (u.type === "none") { setLoadingGroups(false); return; }
      const userId = u.type === "auth" ? u.user.id : null;
      const guestName = u.type === "guest" ? u.user.name : null;
      let q = getSupabase().from("members").select("group_id").eq("status", "approved");
      if (userId) q = q.eq("user_id", userId);
      else if (guestName) q = q.eq("guest_name", guestName);
      const { data: memberships } = await q;
      const ids = (memberships || []).map((m: {group_id: string}) => m.group_id);
      if (ids.length > 0) {
        const { data: groups } = await getSupabase().from("groups").select("id,name,emoji,image_url").in("id", ids).order("created_at", { ascending: false });
        setMyGroups(groups || []);
      } else {
        setMyGroups([]);
      }
      setLoadingGroups(false);
    });
  }, [findGroupModal]);

  useEffect(() => {
    let resolvedProvider: "naver" | "kakao" | "google" = "kakao";
    fetch("/api/admin/settings")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.search_provider) { resolvedProvider = d.search_provider; setSearchProvider(d.search_provider); } })
      .catch(() => {})
      .finally(() => {
        setProviderReady(true);
        const raw = sessionStorage.getItem("meogja_preset_menus");
        if (raw) {
          try { setMenus(JSON.parse(raw)); } catch {}
          sessionStorage.removeItem("meogja_preset_menus");
        }
        let homeLabel: string | undefined;
        try {
          const hl = sessionStorage.getItem("meogja_home_location");
          if (hl) homeLabel = JSON.parse(hl).label;
        } catch { /* ignore */ }

        const searchLoc = sessionStorage.getItem("meogja_search_location");
        if (searchLoc) {
          try {
            const loc = JSON.parse(searchLoc);
            setLocation({ lat: loc.lat, lng: loc.lng, label: homeLabel });
            sessionStorage.removeItem("meogja_search_location");
            return;
          } catch {}
        }
        const homeLoc = sessionStorage.getItem("meogja_home_location");
        if (homeLoc) {
          try {
            const loc = JSON.parse(homeLoc);
            setLocation({ lat: loc.lat, lng: loc.lng, label: loc.label });
            return;
          } catch {}
        }
        requestLocation();
      });
  }, []);

  useEffect(() => {
    if (menus.length > 0 && location && providerReady) search();
  }, [menus, location, providerReady]);

  // 헤더에서 위치를 바꾸면 기준 위치 갱신 → 위 effect가 자동 재검색
  useEffect(() => {
    const onLocChange = (e: Event) => {
      const loc = (e as CustomEvent).detail;
      if (!loc) return;
      setLocation({ lat: loc.lat, lng: loc.lng, label: loc.label });
    };
    window.addEventListener("meogja-location-change", onLocChange);
    return () => window.removeEventListener("meogja-location-change", onLocChange);
  }, []);

  // 같은 기준 위치로 결과만 다시 조회
  function refresh() {
    if (!location || loading || locating) return;
    search();
  }

  function requestLocation() {
    if (!navigator.geolocation) { setError("이 브라우저는 위치 기능을 지원하지 않습니다."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // home_location label 있으면 같이 전달 (API 지역명 검색용)
        let label: string | undefined;
        try {
          const hl = sessionStorage.getItem("meogja_home_location");
          if (hl) label = JSON.parse(hl).label;
        } catch { /* ignore */ }
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, label });
        setLocating(false);
      },
      () => { setError("위치 권한을 허용해주세요.\n설정에서 위치 접근을 허용하면 주변 식당을 찾을 수 있습니다."); setLocating(false); },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }

  async function search() {
    if (!location || menus.length === 0) return;
    setLoading(true);
    setError(null);
    setExpandedRadius(false);
    try {
      const apiEndpoint = searchProvider === "naver" ? "/api/search" : searchProvider === "google" ? "/api/search-google" : "/api/search-kakao";
      // 결과가 하나도 없으면 반경을 넓혀 재시도 (주변 맛집 페이지와 동일한 규칙)
      const RADII = [1000, 2000, 3000];
      let all: Restaurant[] = [];
      let finalRadius = 1000;
      for (const radius of RADII) {
        // 메뉴마다 개별 검색 후 합치기 (중복 제거, 거리순 정렬)
        const seen = new Set<string>();
        const round: Restaurant[] = [];
        await Promise.all(menus.map(async (menu) => {
          const params = new URLSearchParams({ query: menu, x: String(location.lng), y: String(location.lat), radius: String(radius), size: "15" });
          if (location.label) params.set("location", location.label);
          try {
            const res = await fetch(`${apiEndpoint}?${params}`);
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || "검색 실패");
            }
            const data = await res.json();
            (data.items || []).forEach((item: Restaurant) => {
              const key = `${item.title}|${item.address}`;
              if (!seen.has(key)) { seen.add(key); round.push(item); }
            });
          } catch (err) {
            throw err;
          }
        }));
        all = round;
        finalRadius = radius;
        if (round.length > 0) break;
      }
      setUsedRadius(finalRadius);
      setExpandedRadius(finalRadius > 1000);
      all.sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999));
      setResults(all);
      setPickedIdx(null);
      if (all.length) fetchPlaceClickStats(all.map(r => (r.title || "").replace(/<[^>]*>/g, ""))).then(setPlaceClicks);
      // 상위 15개 식당 이미지 비동기 fetch (결과 개수와 맞춤)
      all.slice(0, 15).forEach(async (item) => {
        const name = (item.title || "").replace(/<[^>]*>/g, "");
        if (!name) return;
        try {
          const r = await fetch(`/api/food-image?query=${encodeURIComponent(name)}`);
          const d = await r.json();
          if (d.url) setImages(prev => ({ ...prev, [name]: d.url }));
        } catch { /* fallback */ }
      });
      // 맛집찾기 실행 이벤트 기록 (선호도 스코어 반영)
      menus.forEach(menu => {
        fetch("/api/food-stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ food_name: menu, event_type: "nearby_search" }),
        }).catch(() => {/* fire-and-forget */});
      });
    } catch {
      setError("검색 중 오류가 발생했습니다.");
    }
    setLoading(false);
  }

  async function createGroupForRestaurant() {
    const name = groupNameInput.trim();
    if (!name || groupCreating) return;
    setGroupCreating(true);
    const u = await getCurrentUser();
    if (u.type === "none") { setGroupCreating(false); router.push("/login"); return; }
    const ownerId = u.type === "auth" ? u.user.id : null;
    const ownerGuestName = u.type === "guest" ? u.user.name : null;
    const { data } = await getSupabase().from("groups").insert({
      name, emoji: "🍽️", owner_id: ownerId, owner_guest_name: ownerGuestName,
      is_private: false, require_auth: false, requires_approval: false,
    }).select().single();
    if (data) {
      const ownerName = u.type === "auth"
        ? (u.user.display_name || u.user.email?.split("@")[0] || "모임장")
        : u.type === "guest" ? u.user.name : null;
      let createdMemberId: string | null = null;
      if (ownerName) {
        const { data: memberData } = await getSupabase().from("members").insert({
          name: ownerName, group_id: data.id, user_id: ownerId, guest_name: ownerGuestName, status: "approved",
        }).select().single();
        createdMemberId = memberData?.id || null;
      }
      if (ownerId) {
        await getSupabase().from("group_memberships").insert({ group_id: data.id, user_id: ownerId, role: "owner" });
      }
      const menu = menus[0] || (findGroupModal?.category?.split(" > ").pop()?.trim() || "음식");
      sessionStorage.setItem("meogja_preset_menus", JSON.stringify(menus.length > 0 ? menus : [menu]));
      if (createdMemberId && ownerName && findGroupModal) {
        sessionStorage.setItem("meogja_auto_pat", JSON.stringify({ restaurantName: (findGroupModal.title || "").replace(/<[^>]*>/g, ""), menu, creatorMemberId: createdMemberId, creatorName: ownerName }));
      }
      router.push(`/groups/${data.id}`);
    }
    setGroupCreating(false);
  }

  /* 지도에 넘길 형태로 변환.
     🔴 네이버(/api/search)는 mapx/mapy 를 1e7 배 정수로 내려준다 — normalizeCoord 가
     되돌린다. 좌표가 없는 결과(구글에서 간혹)는 지도에서 빼고 목록에만 남긴다. */
  const mapPlaces: MapPlace[] = [];
  const mapPlaceOrigin: Restaurant[] = [];
  results.forEach((r) => {
    const lng = normalizeCoord(r.mapx);
    const lat = normalizeCoord(r.mapy);
    if (lng === null || lat === null) return;
    mapPlaces.push({
      title: cleanTitle(r.title),
      category: r.category || "",
      address: r.roadAddress || r.address || "",
      distance: r.distance ?? null,
      mapx: String(lng),
      mapy: String(lat),
      link: r.link || "",
      phone: r.telephone || "",
    });
    mapPlaceOrigin.push(r);
  });
  const mapCenter = location ? { x: location.lng, y: location.lat } : null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, padding:"16px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => router.back()} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"var(--text)", flexShrink:0 }}>←</button>
        <div style={{ flex:1, minWidth:0 }}>
          <h1 style={{ fontFamily:"var(--font-display)", fontSize:18, margin:0 }}>주변 맛집 찾기</h1>
          {location?.label && <p style={{ fontSize:12, color:"var(--text-2)", margin:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>📍 {location.label} 기준 {usedRadius >= 1000 ? `${usedRadius / 1000}km` : `${usedRadius}m`}</p>}
        </div>
        <button className="tap" onClick={refresh} disabled={loading || locating || !location} aria-label="다시 찾기" style={{
          display:"flex", alignItems:"center", gap:5, flexShrink:0,
          padding:"7px 13px", borderRadius:"var(--r-pill)",
          border:"1.5px solid var(--primary)", background:"transparent",
          color:"var(--primary)", fontSize:12.5, fontWeight:700,
          cursor: loading || locating || !location ? "default" : "pointer",
          opacity: loading || locating || !location ? .45 : 1,
        }}>
          <span style={{ display:"inline-block", fontSize:13, animation: loading ? "spin .8s linear infinite" : "none" }}>↻</span>
          다시 찾기
        </button>
      </div>

      {(menus.length > 0 || results.length > 0) && (
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, flex:1, minWidth:0 }}>
            {menus.map(m => (
              <span key={m} style={{ padding:"6px 12px", borderRadius:"var(--r-pill)", background:"var(--primary)", color:"#fff", fontSize:13, fontWeight:600 }}>{m}</span>
            ))}
          </div>
          {/* 목록 ↔ 지도 (/nearby 와 같은 모양) */}
          {results.length > 0 && <ViewToggle view={view} onChange={setView} />}
        </div>
      )}

      {locating && (
        <LoadingCat text="📍 위치 확인 중…" />
      )}

      {error && (
        <div style={{ padding:"14px 16px", borderRadius:12, background:"#FFF4CC", border:"1.5px solid #F5A623", color:"#7A5A00", fontSize:14 }}>
          {error}
          <button onClick={requestLocation} style={{ display:"block", marginTop:8, padding:"8px 16px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontSize:13, cursor:"pointer" }}>다시 시도</button>
        </div>
      )}

      {loading && (
        <LoadingCat text="먹자냥이 찾는 중…" />
      )}

      {expandedRadius && results.length > 0 && (
        <div style={{ padding:"10px 14px", borderRadius:12, background:"var(--primary-light)", border:"1.5px solid var(--primary)", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:18 }}>🔍</span>
          <p style={{ fontSize:13, color:"var(--primary)", fontWeight:600, margin:0 }}>
            1km 내 결과 없어 {usedRadius / 1000}km 범위로 확장했어요
          </p>
        </div>
      )}

      {!loading && results.length === 0 && location && !error && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"48px 16px" }}>
          <img src={`/mascot/avatars/${emptyCat}.png`} alt="" style={{ width:80, height:80, objectFit:"contain", marginBottom:12, mixBlendMode:"multiply" }} />
          <p style={{ fontFamily:"var(--font-display)", fontSize:16, color:"var(--text)", marginBottom:6 }}>검색 결과가 없습니다</p>
          <p style={{ fontSize:13, color:"var(--text-3)", marginBottom:16 }}>다른 메뉴나 위치로 다시 시도해보세요</p>
          <button onClick={search} style={{ padding:"10px 24px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontSize:14, cursor:"pointer" }}>다시 검색</button>
        </div>
      )}

      {/* 같이먹을사람 구하기 모달 */}
      {findGroupModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:80 }}
          onClick={() => setFindGroupModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"24px 24px 0 0", padding:"20px 20px calc(32px + env(safe-area-inset-bottom, 0px))", width:"100%", maxWidth:480 }}>
            <div style={{ width:40, height:5, borderRadius:99, background:"var(--border)", margin:"0 auto 16px" }} />
            <p style={{ fontFamily:"var(--font-display)", fontSize:17, marginBottom:4 }}>🍽️ 같이 먹을 사람 구하기</p>
            <p style={{ fontSize:12, color:"var(--text-2)", marginBottom:16 }}>{(findGroupModal.title || "").replace(/<[^>]*>/g, "")}</p>
            {loadingGroups ? (
              <LoadingCat text="모임 불러오는 중…" size={48} padding="8px 0" />
            ) : myGroups.length > 0 ? (
              <div style={{ marginBottom:12 }}>
                <p style={{ fontSize:11, fontWeight:700, color:"var(--text-2)", marginBottom:8 }}>👥 내 모임에서 찾기</p>
                <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:180, overflowY:"auto" }}>
                  {myGroups.map(g => (
                    <button key={g.id} className="tap" onClick={() => {
                      const menu = menus[0] || (findGroupModal?.category?.split(" > ").pop()?.trim() || "음식");
                      sessionStorage.setItem("meogja_preset_menus", JSON.stringify(menus.length > 0 ? menus : [menu]));
                      sessionStorage.setItem("meogja_auto_pat", JSON.stringify({ restaurantName: (findGroupModal!.title || "").replace(/<[^>]*>/g, ""), menu }));
                      setFindGroupModal(null);
                      router.push(`/groups/${g.id}`);
                    }} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:12, border:"1.5px solid var(--border)", background:"var(--bg)", cursor:"pointer", textAlign:"left" }}>
                      <span style={{ fontSize:20 }}>{g.emoji || "🍱"}</span>
                      <span style={{ fontFamily:"var(--font-display)", fontSize:14, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.name}</span>
                      <span style={{ color:"var(--text-3)", fontSize:16 }}>›</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button className="tap" onClick={() => { setFindGroupModal(null); router.push("/groups"); }}
                style={{ width:"100%", padding:"11px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--primary)", background:"transparent", color:"var(--primary)", fontSize:14, fontWeight:700, cursor:"pointer", marginBottom:12 }}>
                👥 기존 모임 참여하기
              </button>
            )}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
              <div style={{ flex:1, height:1, background:"var(--border)" }} />
              <span style={{ fontSize:11, color:"var(--text-3)" }}>또는 새 모임 만들기</span>
              <div style={{ flex:1, height:1, background:"var(--border)" }} />
            </div>
            <input
              value={groupNameInput}
              onChange={e => setGroupNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") createGroupForRestaurant(); }}
              placeholder="모임 이름을 입력하세요"
              style={{ width:"100%", padding:"11px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--bg)", fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:10 }}
            />
            <button className="tap" onClick={createGroupForRestaurant} disabled={!groupNameInput.trim() || groupCreating}
              style={{ width:"100%", padding:"13px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:15, cursor:"pointer" }}>
              {groupCreating ? "생성 중…" : "모임 만들기 →"}
            </button>
          </div>
        </div>
      )}

      {/* 지도 보기 — 내 위치와 가게들이 어디쯤인지 */}
      {!loading && view === "map" && mapPlaces.length > 0 && (
        <div style={{ margin:"0 -16px" }}>
          <MapPanel
            places={mapPlaces}
            center={mapCenter}
            images={images}
            selectedIndex={pickedIdx}
            onSelect={setPickedIdx}
            onFindGroup={(p) => {
              const idx = mapPlaces.indexOf(p);
              const origin = idx >= 0 ? mapPlaceOrigin[idx] : null;
              setFindGroupModal(origin || { title: p.title, address: p.address, category: p.category, link: p.link });
              setGroupNameInput(`${p.title} 같이 먹어요`);
            }}
            onUnavailable={() => { if (!mapBroken) { setMapBroken(true); setView("list"); } }}
          />
        </div>
      )}

      {/* 좌표가 없어 지도에 못 올린 결과가 있으면 알려 준다 */}
      {!loading && view === "map" && results.length > mapPlaces.length && (
        <p style={{ fontSize:12, color:"var(--text-3)", margin:"8px 16px 0" }}>
          위치 정보가 없는 {results.length - mapPlaces.length}곳은 지도에 표시되지 않아요 — 목록에서 볼 수 있어요
        </p>
      )}

      {mapBroken && view === "list" && results.length > 0 && (
        <p style={{ fontSize:12, color:"var(--text-3)", margin:0 }}>
          🗺️ 지도를 열 수 없어서 목록으로 보여드려요
        </p>
      )}

      <div style={{ display: view === "list" ? "flex" : "none", flexDirection:"column", gap:10 }}>
        {results.map((r, i) => {
          const name = (r.title || "").replace(/<[^>]*>/g, "");
          const imgUrl = images[name];
          const kakaoHref = r.link && searchProvider !== "naver" ? r.link : `https://map.kakao.com/link/search/${encodeURIComponent(name)}`;
          const naverHref = r.link && searchProvider === "naver" ? r.link : `https://map.naver.com/p/search/${encodeURIComponent(name)}`;
          const googleHref = r.link && searchProvider === "google"
            ? r.link
            : `https://www.google.com/maps/search/?q=${encodeURIComponent(name + (r.address ? " " + r.address : ""))}&hl=ko`;
          return (
            <div key={i} style={{ background:"var(--surface)", borderRadius:16, border:"var(--card-border)", boxShadow:"var(--card-shadow)", overflow:"hidden" }}>
              <div style={{ display:"flex", gap:12, padding:"12px 14px" }}>
                <div style={{ width:80, height:80, borderRadius:14, overflow:"hidden", flexShrink:0, background:"var(--bg-2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {imgUrl
                    ? <img src={imgUrl} alt={name} referrerPolicy="no-referrer" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    : <img src="/mascot/tabs/food.png" style={{width:48, height:48, objectFit:"contain"}} />}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontFamily:"var(--font-display)", fontSize:16, color:"var(--text)", lineHeight:1.3 }}>{name}</span>
                    {r.distance != null && (
                      <span style={{ fontSize:12, color:"var(--text-3)", flexShrink:0, marginLeft:6 }}>
                        📍 {r.distance < 1000 ? `${Math.round(r.distance)}m` : `${(r.distance/1000).toFixed(1)}km`}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize:12, color:"var(--text-2)", marginBottom:6 }}>{r.roadAddress || r.address}</p>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8, flexWrap:"wrap" }}>
                    {r.category && <span style={{ fontSize:11, padding:"2px 8px", borderRadius:"var(--r-pill)", background:"var(--bg-2)", color:"var(--text-3)" }}>{r.category}</span>}
                    {(() => {
                      const normTitle = normalizePlaceName(name);
                      const restCount = patRestaurant[normTitle] || 0;
                      const menuCount = !restCount ? Object.entries(patMenu).filter(([menu]) => name.includes(menu) || r.category.includes(menu)).reduce((s, [,c]) => s + c, 0) : 0;
                      if (restCount > 0) return (
                        <span style={{ fontSize:11, padding:"2px 8px", borderRadius:"var(--r-pill)", background:"#FFF4E0", color:"#C05E00", fontWeight:700 }}>🍚 먹자팟 {restCount}개</span>
                      );
                      if (menuCount > 0) return (
                        <span style={{ fontSize:11, padding:"2px 8px", borderRadius:"var(--r-pill)", background:"var(--bg-2)", color:"var(--text-2)", fontWeight:600 }}>🍜 이 메뉴 팟 {menuCount}개</span>
                      );
                      return null;
                    })()}
                    {getClickCount(name, placeClicks) >= 5 && (
                      <span style={{ fontSize:11, padding:"2px 8px", borderRadius:"var(--r-pill)", background:"#FFF0E0", color:"#D65000", fontWeight:700 }}>
                        🔥 많이 찾아봤어요
                      </span>
                    )}
                  </div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    <a href={kakaoHref} target="_blank" rel="noopener noreferrer" onClick={() => trackPlaceClick(name)} style={{ padding:"5px 12px", borderRadius:8, background:"#FAE100", color:"#3A1D1D", fontSize:12, fontWeight:700, textDecoration:"none" }}>카카오맵</a>
                    <a href={naverHref} target="_blank" rel="noopener noreferrer" onClick={() => trackPlaceClick(name)} style={{ padding:"5px 12px", borderRadius:8, background:"#03C75A", color:"#fff", fontSize:12, fontWeight:700, textDecoration:"none" }}>네이버맵</a>
                    <a href={googleHref} target="_blank" rel="noopener noreferrer" onClick={() => trackPlaceClick(name)} style={{ padding:"5px 12px", borderRadius:8, background:"#4285F4", color:"#fff", fontSize:12, fontWeight:700, textDecoration:"none" }}>구글맵</a>
                  </div>
                  <button className="tap" onClick={() => { setFindGroupModal(r); setGroupNameInput(`${name} 같이 먹어요`); }} style={{
                    marginTop:6, width:"100%", padding:"8px", borderRadius:10, border:"none",
                    background:"var(--primary)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                  }}>
                    🍽️ 같이 먹을 사람 구하기
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingCat padding="60px 0" />}>
      <SearchContent />
    </Suspense>
  );
}
