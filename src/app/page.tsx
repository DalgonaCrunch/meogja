"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, Group } from "@/lib/supabase";
import { getCurrentUser, CurrentUser } from "@/lib/auth";
import { toast, showAlert, showConfirm, showPrompt } from "@/lib/dialog";
import { getCategorySubItems } from "@/lib/recommend";
import MenuBattle from "./MenuBattle";
import { MENU_CATEGORIES, ROULETTE_POOL } from "@/lib/menus";
import { getFoodIconUrl } from "@/lib/foodIcons";

const GROUP_EMOJIS = ['🍱','🍜','🍗','🍕','🍣','🥘','🌮','🍻','🥗','🍰'];

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

  // 홈 기능
  const [rouletteResult, setRouletteResult] = useState<string | null>(null);
  const [rouletteRunning, setRouletteRunning] = useState(false);
  const [trendingMenus, setTrendingMenus] = useState<{name:string;count:number}[]>([]);

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
    loadTrendingMenus();
    // 오늘 이미 배틀 투표 여부
    const today = new Date().toISOString().slice(0,10);
    if (localStorage.getItem("meogja_battle_voted") === today) setBattleVoted(true);
    // 첫 방문 시 룰렛 팝업
    if (!sessionStorage.getItem("meogja_roulette_seen")) {
      setShowRoulettePopup(true);
      sessionStorage.setItem("meogja_roulette_seen", "1");
    }
    getCurrentUser().then(async (u) => {
      setCurrentUser(u);
      if (u.type === "auth") {
        const { data } = await getSupabase().from("members").select("group_id, name").eq("user_id", u.user.id);
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((m) => { map[m.group_id] = m.name; });
          setMyMemberships(map);
        }
      } else if (u.type === "guest") {
        const { data } = await getSupabase().from("members").select("group_id, name").eq("guest_name", u.user.name);
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((m) => { map[m.group_id] = m.name; });
          setMyMemberships(map);
        }
      }
    });
  }, []);

  // 모임장 여부 확인
  async function loadTrendingMenus() {
    const counts: Record<string, number> = {};

    // 1. food_preferences (like)
    const { data: prefs } = await getSupabase()
      .from("food_preferences").select("food_name").eq("preference_type", "like").limit(500);
    prefs?.forEach((r) => { counts[r.food_name] = (counts[r.food_name] || 0) + 1; });

    // 2. worldcup_selections (winner)
    const { data: wc } = await getSupabase()
      .from("worldcup_selections").select("winner").limit(1000);
    wc?.forEach((r) => { counts[r.winner] = (counts[r.winner] || 0) + 2; }); // 월드컵 승리는 가중치 2

    // 3. worldcup 최종 우승 (is_final)
    const { data: wcFinal } = await getSupabase()
      .from("worldcup_selections").select("winner").eq("is_final", true).limit(200);
    wcFinal?.forEach((r) => { counts[r.winner] = (counts[r.winner] || 0) + 5; }); // 최종 우승 가중치 5

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    if (sorted.length === 0) {
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
    const pool = trendingMenus.length > 0 ? trendingMenus.map(m => m.name).concat(ROULETTE_POOL) : ROULETTE_POOL;
    let i = 0;
    const total = 20;
    const interval = setInterval(() => {
      setRouletteResult(pool[Math.floor(Math.random() * pool.length)]);
      i++;
      if (i >= total) {
        clearInterval(interval);
        const final = pool[Math.floor(Math.random() * pool.length)];
        setRouletteResult(final);
        setRouletteRunning(false);
      }
    }, i < 10 ? 80 : 150);
  }

  function openMenuAction(menus: string[]) {
    setMenuActionMenus(menus);
  }

  // 위치 먼저 확인하고 /search 이동
  function goToSearch(menus: string[]) {
    sessionStorage.setItem("meogja_preset_menus", JSON.stringify(menus));
    if (!navigator.geolocation) { router.push("/search"); return; }
    // 이미 권한 있으면 바로 좌표 저장 후 이동, 없으면 /search에서 직접 요청
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sessionStorage.setItem("meogja_search_location", JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
        router.push("/search");
      },
      () => { router.push("/search"); }, // 실패해도 이동 (search 페이지에서 재시도)
      { timeout: 5000, enableHighAccuracy: false }
    );
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
    if (currentUser.type === "none") { router.push("/login"); return; }

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
      if (ownerMemberName) {
        await getSupabase().from("members").insert({
          name: ownerMemberName, group_id: data.id,
          user_id: ownerId, guest_name: ownerGuestName, status: "approved",
        });
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
      router.push(`/login?next=/groups/${group.id}`);
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
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {/* ── Hero ── */}
      <div className="fade-up" style={{ position:"relative", overflow:"hidden" }}>
        <img src="/meogja-brand.jpg" alt="meogja brand" style={{ width:"100%", display:"block", height:"auto" }} />
      </div>

      {/* ── 랜덤 룰렛 ── */}
      <div className="fade-up fade-up-1" style={{ padding: "0 16px" }}>
        <div style={{ background:"linear-gradient(135deg, #FF7A45 0%, #FF4E88 100%)", borderRadius:20, padding:"20px 20px", boxShadow:"0 8px 24px rgba(255,122,69,.35)", position:"relative", overflow:"hidden" }}>
          <img src="/avatars/meogja_cat_051.png" alt="" style={{ position:"absolute", right:14, bottom:0, width:72, height:72, objectFit:"contain", opacity:.9, pointerEvents:"none" }} />
          <p style={{ fontFamily:"var(--font-display)", fontSize:16, color:"rgba(255,255,255,.85)", marginBottom:8 }}>오늘 뭐 먹지? 🎲</p>
          {rouletteResult ? (
            <p style={{ fontFamily:"var(--font-display)", fontSize:32, color:"#fff", marginBottom:16, animation: rouletteRunning ? "none" : "sheetUp .3s both" }}>
              {rouletteRunning ? rouletteResult : `🍽 ${rouletteResult}!`}
            </p>
          ) : (
            <p style={{ fontSize:15, color:"rgba(255,255,255,.7)", marginBottom:16 }}>버튼 하나로 메뉴 결정!</p>
          )}
          <div style={{ display:"flex", gap:10 }}>
            <button className="tap" onClick={spinRoulette} disabled={rouletteRunning} style={{
              flex:1, padding:"13px", borderRadius:"var(--r-pill)", border:"none",
              background: rouletteRunning ? "rgba(255,255,255,.3)" : "#fff",
              color: rouletteRunning ? "#fff" : "var(--primary)",
              fontFamily:"var(--font-display)", fontSize:15, fontWeight:700, cursor:rouletteRunning ? "default" : "pointer",
            }}>
              {rouletteRunning ? "🎲 돌리는 중…" : "🎲 랜덤 추천"}
            </button>
            {rouletteResult && !rouletteRunning && (
              <button className="tap" onClick={() => {
                const myGroupList = groups.filter(g => myMemberships[g.id] !== undefined || isGroupOwner(g, currentUser));
                if (currentUser.type === "none") { router.push("/login"); return; }
                sessionStorage.setItem("meogja_preset_menus", JSON.stringify([rouletteResult]));
                if (myGroupList.length > 0) handleEnter(myGroupList[0]);
                else setShowCreateForm(true);
              }} style={{
                padding:"13px 16px", borderRadius:"var(--r-pill)", border:"2px solid rgba(255,255,255,.5)",
                background:"transparent", color:"#fff", fontFamily:"var(--font-display)", fontSize:14, cursor:"pointer",
              }}>
                이걸로 찾기 →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 오늘의 배틀 — 투표 전만 표시 ── */}
      {!battleVoted && <MenuBattle onVoted={() => setBattleVoted(true)} />}

      {/* ── 시간대별 추천 ── */}
      {(() => {
        const t = getTimeBasedMenus();
        return (
          <div className="fade-up fade-up-1" style={{ padding: "0 16px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <span style={{ fontFamily:"var(--font-display)", fontSize:16 }}>{t.emoji} {t.label}</span>
            </div>
            <div className="scroll-x" style={{ gap:8, paddingBottom:4 }}>
              {t.menus.map((m) => {
                const iconUrl = getFoodIconUrl(m);
                return (
                <button key={m} className="tap" onClick={() => {
                  openMenuAction([m]);
                }} style={{
                  flexShrink:0, padding: iconUrl ? "7px 14px 7px 10px" : "9px 16px", borderRadius:"var(--r-pill)",
                  border:"1.5px solid var(--border)", background:"var(--surface)",
                  color:"var(--text)", fontSize:14, fontWeight:500, cursor:"pointer", whiteSpace:"nowrap",
                  display:"flex", alignItems:"center", gap:6,
                }}>
                  {iconUrl && <img src={iconUrl} alt="" style={{ width:26, height:26, objectFit:"contain" }} />}
                  {m}
                </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── 오늘의 인기 메뉴 ── */}
      {trendingMenus.length > 0 && (
        <div className="fade-up fade-up-1" style={{ padding: "0 16px" }}>
          <p style={{ fontFamily:"var(--font-display)", fontSize:16, marginBottom:10 }}>🔥 오늘의 인기 메뉴</p>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {trendingMenus.slice(0,5).map((m, i) => {
              const medals = ["🥇","🥈","🥉","4위","5위"];
              const maxCount = trendingMenus[0]?.count || 1;
              const widths = trendingMenus.slice(0,5).map(x => x.count > 0 ? Math.round(x.count / maxCount * 100) : [100,82,68,55,44][trendingMenus.indexOf(x)] || 40);
              const iconUrl = getFoodIconUrl(m.name);
              return (
                <button key={m.name} className="tap" onClick={() => {
                  openMenuAction([m.name]);
                }} style={{
                  display:"flex", alignItems:"center", gap:10, padding:"8px 14px",
                  background:"var(--surface)", borderRadius:12, border:"var(--card-border)", cursor:"pointer", textAlign:"left",
                }}>
                  <span style={{ fontSize:i < 3 ? 20 : 13, fontWeight:700, width:32, flexShrink:0, textAlign:"center" }}>{medals[i]}</span>
                  {iconUrl && <img src={iconUrl} alt="" style={{ width:32, height:32, objectFit:"contain", flexShrink:0 }} />}
                  <span style={{ fontFamily:"var(--font-display)", fontSize:15, flex:1 }}>{m.name}</span>
                  <div style={{ width:80, height:6, borderRadius:99, background:"var(--bg-2)", overflow:"hidden" }}>
                    <div style={{ width:`${widths[i]}%`, height:"100%", background:`hsl(${20+i*20} 85% 56%)`, borderRadius:99 }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 메뉴 카테고리 탭 ── */}
      <div className="fade-up fade-up-1" style={{ padding: "0 16px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <span style={{ fontFamily:"var(--font-display)", fontSize:17 }}>인기 메뉴 🔥</span>
          {quickSelected.size > 0 && (
            <button className="tap" onClick={() => setQuickSelected(new Set())} style={{ fontSize:12, color:"var(--text-3)", background:"none", border:"none", cursor:"pointer" }}>선택 초기화</button>
          )}
        </div>
        {/* 카테고리 탭 */}
        <div className="scroll-x" style={{ gap:8, paddingBottom:4 }}>
          {MENU_CATEGORIES.map((c, idx) => {
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

        {/* 인라인 메뉴 리스트 */}
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
            <div style={{ width:40, height:5, borderRadius:99, background:"var(--border)", margin:"0 auto 16px" }} />
            <p style={{ fontFamily:"var(--font-display)", fontSize:18, marginBottom:4 }}>어느 모임에서 찾을까요?</p>
            <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:16 }}>{[...quickSelected].join(", ")}</p>
            <div style={{ overflowY:"auto", flex:1, display:"flex", flexDirection:"column", gap:10 }}>
              {(() => {
                const myGroupList = groups.filter(g => myMemberships[g.id] !== undefined || isGroupOwner(g, currentUser));
                if (myGroupList.length === 0) {
                  return (
                    <div style={{ textAlign:"center", padding:"20px 0" }}>
                      <p style={{ fontSize:14, color:"var(--text-2)", marginBottom:16 }}>아직 가입한 모임이 없습니다</p>
                      <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                        <button className="tap" onClick={() => { setShowQuickGroupPicker(false); setShowCreateForm(true); }} style={{ padding:"10px 20px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>모임 만들기</button>
                        <button className="tap" onClick={() => { setShowQuickGroupPicker(false); router.push("/groups"); }} style={{ padding:"10px 20px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", fontSize:14, fontWeight:600, cursor:"pointer" }}>모임 찾기</button>
                      </div>
                    </div>
                  );
                }
                return myGroupList.map((g) => (
                  <button key={g.id} className="tap" onClick={() => {
                    setShowQuickGroupPicker(false);
                    sessionStorage.setItem("meogja_preset_menus", JSON.stringify([...quickSelected]));
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
            {/* 바로 찾기 옵션 */}
            <button className="tap" onClick={() => {
              setShowQuickGroupPicker(false);
              setQuickCatSheet(null);
              const menus = [...quickSelected];
              setQuickSelected(new Set());
              goToSearch(menus);
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
            <p style={{ fontFamily:"var(--font-display)", fontSize:18, color:"#fff", marginBottom:8 }}>오늘 뭐 먹지? 🎲</p>
            {rouletteResult ? (
              <p style={{ fontFamily:"var(--font-display)", fontSize:34, color:"#fff", marginBottom:18, textAlign:"center", animation: rouletteRunning ? "none" : "sheetUp .3s both" }}>
                {rouletteRunning ? rouletteResult : `🍽 ${rouletteResult}!`}
              </p>
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
                {rouletteRunning ? "돌리는 중…" : "🎲 돌리기"}
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

      {/* ── 메뉴 액션 시트 (모임 선택 or 바로 찾기) ── */}
      {menuActionMenus.length > 0 && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:75 }}
          onClick={() => setMenuActionMenus([])}>
          <div onClick={(e) => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"24px 24px 0 0", padding:"20px 20px 40px", width:"100%", maxWidth:480, animation:"sheetUp .28s both" }}>
            <div style={{ width:40, height:5, borderRadius:99, background:"var(--border)", margin:"0 auto 16px" }} />
            <p style={{ fontFamily:"var(--font-display)", fontSize:18, marginBottom:6 }}>어떻게 찾으시겠어요?</p>
            <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:18 }}>{menuActionMenus.join(", ")}</p>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <button className="tap" onClick={() => {
                const myGroupList = groups.filter(g => myMemberships[g.id] !== undefined || isGroupOwner(g, currentUser));
                sessionStorage.setItem("meogja_preset_menus", JSON.stringify(menuActionMenus));
                setMenuActionMenus([]);
                if (currentUser.type === "none") { router.push("/login"); return; }
                if (myGroupList.length > 0) {
                  setShowQuickGroupPicker(true);
                } else {
                  setShowQuickGroupPicker(true);
                }
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

      {/* ── 내 모임 — 로그인/게스트 사용자에게만 표시 ── */}
      {!loading && currentUser.type !== "none" && (
        <div className="fade-up fade-up-2" style={{ padding: "0 16px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <span style={{ fontFamily:"var(--font-display)", fontSize:17 }}>내 모임</span>
            <button className="tap" onClick={() => setShowCreateForm(true)} style={{ fontSize:12, color:"var(--primary)", fontWeight:700, background:"none", border:"none", cursor:"pointer" }}>+ 새 모임</button>
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

          {groups.length === 0 && (
            <div style={{ padding:"16px 18px", borderRadius:14, background:"var(--surface)", border:"var(--card-border)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
              <p style={{ fontSize:14, color:"var(--text-2)" }}>가입한 모임이 없습니다</p>
              <button className="tap" onClick={() => setShowCreateForm(true)} style={{ padding:"8px 16px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:13, cursor:"pointer", flexShrink:0 }}>만들기 →</button>
            </div>
          )}

        {/* ⭐ 즐겨찾는 모임 */}
        {!loading && starredList.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <p style={{ fontFamily:"var(--font-display)", fontSize:15, color:"#C77800", marginBottom:8 }}>⭐ 즐겨찾는 모임</p>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {starredList.map((group) => (
                <GroupCard key={group.id} group={group} onClick={() => handleEnter(group)} myMemberName={myMemberships[group.id]} isOwner={isGroupOwner(group, currentUser)} starred={true} onStar={(e) => { e.stopPropagation(); toggleStar(group.id); }} />
              ))}
            </div>
          </div>
        )}

        {/* 일반 내 모임 */}
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

      {/* 📍 공개 모임 추천 — 항상 표시 */}
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
            <p style={{ fontSize:36, marginBottom:10 }}>🍽️</p>
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
    </div>
  );
}
