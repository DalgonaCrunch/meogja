"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, Group } from "@/lib/supabase";
import { getCurrentUser, CurrentUser } from "@/lib/auth";
import { toast, showAlert, showConfirm, showPrompt } from "@/lib/dialog";
import { getCategorySubItems } from "@/lib/recommend";
import MenuBattle from "./MenuBattle";
import { MENU_CATEGORIES, MEAL_POOL, ROULETTE_POOL } from "@/lib/menus";
import { getFoodIconUrl } from "@/lib/foodIcons";
import { getTimeSlot, TIME_FOODS, getAgeGroupFoods, getWeatherFoods, WeatherCondition } from "@/lib/foodRecommend";
import TourGuide, { TOUR_KEY } from "@/components/TourGuide";

const GROUP_EMOJIS = ['🍱','🍜','🍗','🍕','🍣','🥘','🌮','🍻','🥗','🍰'];

const PAT_TITLES = [
  (menu: string) => `${menu} 먹을 파티원 구함 🍽️`,
  (menu: string) => `${menu} 같이 먹을 사람? 🙋`,
  (menu: string) => `지금 ${menu} 먹으러 갈 사람 🚀`,
  (menu: string) => `${menu} 먹자팟 모집 중 🎉`,
  (menu: string) => `${menu} 오늘 먹어볼 사람 손! ✋`,
];

const ROULETTE_CATEGORY_EXCLUDE = new Set([
  "한식","양식","일식","중식","이탈리안","분식","고기","해산물","술안주",
  "카페","베이커리","디저트","야식","파인다이닝","덮밥",
]);

function GroupCard({ group, onClick, myMemberName, isOwner, starred, onStar }: { group: Group; onClick: () => void; myMemberName?: string; isOwner?: boolean; starred?: boolean; onStar?: (e: React.MouseEvent) => void }) {
  const fallbackEmoji = group.emoji || GROUP_EMOJIS[group.name.charCodeAt(0) % GROUP_EMOJIS.length];
  const hue = 20 + (group.name.charCodeAt(0) % 6) * 18;
  return (
    <button onClick={onClick} className="tap"
      style={{ width:"100%", textAlign:"left", display:"flex", gap:12, alignItems:"center",
        padding:"12px 14px", background:"var(--surface)", border:"var(--card-border)",
        borderRadius:16, boxShadow:"var(--card-shadow)", cursor:"pointer" }}>
      {/* 음식 썸네일 */}
      <div style={{ width:72, height:72, borderRadius:14, flex:"none", overflow:"hidden",
        display:"grid", placeItems:"center", fontSize:36,
        background: group.image_url ? "transparent" : `linear-gradient(140deg, hsl(${hue} 82% 66%), hsl(${(hue+30)%360} 84% 54%))`,
        boxShadow:"0 3px 10px rgba(0,0,0,.12)" }}>
        {group.image_url
          ? <img src={group.image_url} alt={group.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          : <span style={{ filter:"drop-shadow(0 2px 5px rgba(0,0,0,.25))" }}>{fallbackEmoji}</span>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <span style={{ fontFamily:"var(--font-display)", fontSize:16.5, color:"var(--text)", display:"block",
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginBottom:3 }}>{group.name}</span>
        {group.description && <p style={{ fontSize:12.5, color:"var(--text-2)", marginBottom:5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{group.description}</p>}
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          {isOwner ? (
            <span style={{ fontSize:11, padding:"2px 8px", borderRadius:"var(--r-pill)", fontWeight:700, color:"#C77800", background:"#FFF4CC" }}>
              👑 모임장
            </span>
          ) : myMemberName && (
            <span style={{ fontSize:11, padding:"2px 8px", borderRadius:"var(--r-pill)", fontWeight:700, color:"var(--primary)", background:"var(--primary-light)" }}>
              나: {myMemberName}
            </span>
          )}
          <span style={{ fontSize:12, color:"var(--text-3)" }}>
            {new Date(group.created_at).toLocaleDateString("ko-KR")}
          </span>
          {group.is_private && <span style={{ fontSize:11, padding:"2px 7px", borderRadius:"var(--r-pill)", fontWeight:600, color:"var(--text-2)", background:"var(--bg-2)" }}>🔒</span>}
          {group.require_auth && <span style={{ fontSize:11, padding:"2px 7px", borderRadius:"var(--r-pill)", fontWeight:600, color:"var(--primary)", background:"var(--primary-light)" }}>🔑</span>}
          {group.requires_approval && <span style={{ fontSize:11, padding:"2px 7px", borderRadius:"var(--r-pill)", fontWeight:600, color:"#C05E00", background:"#FFF0E0" }}>가입 승인 필요</span>}
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
        {onStar && (
          <button onClick={onStar} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color: starred ? "#F5A623" : "var(--text-3)", padding:"2px" }}>
            {starred ? "★" : "☆"}
          </button>
        )}
        <span style={{ color:"var(--text-3)", fontSize:18 }}>›</span>
      </div>
    </button>
  );
}

const GROUP_EMOJI_LIST = ['🍱','🍜','🍗','🍕','🍣','🥘','🌮','🍻','🥗','🍰','🍖','🍛','🥩','🍝','🌯','🥙','🍞','🍔','🍤','🧆'];

function CreateForm({ newName, setNewName, description, setDescription, emoji, setEmoji, imageUrl, setImageUrl, isPrivate, setIsPrivate, newPassword, setNewPassword, requireAuth, setRequireAuth, requiresApproval, setRequiresApproval, creating, onSubmit, isLoggedIn }: {
  newName: string; setNewName: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  emoji: string; setEmoji: (v: string) => void;
  imageUrl: string; setImageUrl: (v: string) => void;
  isPrivate: boolean; setIsPrivate: (v: boolean) => void;
  newPassword: string; setNewPassword: (v: string) => void;
  requireAuth: boolean; setRequireAuth: (v: boolean) => void;
  requiresApproval: boolean; setRequiresApproval: (v: boolean) => void;
  creating: boolean; onSubmit: (e: React.FormEvent) => void;
  isLoggedIn: boolean;
}) {
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { await showAlert("2MB 이하 이미지만 가능합니다", { icon: "🖼️" }); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setImageUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 이모지 / 사진 선택 */}
      <div>
        <p style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 700, marginBottom: 8 }}>모임 아이콘</p>
        {imageUrl ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={imageUrl} alt="preview" style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover" }} />
            <button type="button" onClick={() => setImageUrl("")} style={{ fontSize: 12, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}>사진 제거</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {GROUP_EMOJI_LIST.map((e) => (
              <button key={e} type="button" className="tap" onClick={() => setEmoji(e)} style={{
                width: 42, height: 42, fontSize: 22, borderRadius: 12, cursor: "pointer",
                border: emoji === e ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                background: emoji === e ? "var(--primary-light)" : "var(--bg)",
              }}>{e}</button>
            ))}
            <label className="tap" style={{ width: 42, height: 42, borderRadius: 12, border: "1.5px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: "var(--text-2)" }}>
              📷
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
            </label>
          </div>
        )}
      </div>

      <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="모임 이름 (예: 점심팀, 야식팀)" required
        style={{ padding: "12px 18px", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 15, color: "var(--text)", outline: "none" }}
        onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="모임 설명 (선택)"
        style={{ padding: "12px 18px", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 14, color: "var(--text)", outline: "none" }}
        onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />

      {/* 공개/비공개 */}
      <div style={{ display: "flex", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 100, padding: 4, gap: 4, width: "fit-content" }}>
        {[false, true].map((priv) => (
          <button key={String(priv)} type="button" onClick={() => setIsPrivate(priv)} style={{
            padding: "7px 20px", borderRadius: 100, border: "none", fontSize: 13, fontWeight: 600,
            background: isPrivate === priv ? "var(--text)" : "transparent",
            color: isPrivate === priv ? "#fff" : "var(--text-muted)", cursor: "pointer", transition: "all 0.15s",
          }}>{priv ? "🔒 비공개" : "🌐 공개"}</button>
        ))}
      </div>

      {isPrivate && !isLoggedIn && (
        <div style={{ padding: "12px 16px", borderRadius: 12, background: "#FFF4CC", border: "1.5px solid #F2B705", fontSize: 13, color: "#7A5A00" }}>
          🔒 비공개 모임은 로그인한 사용자만 만들 수 있습니다
        </div>
      )}
      {isPrivate && isLoggedIn && (
        <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="비밀번호 입력" type="password" required={isPrivate}
          style={{ padding: "12px 18px", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 15, color: "var(--text)", outline: "none" }}
          onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
      )}

      {/* 인증 전용 (로그인 사용자만) */}
      {isLoggedIn && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" onClick={() => setRequireAuth(!requireAuth)} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 100, width: "fit-content",
            border: `1.5px solid ${requireAuth ? "var(--green)" : "var(--border)"}`,
            background: requireAuth ? "var(--green-soft)" : "transparent",
            color: requireAuth ? "var(--green)" : "var(--text-muted)",
            fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
          }}>
            {requireAuth ? "✓" : "○"} 로그인 사용자만 참여 가능
          </button>
          <button type="button" onClick={() => setRequiresApproval(!requiresApproval)} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 100, width: "fit-content",
            border: `1.5px solid ${requiresApproval ? "var(--primary)" : "var(--border)"}`,
            background: requiresApproval ? "var(--primary-light)" : "transparent",
            color: requiresApproval ? "var(--primary)" : "var(--text-muted)",
            fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
          }}>
            {requiresApproval ? "✓" : "○"} 가입 시 승인 필요
          </button>
        </div>
      )}

      <button type="submit" disabled={creating || (isPrivate && !isLoggedIn)} style={{ padding: "13px", borderRadius: 100, border: "none", background: (isPrivate && !isLoggedIn) ? "var(--border)" : "var(--accent)", color: (isPrivate && !isLoggedIn) ? "var(--muted)" : "#fff", fontFamily: "var(--font-display)", fontSize: 16, cursor: (creating || (isPrivate && !isLoggedIn)) ? "default" : "pointer", boxShadow: (isPrivate && !isLoggedIn) ? "none" : "0 4px 14px rgba(255,107,53,0.3)" }}>
        {creating ? "생성 중…" : "모임 만들기 →"}
      </button>
    </form>
  );
}

export default function Home() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser>({ type: "none" });
  const [myMemberships, setMyMemberships] = useState<Record<string, string>>({});
  const [starredGroups, setStarredGroups] = useState<Set<string>>(new Set());
  const [allPublicGroups, setAllPublicGroups] = useState<Group[]>([]); // 공개 모임 전체

  // 모임 생성
  const [newName, setNewName] = useState("");
  const [description, setDescription] = useState("");
  const [groupEmoji, setGroupEmoji] = useState("🍱");
  const [groupImageUrl, setGroupImageUrl] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [requireAuth, setRequireAuth] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [quickCatSheet, setQuickCatSheet] = useState<{label:string;emoji:string;items:string[]} | null>(null);
  const [quickSelected, setQuickSelected] = useState<Set<string>>(new Set());
  const [showQuickGroupPicker, setShowQuickGroupPicker] = useState(false);
  const [menuActionMenus, setMenuActionMenus] = useState<string[]>([]); // 공통 메뉴 액션 시트용
  // 오늘 이미 투표했으면 배틀 카드 처음부터 숨김
  const [battleVoted, setBattleVoted] = useState<boolean>(false);
  const [showRoulettePopup, setShowRoulettePopup] = useState(false);
  const [todayRecoIndex, setTodayRecoIndex] = useState(0);

  // 홈 기능
  const [rouletteResult, setRouletteResult] = useState<string | null>(null);
  const [rouletteRunning, setRouletteRunning] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const CAT_IMGS = ["cat-39","cat-02","cat-15","cat-19","cat-24","cat-40","cat-38","cat-07"];
  const [catImg, setCatImg] = useState("cat-39");
  const [trendingMenus, setTrendingMenus] = useState<{name:string;count:number}[]>([]);
  const [rankingPeriod, setRankingPeriod] = useState<"weekly"|"monthly"|"all">("weekly");
  const [homeUserAge, setHomeUserAge] = useState<string | undefined>(undefined);
  const [weatherCondition, setWeatherCondition] = useState<WeatherCondition | null>(null);
  const [weatherEmoji, setWeatherEmoji] = useState<string>("");
  const [homeDislikedFoods, setHomeDislikedFoods] = useState<string[]>([]);
  const [homeUserScores, setHomeUserScores] = useState<Map<string,number>>(new Map());
  const [homeSettings, setHomeSettings] = useState<{
    show_roulette:boolean; show_battle:boolean; show_ranking:boolean; show_trending_bar:boolean;
    weight_time:number; weight_age:number; weight_weather:number; weight_trend:number; weight_app:number; weight_nearby_search:number;
    pinned_menus:string[];
  }>({
    show_roulette:true, show_battle:true, show_ranking:true, show_trending_bar:true,
    weight_time:100, weight_age:100, weight_weather:100, weight_trend:100, weight_app:100, weight_nearby_search:100,
    pinned_menus:[],
  });

  // 현재 위치 (헤더에서 관리 — 여기선 읽기만)
  const [homeLocation, setHomeLocation] = useState<{lat:number;lng:number;label:string} | null>(null);

  // 비공개 모임 입장
  const [enterTarget, setEnterTarget] = useState<Group | null>(null);
  const [enterPassword, setEnterPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // 모임 삭제
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("meogja_starred_groups");
    if (saved) setStarredGroups(new Set(JSON.parse(saved)));
    loadGroups();
    loadTrendingMenus("weekly");
    fetch("/api/admin/home-settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setHomeSettings(prev => ({ ...prev, ...d })); }).catch(() => {});
    // 오늘 이미 배틀 투표 여부
    const today = new Date().toISOString().slice(0,10);
    if (localStorage.getItem("meogja_battle_voted") === today) setBattleVoted(true);
    // 첫 방문 시 룰렛 팝업
    if (!sessionStorage.getItem("meogja_roulette_seen")) {
      setShowRoulettePopup(true);
      sessionStorage.setItem("meogja_roulette_seen", "1");
    }
    // 첫 방문 시 온보딩 투어
    try {
      if (!localStorage.getItem(TOUR_KEY)) {
        setTimeout(() => setShowTour(true), 1200);
      }
    } catch {}

    // 헤더에서 설정된 위치 읽기
    const savedLoc = sessionStorage.getItem("meogja_home_location");
    if (savedLoc) {
      try {
        const loc = JSON.parse(savedLoc);
        setHomeLocation(loc);
        // 위치로 날씨 조회
        fetch(`/api/weather?lat=${loc.lat}&lon=${loc.lng}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.condition) { setWeatherCondition(d.condition); setWeatherEmoji(d.emoji || ""); } })
          .catch(() => {});
      } catch { /* ignore */ }
    }
    const onLocChange = (e: Event) => {
      const loc = (e as CustomEvent).detail;
      if (loc) {
        setHomeLocation(loc);
        fetch(`/api/weather?lat=${loc.lat}&lon=${loc.lng}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.condition) { setWeatherCondition(d.condition); setWeatherEmoji(d.emoji || ""); } })
          .catch(() => {});
      }
    };
    window.addEventListener("meogja-location-change", onLocChange);
    getCurrentUser().then(async (u) => {
      setCurrentUser(u);
      if (u.type === "auth") {
        const { data } = await getSupabase().from("members").select("group_id, name").eq("user_id", u.user.id);
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((m) => { map[m.group_id] = m.name; });
          setMyMemberships(map);
        }
        // 나이대 로드
        getSupabase().from("user_profiles").select("age").eq("id", u.user.id).single()
          .then(({ data: pd }) => { if (pd?.age) setHomeUserAge(pd.age); });
        // 못먹는 음식 로드 (user_food_preferences)
        getSupabase().from("user_food_preferences").select("food_name").eq("user_id", u.user.id).eq("preference_type", "dislike")
          .then(({ data: dislikes }) => {
            if (dislikes && dislikes.length > 0) {
              setHomeDislikedFoods(dislikes.map((d: { food_name: string }) => d.food_name));
            }
          });
        // 개인 선호 점수 로드 (월드컵·선호도 기반)
        getSupabase().from("user_food_scores").select("food_name,score").eq("user_id", u.user.id)
          .then(({ data: scores }) => {
            if (scores && scores.length > 0) {
              const maxScore = Math.max(...scores.map((s: { food_name: string; score: number }) => s.score));
              setHomeUserScores(new Map(scores.map((s: { food_name: string; score: number }) => [s.food_name, s.score / maxScore])));
            }
          });
      } else if (u.type === "guest") {
        const { data } = await getSupabase().from("members").select("group_id, name").eq("guest_name", u.user.name);
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((m) => { map[m.group_id] = m.name; });
          setMyMemberships(map);
        }
      }
    });
    // 뒤로가기 종료 확인 (PWA 설치 모드에서만)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    let cleanupPop: (() => void) | null = null;
    if (isStandalone) {
      window.history.pushState({ backGuard: true }, '');
      const onPop = async () => {
        window.history.pushState({ backGuard: true }, '');
        const ok = await showConfirm("앱을 종료하시겠습니까?", { title: "종료", confirmLabel: "종료" });
        if (ok) window.history.go(-2);
      };
      window.addEventListener('popstate', onPop);
      cleanupPop = () => window.removeEventListener('popstate', onPop);
    }
    return () => {
      window.removeEventListener("meogja-location-change", onLocChange);
      cleanupPop?.();
    };
  }, []);

  // 모임장 여부 확인
  async function loadTrendingMenus(period: "weekly"|"monthly"|"all" = "weekly") {
    const now = new Date();
    let since: string | null = null;
    if (period === "weekly") { const d = new Date(now); d.setDate(d.getDate() - 7); since = d.toISOString(); }
    else if (period === "monthly") { const d = new Date(now); d.setMonth(d.getMonth() - 1); since = d.toISOString(); }

    // 앱 내 선호도 + 월드컵 데이터
    const counts: Record<string, number> = {};

    let prefQ = getSupabase().from("food_preferences").select("food_name").eq("preference_type", "like").limit(500);
    if (since) prefQ = prefQ.gte("created_at", since);
    const { data: prefs } = await prefQ;
    prefs?.forEach((r) => { counts[r.food_name] = (counts[r.food_name] || 0) + 1; });

    let wcQ = getSupabase().from("worldcup_selections").select("winner").limit(1000);
    if (since) wcQ = wcQ.gte("created_at", since);
    const { data: wc } = await wcQ;
    wc?.forEach((r) => { counts[r.winner] = (counts[r.winner] || 0) + 1; });

    let wcFQ = getSupabase().from("worldcup_selections").select("winner").eq("is_final", true).limit(200);
    if (since) wcFQ = wcFQ.gte("created_at", since);
    const { data: wcFinal } = await wcFQ;
    wcFinal?.forEach((r) => { counts[r.winner] = (counts[r.winner] || 0) + 2; });

    // 맛집찾기 실행 이벤트 (weight_nearby_search 계수 적용)
    const wns = homeSettings.weight_nearby_search / 100;
    if (wns > 0) {
      let nsQ = getSupabase().from("food_events").select("food_name").eq("event_type", "nearby_search").limit(500);
      if (since) nsQ = nsQ.gte("created_at", since);
      const { data: ns } = await nsQ;
      ns?.forEach((r) => { counts[r.food_name] = (counts[r.food_name] || 0) + wns; });
    }

    const combined = Object.entries(counts).map(([name, count]) => ({ name, count }));
    const sorted = combined.sort((a, b) => b.count - a.count).slice(0, 20);

    if (sorted.every(m => m.count === 0)) {
      setTrendingMenus([
        { name:"삼겹살", count:0 }, { name:"치킨", count:0 }, { name:"초밥", count:0 },
        { name:"마라탕", count:0 }, { name:"파스타", count:0 }, { name:"떡볶이", count:0 },
        { name:"순대국밥", count:0 }, { name:"김치찌개", count:0 }, { name:"불고기", count:0 }, { name:"라멘", count:0 },
      ]);
    } else {
      setTrendingMenus(sorted);
    }
  }

  function spinRoulette() {
    if (rouletteRunning) return;
    setRouletteRunning(true);
    setRouletteResult(null);

    // 지금 가장 잘 맞는 메뉴 후보 풀 (시간대+나이대+날씨+트렌딩)
    const slot = getTimeSlot();
    const rTimeFoods = TIME_FOODS[slot].foods;
    const rAgeFoods = getAgeGroupFoods(homeUserAge)?.foods ?? [];
    const rWeatherFoods = getWeatherFoods(weatherCondition)?.foods ?? [];
    const rCandidates = new Set([
      ...rTimeFoods,
      ...rAgeFoods,
      ...rWeatherFoods,
      ...trendingMenus.filter(m => ROULETTE_POOL.includes(m.name)).map(m => m.name),
    ]);
    let pool = Array.from(rCandidates)
      .filter(n => !ROULETTE_CATEGORY_EXCLUDE.has(n))
      .filter(n => !homeDislikedFoods.some(d => n.includes(d) || d.includes(n)))
      .sort(() => Math.random() - 0.5)
      .slice(0, 40);
    if (pool.length === 0) pool = [...MEAL_POOL];

    let i = 0;
    const total = 20;
    const interval = setInterval(() => {
      setRouletteResult(pool[Math.floor(Math.random() * pool.length)]);
      i++;
      if (i >= total) {
        clearInterval(interval);
        const final = pool[Math.floor(Math.random() * pool.length)];
        const catImgResult = CAT_IMGS[Math.floor(Math.random() * CAT_IMGS.length)];
        const iconUrl = getFoodIconUrl(final);
        const showResult = () => {
          setRouletteResult(final);
          setRouletteRunning(false);
          setCatImg(catImgResult);
        };
        if (iconUrl) {
          const preload = new Image();
          preload.onload = showResult;
          preload.onerror = showResult;
          preload.src = iconUrl;
        } else {
          showResult();
        }
      }
    }, i < 10 ? 80 : 150);
  }

  function openMenuAction(menus: string[]) {
    setMenuActionMenus(menus);
  }

  // 헤더에서 감지한 위치를 search_location으로 전달 후 /search 이동
  function goToSearch(menus: string[]) {
    if (menus.length > 0) sessionStorage.setItem("meogja_preset_menus", JSON.stringify(menus));
    // 이미 감지된 홈 위치를 재활용 (재감지 불필요)
    const homeLoc = sessionStorage.getItem("meogja_home_location");
    if (homeLoc) {
      try {
        const loc = JSON.parse(homeLoc);
        sessionStorage.setItem("meogja_search_location", JSON.stringify({ lat: loc.lat, lng: loc.lng }));
      } catch { /* ignore */ }
    }
    router.push("/search");
  }

  function getTimeBasedMenus(): { label: string; emoji: string; menus: string[] } {
    const h = new Date().getHours();
    if (h >= 6 && h < 10) return { label:"아침 추천", emoji:"🌅", menus:["김밥","토스트","죽","샌드위치","베이글","계란말이","오트밀","영양밥"] };
    if (h >= 10 && h < 15) return { label:"점심 추천", emoji:"☀️", menus:["김밥","제육볶음","국밥","비빔밥","냉면","돈카츠","짜장면","볶음밥"] };
    if (h >= 15 && h < 18) return { label:"오후 간식", emoji:"☕", menus:["카페라떼","케이크","크로플","타르트","와플","마카롱","에그타르트","빙수"] };
    if (h >= 18 && h < 22) return { label:"저녁 추천", emoji:"🌆", menus:["삼겹살","치킨","초밥","스테이크","갈비","파스타","마라탕","갈비탕"] };
    return { label:"야식 추천", emoji:"🌙", menus:["족발","치킨","떡볶이","피자","라면","마라탕","순대","보쌈"] };
  }

  function isGroupOwner(group: Group, user: typeof currentUser) {
    if (user.type === "auth") return group.owner_id === user.user.id;
    if (user.type === "guest") return group.owner_guest_name === user.user.name;
    return false;
  }

  async function loadGroups() {
    setLoading(true);
    // password 필드 제외 — 서버측 API로만 검증
    const COLS = "id,name,description,is_private,require_auth,requires_approval,owner_id,owner_guest_name,emoji,image_url,created_at";
    const [myRes, publicRes] = await Promise.all([
      getSupabase().from("groups").select(COLS).order("created_at", { ascending: false }),
      getSupabase().from("groups").select(COLS).eq("is_private", false).order("created_at", { ascending: false }).limit(20),
    ]);
    if (myRes.data) setGroups(myRes.data);
    if (publicRes.data) setAllPublicGroups(publicRes.data);
    setLoading(false);
  }

  function toggleStar(groupId: string) {
    setStarredGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      localStorage.setItem("meogja_starred_groups", JSON.stringify([...next]));
      return next;
    });
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    if (isPrivate && currentUser.type !== "auth") return;
    if (currentUser.type === "none") { router.replace("/login"); return; }

    // 최대 10개 제한 (로그인 사용자)
    if (currentUser.type === "auth") {
      const { count } = await getSupabase().from("groups")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", currentUser.user.id);
      if ((count ?? 0) >= 10) {
        await showAlert("모임은 계정당 최대 10개까지 만들 수 있습니다.", { icon: "📌", title: "생성 제한" });
        return;
      }
    }

    setCreating(true);
    const ownerId = currentUser.type === "auth" ? currentUser.user.id : null;
    const ownerGuestName = currentUser.type === "guest" ? currentUser.user.name : null;
    const { data } = await getSupabase()
      .from("groups")
      .insert({
        name: newName.trim(),
        description: description.trim() || null,
        emoji: groupImageUrl ? null : groupEmoji,
        image_url: groupImageUrl || null,
        is_private: isPrivate,
        password: isPrivate ? newPassword : null,
        owner_id: ownerId,
        owner_guest_name: ownerGuestName,
        require_auth: requireAuth,
        requires_approval: requiresApproval,
      })
      .select().single();
    setCreating(false);
    if (data) {
      // 모임장 자동 멤버 추가
      const ownerMemberName =
        currentUser.type === "auth"
          ? (currentUser.user.display_name || currentUser.user.email?.split("@")[0] || "모임장")
          : currentUser.type === "guest" ? currentUser.user.name : null;
      let createdMemberId: string | null = null;
      if (ownerMemberName) {
        const { data: memberData } = await getSupabase().from("members").insert({
          name: ownerMemberName, group_id: data.id,
          user_id: ownerId, guest_name: ownerGuestName, status: "approved",
        }).select().single();
        createdMemberId = memberData?.id || null;
      }
      if (ownerId) {
        await getSupabase().from("group_memberships").insert({ group_id: data.id, user_id: ownerId, role: "owner" });
      }
      router.push(`/groups/${data.id}`);
    }
  }

  async function deleteGroup(group: Group) {
    if (group.is_private) {
      const res = await fetch("/api/groups/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: group.id, password: deletePassword }),
      });
      const { valid } = await res.json();
      if (!valid) { setDeletePasswordError(true); return; }
    }
    await getSupabase().from("groups").delete().eq("id", group.id);
    setDeleteTarget(null);
    setDeletePassword("");
    setDeletePasswordError(false);
    loadGroups();
  }

  async function handleEnter(group: Group) {
    // 인증 전용 모임: 비로그인/게스트 차단
    if (group.require_auth && currentUser.type !== "auth") {
      await showAlert("이 모임은 로그인한 사용자만 참여할 수 있습니다.\n로그인 후 다시 시도해주세요.", { icon: "🔑", title: "로그인 필요" });
      router.replace(`/login?next=/groups/${group.id}`);
      return;
    }
    if (group.is_private) {
      const pw = await showPrompt(`"${group.name}" 비밀번호를 입력하세요`, { title: "비공개 모임", placeholder: "비밀번호", inputType: "password" });
      if (!pw) return;
      const res = await fetch("/api/groups/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: group.id, password: pw }) });
      const { valid } = await res.json();
      if (valid) router.push(`/groups/${group.id}`);
      else await showAlert("비밀번호가 틀렸습니다.", { icon: "🔒" });
    } else {
      router.push(`/groups/${group.id}`);
    }
  }

  async function verifyPassword() {
    if (!enterTarget) return;
    const res = await fetch("/api/groups/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: enterTarget.id, password: enterPassword }),
    });
    const { valid } = await res.json();
    if (valid) {
      router.push(`/groups/${enterTarget.id}`);
    } else {
      setPasswordError(true);
    }
  }

  const publicGroups = groups.filter((g) => !g.is_private);
  const privateGroups = groups.filter((g) => g.is_private);
  // 실제 내 모임: 가입(myMemberships)하거나 내가 만든(owner) 모임만
  const myGroups = groups.filter((g) => myMemberships[g.id] !== undefined || isGroupOwner(g, currentUser));
  const myGroupIds = new Set(myGroups.map((g) => g.id));
  const starredList = myGroups.filter((g) => starredGroups.has(g.id));
  const unstarredList = myGroups.filter((g) => !starredGroups.has(g.id));
  // 공개 추천: 내 모임 제외
  const allGroupIds = new Set(groups.map((g) => g.id));
  // 공개 추천: 내 모임 제외 + 랜덤 5개
  const recommendPublic = allPublicGroups
    .filter((g) => !allGroupIds.has(g.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", gap: 28 }}>

      {/* ── 통합 Hero 카드 ── */}
      {homeSettings.show_roulette && <div className="fade-up" style={{ padding: "16px 16px 0" }}>
        <div style={{ background:"var(--hero-gradient)", borderRadius:20, padding:"20px", boxShadow:"0 8px 24px var(--hero-shadow)" }}>
          <div style={{ marginBottom:10 }}>
            <p style={{ fontFamily:"var(--font-display)", fontSize:17, color:"#fff" }}><img src="/mascot/tabs/food.png" style={{width:28, height:28, objectFit:"contain", marginRight:5, position:"relative", top:5}} />오늘 뭐 먹지?</p>
          </div>
          {rouletteResult && (
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, animation: rouletteRunning ? "none" : "sheetUp .3s both" }}>
              {!rouletteRunning && getFoodIconUrl(rouletteResult) && (
                <img src={getFoodIconUrl(rouletteResult)!} alt={rouletteResult} style={{ width:44, height:44, objectFit:"contain", flexShrink:0 }} />
              )}
              <div style={{ display:"flex", alignItems:"center", gap:4, minWidth:0 }}>
                <p style={{ fontFamily:"var(--font-display)", fontSize:28, color:"#fff", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {rouletteRunning ? rouletteResult : `${rouletteResult}!`}
                </p>
                {!rouletteRunning && (
                  <img src={`/mascot/avatars/${catImg}.png`} alt="" style={{ width:42, height:42, objectFit:"contain", flexShrink:0, pointerEvents:"none", mixBlendMode:"multiply", marginBottom:8 }} />
                )}
              </div>
            </div>
          )}
          <div style={{ display:"flex", gap:8 }}>
            <button data-tour-id="tour-roulette" className="tap" onClick={spinRoulette} disabled={rouletteRunning} style={{
              flex: rouletteResult && !rouletteRunning ? "0 0 auto" : 1,
              padding: rouletteResult && !rouletteRunning ? "11px 16px" : "11px 8px",
              borderRadius:"var(--r-pill)", border:"none",
              background: rouletteRunning ? "rgba(255,255,255,.3)" : "rgba(255,255,255,.2)",
              color:"#fff",
              fontFamily:"var(--font-display)", fontSize:14, fontWeight:700, cursor:rouletteRunning ? "default" : "pointer",
            }}>
              {rouletteRunning ? <><img src="/mascot/tabs/dice.png" style={{width:28,height:28,objectFit:"contain",marginRight:4,position:"relative",top:6}}/>…</> : rouletteResult ? <img src="/mascot/tabs/refresh.png" style={{width:28,height:28,objectFit:"contain",position:"relative",top:6}}/> : <><img src="/mascot/tabs/dice.png" style={{width:28,height:28,objectFit:"contain",marginRight:4,position:"relative",top:6}}/>랜덤 추천</>}
            </button>
            {rouletteResult && !rouletteRunning && (
              <button className="tap pulse-cta" onClick={() => openMenuAction([rouletteResult])} style={{
                flex:1, padding:"11px 8px", borderRadius:"var(--r-pill)", border:"none",
                background:"#fff", color:"var(--primary)",
                fontFamily:"var(--font-display)", fontSize:14, fontWeight:700, cursor:"pointer",
                animation: "pulseCta 1.4s ease-out infinite",
              }}>
                ✨ 이걸로 찾기 →
              </button>
            )}
          </div>
        </div>
      </div>}

      {/* ── 오늘의 배틀 ── */}
      {!battleVoted && homeSettings.show_battle && <MenuBattle onVoted={() => setBattleVoted(true)} />}

      {/* ── 지금 추천 메뉴 랭킹 ── */}
      {homeSettings.show_ranking && (() => {
        const slot = getTimeSlot();
        const timeFoodsArr = TIME_FOODS[slot].foods;
        const ageInfo = getAgeGroupFoods(homeUserAge);
        const ageFoodsArr = ageInfo?.foods ?? [];
        const weatherInfo = getWeatherFoods(weatherCondition);
        const weatherFoodsArr = weatherInfo?.foods ?? [];
        const trendMap = new Map(trendingMenus.map(m => [m.name, m.count]));
        const maxTrend = trendingMenus[0]?.count || 1;

        // 시간대 위치 기반 점수 (1위=30, 이후 2씩 감소, 최소 4) × 가중치
        const wt = homeSettings.weight_time / 100;
        const wa = homeSettings.weight_age / 100;
        const ww = homeSettings.weight_weather / 100;
        const wtr = homeSettings.weight_trend / 100;
        const wap = homeSettings.weight_app / 100;
        // 격차 2→1로 줄여 순위 다양성 향상
        const timeScoreMap = new Map(timeFoodsArr.map((n, i) => [n, Math.max(4, 30 - i) * wt]));
        const ageScoreMap = new Map(ageFoodsArr.map((n, i) => [n, Math.max(4, 22 - i) * wa]));
        const weatherScoreMap = new Map(weatherFoodsArr.map((n, i) => [n, Math.max(4, 18 - i) * ww]));

        // 후보: 시간대 + 나이대 + 날씨 + 트렌딩
        const candidateSet = new Set([
          ...timeFoodsArr,
          ...ageFoodsArr,
          ...weatherFoodsArr,
          ...trendingMenus.filter(m => ROULETTE_POOL.includes(m.name)).map(m => m.name),
        ]);
        const algoRanked = Array.from(candidateSet)
          .filter(name => !ROULETTE_CATEGORY_EXCLUDE.has(name))
          .filter(name => !homeDislikedFoods.some(d => name.includes(d) || d.includes(name)))
          .map(name => {
          const timeScore = timeScoreMap.get(name) || 0;
          const ageScore = ageScoreMap.get(name) || 0;
          const weatherScore = weatherScoreMap.get(name) || 0;
          const trendCnt = trendMap.get(name) || 0;
          const trendBoost = Math.floor((trendCnt / maxTrend) * 15 * wtr);
          const appCnt = (trendingMenus.find(m => m.name === name)?.count || 0);
          const appBoost = wap > 0 ? Math.floor((appCnt / maxTrend) * 20 * wap) : 0;
          const nameHash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
          const jitter = (nameHash % 7) - 3;
          const userBoost = Math.round((homeUserScores.get(name) || 0) * 12);
          const matchPct = Math.min(99, Math.max(30, Math.round(28 + timeScore + ageScore + weatherScore + trendBoost + appBoost + userBoost + jitter)));
          const tags: string[] = [];
          if (timeScore > 0) tags.push(`${TIME_FOODS[slot].emoji} ${slot}`);
          if (ageScore > 0 && ageInfo) tags.push(ageInfo.label);
          if (weatherScore > 0 && weatherInfo) tags.push(`${weatherInfo.emoji} ${weatherInfo.label}`);
          if (trendCnt > 0) tags.push("🔥 인기");
          return { name, matchPct, tags };
        }).sort((a, b) => b.matchPct - a.matchPct);

        // 고정 메뉴를 맨 앞에 삽입
        const pinnedItems = homeSettings.pinned_menus
          .filter(m => !homeDislikedFoods.some(d => m.includes(d) || d.includes(m)))
          .map(name => ({ name, matchPct: 99, tags: ["📌 고정"] as string[] }));
        const nonPinned = algoRanked.filter(r => !homeSettings.pinned_menus.includes(r.name));
        const ranked = [...pinnedItems, ...nonPinned].slice(0, 10);

        const subtitle = [
          `${TIME_FOODS[slot].emoji} ${slot}`,
          ageInfo ? ageInfo.label : null,
          weatherInfo ? `${weatherInfo.emoji} ${weatherInfo.label}` : null,
          trendingMenus.length > 0 ? "트렌딩 반영" : null,
        ].filter(Boolean).join(" · ");

        return (
          <div className="fade-up fade-up-1">
            <div data-tour-id="tour-ranking" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", marginBottom:10 }}>
              <div>
                <p style={{ fontFamily:"var(--font-display)", fontSize:16 }}><img src="/mascot/tabs/hot.png" style={{width:24, height:24, objectFit:"contain", marginRight:4, position:"relative", top:3}} />지금 가장 잘 맞는 메뉴</p>
                <p style={{ fontSize:12, color:"var(--text-2)", marginTop:2 }}>{subtitle}</p>
              </div>
            </div>
            <div className="scroll-x" style={{ padding:"14px 16px 4px", overflow:"visible", overflowX:"auto" }}>
              {ranked.map((item, i) => {
                const iconUrl = getFoodIconUrl(item.name);
                const isTop = i === 0;
                return (
                  <div key={item.name} style={{ flexShrink:0, position:"relative", paddingTop: 12 }}>
                    {isTop && (
                      <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", background:"var(--primary)", color:"#fff", fontSize:9, fontWeight:800, padding:"2px 8px", borderRadius:99, letterSpacing:"0.05em", zIndex:1, whiteSpace:"nowrap" }}>BEST</div>
                    )}
                    <button className="tap" onClick={() => openMenuAction([item.name])} style={{
                      width:120, borderRadius:16, border: isTop ? "2px solid var(--primary)" : "var(--card-border)",
                      background:"var(--surface)", padding:"12px 10px 12px", display:"flex", flexDirection:"column",
                      alignItems:"center", gap:6, cursor:"pointer", boxShadow: isTop ? "0 4px 16px rgba(255,122,69,.2)" : "var(--card-shadow)",
                    }}>
                      {iconUrl
                        ? <img src={iconUrl} alt={item.name} style={{ width:52, height:52, objectFit:"contain" }} />
                        : <img src="/mascot/tabs/food.png" style={{width:52, height:52, objectFit:"contain"}} />}
                      <p style={{ fontFamily:"var(--font-display)", fontSize:13, color:"var(--text)", textAlign:"center", lineHeight:1.3 }}>{item.name}</p>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:3, justifyContent:"center" }}>
                        {item.tags.map(tag => (
                          <span key={tag} style={{ fontSize:9, padding:"2px 5px", borderRadius:99, background:"var(--bg-2)", color:"var(--text-2)", fontWeight:700 }}>{tag}</span>
                        ))}
                      </div>
                      <div style={{ width:"100%", display:"flex", alignItems:"center", gap:4 }}>
                        <div style={{ flex:1, height:4, borderRadius:99, background:"var(--bg-2)", overflow:"hidden" }}>
                          <div style={{ width:`${item.matchPct}%`, height:"100%", background: isTop ? "var(--primary)" : "var(--green)", borderRadius:99 }} />
                        </div>
                        <span style={{ fontSize:10, fontWeight:700, color: isTop ? "var(--primary)" : "var(--green)", flexShrink:0 }}>{item.matchPct}%</span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── 내 모임 (위로 올림) ── */}
      {!loading && currentUser.type !== "none" && (
        <div className="fade-up fade-up-2" style={{ padding: "0 16px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <span style={{ fontFamily:"var(--font-display)", fontSize:17 }}>👥 내 모임</span>
            <button data-tour-id="tour-group-btn" className="tap" onClick={() => setShowCreateForm(true)} style={{ fontSize:12, color:"var(--primary)", fontWeight:700, background:"none", border:"none", cursor:"pointer" }}>+ 새 모임</button>
          </div>
          {showCreateForm && (
            <div className="fade-up" style={{ marginBottom:12, background:"var(--surface)", borderRadius:"var(--card-radius)", padding:"22px 20px", border:"var(--card-border)", boxShadow:"var(--card-shadow)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <span style={{ fontFamily:"var(--font-display)", fontSize:17 }}>새 모임 만들기</span>
                <button onClick={() => { setShowCreateForm(false); setNewName(""); setIsPrivate(false); setNewPassword(""); }} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-2)", fontSize:18 }}>✕</button>
              </div>
              <CreateForm newName={newName} setNewName={setNewName} description={description} setDescription={setDescription} emoji={groupEmoji} setEmoji={setGroupEmoji} imageUrl={groupImageUrl} setImageUrl={setGroupImageUrl} isPrivate={isPrivate} setIsPrivate={setIsPrivate} newPassword={newPassword} setNewPassword={setNewPassword} requireAuth={requireAuth} setRequireAuth={setRequireAuth} requiresApproval={requiresApproval} setRequiresApproval={setRequiresApproval} creating={creating} onSubmit={createGroup} isLoggedIn={currentUser.type === "auth"} />
            </div>
          )}
          {!loading && myGroups.length === 0 && (
            <div style={{ padding:"20px 18px", borderRadius:14, background:"var(--surface)", border:"var(--card-border)", textAlign:"center" }}>
              <p style={{ fontSize:28, marginBottom:8 }}><img src="/mascot/tabs/food.png" style={{width:28, height:28, objectFit:"contain"}} /></p>
              <p style={{ fontSize:14, color:"var(--text)", fontWeight:600, marginBottom:4 }}>아직 가입한 모임이 없어요</p>
              <p style={{ fontSize:12, color:"var(--text-2)", marginBottom:14 }}>친구들과 모임을 만들고 메뉴를 함께 정해보세요</p>
              <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
                <button className="tap" onClick={() => router.push("/groups")} style={{ padding:"9px 18px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--primary)", background:"transparent", color:"var(--primary)", fontFamily:"var(--font-display)", fontSize:13, cursor:"pointer" }}>모임 찾기</button>
                <button className="tap" onClick={() => setShowCreateForm(true)} style={{ padding:"9px 18px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:13, cursor:"pointer" }}>모임 만들기</button>
              </div>
            </div>
          )}
          {!loading && starredList.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <p style={{ fontFamily:"var(--font-display)", fontSize:15, color:"#C77800", marginBottom:8 }}><img src="/mascot/tabs/star.png" style={{width:24, height:24, objectFit:"contain", marginRight:4, position:"relative", top:3}} />즐겨찾는 모임</p>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {starredList.map((group) => (
                  <GroupCard key={group.id} group={group} onClick={() => handleEnter(group)} myMemberName={myMemberships[group.id]} isOwner={isGroupOwner(group, currentUser)} starred={true} onStar={(e) => { e.stopPropagation(); toggleStar(group.id); }} />
                ))}
              </div>
            </div>
          )}
          {!loading && unstarredList.length > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {unstarredList.map((group) => (
                <GroupCard key={group.id} group={group} onClick={() => handleEnter(group)} myMemberName={myMemberships[group.id]} isOwner={isGroupOwner(group, currentUser)} starred={false} onStar={(e) => { e.stopPropagation(); toggleStar(group.id); }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* loading 중 표시 */}
      {loading && <div style={{ padding:"0 16px" }}><p style={{ color:"var(--text-2)", textAlign:"center", padding:"30px 0", fontSize:14 }}>불러오는 중…</p></div>}

      {/* ── 앱 사용자 메뉴 랭킹 ── */}
      {homeSettings.show_trending_bar && trendingMenus.length > 0 && (
        <div className="fade-up fade-up-1" style={{ padding:"0 16px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <div>
              <p style={{ fontFamily:"var(--font-display)", fontSize:16 }}><img src="/mascot/tabs/ranking.png" style={{width:24, height:24, objectFit:"contain", marginRight:4, position:"relative", top:3}} />앱 사용자 메뉴 랭킹</p>
              <p style={{ fontSize:11, color:"var(--text-3)", marginTop:2 }}>
                {rankingPeriod === "weekly" ? "지난 7일" : rankingPeriod === "monthly" ? "지난 30일" : "누적"} 기준 · 월드컵·선호도 집계
              </p>
            </div>
            <div style={{ display:"flex", gap:4 }}>
              {(["weekly","monthly","all"] as const).map(p => (
                <button key={p} className="tap" onClick={() => { setRankingPeriod(p); loadTrendingMenus(p); }} style={{
                  padding:"4px 10px", borderRadius:99, border:"none", fontSize:11, fontWeight:700, cursor:"pointer",
                  background: rankingPeriod === p ? "var(--primary)" : "var(--bg-2)",
                  color: rankingPeriod === p ? "#fff" : "var(--text-3)",
                }}>{p === "weekly" ? "주간" : p === "monthly" ? "월간" : "전체"}</button>
              ))}
            </div>
          </div>
          <div className="scroll-x" style={{ gap:10, paddingBottom:8 }}>
            {trendingMenus.slice(0,5).map((m, i) => {
              const medals = ["🥇","🥈","🥉","4위","5위"];
              const iconUrl = getFoodIconUrl(m.name);
              return (
                <button key={m.name} className="tap" onClick={() => openMenuAction([m.name])} style={{
                  flexShrink:0, width:105, display:"flex", flexDirection:"column", alignItems:"center", gap:6,
                  padding:"14px 8px", background:"var(--surface)", borderRadius:16,
                  border: i === 0 ? "2px solid var(--primary)" : "var(--card-border)",
                  cursor:"pointer", boxShadow:"var(--card-shadow)", textAlign:"center",
                }}>
                  {iconUrl
                    ? <img src={iconUrl} alt={m.name} style={{ width:48, height:48, objectFit:"contain" }} />
                    : <img src="/mascot/tabs/food.png" style={{width:48, height:48, objectFit:"contain"}} />}
                  <p style={{ fontFamily:"var(--font-display)", fontSize:13, color:"var(--text)", lineHeight:1.3 }}>
                    {medals[i]}<br/>{m.name}
                  </p>
                  <span style={{ fontSize:10, color:"var(--text-3)" }}>{m.count}점</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 메뉴 카테고리 탭 ── */}
      <div className="fade-up fade-up-1" style={{ padding: "0 16px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <span style={{ fontFamily:"var(--font-display)", fontSize:17 }}>메뉴 고르기</span>
          {quickSelected.size > 0 && (
            <button className="tap" onClick={() => setQuickSelected(new Set())} style={{ fontSize:12, color:"var(--text-3)", background:"none", border:"none", cursor:"pointer" }}>선택 초기화</button>
          )}
        </div>
        <div className="scroll-x" style={{ gap:8, paddingBottom:4 }}>
          {MENU_CATEGORIES.map((c) => {
            const isActive = quickCatSheet?.label === c.label;
            const catIconUrl = getFoodIconUrl(c.label);
            return (
              <button key={c.label} className="tap" onClick={() => {
                setQuickCatSheet(isActive ? null : { label: c.label, emoji: c.emoji, items: c.menus });
              }} style={{
                display:"flex", alignItems:"center", gap:6, flexShrink:0, padding:"6px 14px 6px 8px",
                borderRadius:"var(--r-pill)", border: isActive ? "none" : "1.5px solid var(--border)",
                background: isActive ? "var(--primary)" : "var(--surface)",
                color: isActive ? "#fff" : "var(--text-2)", fontSize:13, fontWeight:600, cursor:"pointer",
                boxShadow: isActive ? "0 4px 12px rgba(255,122,69,.3)" : "none", transition:"all .15s",
              }}>
                {catIconUrl
                  ? <img src={catIconUrl} alt="" style={{ width:24, height:24, objectFit:"contain" }} />
                  : <span style={{ fontSize:16 }}>{c.emoji}</span>}
                {c.label}
              </button>
            );
          })}
        </div>
        {quickCatSheet && (
          <div style={{ marginTop:12, padding:"14px 16px", background:"var(--surface)", borderRadius:16, border:"var(--card-border)", boxShadow:"var(--card-shadow)" }}>
            <p style={{ fontSize:12, color:"var(--text-3)", marginBottom:10 }}>먹고 싶은 메뉴를 선택하세요 (다중 선택 가능)</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {quickCatSheet.items.map((item) => {
                const sel = quickSelected.has(item);
                return (
                  <button key={item} className="tap" onClick={() => {
                    setQuickSelected(prev => {
                      const next = new Set(prev);
                      if (next.has(item)) next.delete(item); else next.add(item);
                      return next;
                    });
                  }} style={{
                    padding:"7px 14px", borderRadius:"var(--r-pill)", cursor:"pointer", fontSize:13, fontWeight: sel ? 700 : 400,
                    border: sel ? "none" : "1.5px solid var(--border)",
                    background: sel ? "var(--primary)" : "var(--bg)",
                    color: sel ? "#fff" : "var(--text)",
                  }}>
                    {sel && "✓ "}{item}
                  </button>
                );
              })}
            </div>
            {quickSelected.size > 0 && (
              <button className="tap" onClick={() => setShowQuickGroupPicker(true)} style={{
                marginTop:14, width:"100%", padding:"13px", borderRadius:"var(--r-pill)", border:"none",
                background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:15, cursor:"pointer",
                boxShadow:"0 6px 18px rgba(255,122,69,.3)",
              }}>
                {quickSelected.size}개 메뉴로 식당 찾기 →
              </button>
            )}
          </div>
        )}
      </div>

      {/* 모임 선택 시트 */}
      {showQuickGroupPicker && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:70 }}
          onClick={() => setShowQuickGroupPicker(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"24px 24px 0 0", padding:"20px 20px 40px", width:"100%", maxWidth:480, maxHeight:"60vh", display:"flex", flexDirection:"column", animation:"sheetUp .28s both" }}>
            <div style={{ width:40, height:5, borderRadius:99, background:"var(--border)", margin:"0 auto 12px" }} />
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
              <p style={{ fontFamily:"var(--font-display)", fontSize:18 }}>어느 모임에서 찾을까요?</p>
              <button onClick={() => setShowQuickGroupPicker(false)} style={{ background:"var(--bg-2)", border:"none", borderRadius:"50%", width:30, height:30, cursor:"pointer", color:"var(--text-2)", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>✕</button>
            </div>
            <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:16 }}>{[...quickSelected].join(", ")}</p>
            <div style={{ overflowY:"auto", flex:1, display:"flex", flexDirection:"column", gap:10 }}>
              {(() => {
                const myGroupList = groups.filter(g => myMemberships[g.id] !== undefined || isGroupOwner(g, currentUser));
                if (myGroupList.length === 0) {
                  return (
                    <div style={{ textAlign:"center", padding:"20px 0" }}>
                      <p style={{ fontSize:14, color:"var(--text-2)", marginBottom:16 }}>아직 가입한 모임이 없습니다</p>
                      <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                        <button className="tap" onClick={() => {
                          setShowQuickGroupPicker(false);
                          if (currentUser.type === "none") { router.replace("/login"); return; }
                          setShowCreateForm(true);
                        }} style={{ padding:"10px 20px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>모임 만들기</button>
                        <button className="tap" onClick={() => { setShowQuickGroupPicker(false); router.push("/groups"); }} style={{ padding:"10px 20px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", fontSize:14, fontWeight:600, cursor:"pointer" }}>모임 찾기</button>
                      </div>
                    </div>
                  );
                }
                return myGroupList.map((g) => (
                  <button key={g.id} className="tap" onClick={() => {
                    setShowQuickGroupPicker(false);
                    if (quickSelected.size > 0) {
                      sessionStorage.setItem("meogja_preset_menus", JSON.stringify([...quickSelected]));
                    }
                    setQuickCatSheet(null);
                    setQuickSelected(new Set());
                    handleEnter(g);
                  }} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:14, border:"1.5px solid var(--border)", background:"var(--bg)", cursor:"pointer", textAlign:"left" }}>
                    <span style={{ fontSize:24 }}>{g.emoji || "🍱"}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontFamily:"var(--font-display)", fontSize:15, color:"var(--text)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{g.name}</p>
                      {g.description && <p style={{ fontSize:12, color:"var(--text-2)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{g.description}</p>}
                    </div>
                    <span style={{ color:"var(--text-3)", fontSize:18 }}>›</span>
                  </button>
                ));
              })()}
            </div>
            <button className="tap" onClick={() => {
              setShowQuickGroupPicker(false);
              setQuickCatSheet(null);
              if (quickSelected.size > 0) {
                const menus = [...quickSelected];
                setQuickSelected(new Set());
                goToSearch(menus);
              } else {
                setQuickSelected(new Set());
                try {
                  const existing = JSON.parse(sessionStorage.getItem("meogja_preset_menus") || "[]");
                  goToSearch(existing.length > 0 ? existing : []);
                } catch { goToSearch([]); }
              }
            }} style={{ marginTop:12, width:"100%", padding:"12px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-2)", fontSize:14, fontWeight:600, cursor:"pointer" }}>
              📍 모임 없이 바로 주변 찾기
            </button>
          </div>
        </div>
      )}

      {/* ── 랜덤 추천 팝업 (세션 첫 방문) ── */}
      {showRoulettePopup && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:90, padding:"0 20px" }}>
          <div style={{ background:"linear-gradient(135deg,#FF7A45,#FF4E88)", borderRadius:24, padding:"28px 24px 24px", width:"100%", maxWidth:360, boxShadow:"0 20px 60px rgba(255,122,69,.5)", position:"relative", animation:"sheetUp .3s both" }}>
            <button onClick={() => setShowRoulettePopup(false)} style={{ position:"absolute", top:14, right:16, background:"rgba(255,255,255,.25)", border:"none", borderRadius:"50%", width:30, height:30, cursor:"pointer", color:"#fff", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
            <p style={{ fontFamily:"var(--font-display)", fontSize:18, color:"#fff", marginBottom:8 }}>오늘 뭐 먹지? <img src="/mascot/tabs/dice.png" style={{width:22,height:22,objectFit:"contain"}}/></p>
            {rouletteResult ? (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:18, animation: rouletteRunning ? "none" : "sheetUp .3s both" }}>
                {!rouletteRunning && getFoodIconUrl(rouletteResult) && (
                  <img src={getFoodIconUrl(rouletteResult)!} alt={rouletteResult} style={{ width:52, height:52, objectFit:"contain", flexShrink:0 }} />
                )}
                <p style={{ fontFamily:"var(--font-display)", fontSize:32, color:"#fff" }}>
                  {rouletteRunning ? rouletteResult : `${rouletteResult}!`}
                </p>
                {!rouletteRunning && (
                  <img src={`/mascot/avatars/${catImg}.png`} alt="" style={{ width:44, height:44, objectFit:"contain", flexShrink:0, mixBlendMode:"multiply", marginBottom:8 }} />
                )}
              </div>
            ) : (
              <p style={{ fontSize:15, color:"rgba(255,255,255,.75)", marginBottom:18 }}>랜덤으로 오늘 메뉴를 정해드려요</p>
            )}
            <div style={{ display:"flex", gap:10 }}>
              <button className="tap" onClick={spinRoulette} disabled={rouletteRunning} style={{
                flex:1, padding:"13px", borderRadius:"var(--r-pill)", border:"none",
                background: rouletteRunning ? "rgba(255,255,255,.3)" : "#fff",
                color: rouletteRunning ? "#fff" : "var(--primary)",
                fontFamily:"var(--font-display)", fontSize:14, fontWeight:700, cursor:rouletteRunning ? "default" : "pointer",
              }}>
                {rouletteRunning ? "돌리는 중…" : <><img src="/mascot/tabs/dice.png" style={{width:18,height:18,objectFit:"contain",marginRight:4}}/>돌리기</>}
              </button>
              {rouletteResult && !rouletteRunning && (
                <button className="tap" onClick={() => {
                  setShowRoulettePopup(false);
                  openMenuAction([rouletteResult]);
                }} style={{
                  padding:"13px 16px", borderRadius:"var(--r-pill)", border:"2px solid rgba(255,255,255,.5)",
                  background:"transparent", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer",
                }}>
                  찾기 →
                </button>
              )}
            </div>
            <button className="tap" onClick={() => setShowRoulettePopup(false)} style={{ marginTop:12, width:"100%", padding:"10px", borderRadius:"var(--r-pill)", border:"none", background:"rgba(255,255,255,.15)", color:"rgba(255,255,255,.7)", fontSize:13, cursor:"pointer" }}>
              나중에
            </button>
          </div>
        </div>
      )}

      {/* ── 메뉴 액션 시트 ── */}
      {menuActionMenus.length > 0 && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:75 }}
          onClick={() => setMenuActionMenus([])}>
          <div onClick={(e) => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"24px 24px 0 0", padding:"20px 20px 40px", width:"100%", maxWidth:480, animation:"sheetUp .28s both" }}>
            <div style={{ width:40, height:5, borderRadius:99, background:"var(--border)", margin:"0 auto 12px" }} />
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
              <p style={{ fontFamily:"var(--font-display)", fontSize:18 }}>어떻게 찾으시겠어요?</p>
              <button onClick={() => setMenuActionMenus([])} style={{ background:"var(--bg-2)", border:"none", borderRadius:"50%", width:30, height:30, cursor:"pointer", color:"var(--text-2)", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>✕</button>
            </div>
            <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:18 }}>{menuActionMenus.join(", ")}</p>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <button className="tap" onClick={() => {
                sessionStorage.setItem("meogja_preset_menus", JSON.stringify(menuActionMenus));
                setMenuActionMenus([]);
                setShowQuickGroupPicker(true);
              }} style={{ padding:"14px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:15, cursor:"pointer" }}>
                👥 모임에서 찾기
              </button>
              <button className="tap" onClick={() => {
                const menus = menuActionMenus;
                setMenuActionMenus([]);
                goToSearch(menus);
              }} style={{ padding:"14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", fontSize:15, fontWeight:600, cursor:"pointer" }}>
                📍 모임 없이 바로 주변 찾기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📍 공개 모임 추천 */}
      {!loading && recommendPublic.length > 0 && (
        <div className="fade-up fade-up-3" style={{ padding: "0 16px" }}>
          <p style={{ fontFamily:"var(--font-display)", fontSize:15, color:"var(--text-2)", marginBottom:8 }}>📍 이런 모임은 어때요?</p>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {recommendPublic.map((group) => (
              <GroupCard key={group.id} group={group} onClick={() => handleEnter(group)} />
            ))}
          </div>
        </div>
      )}

      {/* 비로그인 + 공개 모임 없을 때 — 시작 유도 */}
      {!loading && currentUser.type === "none" && recommendPublic.length === 0 && (
        <div className="fade-up fade-up-2" style={{ padding: "0 16px", textAlign:"center" }}>
          <div style={{ padding:"32px 20px", background:"var(--surface)", borderRadius:"var(--card-radius)", border:"var(--card-border)" }}>
            <p style={{ fontSize:36, marginBottom:10 }}><img src="/mascot/tabs/food.png" style={{width:36, height:36, objectFit:"contain"}} /></p>
            <p style={{ fontFamily:"var(--font-display)", fontSize:18, marginBottom:6 }}>배고파? 같이 정하자!</p>
            <p style={{ fontSize:14, color:"var(--text-2)", marginBottom:20 }}>로그인하고 첫 모임을 만들어보세요</p>
            <button className="tap" onClick={() => router.push("/login")} style={{ padding:"12px 28px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:15, cursor:"pointer" }}>시작하기 →</button>
          </div>
        </div>
      )}

      {/* 비공개 모임 비밀번호 다이얼로그 */}
      {enterTarget && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 50, padding: 20,
        }} onClick={(e) => { if (e.target === e.currentTarget) setEnterTarget(null); }}>
          <div style={{
            background: "var(--bg-card)", borderRadius: 20, padding: 32,
            width: "100%", maxWidth: 380, boxShadow: "var(--shadow-lg)",
          }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, marginBottom: 6 }}>
              🔒 {enterTarget.name}
            </p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>비밀번호를 입력하세요</p>
            <input
              autoFocus
              type="password"
              value={enterPassword}
              onChange={(e) => { setEnterPassword(e.target.value); setPasswordError(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") verifyPassword(); }}
              placeholder="비밀번호"
              style={{
                width: "100%", padding: "12px 18px", borderRadius: 100,
                border: `1.5px solid ${passwordError ? "var(--red)" : "var(--border)"}`,
                background: "var(--bg)", fontSize: 15, color: "var(--text)", outline: "none",
                marginBottom: passwordError ? 6 : 16,
              }}
            />
            {passwordError && <p style={{ fontSize: 12, color: "var(--red)", marginBottom: 14 }}>비밀번호가 틀렸습니다</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEnterTarget(null)} style={{
                flex: 1, padding: "11px", borderRadius: 100, border: "1.5px solid var(--border)",
                background: "transparent", color: "var(--text-muted)", fontSize: 14, fontWeight: 500, cursor: "pointer",
              }}>취소</button>
              <button onClick={verifyPassword} style={{
                flex: 2, padding: "11px", borderRadius: 100, border: "none",
                background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}>입장</button>
            </div>
          </div>
        </div>
      )}

      {/* 모임 삭제 확인 다이얼로그 */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) { setDeleteTarget(null); setDeletePassword(""); setDeletePasswordError(false); } }}>
          <div style={{ background: "var(--bg-card)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, boxShadow: "var(--shadow-lg)" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>모임 삭제</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: deleteTarget.is_private ? 14 : 20 }}>
              <strong style={{ color: "var(--text)" }}>{deleteTarget.name}</strong> 모임을 삭제하면 멤버, 선호도, 히스토리가 모두 삭제됩니다.
            </p>
            {deleteTarget.is_private && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>🔒 비공개 모임 — 비밀번호를 입력하세요</p>
                <input
                  autoFocus
                  type="password"
                  value={deletePassword}
                  onChange={(e) => { setDeletePassword(e.target.value); setDeletePasswordError(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") deleteGroup(deleteTarget); }}
                  placeholder="비밀번호"
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 100,
                    border: `1.5px solid ${deletePasswordError ? "var(--red)" : "var(--border)"}`,
                    background: "var(--bg)", fontSize: 14, color: "var(--text)", outline: "none",
                  }}
                />
                {deletePasswordError && <p style={{ fontSize: 12, color: "var(--red)", marginTop: 4 }}>비밀번호가 틀렸습니다</p>}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setDeleteTarget(null); setDeletePassword(""); setDeletePasswordError(false); }} style={{ flex: 1, padding: 11, borderRadius: 100, border: "1.5px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>취소</button>
              <button onClick={() => deleteGroup(deleteTarget)} style={{ flex: 2, padding: 11, borderRadius: 100, border: "none", background: "var(--red)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* 온보딩 투어 */}
      {showTour && <TourGuide onDone={() => setShowTour(false)} />}
    </div>
  );
}
