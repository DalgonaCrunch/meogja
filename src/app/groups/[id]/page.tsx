"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabase, Group, Member, FoodPreference } from "@/lib/supabase";
import { getAllLargeCategories, getMediumCategories, getMenuItems, getCategorySubItems, getAllMediumCategories, getRecommendations } from "@/lib/recommend";
import { getCurrentUser, CurrentUser } from "@/lib/auth";
import JoinModal from "./JoinModal";
import AddFavLocationForm from "./AddFavLocationForm";
import HistoryTab from "./tabs/HistoryTab";

const MEMBER_COLORS = ["#F4631E","#3D7A5A","#6B5CE7","#E7975C","#2E86AB","#C94040","#7B8C42","#A35CB0"];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "한식":    { bg: "#FFF3E0", text: "#E65100", border: "#FF9800" },
  "중식":    { bg: "#FCE4EC", text: "#880E4F", border: "#E91E63" },
  "일식":    { bg: "#E8F5E9", text: "#1B5E20", border: "#4CAF50" },
  "양식":    { bg: "#E3F2FD", text: "#0D47A1", border: "#2196F3" },
  "분식":    { bg: "#FFF8E1", text: "#F57F17", border: "#FFC107" },
  "동남아식":{ bg: "#E8EAF6", text: "#283593", border: "#3F51B5" },
  "고기류":  { bg: "#FFEBEE", text: "#B71C1C", border: "#F44336" },
  "치킨/닭": { bg: "#FFF9C4", text: "#827717", border: "#CDDC39" },
  "해산물":  { bg: "#E0F7FA", text: "#006064", border: "#00BCD4" },
  "카페":    { bg: "#EFEBE9", text: "#3E2723", border: "#795548" },
  "디저트":  { bg: "#FCE4EC", text: "#880E4F", border: "#E91E63" },
  "패스트푸드":{ bg: "#FBE9E7", text: "#BF360C", border: "#FF5722" },
  "기타":    { bg: "#F3E5F5", text: "#4A148C", border: "#9C27B0" },
};

function getSizeModifier(count: number): string {
  if (count === 1) return "혼밥";
  if (count >= 6 && count <= 10) return "단체석";
  if (count > 10) return "단체석 대관";
  return "";
}

function getSizeLabel(count: number): string {
  if (count === 1) return "혼밥 식당 우선";
  if (count >= 6 && count <= 10) return "단체석 식당 우선";
  if (count > 10) return "대규모 단체 식당 우선";
  return "";
}

const ATMOSPHERES = [
  { id: "", label: "🍽 전체", modifier: "" },
  { id: "casual", label: "😊 캐주얼", modifier: "" },
  { id: "date", label: "💑 데이트", modifier: "분위기 좋은" },
  { id: "business", label: "👔 비즈니스", modifier: "정갈한" },
  { id: "party", label: "🎉 회식/모임", modifier: "회식" },
  { id: "solo", label: "🙋 혼밥", modifier: "혼밥" },
];

function getCategoryColor(category: string) {
  const c = category.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_COLORS)) {
    if (c.includes(key.toLowerCase())) return val;
  }
  return { bg: "#F5F5F5", text: "#616161", border: "#9E9E9E" };
}

// "음식점 > 한식 > 치킨" → "치킨", "음식점" 제거
function refinedCategory(category: string): string {
  const parts = category.split(">").map(s => s.trim()).filter(s => s && s !== "음식점" && s !== "음식");
  return parts[parts.length - 1] || category;
}

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
  const [currentUser, setCurrentUser] = useState<CurrentUser>({ type: "none" });
  const [isOwner, setIsOwner] = useState(false);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showPrefSetup, setShowPrefSetup] = useState(false);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // 모임 이름 수정
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDescValue, setEditDescValue] = useState("");
  // 즐겨찾는 지역
  const [favLocations, setFavLocations] = useState<{id:string;name:string;address:string;lat:number|null;lng:number|null}[]>([]);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [tab, setTab] = useState<"recommend" | "history" | "members">("recommend");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [reviewAvgs, setReviewAvgs] = useState<Record<string, number>>({});
  const [memberImages, setMemberImages] = useState<Record<string, string>>({});
  const [foodImages, setFoodImages] = useState<Record<string, string>>({});

  // 추천 탭
  const [selected, setSelected] = useState<string[]>([]);
  const [scoredRestaurants, setScoredRestaurants] = useState<ScoredRestaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [providers, setProviders] = useState<Set<"naver" | "kakao">>(new Set(["naver", "kakao"]));
  const [location, setLocation] = useState<{ lat: number; lng: number; label?: string; address?: string } | null>(null);
  const [radius, setRadius] = useState(1000);
  const [sortBy, setSortBy] = useState<"distance" | "rating" | "score" | "category">("distance");
  // 카테고리 필터
  const [filterLarge, setFilterLarge] = useState<string>("");
  const [filterMedium, setFilterMedium] = useState<string>("");
  const [filterItem, setFilterItem] = useState<string>("");
  // 분위기 + 배달 전용 제외
  const [atmosphere, setAtmosphere] = useState<string>("");
  const [excludeDelivery, setExcludeDelivery] = useState(true);
  // 검색 모드
  const [searchMode, setSearchMode] = useState<"restaurant" | "menu">("restaurant");
  const [menuRecommendations, setMenuRecommendations] = useState<{ menu: string; large: string; medium: string; score: number }[]>([]);
  const [selectedMenus, setSelectedMenus] = useState<string[]>([]);
  const [voteUrl, setVoteUrl] = useState<string | null>(null);
  const [creatingVote, setCreatingVote] = useState(false);
  const [showVotePicker, setShowVotePicker] = useState(false);
  const [voteCandidates, setVoteCandidates] = useState<Set<string>>(new Set());
  const [randomPick, setRandomPick] = useState<string | null>(null);
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
    // 마지막 방문 모임 저장 (모임 탭 복귀용)
    localStorage.setItem("meogja_last_group", id);
    loadGroup();
    loadMembers();
    loadCustomMenus();
    loadFavorites();
    loadReviewAvgs();
    loadFavLocations();
    requestAutoLocation();
    getCurrentUser().then((u) => {
      setCurrentUser(u);
      // 로그인 후 복귀 → 참여 모달 자동 열기
      const pending = sessionStorage.getItem("meogja_pending_join");
      if (pending === id && u.type === "auth") {
        sessionStorage.removeItem("meogja_pending_join");
        setShowJoinModal(true);
      }
    });
    // 홈 빠른 카테고리에서 선택된 항목 적용
    const quickCat = localStorage.getItem("meogja_quick_cat");
    if (quickCat) {
      setFilterMedium(quickCat);
      localStorage.removeItem("meogja_quick_cat");
    }
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

  async function loadFavLocations() {
    const { data } = await getSupabase().from("favorite_locations").select("*").eq("group_id", id).order("created_at");
    if (data) setFavLocations(data);
  }

  async function addFavLocation(name: string, address: string, lat: number | null, lng: number | null) {
    if (favLocations.length >= 5) { alert("즐겨찾는 지역은 최대 5개까지 등록 가능합니다"); return; }
    await getSupabase().from("favorite_locations").insert({ group_id: id, name, address, lat, lng });
    loadFavLocations();
    setShowAddLocation(false);
  }

  async function removeFavLocation(locId: string) {
    await getSupabase().from("favorite_locations").delete().eq("id", locId);
    setFavLocations((prev) => prev.filter((l) => l.id !== locId));
  }

  async function saveGroupName() {
    if (!editNameValue.trim() || editNameValue === group?.name) { setEditingName(false); return; }
    const { error } = await getSupabase().from("groups").update({ name: editNameValue.trim() }).eq("id", id);
    if (error) { alert("이름 변경에 실패했습니다."); return; }
    setGroup((prev) => prev ? { ...prev, name: editNameValue.trim() } : null);
    setEditingName(false);
  }

  async function saveGroupDesc() {
    await getSupabase().from("groups").update({ description: editDescValue.trim() || null }).eq("id", id);
    setGroup((prev) => prev ? { ...prev, description: editDescValue.trim() || null } : null);
    setEditingDesc(false);
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
    // participants 파라미터 사용 (state 의존 버그 수정)
    const participantNames = members.filter((m) => participants.includes(m.id)).map((m) => m.name);
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
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // 좌표 → 주소 변환 (네이버 검색용)
        try {
          const res = await fetch(`/api/reverse-geocode?x=${lng}&y=${lat}`);
          const data = await res.json();
          setLocation({ lat, lng, label: data.address || "현재 위치", address: data.full });
        } catch {
          setLocation({ lat, lng, label: "현재 위치" });
        }
        setLocating(false);
      },
      () => setLocating(false)
    );
  }

  async function searchLocation() {
    if (!locationQuery.trim()) return;
    setSearchingLocation(true);
    try {
      const res = await fetch(`/api/geocode?query=${encodeURIComponent(locationQuery)}`);
      const data = await res.json();
      setLocationResults(data.places || []);
    } catch { setLocationResults([]); }
    finally { setSearchingLocation(false); }
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
    const user = await getCurrentUser();
    setCurrentUser(user);
    if (user.type === "auth") {
      setIsOwner(data.owner_id === user.user.id);
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      setIsAdmin(!!adminEmail && user.user.email === adminEmail);
    } else if (user.type === "guest") {
      // 게스트가 만든 모임 오너 체크
      setIsOwner(data.owner_guest_name === user.user.name);
    }
    // 모임장 이름 조회
    if (data.owner_id) {
      const { data: profile } = await getSupabase().from("user_profiles").select("display_name").eq("id", data.owner_id).single();
      if (profile?.display_name) setOwnerName(profile.display_name);
      else {
        // members 테이블에서 찾기
        const { data: ownerMember } = await getSupabase().from("members").select("name").eq("group_id", id).eq("user_id", data.owner_id).single();
        if (ownerMember) setOwnerName(ownerMember.name);
      }
    }
  }

  async function loadMembers() {
    const { data } = await getSupabase().from("members").select("*").eq("group_id", id).order("name");
    if (data) {
      setMembers(data);
      // user_id가 있는 멤버의 프로필 이미지 로드
      const userIds = data.filter((m) => m.user_id).map((m) => m.user_id);
      if (userIds.length > 0) {
        const { data: profiles } = await getSupabase().from("user_profiles").select("id, profile_image").in("id", userIds);
        if (profiles) {
          const imgMap: Record<string, string> = {};
          profiles.forEach((p) => { if (p.profile_image) imgMap[p.id] = p.profile_image; });
          // member_id → image 매핑
          const memberImgMap: Record<string, string> = {};
          data.forEach((m) => { if (m.user_id && imgMap[m.user_id]) memberImgMap[m.id] = imgMap[m.user_id]; });
          setMemberImages(memberImgMap);
        }
      }
      const validIds = new Set(data.map((m) => m.id));
      setSelected((prev) => prev.filter((id) => validIds.has(id)));
      // 내 멤버 찾기
      const user = await getCurrentUser();
      if (user.type === "auth") {
        const mine = data.find((m) => m.user_id === user.user.id);
        setMyMemberId(mine?.id || null);
      } else if (user.type === "guest") {
        const mine = data.find((m) => m.guest_name === user.user.name || m.name === user.user.name);
        setMyMemberId(mine?.id || null);
      }
    }
  }

  // 추천 탭 함수들
  function toggleMember(memberId: string) {
    setSelected((prev) => prev.includes(memberId) ? prev.filter((x) => x !== memberId) : [...prev, memberId]);
  }

  async function searchNearbyFromProvider(query: string, provider: "naver" | "kakao"): Promise<ScoredRestaurant[]> {
    const endpoint = provider === "naver" ? "/api/search" : "/api/search-kakao";
    // 인원 + 분위기 수정자 추가
    const sizeModifier = getSizeModifier(selected.length);
    const atmosModifier = ATMOSPHERES.find((a) => a.id === atmosphere)?.modifier || "";
    const modifiers = [sizeModifier, atmosModifier].filter(Boolean).join(" ");
    const fullQuery = modifiers ? `${modifiers} ${query}` : query;
    const params = new URLSearchParams({ query: fullQuery, radius: String(radius) });
    if (location) {
      params.set("x", String(location.lng));
      params.set("y", String(location.lat));
      // 네이버/카카오 모두 지역명 label 전달 (좌표 없을 때 fallback 검색)
      if (location.label) {
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

  function openVotePicker() {
    if (scoredRestaurants.length === 0) return;
    // 기본으로 상위 5개 선택
    setVoteCandidates(new Set(scoredRestaurants.slice(0, 5).map((r) => r.title)));
    setShowVotePicker(true);
  }

  async function startVote() {
    if (voteCandidates.size === 0) return;
    setCreatingVote(true);
    setShowVotePicker(false);
    try {
    const selected = scoredRestaurants.filter((r) => voteCandidates.has(r.title))
      .map((r) => ({ title: r.title, address: r.address, category: r.category }));
    const creatorName = currentUser.type === "auth" ? currentUser.user.display_name : currentUser.type === "guest" ? currentUser.user.name : "모임장";
    const { data } = await getSupabase().from("group_votes").insert({
      group_id: id,
      title: "오늘의 식당 투표",
      restaurants: selected,
      created_by: creatorName,
    }).select().single();
    if (data) {
      const url = `${window.location.origin}/vote/${data.id}`;
      setVoteUrl(url);
      await navigator.clipboard.writeText(url).catch(() => {});
    }
    } catch (e) { console.error("vote error", e); }
    finally { setCreatingVote(false); }
  }

  async function handleMenuRecommend() {
    if (selected.length === 0) return;
    setLoading(true);
    setMenuRecommendations([]);
    setSelectedMenus([]);
    const { data: prefs } = await getSupabase().from("food_preferences").select("*").in("member_id", selected);
    if (prefs) {
      const recs = getRecommendations(prefs, selected, 15);
      setMenuRecommendations(recs);
    }
    setLoading(false);
  }

  async function handleRestaurantByMenus() {
    if (selectedMenus.length === 0) return;
    setLoading(true);
    setScoredRestaurants([]);
    const { data: prefs } = await getSupabase().from("food_preferences").select("*").in("member_id", selected);
    const dislikes = new Set(prefs?.filter((p) => p.preference_type === "dislike").map((p) => p.food_name) ?? []);
    const results = await Promise.all(selectedMenus.map((q) => searchNearbyFromProvider(q, [...providers][0] || "naver")));
    const all = results.flat();
    const seen = new Set<string>();
    const unique = all.filter((r) => { const k = r.title + r.address; if (seen.has(k)) return false; seen.add(k); return true; });
    const filtered = unique.filter((r) => {
      const cat = (r.category || "").toLowerCase();
      const title = (r.title || "").toLowerCase();
      for (const d of dislikes) { if (cat.includes(d.toLowerCase())) return false; }
      if (excludeDelivery) {
        for (const kw of ["배달", "포장전문", "배달전문"]) { if (title.includes(kw) || cat.includes(kw)) return false; }
      }
      return true;
    });
    const scored: ScoredRestaurant[] = filtered.map((r) => ({
      ...r, score: selectedMenus.some((m) => (r.category || "").toLowerCase().includes(m.toLowerCase())) ? 2 : 0,
      matchedLikes: selectedMenus.filter((m) => (r.category || "").toLowerCase().includes(m.toLowerCase())),
    }));
    scored.sort((a, b) => {
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
      return b.score - a.score;
    });
    setScoredRestaurants(scored.slice(0, 15));
    setLoading(false);
  }

  async function handleRecommend() {
    if (selected.length === 0) return;
    setLoading(true);
    setScoredRestaurants([]);

    const { data: prefs } = await getSupabase().from("food_preferences").select("*").in("member_id", selected);
    const likes = prefs?.filter((p) => p.preference_type === "like").map((p) => p.food_name) ?? [];
    const dislikes = new Set(prefs?.filter((p) => p.preference_type === "dislike").map((p) => p.food_name) ?? []);

    // 카테고리 필터 우선 적용
    const DEFAULT_QUERIES = ["한식", "중식", "일식", "양식", "분식", "고기", "카페"];
    let queries: string[];
    if (filterItem) {
      queries = [filterItem];
    } else if (filterMedium) {
      queries = [filterMedium];
    } else if (filterLarge) {
      queries = getMediumCategories(filterLarge).slice(0, 5);
    } else {
      // 선호 + 기본 골고루 혼합 (선호 최대 4개 + 기본 3개)
      const likeQueries = [...new Set(likes)].slice(0, 4);
      const defaultFill = DEFAULT_QUERIES.filter((d) => !likeQueries.some((l) => l.includes(d) || d.includes(l))).slice(0, 3);
      queries = [...likeQueries, ...defaultFill];
      if (queries.length === 0) queries = DEFAULT_QUERIES.slice(0, 5);
    }

    // 매 검색마다 다른 결과를 위해 쿼리 순서 셔플
    queries = [...queries].sort(() => Math.random() - 0.5);

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

    // dislike 필터링 + 배달 전용 제외
    const filtered = unique.filter((r) => {
      const cat = (r.category || "").toLowerCase();
      const title = (r.title || "").toLowerCase();
      // 못먹는 음식 카테고리 제외
      for (const d of dislikes) {
        if (cat.includes(d.toLowerCase())) return false;
      }
      // 배달 전용 제외
      if (excludeDelivery) {
        const deliveryKeywords = ["배달", "포장전문", "배달전문", "ghost kitchen", "배민", "쿠팡이츠"];
        for (const kw of deliveryKeywords) {
          if (title.includes(kw) || cat.includes(kw)) return false;
        }
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
    const userId = currentUser.type === "auth" ? currentUser.user.id : null;
    const guestName = currentUser.type === "guest" ? currentUser.user.name : null;
    await getSupabase().from("members").insert({ name, group_id: id, user_id: userId, guest_name: guestName });
    setNewName("");
    loadMembers();
  }

  async function joinAsMyself() {
    // 현재 사용자 이름으로 멤버 추가
    const name = currentUser.type === "auth"
      ? (currentUser.user.display_name || currentUser.user.email?.split("@")[0] || "사용자")
      : currentUser.type === "guest" ? currentUser.user.name : null;
    if (!name) return;
    const userId = currentUser.type === "auth" ? currentUser.user.id : null;
    const guestName = currentUser.type === "guest" ? currentUser.user.name : null;
    await getSupabase().from("members").upsert({ name, group_id: id, user_id: userId, guest_name: guestName }, { onConflict: "group_id,name", ignoreDuplicates: true });
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

    // 이미 같은 타입으로 등록된 경우 → 토글(삭제)
    const alreadySame = memberPrefs.find((p) => p.food_name === trimmed && p.preference_type === prefType);
    if (alreadySame) {
      await removePreference(alreadySame.id);
      return;
    }

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

  function renderCard(r: ScoredRestaurant, i: number, _borderColor: string) {
    const isPicked = false; // 팝업으로 표시하므로 인라인 강조 제거
    const catKey = refinedCategory(r.category);
    const imgUrl = foodImages[catKey];
    const isFav = favorites.has(r.title);
    const hasScore = r.score > 0;
    const avg = reviewAvgs[r.title];
    return (
      <div key={`${r.title}-${i}`} style={{ background:"var(--surface)", borderRadius:16, border:"var(--card-border)", boxShadow:"var(--card-shadow)", overflow:"hidden" }}>
        <div style={{ display:"flex", gap:12, padding:"12px 14px" }}>
          {/* 음식 사진 */}
          <div style={{ width:80, height:80, borderRadius:14, overflow:"hidden", flexShrink:0, position:"relative",
            background:"var(--bg-2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            {imgUrl
              ? <img src={imgUrl} alt={catKey} style={{ width:"100%", height:"100%", objectFit:"cover" }} referrerPolicy="no-referrer" />
              : <span style={{ fontSize:34 }}>{categoryEmoji(r.category)}</span>}
            {hasScore && <div style={{ position:"absolute", top:5, left:5, padding:"2px 6px", borderRadius:6, background:"var(--primary)", color:"#fff", fontSize:10, fontWeight:800 }}>BEST</div>}
          </div>
          {/* 정보 */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:4 }}>
              <a href={`https://map.naver.com/p/search/${encodeURIComponent(r.title + " " + r.address)}`} target="_blank" rel="noopener noreferrer"
                style={{ fontFamily:"var(--font-display)", fontSize:16, color:"var(--text)", textDecoration:"none", lineHeight:1.3 }}>
                {r.title}
              </a>
              <button className="tap" onClick={() => toggleFavorite(r)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color: isFav ? "var(--primary)" : "var(--text-3)", marginTop:-2, flexShrink:0 }}>
                {isFav ? "♥" : "♡"}
              </button>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5, flexWrap:"wrap" }}>
              {avg && <span style={{ fontSize:12.5, color:"#E67700", fontWeight:700 }}>★ {avg.toFixed(1)}</span>}
              {r.distance !== null && <span style={{ fontSize:12, color:"var(--text-2)" }}>📍 {formatDistance(r.distance)}</span>}
              <span style={{ fontSize:12, color:"var(--text-3)" }}>·</span>
              <span style={{ fontSize:12, color:"var(--text-2)" }}>{r.category.split(">").slice(-1)[0]?.trim() || r.category}</span>
            </div>
            {hasScore && (
              <div style={{ fontSize:11.5, color:"var(--primary)", fontWeight:600, marginBottom:6 }}>💛 모임 선호도 높음</div>
            )}
            <div style={{ display:"flex", gap:6 }}>
              <a href={`https://map.naver.com/p/search/${encodeURIComponent(r.title + " " + r.address)}`} target="_blank" rel="noopener noreferrer"
                style={{ padding:"5px 12px", borderRadius:8, background:"#03C75A", color:"#fff", fontSize:12, fontWeight:700, textDecoration:"none" }}>N 지도</a>
              <a href={`https://map.kakao.com/link/search/${encodeURIComponent(r.title)}`} target="_blank" rel="noopener noreferrer"
                style={{ padding:"5px 12px", borderRadius:8, background:"#FAE100", color:"#3A1D1D", fontSize:12, fontWeight:700, textDecoration:"none" }}>K 지도</a>
              {r.link && r.link.startsWith("http") && (
                <a href={r.link} target="_blank" rel="noopener noreferrer"
                  style={{ padding:"5px 12px", borderRadius:8, background:"var(--bg-2)", border:"1px solid var(--border)", color:"var(--text-2)", fontSize:12, fontWeight:500, textDecoration:"none" }}>🌐</a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

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

  function handleJoined(memberId: string, memberName: string) {
    setMyMemberId(memberId);
    setShowJoinModal(false);
    // 참여 후 선호도 설정으로 안내
    setExpandedId(memberId);
    setTab("members");
    setShowPrefSetup(true);
    loadMembers();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* 🎲 랜덤선택 팝업 */}
      {randomPick && (() => {
        const r = scoredRestaurants.find((x) => x.title === randomPick);
        if (!r) return null;
        const catKey = refinedCategory(r.category);
        const imgUrl = foodImages[catKey];
        const avg = reviewAvgs[r.title];
        const isFav = favorites.has(r.title);
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:70, padding:20 }}
            onClick={() => setRandomPick(null)}>
            <div onClick={(e) => e.stopPropagation()} className="bounce-in" style={{ background:"var(--surface)", borderRadius:24, overflow:"hidden", width:"100%", maxWidth:380, boxShadow:"0 24px 60px rgba(0,0,0,.35)" }}>
              {/* 팝업 헤더 */}
              <div style={{ padding:"14px 18px", background:"linear-gradient(135deg, #F5A623, #FF7A45)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:24 }}>🎲</span>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:17, color:"#fff" }}>오늘 여기 어때요?</span>
                </div>
                <button onClick={() => setRandomPick(null)} style={{ background:"rgba(255,255,255,.25)", border:"none", borderRadius:"50%", width:30, height:30, cursor:"pointer", color:"#fff", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
              </div>
              {/* 식당 정보 */}
              <div style={{ padding:"18px 18px 22px" }}>
                <div style={{ display:"flex", gap:14, marginBottom:16 }}>
                  {/* 음식 사진 */}
                  <div style={{ width:80, height:80, borderRadius:16, overflow:"hidden", flexShrink:0, background:"var(--bg-2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {imgUrl ? <img src={imgUrl} alt={catKey} style={{ width:"100%", height:"100%", objectFit:"cover" }} referrerPolicy="no-referrer" /> : <span style={{ fontSize:36 }}>{categoryEmoji(r.category)}</span>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <a href={`https://map.naver.com/p/search/${encodeURIComponent(r.title + " " + r.address)}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily:"var(--font-display)", fontSize:20, color:"var(--text)", textDecoration:"none", display:"block", marginBottom:6 }}>{r.title}</a>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      {avg && <span style={{ fontSize:13, color:"#E67700", fontWeight:700 }}>★ {avg.toFixed(1)}</span>}
                      {r.distance !== null && <span style={{ fontSize:12, color:"var(--green)", fontWeight:600 }}>📍 {formatDistance(r.distance)}</span>}
                    </div>
                    <p style={{ fontSize:12.5, color:"var(--text-2)", marginTop:5 }}>{r.category.split(">").pop()?.trim()}</p>
                    <p style={{ fontSize:12, color:"var(--text-2)", marginTop:3 }}>{r.address}</p>
                  </div>
                </div>
                {/* 액션 버튼들 */}
                <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                  <button className="tap" onClick={() => toggleFavorite(r)} style={{ flex:1, padding:"10px", borderRadius:12, border:`1.5px solid ${isFav ? "#F5A623" : "var(--border)"}`, background: isFav ? "#FFF4CC" : "var(--bg-2)", color: isFav ? "#C77800" : "var(--text-2)", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                    {isFav ? "★ 즐겨찾기" : "☆ 즐겨찾기"}
                  </button>
                  <a href={`https://map.naver.com/p/search/${encodeURIComponent(r.title + " " + r.address)}`} target="_blank" rel="noopener noreferrer" style={{ flex:1, padding:"10px", borderRadius:12, background:"#03C75A", color:"#fff", fontSize:13, fontWeight:800, textDecoration:"none", textAlign:"center" }}>N 지도</a>
                  <a href={`https://map.kakao.com/link/search/${encodeURIComponent(r.title)}`} target="_blank" rel="noopener noreferrer" style={{ flex:1, padding:"10px", borderRadius:12, background:"#FAE100", color:"#3A1D1D", fontSize:13, fontWeight:800, textDecoration:"none", textAlign:"center" }}>K 지도</a>
                </div>
                <button className="tap" onClick={() => {
                  const list = sortedRestaurants;
                  if (!list.length) return;
                  let next;
                  do { next = list[Math.floor(Math.random() * list.length)]; } while (next.title === randomPick && list.length > 1);
                  setRandomPick(next.title);
                }} style={{ width:"100%", padding:"12px", borderRadius:12, border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:15, cursor:"pointer", boxShadow:"0 6px 16px rgba(255,122,69,.3)" }}>
                  🎲 다른 곳 보기
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 투표 후보 선택 모달 */}
      {showVotePicker && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:60 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowVotePicker(false); }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"24px 24px 0 0", padding:"16px 20px 40px", width:"100%", maxWidth:480, maxHeight:"80vh", overflowY:"auto", boxShadow:"0 -20px 50px rgba(0,0,0,.3)", animation:"sheetUp .3s both" }}>
            <div style={{ width:40, height:5, borderRadius:99, background:"var(--border)", margin:"0 auto 20px" }} />
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <h3 style={{ fontSize:20 }}>투표 후보 선택</h3>
              <button onClick={() => setShowVotePicker(false)} style={{ background:"none", border:"none", color:"var(--text-2)", fontSize:18, cursor:"pointer" }}>✕</button>
            </div>
            <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:14 }}>투표에 올릴 식당을 선택하세요 ({voteCandidates.size}개 선택됨)</p>
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
              {scoredRestaurants.map((r) => {
                const checked = voteCandidates.has(r.title);
                return (
                  <button key={r.title} className="tap" onClick={() => {
                    setVoteCandidates((prev) => {
                      const next = new Set(prev);
                      if (next.has(r.title)) next.delete(r.title);
                      else next.add(r.title);
                      return next;
                    });
                  }} style={{
                    display:"flex", alignItems:"center", gap:12, padding:"12px 14px", textAlign:"left",
                    borderRadius:14, border: checked ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                    background: checked ? "var(--primary-light)" : "var(--surface)", cursor:"pointer",
                  }}>
                    <div style={{ width:22, height:22, borderRadius:6, border: checked ? "none" : "2px solid var(--border)", background: checked ? "var(--primary)" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {checked && <span style={{ color:"#fff", fontSize:13 }}>✓</span>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontFamily:"var(--font-display)", fontSize:15, color: checked ? "var(--primary)" : "var(--text)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.title}</p>
                      <p style={{ fontSize:12, color:"var(--text-2)", marginTop:2 }}>{r.category.split(">").pop()?.trim()} {r.distance !== null ? `· 📍${formatDistance(r.distance)}` : ""}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <button className="tap" onClick={startVote} disabled={voteCandidates.size === 0} style={{
              width:"100%", padding:"14px", borderRadius:"var(--r-pill)", border:"none",
              background: voteCandidates.size === 0 ? "var(--border)" : "var(--primary)",
              color: voteCandidates.size === 0 ? "var(--text-2)" : "#fff",
              fontFamily:"var(--font-display)", fontSize:16, cursor: voteCandidates.size === 0 ? "default" : "pointer",
              boxShadow: voteCandidates.size > 0 ? "0 6px 16px rgba(255,122,69,.3)" : "none",
            }}>
              {voteCandidates.size > 0 ? `${voteCandidates.size}개로 투표 링크 만들기 →` : "후보를 선택해주세요"}
            </button>
          </div>
        </div>
      )}

      {/* Join Modal */}
      {showJoinModal && (
        <JoinModal
          groupId={id}
          onJoined={handleJoined}
          onClose={() => setShowJoinModal(false)}
        />
      )}

      {/* 선호도 설정 안내 배너 */}
      {showPrefSetup && myMemberId && (
        <div className="bounce-in" style={{ padding: "14px 18px", borderRadius: 14, background: "var(--accent-soft)", border: "2px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--accent)" }}>🎉 참여 완료!</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>좋아하는 음식과 못먹는 음식을 아래에서 설정해보세요</p>
          </div>
          <button onClick={() => setShowPrefSetup(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* 헤더 */}
      <div className="fade-up" style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <button className="tap" onClick={() => router.push("/")} style={{ width: 38, height: 38, borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)", flexShrink: 0, marginTop: 2 }}>←</button>
        <div style={{ flex: 1 }}>
          {/* 모임명 (수정 가능) */}
          {editingName ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <input autoFocus value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveGroupName(); if (e.key === "Escape") setEditingName(false); }}
                style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px,4vw,30px)", border: "2px solid var(--accent)", borderRadius: 12, padding: "4px 12px", background: "var(--card)", color: "var(--text)", outline: "none", flex: 1 }} />
              <button className="tap" onClick={saveGroupName} style={{ padding: "6px 14px", borderRadius: "var(--r-pill)", border: "none", background: "var(--accent)", color: "#fff", fontFamily: "var(--font-display)", fontSize: 14, cursor: "pointer" }}>저장</button>
              <button onClick={() => setEditingName(false)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* 썸네일 (이모지 or 이미지) */}
              {(group as { emoji?: string; image_url?: string }).image_url ? (
                <img src={(group as { image_url?: string }).image_url} alt={group.name} style={{ width: 44, height: 44, borderRadius: 12, objectFit: "cover", flexShrink: 0, boxShadow: "var(--card-shadow)" }} />
              ) : (group as { emoji?: string }).emoji ? (
                <div style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, background: "var(--bg-2)", border: "1px solid var(--border)", flexShrink: 0 }}>
                  {(group as { emoji?: string }).emoji}
                </div>
              ) : (
                <span style={{ fontSize: 22, flexShrink: 0 }}>{group.is_private ? "🔒" : "🌐"}</span>
              )}
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px,4vw,30px)", lineHeight: 1.1, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {group.name}
              </h1>
              {group.is_private && <span style={{ fontSize: 14, flexShrink: 0 }}>🔒</span>}
              {(isOwner || isAdmin) && (
                <button className="tap" onClick={() => { setEditNameValue(group.name); setEditingName(true); }} style={{ width: 30, height: 30, borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 14, flexShrink: 0 }}>✏️</button>
              )}
            </div>
          )}
          {/* 설명 */}
          {editingDesc ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0" }}>
              <input autoFocus value={editDescValue} onChange={(e) => setEditDescValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveGroupDesc(); if (e.key === "Escape") setEditingDesc(false); }}
                placeholder="모임 설명 입력"
                style={{ flex: 1, border: "1.5px solid var(--accent)", borderRadius: 10, padding: "5px 11px", background: "var(--card)", fontSize: 13, color: "var(--text)", outline: "none" }} />
              <button className="tap" onClick={saveGroupDesc} style={{ padding: "5px 12px", borderRadius: "var(--r-pill)", border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, cursor: "pointer" }}>저장</button>
              <button onClick={() => setEditingDesc(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>✕</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0" }}>
              {group.description
                ? <p style={{ fontSize: 13, color: "var(--muted)", flex: 1 }}>{group.description}</p>
                : (isOwner || isAdmin) && <p style={{ fontSize: 12, color: "var(--faint)", fontStyle: "italic" }}>설명 없음</p>}
              {(isOwner || isAdmin) && (
                <button className="tap" onClick={() => { setEditDescValue(group.description || ""); setEditingDesc(true); }} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 12, cursor: "pointer", padding: "2px 4px" }}>✏️</button>
              )}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{members.length}명 참여 중</span>
            {ownerName && <span style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"2px 8px", borderRadius:"var(--r-pill)", background:"#FFF4CC", color:"#9A7B00", fontSize:11, fontWeight:700 }}>👑 {ownerName}</span>}
            {isOwner && <span style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"2px 8px", borderRadius:"var(--r-pill)", background:"var(--green-soft)", color:"var(--green)", fontSize:11, fontWeight:700 }}>모임장</span>}
            {isAdmin && !isOwner && <span style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"2px 8px", borderRadius:"var(--r-pill)", background:"#F3E5F5", color:"#6A1B9A", fontSize:11, fontWeight:700 }}>🛡️ 관리자</span>}
            {myMemberId && !isOwner && <span style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"2px 8px", borderRadius:"var(--r-pill)", background:"var(--accent-soft)", color:"var(--accent)", fontSize:11, fontWeight:600 }}>✓ 참여 중</span>}
          </div>
          {/* 참여하기 버튼 — 미참여자에게 표시 */}
          {!myMemberId && !isOwner && (
            <button className="tap" onClick={() => setShowJoinModal(true)} style={{
              marginTop: 12, padding: "10px 24px", borderRadius: "var(--r-pill)", border: "none",
              background: "var(--accent)", color: "var(--accent-ink)",
              fontFamily: "var(--font-display)", fontSize: 15, cursor: "pointer",
              boxShadow: "0 8px 18px -8px var(--accent)",
            }}>
              🙌 이 모임 참여하기
            </button>
          )}
          {myMemberId && !isOwner && (
            <button onClick={() => { setExpandedId(myMemberId); setTab("members"); setShowPrefSetup(true); }} style={{
              marginTop: 10, padding: "7px 16px", borderRadius: 100,
              border: "1.5px solid var(--accent)", background: "var(--accent-soft)",
              color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
              ✏️ 내 선호 음식 설정하기
            </button>
          )}
        </div>
        {/* 멤버 초대 버튼 — 누구나 */}
        <button className="tap" onClick={async () => {
          const url = window.location.href;
          if (navigator.share) {
            navigator.share({ title: `${group.name} 모임 초대`, text: `"${group.name}" 모임에 참여하세요! 🍽️`, url });
          } else {
            await navigator.clipboard.writeText(url);
            alert("초대 링크가 복사되었습니다!");
          }
        }} style={{ padding: "7px 16px", borderRadius: "var(--r-pill)", border: "none", background: "var(--primary)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + 초대
        </button>
        {/* 링크 복사 */}
        <button onClick={async () => {
          await navigator.clipboard.writeText(window.location.href).catch(() => {});
          alert("링크 복사됨!");
        }} style={{ padding: "6px 10px", borderRadius: "var(--r-pill)", border: "1.5px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
          🔗
        </button>
        {/* 나가기 버튼 — 참여 중이고 모임장 아닌 경우 */}
        {myMemberId && !isOwner && (
          <button onClick={async () => {
            if (!confirm("이 모임에서 나가시겠습니까?\n선호도 설정은 삭제됩니다.")) return;
            await getSupabase().from("members").delete().eq("id", myMemberId);
            setMyMemberId(null);
            loadMembers();
          }} style={{ padding: "6px 14px", borderRadius: 100, border: "1.5px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
            나가기
          </button>
        )}
        {/* 모임 삭제 — 모임장 또는 어드민 */}
        {(isOwner || isAdmin) && (
          <button onClick={async () => {
            if (group.is_private) {
              const pw = prompt(`"${group.name}" 비공개 모임\n삭제하려면 비밀번호를 입력하세요:`);
              if (pw === null) return;
              if (pw !== group.password) { alert("비밀번호가 틀렸습니다."); return; }
            } else {
              if (!confirm(`"${group.name}" 모임을 삭제하시겠습니까?\n멤버, 선호도, 히스토리가 모두 삭제됩니다.`)) return;
            }
            await getSupabase().from("groups").delete().eq("id", id);
            router.push("/");
          }} style={{ padding: "6px 14px", borderRadius: 100, border: "1.5px solid var(--border)", background: "transparent", color: "var(--red)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            삭제
          </button>
        )}
      </div>

      {/* 탭 */}
      <div className="fade-up fade-up-1" style={{ display:"flex", borderBottom:"1.5px solid var(--border)", marginBottom:0 }}>
        {([["recommend","추천"],["history","기록"],["members","멤버"]] as const).map(([t, label]) => (
          <button key={t} className="tap" onClick={() => setTab(t)} style={{
            flex:1, padding:"12px 0", border:"none", fontSize:14, fontWeight:700,
            background:"transparent", cursor:"pointer", transition:"all .15s",
            color: tab === t ? "var(--primary)" : "var(--text-2)",
            borderBottom: tab === t ? "2.5px solid var(--primary)" : "2.5px solid transparent",
            marginBottom:-1.5,
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
                      <span style={{ width: 26, height: 26, borderRadius: "50%", background: isSelected ? color : "var(--border)", color: isSelected ? "#fff" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, transition: "all 0.15s", overflow: "hidden" }}>
                        {memberImages[m.id]
                          ? <img src={memberImages[m.id]} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : m.name[0]}
                      </span>
                      {m.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 분위기 + 인원 설정 */}
          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 22, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>분위기 / 상황</p>
              {/* 배달 전용 제외 토글 */}
              <button onClick={() => setExcludeDelivery((v) => !v)} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 100,
                border: `1.5px solid ${excludeDelivery ? "var(--green)" : "var(--border)"}`,
                background: excludeDelivery ? "var(--green-soft)" : "transparent",
                color: excludeDelivery ? "var(--green)" : "var(--text-muted)",
                fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
              }}>
                {excludeDelivery ? "✓" : "○"} 배달 전용 제외
              </button>
            </div>

            {/* 인원 안내 */}
            {selected.length > 0 && (
              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  👥 {selected.length}명
                </span>
                {getSizeLabel(selected.length) && (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 600 }}>
                    {getSizeLabel(selected.length)}
                  </span>
                )}
              </div>
            )}

            {/* 분위기 선택 — 목업 스타일 */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {ATMOSPHERES.filter(a => a.id !== "").map((a) => (
                <button key={a.id} className="tap" onClick={() => setAtmosphere(a.id === atmosphere ? "" : a.id)} style={{
                  padding: "8px 16px", borderRadius: "var(--r-pill)", fontSize: 13.5, fontWeight: 600,
                  border: atmosphere === a.id ? "none" : "1.5px solid var(--border)",
                  background: atmosphere === a.id ? "var(--primary)" : "var(--surface)",
                  color: atmosphere === a.id ? "#fff" : "var(--text)",
                  cursor: "pointer", transition: "all .15s",
                  boxShadow: atmosphere === a.id ? "0 4px 12px rgba(255,122,69,.3)" : "none",
                }}>{a.label}</button>
              ))}
            </div>
          </div>

          {/* 카테고리 필터 */}
          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 22, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>메뉴 종류 선택</p>

            {/* 대분류 */}
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 7 }}>대분류</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <button onClick={() => { setFilterLarge(""); setFilterMedium(""); setFilterItem(""); }} style={{
                  padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600,
                  border: !filterLarge ? "2px solid var(--accent)" : "1.5px solid var(--border)",
                  background: !filterLarge ? "var(--accent-soft)" : "transparent",
                  color: !filterLarge ? "var(--accent)" : "var(--text-muted)", cursor: "pointer",
                }}>전체</button>
                {getAllLargeCategories().map((cat) => (
                  <button key={cat} onClick={() => { setFilterLarge(cat === filterLarge ? "" : cat); setFilterMedium(""); setFilterItem(""); }} style={{
                    padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600,
                    border: filterLarge === cat ? "2px solid var(--accent)" : "1.5px solid var(--border)",
                    background: filterLarge === cat ? "var(--accent-soft)" : "transparent",
                    color: filterLarge === cat ? "var(--accent)" : "var(--text)", cursor: "pointer", transition: "all 0.15s",
                  }}>{cat}</button>
                ))}
              </div>
            </div>

            {/* 중분류 */}
            {filterLarge && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 7 }}>중분류</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <button onClick={() => { setFilterMedium(""); setFilterItem(""); }} style={{
                    padding: "5px 12px", borderRadius: 100, fontSize: 12, fontWeight: 500,
                    border: !filterMedium ? "2px solid var(--accent)" : "1.5px solid var(--border)",
                    background: !filterMedium ? "var(--accent-soft)" : "transparent",
                    color: !filterMedium ? "var(--accent)" : "var(--text-muted)", cursor: "pointer",
                  }}>전체</button>
                  {getMediumCategories(filterLarge).map((cat) => (
                    <button key={cat} onClick={() => { setFilterMedium(cat === filterMedium ? "" : cat); setFilterItem(""); }} style={{
                      padding: "5px 12px", borderRadius: 100, fontSize: 12, fontWeight: 500,
                      border: filterMedium === cat ? "2px solid var(--accent)" : "1.5px solid var(--border)",
                      background: filterMedium === cat ? "var(--accent-soft)" : "transparent",
                      color: filterMedium === cat ? "var(--accent)" : "var(--text)", cursor: "pointer", transition: "all 0.15s",
                    }}>{cat}</button>
                  ))}
                </div>
              </div>
            )}

            {/* 소분류 */}
            {filterMedium && (
              <div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 7 }}>소분류</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 100, overflowY: "auto" }}>
                  <button onClick={() => setFilterItem("")} style={{
                    padding: "4px 11px", borderRadius: 100, fontSize: 11, fontWeight: 500,
                    border: !filterItem ? "2px solid var(--accent)" : "1.5px solid var(--border)",
                    background: !filterItem ? "var(--accent-soft)" : "transparent",
                    color: !filterItem ? "var(--accent)" : "var(--text-muted)", cursor: "pointer",
                  }}>전체</button>
                  {getMenuItems(filterLarge, filterMedium).map((item) => (
                    <button key={item} onClick={() => setFilterItem(item === filterItem ? "" : item)} style={{
                      padding: "4px 11px", borderRadius: 100, fontSize: 11, fontWeight: 500,
                      border: filterItem === item ? "2px solid var(--accent)" : "1.5px solid var(--border)",
                      background: filterItem === item ? "var(--accent-soft)" : "transparent",
                      color: filterItem === item ? "var(--accent)" : "var(--text)", cursor: "pointer", transition: "all 0.1s",
                    }}>{item}</button>
                  ))}
                </div>
              </div>
            )}

            {/* 선택된 필터 표시 */}
            {(filterLarge || filterMedium || filterItem) && (
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>선택:</span>
                {[filterLarge, filterMedium, filterItem].filter(Boolean).map((f, i) => (
                  <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 600 }}>{f}</span>
                ))}
              </div>
            )}
          </div>

          {/* 위치 설정 */}
          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 22, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>검색 위치</p>
            </div>

            {/* 즐겨찾는 지역 */}
            {favLocations.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 7 }}>📍 즐겨찾는 지역</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {favLocations.map((loc) => (
                    <div key={loc.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button className="tap" onClick={() => { setLocation({ lat: loc.lat || 0, lng: loc.lng || 0, label: loc.name, address: loc.address }); setLocationMode("manual"); }}
                        style={{ padding: "6px 12px", borderRadius: "var(--r-pill)", border: location?.label === loc.name ? "2px solid var(--accent)" : "1.5px solid var(--border)", background: location?.label === loc.name ? "var(--accent-soft)" : "var(--card)", color: location?.label === loc.name ? "var(--accent)" : "var(--text)", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all .15s" }}>
                        {loc.name}
                      </button>
                      {(isOwner || isAdmin) && (
                        <button onClick={() => removeFavLocation(loc.id)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12, cursor: "pointer", padding: "2px" }}>✕</button>
                      )}
                    </div>
                  ))}
                  {(isOwner || isAdmin) && !showAddLocation && favLocations.length < 5 && (
                    <button className="tap" onClick={() => setShowAddLocation(true)} style={{ padding: "6px 12px", borderRadius: "var(--r-pill)", border: "1.5px dashed var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>+ 추가</button>
                  )}
                  {favLocations.length >= 5 && <span style={{ fontSize: 11, color: "var(--faint)" }}>최대 5개</span>}
                </div>
              </div>
            )}

            {/* 즐겨찾는 지역 추가 폼 */}
            {(isOwner || isAdmin) && showAddLocation && (
              <AddFavLocationForm groupId={id} onAdd={addFavLocation} onCancel={() => setShowAddLocation(false)} />
            )}
            {(isOwner || isAdmin) && favLocations.length === 0 && !showAddLocation && (
              <button className="tap" onClick={() => setShowAddLocation(true)} style={{ marginBottom: 12, padding: "7px 14px", borderRadius: "var(--r-pill)", border: "1.5px dashed var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>📍 즐겨찾는 지역 추가</button>
            )}

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

          {/* 멤버 미선택 안내 */}
          {selected.length === 0 && members.length > 0 && (
            <div style={{ padding: "16px 20px", borderRadius: 14, background: "var(--accent-soft)", border: "1.5px dashed var(--accent)", color: "var(--accent)", fontSize: 14, fontWeight: 500, textAlign: "center" }}>
              👆 위에서 오늘 참가할 멤버를 먼저 선택하세요
            </div>
          )}

          {/* 검색 모드 토글 */}
          {selected.length > 0 && (
            <div style={{ display: "flex", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 100, padding: 3, gap: 3, width: "fit-content" }}>
              <button onClick={() => { setSearchMode("restaurant"); setScoredRestaurants([]); setMenuRecommendations([]); }} style={{
                padding: "7px 18px", borderRadius: 100, border: "none", fontSize: 13, fontWeight: 600,
                background: searchMode === "restaurant" ? "var(--text)" : "transparent",
                color: searchMode === "restaurant" ? "#fff" : "var(--text-muted)", cursor: "pointer", transition: "all 0.15s",
              }}>🏪 식당 바로 찾기</button>
              <button onClick={() => { setSearchMode("menu"); setScoredRestaurants([]); setMenuRecommendations([]); }} style={{
                padding: "7px 18px", borderRadius: 100, border: "none", fontSize: 13, fontWeight: 600,
                background: searchMode === "menu" ? "var(--text)" : "transparent",
                color: searchMode === "menu" ? "#fff" : "var(--text-muted)", cursor: "pointer", transition: "all 0.15s",
              }}>🍜 메뉴 먼저 고르기</button>
            </div>
          )}

          {/* 액션 바 */}
          {selected.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {searchMode === "menu" ? (
                <button onClick={handleMenuRecommend} disabled={loading} style={{
                  background: loading ? "var(--border)" : "var(--green)", color: loading ? "var(--text-muted)" : "#fff",
                  border: "none", borderRadius: 100, padding: "12px 28px", fontSize: 15, fontWeight: 600,
                  cursor: loading ? "default" : "pointer", transition: "all 0.15s",
                }}>
                  {loading ? "메뉴 추천 중…" : "🍜 메뉴 추천받기 →"}
                </button>
              ) : (
              <button className="tap" onClick={handleRecommend} disabled={loading || providers.size === 0} style={{
                background: (loading || providers.size === 0) ? "var(--border)" : "var(--primary)",
                color: (loading || providers.size === 0) ? "var(--text-2)" : "#fff",
                border: "none", borderRadius: "var(--r-pill)", padding: "14px", fontSize: 16, fontWeight: 700,
                cursor: (loading || providers.size === 0) ? "default" : "pointer",
                fontFamily: "var(--font-display)", width: "100%",
                boxShadow: (loading || providers.size === 0) ? "none" : "0 8px 20px rgba(255,122,69,.3)",
              }}>
                {loading ? "🔍 검색 중…" : "맛집 추천 받기 ✦"}
              </button>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                {(["naver", "kakao"] as const).map((p) => {
                  const isOn = providers.has(p);
                  const color = p === "naver" ? "#03C75A" : "#FAE100";
                  const textColor = p === "naver" ? "#fff" : "#3A1D1D";
                  return (
                    <button key={p} onClick={() => {
                      setProviders((prev) => {
                        const next = new Set(prev);
                        if (next.has(p)) next.delete(p);
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
              {providers.size === 0 && (
                <p style={{ fontSize: 12, color: "var(--red)", fontWeight: 500 }}>⚠️ 네이버 또는 카카오 중 최소 하나를 선택하세요</p>
              )}
            </div>
          )}

          {/* 추천 식당 결과 */}
          {/* 메뉴 먼저 고르기 결과 */}
          {searchMode === "menu" && menuRecommendations.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600 }}>
                  추천 메뉴 <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>— 먹고 싶은 메뉴를 골라보세요</span>
                </p>
                <button onClick={handleMenuRecommend} style={{ padding: "6px 14px", borderRadius: 100, border: "1.5px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  🔄 다시 추천
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {menuRecommendations.map((rec) => {
                  const isSel = selectedMenus.includes(rec.menu);
                  const col = getCategoryColor(rec.medium);
                  return (
                    <button key={rec.menu} onClick={() => setSelectedMenus((prev) => isSel ? prev.filter((m) => m !== rec.menu) : [...prev, rec.menu])} style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 100,
                      border: isSel ? `2px solid ${col.border}` : "1.5px solid var(--border)",
                      background: isSel ? col.bg : "var(--bg-card)",
                      color: isSel ? col.text : "var(--text)",
                      fontSize: 13, fontWeight: isSel ? 700 : 400, cursor: "pointer", transition: "all 0.15s",
                      boxShadow: isSel ? `0 0 0 2px ${col.border}30` : "none",
                    }}>
                      <span>{categoryEmoji(rec.medium)}</span>
                      {rec.menu}
                      {rec.score > 0 && <span style={{ fontSize: 10, color: col.text, opacity: 0.7 }}>👍</span>}
                    </button>
                  );
                })}
              </div>
              {selectedMenus.length > 0 && providers.size > 0 && (
                <button onClick={handleRestaurantByMenus} disabled={loading} style={{
                  padding: "12px 28px", borderRadius: 100, border: "none",
                  background: "var(--accent)", color: "#fff", fontSize: 15, fontWeight: 700,
                  cursor: loading ? "default" : "pointer", width: "100%",
                }}>
                  {loading ? "식당 검색 중…" : `선택한 ${selectedMenus.length}개 메뉴로 식당 찾기 →`}
                </button>
              )}
            </div>
          )}

          {voteUrl && (
            <div style={{ padding: "14px 18px", borderRadius: 14, background: "var(--accent-soft)", border: "1.5px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>🗳️ 투표 링크가 복사되었습니다!</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>멤버들에게 공유하세요</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => navigator.clipboard.writeText(voteUrl)} style={{ padding: "6px 12px", borderRadius: 100, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>복사</button>
                <a href={voteUrl} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 12px", borderRadius: 100, border: "1.5px solid var(--accent)", color: "var(--accent)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>열기</a>
              </div>
            </div>
          )}

          {scoredRestaurants.length > 0 && (
            <div>
              {/* 헤더 라인: 제목 + 재검색 + 투표 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 10 }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
                  주변 추천 맛집
                  <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)", marginLeft: 8 }}>{scoredRestaurants.length}곳</span>
                </p>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button className="tap" onClick={() => {
                    const list = sortedRestaurants;
                    if (!list.length) return;
                    const pick = list[Math.floor(Math.random() * list.length)];
                    setRandomPick(pick.title);
                  }} style={{
                    padding: "8px 16px", borderRadius: "var(--r-pill)", fontSize: 13, fontWeight: 700,
                    border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    🎲 랜덤선택
                  </button>
                  <button className="tap" onClick={() => { setScoredRestaurants([]); setVoteUrl(null); setRandomPick(null); searchMode === "menu" ? handleRestaurantByMenus() : handleRecommend(); }} style={{
                    padding: "8px 14px", borderRadius: "var(--r-pill)", fontSize: 13, fontWeight: 700,
                    border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer",
                  }}>
                    🔄
                  </button>
                  <button className="tap" onClick={openVotePicker} disabled={creatingVote} style={{
                    padding: "8px 16px", borderRadius: "var(--r-pill)", fontSize: 13, fontWeight: 700,
                    border: "none", background: "var(--primary)", color: "#fff", cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(255,122,69,.3)",
                  }}>
                    🗳️ {creatingVote ? "생성 중…" : "투표"}
                  </button>
                </div>
              </div>
              {/* 정렬 버튼 — 별도 줄 */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                {([["distance","📍 거리순"],["score","👍 선호순"],["rating","⭐ 별점"],["category","🏷 카테고리"]] as const).map(([s, label]) => (
                  <button key={s} className="tap" onClick={() => setSortBy(s)} style={{
                    padding: "5px 12px", borderRadius: "var(--r-pill)", fontSize: 12, fontWeight: 600,
                    border: sortBy === s ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                    background: sortBy === s ? "var(--primary-light)" : "transparent",
                    color: sortBy === s ? "var(--primary)" : "var(--text-2)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}>{label}</button>
                ))}
              </div>
              {sortBy === "category" ? (
                // 카테고리별 그룹핑
                (() => {
                  const groups: Record<string, typeof sortedRestaurants> = {};
                  sortedRestaurants.forEach((r) => {
                    const key = r.category.split(">")[0]?.trim() || "기타";
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(r);
                  });
                  return Object.entries(groups).map(([groupName, items]) => {
                    const col = getCategoryColor(groupName);
                    return (
                      <div key={groupName} style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 18 }}>{categoryEmoji(groupName)}</span>
                          <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: col.text }}>{groupName}</span>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: col.bg, color: col.text, border: `1px solid ${col.border}`, fontWeight: 600 }}>{items.length}곳</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {items.map((r, i) => renderCard(r, i, col.border))}
                        </div>
                      </div>
                    );
                  });
                })()
              ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sortedRestaurants.map((r, i) => renderCard(r, i, r.score > 0 ? MEMBER_COLORS[i % MEMBER_COLORS.length] : "var(--border)"))}
              </div>
              )}
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

          {/* 멤버 추가 — 모임장만 자유롭게 추가, 일반 참여자는 본인만 참여 */}
          {isOwner ? (
            <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 22, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>새 멤버 추가 (모임장)</p>
              <form onSubmit={(e) => { e.preventDefault(); addMember(); }} style={{ display: "flex", gap: 8 }}>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="이름 입력" style={{ flex: 1, padding: "10px 16px", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 14, color: "var(--text)", outline: "none" }} onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
                <button type="submit" style={{ padding: "10px 20px", borderRadius: 100, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>추가</button>
              </form>
            </div>
          ) : myMemberId ? (
            <div style={{ padding: "12px 16px", borderRadius: 12, background: "var(--green-soft)", border: "1px solid var(--green)", color: "var(--green)", fontSize: 13, fontWeight: 600 }}>
              ✓ 이 모임에 참여 중입니다
            </div>
          ) : (
            <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 20, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>이 모임에 참여하면 선호도를 설정할 수 있습니다</p>
              <button onClick={joinAsMyself} style={{ padding: "10px 24px", borderRadius: 100, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                {currentUser.type === "auth" ? currentUser.user.display_name || "내 이름" : currentUser.type === "guest" ? currentUser.user.name : "이름"} 으로 참여하기
              </button>
            </div>
          )}

          {/* 멤버 목록 */}
          {members.map((m, idx) => {
            const color = MEMBER_COLORS[idx % MEMBER_COLORS.length];
            const isExpanded = expandedId === m.id;
            return (
              <div key={m.id} style={{ background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow)", overflow: "hidden", borderLeft: `4px solid ${color}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, overflow: "hidden", flexShrink: 0 }}>
                      {memberImages[m.id]
                        ? <img src={memberImages[m.id]} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : m.name[0]}
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{m.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {/* 선호도 편집: 모임장 or 본인 멤버만 */}
                    {(isOwner || m.id === myMemberId) && (
                      <button onClick={() => toggleExpand(m.id)} style={{ padding: "5px 14px", borderRadius: 100, fontSize: 12, fontWeight: 500, border: "1.5px solid var(--border)", background: isExpanded ? "var(--primary)" : "transparent", color: isExpanded ? "#fff" : "var(--text-muted)", cursor: "pointer", transition: "all 0.15s" }}>
                        {isExpanded ? "접기" : "선호도"}
                      </button>
                    )}
                    {/* 닉네임 변경: 본인 멤버 */}
                    {m.id === myMemberId && (
                      <button onClick={async () => {
                        const newName = prompt("새 닉네임을 입력하세요:", m.name);
                        if (!newName?.trim() || newName.trim() === m.name) return;
                        await getSupabase().from("members").update({ name: newName.trim() }).eq("id", m.id);
                        loadMembers();
                      }} style={{ padding: "5px 12px", borderRadius: 100, fontSize: 12, border: "1.5px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>
                        ✏️ 닉네임
                      </button>
                    )}
                    {/* 삭제: 모임장 또는 어드민 */}
                    {(isOwner || isAdmin) && (
                      <button onClick={() => deleteMember(m.id)} style={{ padding: "5px 12px", borderRadius: 100, fontSize: 12, border: "1.5px solid var(--border)", background: "transparent", color: "var(--red)", cursor: "pointer" }}>삭제</button>
                    )}
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
                    {/* 내 기본값 불러오기 / 저장 — 로그인 사용자 + 본인 멤버만 */}
                    {currentUser.type === "auth" && m.id === myMemberId && (
                      <div style={{ display:"flex", gap:8, marginTop:12 }}>
                        <button className="tap" onClick={async () => {
                          const { data } = await getSupabase().from("user_food_preferences").select("*").eq("user_id", currentUser.user.id);
                          if (!data || data.length === 0) { alert("저장된 기본값이 없습니다. 먼저 선호도를 설정한 뒤 저장해주세요."); return; }
                          // 현재 멤버의 기존 선호도 삭제 후 기본값 적용
                          const ids = memberPrefs.map((p) => p.id);
                          if (ids.length > 0) await getSupabase().from("food_preferences").delete().in("id", ids);
                          await getSupabase().from("food_preferences").insert(
                            data.map((p) => ({ member_id: expandedId, food_name: p.food_name, preference_type: p.preference_type }))
                          );
                          await loadMemberPrefs(expandedId!);
                          alert("기본값을 불러왔습니다!");
                        }} style={{ flex:1, padding:"9px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--surface)", color:"var(--text-2)", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                          📥 기본값 불러오기
                        </button>
                        <button className="tap" onClick={async () => {
                          if (memberLikes.length === 0 && memberDislikes.length === 0) { alert("저장할 선호도가 없습니다."); return; }
                          // 기존 기본값 삭제 후 현재 값으로 대체
                          await getSupabase().from("user_food_preferences").delete().eq("user_id", currentUser.user.id);
                          await getSupabase().from("user_food_preferences").insert([
                            ...memberLikes.map((p) => ({ user_id: currentUser.user.id, food_name: p.food_name, preference_type: "like" as const })),
                            ...memberDislikes.map((p) => ({ user_id: currentUser.user.id, food_name: p.food_name, preference_type: "dislike" as const })),
                          ]);
                          alert("내 기본값에 저장됐습니다! 다른 모임에서도 불러올 수 있어요.");
                        }} style={{ flex:1, padding:"9px", borderRadius:"var(--r-pill)", border:"none", background:"var(--green-soft)", color:"var(--green)", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                          💾 기본값에 저장
                        </button>
                      </div>
                    )}
                    {/* 설정 완료 버튼 */}
                    {(memberLikes.length > 0 || memberDislikes.length > 0) && (
                      <button className="tap" onClick={() => { setExpandedId(null); setTab("recommend"); }} style={{
                        marginTop: 10, width: "100%", padding: "11px", borderRadius: "var(--r-pill)", border: "none",
                        background: "var(--primary)", color: "#fff", fontFamily: "var(--font-display)", fontSize: 15, cursor: "pointer",
                        boxShadow: "0 6px 16px rgba(255,122,69,.25)",
                      }}>
                        ✓ 설정 완료 → 추천 받기
                      </button>
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
