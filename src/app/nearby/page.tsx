"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { trackPlaceClick, fetchPlaceClickStats, getClickCount } from "@/lib/placeClicks";
import LoadingCat from "@/components/LoadingCat";
import MapPanel, { ViewToggle } from "@/components/MapPanel";
import { dedupePlaces } from "@/lib/dedupePlaces";
import { densityMap } from "@/lib/density";
import { sharePlace } from "@/lib/shareResult";
import { toast } from "@/lib/dialog";
import {
  FOOD_EMOJIS, categoryKey, localFoodIcon, catShort, fmtDist,
  kakaoUrl, naverUrl, googleUrl,
} from "@/lib/foodCategory";

type Place = {
  title: string;
  category: string;
  address: string;
  distance: number | null;
  mapx: string;
  mapy: string;
  link: string;
  phone: string;
};

/* 카테고리·아이콘·거리·지도링크 헬퍼는 lib/foodCategory.ts 로 옮겼다.
   /search 화면이 같은 카드를 그리는데 복사본이 갈라져 아이콘 버그를 한쪽만
   고치는 일이 있었다. */

function normalizePlaceName(name: string): string {
  return name
    .replace(/\s/g, "")
    .replace(/(본점|지점|분점|직영점|[가-힣]{1,4}점)$/, "")
    .toLowerCase();
}

function NearbyContent() {
  const router = useRouter();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [sort, setSort] = useState<"distance" | "accuracy">("distance");
  const [images, setImages] = useState<Record<string, string>>({});
  const [searchProvider, setSearchProvider] = useState<"naver" | "kakao" | "google">("kakao");
  const [findGroupModal, setFindGroupModal] = useState<Place | null>(null);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [groupCreating, setGroupCreating] = useState(false);
  const [patRestaurant, setPatRestaurant] = useState<Record<string, number>>({});
  const [patMenu, setPatMenu] = useState<Record<string, number>>({});
  const [placeClicks, setPlaceClicks] = useState<Record<string, number>>({});
  const [myGroups, setMyGroups] = useState<{id:string;name:string;emoji:string|null;image_url:string|null}[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [usedRadius, setUsedRadius] = useState<number>(1000);
  const [expandedRadius, setExpandedRadius] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  /* 지도를 기본으로 보여준다 — 어디쯤인지 먼저 보이는 게 고르는 데 낫다.
     SDK/도메인 문제로 지도가 안 뜨는 경우를 위해 목록 전환은 남긴다. */
  const [view, setView] = useState<"list" | "map">("map");
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);
  /* 지도 키·SDK 문제로 지도를 못 띄우면 결과가 아예 안 보이게 된다(지도가 기본이라).
     한 번은 자동으로 목록으로 되돌린다. 그 뒤 사용자가 다시 '지도'를 누르면 그대로 둔다. */
  const [mapBroken, setMapBroken] = useState(false);
  /* 가게 이름 → 그 가게로 만들어진 먹자팟 수. 목록 카드는 정규화한 이름으로 세는데
     지도 카드도 같은 값을 써야 두 화면이 다른 말을 하지 않는다. */
  /* 후보끼리의 밀집도(좌표만으로 계산 — 추가 API 없음) */
  const nearbyDensity = useMemo(() => densityMap(places, 80), [places]);

  const patRestaurantByTitle = useMemo(() => {
    const out: Record<string, number> = {};
    places.forEach(p => {
      const n = patRestaurant[normalizePlaceName(p.title)] || 0;
      if (n > 0) out[p.title] = n;
    });
    return out;
  }, [places, patRestaurant]);

  /** 같이 먹을 사람 구하기 모달 열기 — 모임 목록 로딩도 여기서 켠다 */
  function openFindGroup(p: Place, name: string) {
    setLoadingGroups(true);
    setMyGroups([]);
    setFindGroupModal(p);
    setGroupNameInput(`${name} 같이 먹어요`);
  }

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

  /* 모달을 열 때 openFindGroup 이 로딩을 켠다 — effect 안에서 동기적으로 setState 하면
     렌더가 연쇄된다(eslint react-hooks/set-state-in-effect). */
  useEffect(() => {
    if (!findGroupModal) return;
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
    let resolved: "naver" | "kakao" | "google" = "kakao";
    fetch("/api/admin/settings")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.search_provider) { resolved = d.search_provider; setSearchProvider(d.search_provider); } })
      .catch(() => {})
      .finally(() => {
        const saved = sessionStorage.getItem("meogja_home_location");
        if (saved) {
          try {
            const loc = JSON.parse(saved);
            if (loc.label) setLocationLabel(loc.label);
            fetchNearby(loc.lng, loc.lat, sort, resolved);
            return;
          } catch { /* ignore */ }
        }
        requestLocation(resolved);
      });
  }, []);

  // 헤더에서 위치를 바꾸면 목록도 다시 불러오기
  useEffect(() => {
    const onLocChange = (e: Event) => {
      const loc = (e as CustomEvent).detail;
      if (!loc) return;
      if (loc.label) setLocationLabel(loc.label);
      fetchNearby(loc.lng, loc.lat, sort, searchProvider);
    };
    window.addEventListener("meogja-location-change", onLocChange);
    return () => window.removeEventListener("meogja-location-change", onLocChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, searchProvider]);

  function requestLocation(provider?: string) {
    if (!navigator.geolocation) { setError("이 브라우저는 위치 기능을 지원하지 않습니다."); setLoading(false); return; }
    setLocating(true);
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        let label: string | undefined;
        try {
          const hl = sessionStorage.getItem("meogja_home_location");
          if (hl) label = JSON.parse(hl).label;
        } catch { /* ignore */ }
        if (label) setLocationLabel(label);
        fetchNearby(pos.coords.longitude, pos.coords.latitude, sort, provider);
      },
      () => { setLocating(false); setLoading(false); setError("위치 권한을 허용해주세요."); },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }

  async function fetchNearby(x: number, y: number, sortBy: string, provider?: string) {
    setCoords({ x, y });
    setLoading(true);
    setError(null);
    setExpandedRadius(false);
    const p = provider ?? searchProvider;
    const RADII = [1000, 2000, 3000];
    try {
      let items: Place[] = [];
      let finalRadius = 1000;
      for (const radius of RADII) {
        const url = p === "google"
          ? `/api/search-google?query=맛집&x=${x}&y=${y}&radius=${radius}`
          : `/api/nearby?x=${x}&y=${y}&radius=${radius}&sort=${sortBy}`;
        const res = await fetch(url);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "주변 식당을 불러올 수 없습니다.");
        }
        const data = await res.json();
        /* 같은 집이 이름·주소를 조금 달리해 여러 번 등록된 경우가 있다(실물에서 3개까지
           봤다). 이름을 다듬고 좌표가 80m 안이면 하나로 본다. */
        items = dedupePlaces(data.items || []);
        finalRadius = radius;
        if (items.length > 0) break;
      }
      setUsedRadius(finalRadius);
      setExpandedRadius(finalRadius > 1000);
      setPlaces(items);
      setPickedIdx(null);
      if (items.length) fetchPlaceClickStats(items.map(i => i.title)).then(setPlaceClicks);
      items.slice(0, 10).forEach(async (pl) => {
        if (images[pl.title]) return;
        try {
          const r = await fetch(`/api/food-image?query=${encodeURIComponent(pl.title)}`);
          const d = await r.json();
          if (d.url) setImages(prev => ({ ...prev, [pl.title]: d.url }));
        } catch { /* fallback */ }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "주변 식당을 불러올 수 없습니다.");
    }
    setLoading(false);
  }

  /* 지도를 밀어 옮긴 자리에서 다시 찾기. 헤더 위치도 그 동네 이름으로 바꿔 준다
     (그러지 않으면 "강남역 기준" 이라고 적힌 채 다른 동네 결과가 보인다). */
  async function searchHere(c: { x: number; y: number }) {
    fetchNearby(c.x, c.y, sort, searchProvider);
    try {
      const r = await fetch(`/api/reverse-geocode?x=${c.x}&y=${c.y}`);
      const d = await r.json();
      setLocationLabel(d.address || null);
    } catch { setLocationLabel(null); }
  }

  // 현재 기준 위치로 목록만 다시 조회 (위치 재감지 없음)
  function refresh() {
    if (!coords || loading || locating) return;
    fetchNearby(coords.x, coords.y, sort, searchProvider);
  }

  function handleSortChange(newSort: "distance" | "accuracy") {
    setSort(newSort);
    const saved = sessionStorage.getItem("meogja_home_location");
    if (saved) {
      try {
        const loc = JSON.parse(saved);
        fetchNearby(loc.lng, loc.lat, newSort, searchProvider);
      } catch { /* ignore */ }
    }
  }

  async function createGroupForRestaurant() {
    const name = groupNameInput.trim();
    if (!name || groupCreating) return;
    setGroupCreating(true);
    const u = await getCurrentUser();
    if (u.type === "none") { setGroupCreating(false); router.push("/login"); return; }
    const ownerId = u.type === "auth" ? u.user.id : null;
    const ownerGuestName = u.type === "guest" ? u.user.name : null;
    const ck = findGroupModal ? categoryKey(findGroupModal.category) : "한식";
    const emoji = FOOD_EMOJIS[ck] || "🍽️";
    const { data } = await getSupabase().from("groups").insert({
      name, emoji, owner_id: ownerId, owner_guest_name: ownerGuestName,
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
      // save preset + auto-pat context
      const menu = findGroupModal ? categoryKey(findGroupModal.category) : "음식";
      sessionStorage.setItem("meogja_preset_menus", JSON.stringify([menu]));
      if (createdMemberId && ownerName && findGroupModal) {
        sessionStorage.setItem("meogja_auto_pat", JSON.stringify({ restaurantName: findGroupModal.title, menu, creatorMemberId: createdMemberId, creatorName: ownerName }));
      }
      router.push(`/groups/${data.id}`);
    }
    setGroupCreating(false);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh", paddingBottom:32 }}>
      {/* 헤더 */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderBottom:"1px solid var(--border)" }}>
        <button onClick={() => router.back()} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"var(--text)", flexShrink:0 }}>←</button>
        <div style={{ flex:1, minWidth:0 }}>
          <h1 style={{ fontFamily:"var(--font-display)", fontSize:18, margin:0 }}>주변 맛집 찾기</h1>
          {locationLabel && <p style={{ fontSize:12, color:"var(--text-2)", margin:0 }}>📍 {locationLabel} 기준 {usedRadius >= 1000 ? `${usedRadius / 1000}km` : `${usedRadius}m`}</p>}
        </div>
        <button className="tap" onClick={refresh} disabled={loading || locating || !coords} aria-label="다시 찾기" style={{
          display:"flex", alignItems:"center", gap:5, flexShrink:0,
          padding:"7px 13px", borderRadius:"var(--r-pill)",
          border:"1.5px solid var(--primary)", background:"transparent",
          color:"var(--primary)", fontSize:12.5, fontWeight:700,
          cursor: loading || locating || !coords ? "default" : "pointer",
          opacity: loading || locating || !coords ? .45 : 1,
        }}>
          <span style={{ display:"inline-block", fontSize:13, animation: loading ? "spin .8s linear infinite" : "none" }}>↻</span>
          다시 찾기
        </button>
      </div>

      {/* 정렬 탭 + 목록/지도 전환 */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 16px 0" }}>
        {(["distance", "accuracy"] as const).map(s => (
          <button key={s} onClick={() => handleSortChange(s)} style={{
            padding:"7px 16px", borderRadius:"var(--r-pill)", fontSize:13, fontWeight:600, cursor:"pointer",
            border: sort === s ? "none" : "1.5px solid var(--border)",
            background: sort === s ? "var(--primary)" : "var(--surface)",
            color: sort === s ? "#fff" : "var(--text-2)",
          }}>
            {s === "distance" ? "📍 거리순" : "⭐ 정확도순"}
          </button>
        ))}
        <div style={{ flex:1 }} />
        {/* 목록 ↔ 지도 (MapPanel 과 같은 모양을 쓴다) */}
        <ViewToggle view={view} onChange={setView} />
      </div>

      {/* 상태 */}
      {(loading || locating) && (
        <LoadingCat text={locating ? "📍 위치 확인 중…" : "먹자냥이 찾는 중…"} padding="52px 0" />
      )}
      {error && !loading && (
        <div style={{ margin:"16px", padding:"14px 16px", borderRadius:12, background:"#FFF4CC", border:"1.5px solid #F5A623", color:"#7A5A00", fontSize:14 }}>
          {error}
          <button onClick={() => requestLocation(searchProvider)} style={{ display:"block", marginTop:8, padding:"8px 16px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontSize:13, cursor:"pointer" }}>
            다시 시도
          </button>
        </div>
      )}
      {!loading && !error && places.length === 0 && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"48px 16px" }}>
          <img src="/mascot/avatars/cat-31.png" alt="" style={{ width:80, height:80, objectFit:"contain", marginBottom:12, mixBlendMode:"multiply" }} />
          <p style={{ fontFamily:"var(--font-display)", fontSize:16, color:"var(--text)", marginBottom:6 }}>검색 결과가 없습니다</p>
          <p style={{ fontSize:13, color:"var(--text-3)" }}>위치나 검색 범위를 바꿔서 다시 시도해보세요</p>
        </div>
      )}

      {/* 범위 확장 알림 */}
      {expandedRadius && places.length > 0 && (
        <div style={{ margin:"10px 16px 0", padding:"10px 14px", borderRadius:12, background:"var(--primary-light)", border:"1.5px solid var(--primary)", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:18 }}>🔍</span>
          <p style={{ fontSize:13, color:"var(--primary)", fontWeight:600, margin:0 }}>
            1km 내 결과 없어 {usedRadius / 1000}km 범위로 확장했어요
          </p>
        </div>
      )}

      {/* 결과 카드 */}
      {/* 같이먹을사람 구하기 모달 */}
      {findGroupModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:80 }}
          onClick={() => setFindGroupModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"24px 24px 0 0", padding:"20px 20px calc(32px + env(safe-area-inset-bottom, 0px))", width:"100%", maxWidth:480 }}>
            <div style={{ width:40, height:5, borderRadius:99, background:"var(--border)", margin:"0 auto 16px" }} />
            <p style={{ fontFamily:"var(--font-display)", fontSize:17, marginBottom:4 }}>🍽️ 같이 먹을 사람 구하기</p>
            <p style={{ fontSize:12, color:"var(--text-2)", marginBottom:16 }}>{findGroupModal.title} · {catShort(findGroupModal.category)}</p>
            {loadingGroups ? (
              <LoadingCat text="모임 불러오는 중…" size={48} padding="8px 0" />
            ) : myGroups.length > 0 ? (
              <div style={{ marginBottom:12 }}>
                <p style={{ fontSize:11, fontWeight:700, color:"var(--text-2)", marginBottom:8 }}>👥 내 모임에서 찾기</p>
                <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:180, overflowY:"auto" }}>
                  {myGroups.map(g => (
                    <button key={g.id} className="tap" onClick={() => {
                      const menu = findGroupModal ? categoryKey(findGroupModal.category) : "음식";
                      sessionStorage.setItem("meogja_preset_menus", JSON.stringify([menu]));
                      sessionStorage.setItem("meogja_auto_pat", JSON.stringify({ restaurantName: findGroupModal!.title, menu }));
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

      {/* 지도 보기 — 현재 위치와 식당들이 어디쯤인지 한눈에 */}
      {!loading && !error && view === "map" && places.length > 0 && (
        <MapPanel
          places={places}
          center={coords}
          images={images}
          stats={{ clicks: placeClicks, pats: patRestaurantByTitle }}
          selectedIndex={pickedIdx}
          onSelect={setPickedIdx}
          onFindGroup={(p) => openFindGroup(p as Place, p.title)}
          onUnavailable={() => { if (!mapBroken) { setMapBroken(true); setView("list"); } }}
          onSearchHere={searchHere}
          searching={loading}
        />
      )}

      {mapBroken && view === "list" && places.length > 0 && (
        <p style={{ fontSize:12, color:"var(--text-3)", margin:"10px 16px 0" }}>
          🗺️ 지도를 열 수 없어서 목록으로 보여드려요
        </p>
      )}

      {!loading && view === "list" && places.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:10, padding:"12px 16px 0" }}>
          {places.map((p, i) => {
            const ck = categoryKey(p.category);
            const imgUrl = images[p.title] || localFoodIcon(p.category);
            const hasRealImg = !!images[p.title];
            return (
              <div key={i} style={{ background:"var(--surface)", borderRadius:16, border:"var(--card-border)", boxShadow:"var(--card-shadow)", overflow:"hidden" }}>
                <div style={{ display:"flex", gap:12, padding:"12px 14px" }}>
                  {/* 이미지 */}
                  <div style={{ width:80, height:80, borderRadius:14, overflow:"hidden", flexShrink:0, background:"var(--bg-2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {imgUrl
                      ? <img src={imgUrl} alt={ck} referrerPolicy="no-referrer"
                          style={{ width:"100%", height:"100%", objectFit: hasRealImg ? "cover" : "contain", padding: hasRealImg ? 0 : 6 }} />
                      : <img src="/mascot/tabs/food.png" style={{width:48, height:48, objectFit:"contain"}} />}
                  </div>
                  {/* 정보 */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontFamily:"var(--font-display)", fontSize:16, color:"var(--text)", lineHeight:1.3 }}>{p.title}</span>
                      {p.distance !== null && (
                        <span style={{ fontSize:12, color:"var(--text-3)", flexShrink:0, marginLeft:6 }}>📍 {fmtDist(p.distance)}</span>
                      )}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8, flexWrap:"wrap" }}>
                      {p.category && (
                        <span style={{ fontSize:11, padding:"2px 8px", borderRadius:"var(--r-pill)", background:"var(--bg-2)", color:"var(--text-3)" }}>
                          {catShort(p.category)}
                        </span>
                      )}
                      {p.phone && <span style={{ fontSize:11, color:"var(--text-3)" }}>{p.phone}</span>}
                      {(() => {
                        const normTitle = normalizePlaceName(p.title);
                        const restCount = patRestaurant[normTitle] || 0;
                        const menuCount = !restCount ? Object.entries(patMenu).filter(([menu]) => p.title.includes(menu) || p.category.includes(menu)).reduce((s, [,c]) => s + c, 0) : 0;
                        if (restCount > 0) return (
                          <span style={{ fontSize:11, padding:"2px 8px", borderRadius:"var(--r-pill)", background:"#FFF4E0", color:"#C05E00", fontWeight:700 }}>🍚 먹자팟 {restCount}개</span>
                        );
                        if (menuCount > 0) return (
                          <span style={{ fontSize:11, padding:"2px 8px", borderRadius:"var(--r-pill)", background:"var(--bg-2)", color:"var(--text-2)", fontWeight:600 }}>🍜 이 메뉴 팟 {menuCount}개</span>
                        );
                        return null;
                      })()}
                      {nearbyDensity[p.title] >= 3 && (
                        <span style={{ fontSize:11, padding:"2px 8px", borderRadius:"var(--r-pill)", background:"var(--bg-2)", color:"var(--text-2)", fontWeight:600 }}>
                          🍜 이 근처 {nearbyDensity[p.title]}곳 더
                        </span>
                      )}
                      {getClickCount(p.title, placeClicks) >= 5 && (
                        <span style={{ fontSize:11, padding:"2px 8px", borderRadius:"var(--r-pill)", background:"#FFF0E0", color:"#D65000", fontWeight:700 }}>
                          🔥 많이 찾아봤어요
                        </span>
                      )}
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      <a href={kakaoUrl(p)} target="_blank" rel="noopener noreferrer"
                        onClick={() => trackPlaceClick(p.title)}
                        style={{ padding:"5px 12px", borderRadius:8, background:"#FAE100", color:"#3A1D1D", fontSize:12, fontWeight:700, textDecoration:"none" }}>
                        카카오맵
                      </a>
                      <a href={naverUrl(p)} target="_blank" rel="noopener noreferrer"
                        onClick={() => trackPlaceClick(p.title)}
                        style={{ padding:"5px 12px", borderRadius:8, background:"#03C75A", color:"#fff", fontSize:12, fontWeight:700, textDecoration:"none" }}>
                        네이버맵
                      </a>
                      <a href={googleUrl(p)} target="_blank" rel="noopener noreferrer"
                        onClick={() => trackPlaceClick(p.title)}
                        style={{ padding:"5px 12px", borderRadius:8, background:"#4285F4", color:"#fff", fontSize:12, fontWeight:700, textDecoration:"none" }}>
                        구글맵
                      </a>
                      {/* 전화·예약 — 정한 다음이 이어져야 서비스가 끊기지 않는다 */}
                      {p.phone && (
                        <a href={`tel:${p.phone.replace(/[^0-9+]/g, "")}`} onClick={() => trackPlaceClick(p.title)}
                          style={{ padding:"5px 12px", borderRadius:8, background:"var(--green, #30A46C)", color:"#fff", fontSize:12, fontWeight:700, textDecoration:"none" }}>
                          📞 전화
                        </a>
                      )}
                      <a href={`https://booking.naver.com/booking/search?query=${encodeURIComponent(p.title)}`}
                        target="_blank" rel="noopener noreferrer" onClick={() => trackPlaceClick(p.title)}
                        style={{ padding:"5px 12px", borderRadius:8, background:"var(--bg-2)", color:"var(--text-2)", border:"1px solid var(--border)", fontSize:12, fontWeight:700, textDecoration:"none" }}>
                        예약 찾기
                      </a>
                      <button className="tap" onClick={async () => {
                        const r = await sharePlace({ name: p.title, category: p.category, address: p.address });
                        if (r === "copied") toast("링크를 복사했어요");
                      }} style={{ padding:"5px 12px", borderRadius:8, background:"var(--primary)", color:"#fff", border:"none", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        🔗 공유
                      </button>
                      {/* 목록에서 고른 가게를 지도에서 이어 본다(선택이 유지된다) */}
                      <button className="tap" onClick={() => { setPickedIdx(i); setView("map"); }}
                        style={{ padding:"5px 12px", borderRadius:8, background:"var(--bg-2)", color:"var(--text-2)", border:"1px solid var(--border)", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        🗺️ 지도에서
                      </button>
                    </div>
                    <button className="tap" onClick={() => openFindGroup(p, p.title)} style={{
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
      )}
    </div>
  );
}

export default function NearbyPage() {
  return (
    <Suspense fallback={<LoadingCat padding="60px 0" />}>
      <NearbyContent />
    </Suspense>
  );
}
