"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

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

const FOOD_ICONS: Record<string, string> = {
  한식: "/food-icons/korean.png", 중식: "/food-icons/chinese.png", 일식: "/food-icons/japanese.png",
  양식: "/food-icons/western.png", 카페: "/food-icons/cafe.png", 치킨: "/food-icons/chicken.png",
  피자: "/food-icons/pizza.png", 분식: "/food-icons/tteok.png", 술집: "/food-icons/beer.png",
  패스트푸드: "/food-icons/burger.png", 베이커리: "/food-icons/bakery.png",
};
const FOOD_EMOJIS: Record<string, string> = {
  한식: "🍚", 중식: "🥢", 일식: "🍱", 양식: "🍝", 카페: "☕", 치킨: "🍗",
  피자: "🍕", 분식: "🍜", 술집: "🍺", 패스트푸드: "🍔", 베이커리: "🥐",
};

function categoryKey(cat: string) {
  for (const k of Object.keys(FOOD_ICONS)) {
    if (cat.includes(k)) return k;
  }
  return "한식";
}

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
  const [myGroups, setMyGroups] = useState<{id:string;name:string;emoji:string|null;image_url:string|null}[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

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
    setLoading(true);
    setError(null);
    const p = provider ?? searchProvider;
    try {
      const url = p === "google"
        ? `/api/search-google?query=맛집&x=${x}&y=${y}&radius=1000`
        : `/api/nearby?x=${x}&y=${y}&radius=1000&sort=${sortBy}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "주변 식당을 불러올 수 없습니다.");
      }
      const data = await res.json();
      const items: Place[] = data.items || [];
      setPlaces(items);
      // 상위 10개 이미지 비동기 fetch
      items.slice(0, 10).forEach(async (p) => {
        if (images[p.title]) return;
        try {
          const r = await fetch(`/api/food-image?query=${encodeURIComponent(p.title)}`);
          const d = await r.json();
          if (d.url) setImages(prev => ({ ...prev, [p.title]: d.url }));
        } catch { /* fallback */ }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "주변 식당을 불러올 수 없습니다.");
    }
    setLoading(false);
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

  const fmtDist = (d: number | null) => d === null ? "" : d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
  const catShort = (cat: string) => cat.split(" > ").pop() || cat;

  function kakaoUrl(p: Place) {
    if (p.link?.includes("place.map.kakao") || p.link?.includes("map.kakao.com/link")) return p.link;
    return `https://map.kakao.com/link/search/${encodeURIComponent(p.title)}`;
  }
  function naverUrl(p: Place) {
    return `https://map.naver.com/p/search/${encodeURIComponent(p.title)}`;
  }
  function googleUrl(p: Place) {
    const q = encodeURIComponent(p.title + (p.address ? " " + p.address : ""));
    return `https://www.google.com/maps/search/?q=${q}&hl=ko`;
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh", paddingBottom:32 }}>
      {/* 헤더 */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderBottom:"1px solid var(--border)" }}>
        <button onClick={() => router.back()} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"var(--text)", flexShrink:0 }}>←</button>
        <div style={{ flex:1, minWidth:0 }}>
          <h1 style={{ fontFamily:"var(--font-display)", fontSize:18, margin:0 }}>주변 맛집</h1>
          {locationLabel && <p style={{ fontSize:12, color:"var(--text-2)", margin:0 }}>📍 {locationLabel} 기준 1km</p>}
        </div>
      </div>

      {/* 정렬 탭 */}
      <div style={{ display:"flex", gap:8, padding:"12px 16px 0" }}>
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
      </div>

      {/* 상태 */}
      {(loading || locating) && (
        <div style={{ textAlign:"center", padding:"60px 0", color:"var(--text-2)" }}>
          <p style={{ fontSize:14 }}>{locating ? "📍 위치 확인 중…" : "🔍 주변 식당 검색 중…"}</p>
        </div>
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
              <div style={{ textAlign:"center", padding:"10px 0", color:"var(--text-2)", fontSize:13 }}>모임 불러오는 중…</div>
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

      {!loading && places.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:10, padding:"12px 16px 0" }}>
          {places.map((p, i) => {
            const ck = categoryKey(p.category);
            const imgUrl = images[p.title] || FOOD_ICONS[ck];
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
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      <a href={kakaoUrl(p)} target="_blank" rel="noopener noreferrer"
                        style={{ padding:"5px 12px", borderRadius:8, background:"#FAE100", color:"#3A1D1D", fontSize:12, fontWeight:700, textDecoration:"none" }}>
                        카카오맵
                      </a>
                      <a href={naverUrl(p)} target="_blank" rel="noopener noreferrer"
                        style={{ padding:"5px 12px", borderRadius:8, background:"#03C75A", color:"#fff", fontSize:12, fontWeight:700, textDecoration:"none" }}>
                        네이버맵
                      </a>
                      <a href={googleUrl(p)} target="_blank" rel="noopener noreferrer"
                        style={{ padding:"5px 12px", borderRadius:8, background:"#4285F4", color:"#fff", fontSize:12, fontWeight:700, textDecoration:"none" }}>
                        구글맵
                      </a>
                    </div>
                    <button className="tap" onClick={() => { setFindGroupModal(p); setGroupNameInput(`${p.title} 같이 먹어요`); }} style={{
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
    <Suspense fallback={<div style={{ padding:40, textAlign:"center", color:"var(--text-2)" }}>로딩 중…</div>}>
      <NearbyContent />
    </Suspense>
  );
}
