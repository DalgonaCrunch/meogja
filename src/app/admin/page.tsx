"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, Group } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { showConfirm } from "@/lib/dialog";
import { getFoodIconUrl } from "@/lib/foodIcons";

type MenuCategory = { emoji: string; label: string; menus: string[]; menuIcons?: Record<string, string> };

type Feedback = { id: string; category: string; content: string; email: string | null; guest_name: string | null; status: string; created_at: string; };
type GuestAccount = { id: string; name: string; password: string | null; created_at: string; };
type Report = { id: string; target_type: string; target_id: string; target_name: string | null; reason: string; status: string; created_at: string; };
type AdminUser = { id: string; type: "auth" | "guest"; name: string; email: string | null; created_at: string; suspended_until: string | null; is_deleted?: boolean; };
type UserGroup = { id: string; name: string; emoji: string | null; is_private: boolean; created_at: string; };

interface HomeSettings {
  show_roulette: boolean; show_battle: boolean; show_ranking: boolean; show_trending_bar: boolean;
  weight_time: number; weight_age: number; weight_weather: number; weight_trend: number; weight_app: number; weight_nearby_search: number;
  pinned_menus: string[];
}
const DEFAULT_HOME: HomeSettings = {
  show_roulette: true, show_battle: true, show_ranking: true, show_trending_bar: true,
  weight_time: 100, weight_age: 100, weight_weather: 100, weight_trend: 100, weight_app: 100, weight_nearby_search: 100,
  pinned_menus: [],
};

export default function AdminPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [adminTab, setAdminTab] = useState<"groups" | "feedbacks" | "guests" | "reports" | "settings" | "home" | "menus" | "api">("home");
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [guestAccounts, setGuestAccounts] = useState<GuestAccount[]>([]);
  const [guestSearch, setGuestSearch] = useState("");
  // 사용자 탭
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [userFilter, setUserFilter] = useState<"all" | "auth" | "guest">("all");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedUserGroups, setSelectedUserGroups] = useState<UserGroup[]>([]);
  const [loadingUserGroups, setLoadingUserGroups] = useState(false);
  const [suspendDate, setSuspendDate] = useState("");
  const [suspending, setSuspending] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [socialSettings, setSocialSettings] = useState<{ show_kakao_login: boolean; show_naver_login: boolean }>({ show_kakao_login: true, show_naver_login: true })
  const [searchProvider, setSearchProvider] = useState<"naver" | "kakao" | "google">("kakao");
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState(10);
  const [rateLimitPerDay, setRateLimitPerDay] = useState(100);
  const [rateLimitSaved, setRateLimitSaved] = useState(false);
  type ApiStat = { name: string; label: string; dailyUsed: number; dailyLimit: number | null; monthlyUsed: number; monthlyLimit: number | null; usages: string[] };
  const [apiStats, setApiStats] = useState<ApiStat[]>([]);
  const [apiStatsLoading, setApiStatsLoading] = useState(false);
  const [homeSettings, setHomeSettings] = useState<HomeSettings>(DEFAULT_HOME);
  const [homeSaved, setHomeSaved] = useState(false);
  const [pinnedInput, setPinnedInput] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  // 메뉴 관리
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [menuDirty, setMenuDirty] = useState(false);
  const [menuSaved, setMenuSaved] = useState(false);
  const [expandedCat, setExpandedCat] = useState<number | null>(null);
  const [editingMenu, setEditingMenu] = useState<{catIdx:number;menuIdx:number;val:string}|null>(null);
  const [addMenuForm, setAddMenuForm] = useState<{catIdx:number;name:string;iconQuery:string;extraCats:number[]}|null>(null);
  const [menuSearch, setMenuSearch] = useState("");

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const user = await getCurrentUser();
    const email = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (user.type !== "auth" || user.user.email !== email) {
      router.replace("/");
      return;
    }
    setAdminEmail(user.user.email || "");
    loadGroups();
    loadFeedbacks();
    loadGuestAccounts();
    loadReports();
    loadSocialSettings();
    loadHomeSettings();
    loadAllUsers();
    loadMenuCategories();
    loadApiStats(user.type === "auth" ? user.user.email || "" : "");
  }

  async function loadMenuCategories() {
    const res = await fetch("/api/admin/menu-categories");
    const data = await res.json();
    if (data.categories) setMenuCategories(data.categories);
  }

  async function saveMenuCategories() {
    const res = await fetch("/api/admin/menu-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-email": adminEmail },
      body: JSON.stringify({ categories: menuCategories }),
    });
    if (!res.ok) { alert("저장 실패"); return; }
    setMenuDirty(false);
    setMenuSaved(true);
    setTimeout(() => setMenuSaved(false), 2000);
  }

  async function loadReports() {
    const res = await fetch("/api/admin/reports");
    const data = await res.json();
    if (data.reports) setReports(data.reports);
  }

  async function loadSocialSettings() {
    const res = await fetch("/api/admin/settings");
    const data = await res.json();
    setSocialSettings({ show_kakao_login: data.show_kakao_login !== false, show_naver_login: data.show_naver_login !== false });
    if (data.rate_limit_per_minute !== undefined) setRateLimitPerMinute(Number(data.rate_limit_per_minute) || 10);
    if (data.rate_limit_per_day !== undefined) setRateLimitPerDay(Number(data.rate_limit_per_day) || 100);
    if (data.search_provider) setSearchProvider(data.search_provider as "naver" | "kakao" | "google");
  }

  async function saveSocialSettings() {
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...socialSettings, search_provider: searchProvider }),
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  }

  async function loadHomeSettings() {
    const res = await fetch("/api/admin/home-settings");
    const data = await res.json();
    setHomeSettings({ ...DEFAULT_HOME, ...data });
  }

  async function saveHomeSettings() {
    const res = await fetch("/api/admin/home-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-email": adminEmail },
      body: JSON.stringify(homeSettings),
    });
    if (!res.ok) {
      alert("저장 실패 (" + res.status + ")");
      return;
    }
    // 저장 후 실제 DB값으로 재확인
    await loadHomeSettings();
    setHomeSaved(true);
    setTimeout(() => setHomeSaved(false), 2000);
  }

  async function updateReportStatus(id: string, status: string) {
    await fetch("/api/admin/reports", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  }

  async function loadApiStats(email?: string) {
    setApiStatsLoading(true);
    try {
      const res = await fetch("/api/admin/api-stats", { headers: { "x-admin-email": email ?? adminEmail } });
      if (res.ok) { const d = await res.json(); setApiStats(d.stats || []); }
    } catch { /* ignore */ }
    setApiStatsLoading(false);
  }

  async function loadFeedbacks() {
    const { data } = await getSupabase().from("feedbacks").select("*").order("created_at", { ascending: false });
    if (data) setFeedbacks(data);
  }

  async function markRead(id: string) {
    await getSupabase().from("feedbacks").update({ status: "read" }).eq("id", id);
    setFeedbacks((prev) => prev.map((f) => f.id === id ? { ...f, status: "read" } : f));
  }

  async function loadGuestAccounts() {
    const { data } = await getSupabase().from("guest_accounts").select("*").order("created_at", { ascending: false });
    if (data) setGuestAccounts(data);
  }

  async function loadAllUsers() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    const combined: AdminUser[] = [
      ...(data.members || []),
      ...(data.guests || []),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setAllUsers(combined);
  }

  async function openUserDetail(u: AdminUser) {
    setSelectedUser(u);
    setSuspendDate(u.suspended_until ? u.suspended_until.slice(0, 10) : "");
    setLoadingUserGroups(true);
    const res = await fetch(`/api/admin/users/groups?userId=${u.id}&type=${u.type}`);
    const data = await res.json();
    setSelectedUserGroups(data.groups || []);
    setLoadingUserGroups(false);
  }

  async function saveUserSuspension() {
    if (!selectedUser) return;
    setSuspending(true);
    const suspendedUntil = suspendDate ? new Date(suspendDate + "T23:59:59Z").toISOString() : null;
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUser.id, userType: selectedUser.type, suspendedUntil }),
    });
    setAllUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, suspended_until: suspendedUntil } : u));
    setSelectedUser(prev => prev ? { ...prev, suspended_until: suspendedUntil } : prev);
    setSuspending(false);
  }

  async function deleteGuestAccount(id: string) {
    await getSupabase().from("guest_accounts").delete().eq("id", id);
    setGuestAccounts((prev) => prev.filter((g) => g.id !== id));
  }

  async function markResolved(id: string) {
    await getSupabase().from("feedbacks").update({ status: "resolved" }).eq("id", id);
    setFeedbacks((prev) => prev.map((f) => f.id === id ? { ...f, status: "resolved" } : f));
  }

  async function loadGroups() {
    setLoading(true);
    const { data } = await getSupabase()
      .from("groups").select("*").order("created_at", { ascending: false });
    if (data) setGroups(data);
    setLoading(false);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((g) => g.id)));
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!await showConfirm(`선택한 ${selected.size}개 모임을 삭제하시겠습니까?\n멤버, 선호도, 히스토리 모두 삭제됩니다.`, { icon: "🗑️", title: "일괄 삭제", danger: true, confirmLabel: "삭제" })) return;
    setDeleting(true);
    await getSupabase().from("groups").delete().in("id", [...selected]);
    setSelected(new Set());
    await loadGroups();
    setDeleting(false);
  }

  async function deleteSingle(id: string) {
    await getSupabase().from("groups").delete().eq("id", id);
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  const filtered = groups.filter((g) =>
    !search || g.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 700, margin: "0 auto" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button className="tap" onClick={() => router.push("/")} style={{ width: 38, height: 38, borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)" }}>←</button>
        <div style={{ flex:1 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28 }}>🛡️ 관리자 모드</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>모임 일괄 관리</p>
        </div>
        <button className="tap" onClick={() => router.push("/admin/images")} style={{ padding:"7px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--bg-2)", color:"var(--text)", fontSize:13, cursor:"pointer", flexShrink:0 }}>
          🐱 이미지
        </button>
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", borderBottom: "1.5px solid var(--border)", overflowX: "auto" }}>
        {([["home","🏠 홈"],["groups","📋 모임"],["guests","👤 멤버"],["feedbacks","💬 문의"],["reports","🚨 신고"],["menus","🍽️ 메뉴"],["api","📊 API"],["settings","settings"]] as const).map(([t, label]) => (
          <button key={t} className="tap" onClick={() => setAdminTab(t)} style={{
            flex: "0 0 auto", padding: "11px 14px", border: "none", fontSize: 13, fontWeight: 700, background: "transparent", cursor: "pointer",
            color: adminTab === t ? "var(--primary)" : "var(--text-2)",
            borderBottom: adminTab === t ? "2.5px solid var(--primary)" : "2.5px solid transparent", marginBottom: -1.5,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4, whiteSpace: "nowrap",
          }}>
            {t === "settings"
              ? <><img src="/mascot/tabs/settings.png" alt="설정" style={{ width:18, height:18, objectFit:"contain", opacity: adminTab === t ? 1 : 0.5 }} /> 설정</>
              : label}
          </button>
        ))}
      </div>

      {/* 문의 목록 */}
      {adminTab === "feedbacks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {feedbacks.length === 0 && <p style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>문의가 없습니다</p>}
          {feedbacks.map((f) => (
            <div key={f.id} style={{ padding: "16px 18px", borderRadius: 16, background: "var(--card)", border: f.status === "new" ? "1.5px solid var(--primary)" : "var(--card-border)", boxShadow: "var(--card-shadow)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: "var(--r-pill)", fontWeight: 700, background: f.category === "bug" ? "var(--red-soft)" : f.category === "feature" ? "var(--green-soft)" : "var(--bg-2)", color: f.category === "bug" ? "var(--red)" : f.category === "feature" ? "var(--green)" : "var(--muted)" }}>
                    {f.category === "bug" ? "🐛 버그" : f.category === "feature" ? "✨ 기능" : f.category === "general" ? "💬 문의" : "📝 기타"}
                  </span>
                  {f.status === "new" && <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: "var(--r-pill)", background: "var(--primary)", color: "#fff", fontWeight: 700 }}>NEW</span>}
                  {f.status === "resolved" && <span style={{ fontSize: 11, color: "var(--green)" }}>✓ 해결됨</span>}
                </div>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{new Date(f.created_at).toLocaleString("ko-KR")}</span>
              </div>
              <p style={{ fontSize: 14, color: "var(--text)", marginBottom: 8, lineHeight: 1.6 }}>{f.content}</p>
              {(f.email || f.guest_name) && <p style={{ fontSize: 12, color: "var(--muted)" }}>{f.guest_name && `👤 ${f.guest_name}`}{f.email && ` · 📧 ${f.email}`}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {f.status === "new" && <button className="tap" onClick={() => markRead(f.id)} style={{ padding: "5px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>읽음</button>}
                {f.status !== "resolved" && <button className="tap" onClick={() => markResolved(f.id)} style={{ padding: "5px 12px", borderRadius: 10, border: "none", background: "var(--green-soft)", color: "var(--green)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✓ 해결</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 멤버/게스트 통합 탭 */}
      {adminTab === "guests" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {/* 필터 + 검색 */}
          <div style={{ display:"flex", gap:8 }}>
            {([["all","전체"],["auth","회원"],["guest","게스트"]] as const).map(([f, label]) => (
              <button key={f} onClick={() => setUserFilter(f)} style={{ padding:"6px 14px", borderRadius:"var(--r-pill)", fontSize:12, fontWeight:700, border:"none", cursor:"pointer", background: userFilter===f ? "var(--primary)" : "var(--bg-2)", color: userFilter===f ? "#fff" : "var(--text-2)" }}>{label}</button>
            ))}
          </div>
          <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="이름/이메일 검색"
            style={{ padding:"10px 16px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--card)", fontSize:14, outline:"none" }} />
          <p style={{ fontSize:12, color:"var(--muted)" }}>
            전체 {allUsers.length}명 · 회원 {allUsers.filter(u=>u.type==="auth").length} · 게스트 {allUsers.filter(u=>u.type==="guest").length}
          </p>

          {/* 목록 */}
          {allUsers
            .filter(u => userFilter === "all" || u.type === userFilter)
            .filter(u => !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()) || (u.email || "").toLowerCase().includes(userSearch.toLowerCase()))
            .map(u => {
              const isSuspended = u.suspended_until && new Date(u.suspended_until) > new Date();
              const displayName = u.is_deleted
                ? (u.name && u.name !== "탈퇴한 사용자" ? `${u.name} (탈퇴한 사용자)` : "탈퇴한 사용자")
                : u.name;
              return (
                <button key={u.id} className="tap" onClick={() => openUserDetail(u)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderRadius:14, background:"var(--card)", border: u.is_deleted ? "1.5px solid var(--text-3)" : isSuspended ? "1.5px solid #E53935" : "var(--card-border)", boxShadow:"var(--card-shadow)", cursor:"pointer", textAlign:"left", width:"100%", opacity: u.is_deleted ? 0.7 : 1 }}>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontFamily:"var(--font-display)", fontSize:14 }}>{displayName}</span>
                      <span style={{ fontSize:10, padding:"2px 7px", borderRadius:99, background: u.type==="auth" ? "var(--primary-light)" : "var(--bg-2)", color: u.type==="auth" ? "var(--primary)" : "var(--text-3)", fontWeight:700 }}>{u.type==="auth" ? "회원" : "게스트"}</span>
                      {isSuspended && <span style={{ fontSize:10, padding:"2px 7px", borderRadius:99, background:"#FFE0DE", color:"#C62828", fontWeight:700 }}>🚫 정지중</span>}
                    </div>
                    {u.email && <p style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>{u.email}</p>}
                    <p style={{ fontSize:11, color:"var(--muted)", marginTop:1 }}>{new Date(u.created_at).toLocaleDateString("ko-KR")} 가입</p>
                  </div>
                  <span style={{ fontSize:18, color:"var(--text-3)" }}>›</span>
                </button>
              );
            })}

          {/* 사용자 상세 패널 */}
          {selectedUser && (
            <div style={{ position:"fixed", inset:0, zIndex:9990, display:"flex", flexDirection:"column" }}>
              <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.5)" }} onClick={() => setSelectedUser(null)} />
              <div style={{ position:"relative", marginTop:"auto", background:"var(--surface)", borderRadius:"24px 24px 0 0", padding:"24px 20px", paddingBottom:"max(32px,env(safe-area-inset-bottom,20px))", maxHeight:"85vh", overflowY:"auto", zIndex:1 }}>
                <div style={{ width:40, height:5, borderRadius:99, background:"var(--border)", margin:"0 auto 20px" }} />
                {/* 유저 정보 */}
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                  <div style={{ width:48, height:48, borderRadius:"50%", background: selectedUser.type==="auth" ? "var(--primary)" : "var(--bg-2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, color:"#fff", fontWeight:800 }}>
                    {selectedUser.name[0]}
                  </div>
                  <div>
                    <p style={{ fontFamily:"var(--font-display)", fontSize:17 }}>
                      {selectedUser.is_deleted
                        ? (selectedUser.name && selectedUser.name !== "탈퇴한 사용자" ? `${selectedUser.name} (탈퇴한 사용자)` : "탈퇴한 사용자")
                        : selectedUser.name}
                    </p>
                    {selectedUser.email && <p style={{ fontSize:12, color:"var(--muted)" }}>{selectedUser.email}</p>}
                    <p style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>{selectedUser.type==="auth" ? "회원" : "게스트"} · {new Date(selectedUser.created_at).toLocaleDateString("ko-KR")} 가입</p>
                  </div>
                </div>

                {/* 버튼 행 */}
                <div style={{ display:"flex", gap:8, marginBottom:20 }}>
                  {selectedUser.type === "auth" && (
                    <button className="tap" onClick={() => { setSelectedUser(null); router.push(`/messages?with=${selectedUser.id}`); }} style={{ flex:1, padding:"10px", borderRadius:12, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                      💬 메시지 보내기
                    </button>
                  )}
                  {selectedUser.type === "guest" && (
                    <button className="tap" onClick={() => { if(window.confirm("이 게스트 계정을 삭제할까요?")) { deleteGuestAccount(selectedUser.id); setSelectedUser(null); } }} style={{ flex:1, padding:"10px", borderRadius:12, border:"none", background:"var(--red-soft)", color:"var(--red)", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                      🗑️ 계정 삭제
                    </button>
                  )}
                </div>

                {/* 계정 정지 */}
                <div style={{ background:"var(--bg-2)", borderRadius:14, padding:"14px 16px", marginBottom:20 }}>
                  <p style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>🚫 계정 정지</p>
                  {selectedUser.suspended_until && new Date(selectedUser.suspended_until) > new Date() && (
                    <p style={{ fontSize:12, color:"#C62828", marginBottom:8 }}>현재 정지 중 · ~{new Date(selectedUser.suspended_until).toLocaleDateString("ko-KR")}</p>
                  )}
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <input type="date" value={suspendDate} onChange={e => setSuspendDate(e.target.value)} min={new Date().toISOString().slice(0,10)}
                      style={{ flex:1, padding:"8px 12px", borderRadius:10, border:"1.5px solid var(--border)", background:"var(--card)", fontSize:13, outline:"none" }} />
                    <button className="tap" onClick={saveUserSuspension} disabled={suspending} style={{ padding:"8px 16px", borderRadius:10, border:"none", background:"#E53935", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                      {suspending ? "처리중…" : "정지"}
                    </button>
                    {selectedUser.suspended_until && (
                      <button className="tap" onClick={() => { setSuspendDate(""); saveUserSuspension(); }} style={{ padding:"8px 12px", borderRadius:10, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-2)", fontSize:12, cursor:"pointer" }}>
                        해제
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize:11, color:"var(--muted)", marginTop:6 }}>영구 정지: 9999-12-31 입력</p>
                </div>

                {/* 가입 모임 */}
                <p style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>📋 가입한 모임</p>
                {loadingUserGroups ? (
                  <p style={{ fontSize:13, color:"var(--muted)", textAlign:"center", padding:16 }}>불러오는 중…</p>
                ) : selectedUserGroups.length === 0 ? (
                  <p style={{ fontSize:13, color:"var(--muted)", textAlign:"center", padding:16 }}>가입한 모임 없음</p>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {selectedUserGroups.map(g => (
                      <div key={g.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderRadius:12, background:"var(--card)", border:"var(--card-border)" }}>
                        <span style={{ fontSize:14 }}>{g.emoji} {g.name}</span>
                        <span style={{ fontSize:11, color:"var(--muted)" }}>{g.is_private ? "🔒" : "🌐"}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={() => setSelectedUser(null)} style={{ marginTop:20, width:"100%", padding:"12px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-2)", fontSize:14, cursor:"pointer" }}>
                  닫기
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 신고 목록 */}
      {adminTab === "reports" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <p style={{ fontSize:13, color:"var(--text-2)" }}>총 {reports.length}건 · 미처리 {reports.filter(r=>r.status==="pending").length}건</p>
          {reports.length === 0 && <p style={{ color:"var(--text-3)", textAlign:"center", padding:40 }}>신고 없음</p>}
          {reports.map((r) => {
            const targetUser = r.target_type === "user" ? allUsers.find(u => u.id === r.target_id) : null;
            const isSuspended = targetUser?.suspended_until && new Date(targetUser.suspended_until) > new Date();
            return (
              <div key={r.id} style={{ padding:"14px 16px", borderRadius:14, background:"var(--card)", border: r.status==="pending" ? "1.5px solid #E53935" : "var(--card-border)", boxShadow:"var(--card-shadow)" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontSize:13, fontWeight:700 }}>{r.target_type==="user"?"👤":"👥"} {r.target_name || r.target_id}</span>
                  <span style={{ fontSize:11, padding:"2px 8px", borderRadius:99, background: r.status==="resolved"?"#D4EDDA":r.status==="reviewed"?"#FFF3CD":"#FFE0DE", color: r.status==="resolved"?"#155724":r.status==="reviewed"?"#856404":"#721c24" }}>
                    {r.status==="resolved"?"처리완료":r.status==="reviewed"?"검토중":"미처리"}
                  </span>
                </div>
                {targetUser && (
                  <div style={{ fontSize:12, color:"var(--text-2)", marginBottom:6, padding:"6px 10px", borderRadius:8, background:"var(--bg-2)", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <span>{targetUser.type === "auth" ? "🔐 소셜" : "👤 게스트"}</span>
                    {targetUser.email && <span style={{ fontWeight:600 }}>{targetUser.email}</span>}
                    <span style={{ color:"var(--text-3)" }}>가입: {new Date(targetUser.created_at).toLocaleDateString("ko-KR")}</span>
                    {isSuspended && <span style={{ color:"#E53935", fontWeight:700 }}>정지중 ~{new Date(targetUser.suspended_until!).toLocaleDateString("ko-KR")}</span>}
                  </div>
                )}
                <p style={{ fontSize:13, color:"var(--text)", marginBottom:6 }}>{r.reason}</p>
                <p style={{ fontSize:11, color:"var(--text-3)", marginBottom:8 }}>{new Date(r.created_at).toLocaleString("ko-KR")}</p>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {r.status !== "reviewed" && <button className="tap" onClick={() => updateReportStatus(r.id, "reviewed")} style={{ padding:"4px 12px", borderRadius:99, border:"1.5px solid var(--border)", background:"transparent", fontSize:12, cursor:"pointer" }}>검토중으로</button>}
                  {r.status !== "resolved" && <button className="tap" onClick={() => updateReportStatus(r.id, "resolved")} style={{ padding:"4px 12px", borderRadius:99, border:"none", background:"#28A745", color:"#fff", fontSize:12, cursor:"pointer" }}>처리완료</button>}
                  {targetUser && (
                    <button className="tap" onClick={() => { setSelectedUser(targetUser); setSuspendDate(targetUser.suspended_until ? targetUser.suspended_until.slice(0,10) : ""); setAdminTab("guests"); }} style={{ padding:"4px 12px", borderRadius:99, border:"none", background:"#E53935", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                      🚫 제재
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adminTab === "groups" && (
      <>{/* 툴바 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="모임 이름 검색"
          style={{ flex: 1, minWidth: 200, padding: "10px 16px", borderRadius: "var(--r-pill)", border: "1.5px solid var(--border)", background: "var(--card)", fontSize: 14, color: "var(--text)", outline: "none" }}
          onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
          onBlur={(e) => e.target.style.borderColor = "var(--border)"}
        />
        <span style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap" }}>
          전체 {filtered.length}개 / {selected.size}개 선택
        </span>
        {selected.size > 0 && (
          <button className="tap" onClick={deleteSelected} disabled={deleting} style={{
            padding: "10px 20px", borderRadius: "var(--r-pill)", border: "none",
            background: "var(--red)", color: "#fff", fontFamily: "var(--font-display)", fontSize: 14,
            cursor: deleting ? "default" : "pointer", whiteSpace: "nowrap",
          }}>
            {deleting ? "삭제 중…" : `🗑 ${selected.size}개 삭제`}
          </button>
        )}
      </div>

      {/* 전체 선택 */}
      {filtered.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderRadius: 12, background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          <input type="checkbox"
            checked={selected.size === filtered.length && filtered.length > 0}
            onChange={toggleAll}
            style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>전체 선택</span>
        </div>
      )}

      {/* 모임 목록 */}
      {loading ? (
        <p style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>불러오는 중…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((g) => (
            <div key={g.id} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
              borderRadius: "var(--card-radius)", background: selected.has(g.id) ? "var(--accent-soft)" : "var(--card)",
              border: selected.has(g.id) ? "1.5px solid var(--accent)" : "var(--card-border)",
              boxShadow: "var(--card-shadow)", transition: "all .15s",
            }}>
              <input type="checkbox"
                checked={selected.has(g.id)}
                onChange={() => toggleSelect(g.id)}
                style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--accent)", flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: selected.has(g.id) ? "var(--accent)" : "var(--text)" }}>{g.name}</span>
                  {g.is_private
                    ? <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 99, background: "var(--bg-2)", color: "var(--muted)", fontWeight: 700 }}>🔒 비공개</span>
                    : <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 99, background: "var(--green-soft)", color: "var(--green)", fontWeight: 700 }}>공개</span>}
                  {g.require_auth && <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 99, background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 700 }}>로그인 전용</span>}
                </div>
                <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
                  ID: {g.id.slice(0, 8)}… · {new Date(g.created_at).toLocaleString("ko-KR")}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button className="tap" onClick={() => router.push(`/groups/${g.id}`)} style={{ padding: "6px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-2)", color: "var(--text)", fontSize: 12, cursor: "pointer" }}>
                  열기
                </button>
                <button className="tap" onClick={() => deleteSingle(g.id)} style={{ padding: "6px 12px", borderRadius: 10, border: "none", background: "var(--red-soft)", color: "var(--red)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  삭제
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>모임이 없습니다</p>
          )}
        </div>
      )}
      </>)}

      {/* 설정 탭 */}
      {adminTab === "home" && (
        <div style={{ display:"flex", flexDirection:"column", gap:20, padding:"8px 0" }}>

          {/* 섹션 표시 */}
          <div>
            <p style={{ fontFamily:"var(--font-display)", fontSize:16, marginBottom:4 }}>🏠 홈 섹션 표시</p>
            <p style={{ fontSize:12, color:"var(--text-2)", marginBottom:12 }}>각 섹션을 홈 화면에 표시할지 설정합니다</p>
            {([
              { key:"show_roulette" as const, label:"🎰 메뉴 룰렛", desc:"랜덤으로 메뉴 뽑기" },
              { key:"show_battle" as const, label:"⚔️ 오늘의 배틀", desc:"두 메뉴 중 하나 선택 투표" },
              { key:"show_ranking" as const, label:"🔥 지금 가장 잘 맞는 메뉴", desc:"시간대·나이대·날씨·트렌드 기반 랭킹" },
              { key:"show_trending_bar" as const, label:"📊 실시간 인기 메뉴", desc:"전체 사용자 선호도 기반 상위 5개 바 차트" },
            ]).map(({ key, label, desc }) => (
              <div key={key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderRadius:12, background:"var(--surface)", border:"var(--card-border)", marginBottom:8 }}>
                <div>
                  <p style={{ fontSize:14, fontWeight:600 }}>{label}</p>
                  <p style={{ fontSize:11, color:"var(--text-2)", marginTop:2 }}>{desc}</p>
                </div>
                <button onClick={() => setHomeSettings(prev => ({ ...prev, [key]: !prev[key] }))} style={{
                  width:48, height:26, borderRadius:13, border:"none", cursor:"pointer", flexShrink:0,
                  background: homeSettings[key] ? "var(--green)" : "var(--border-2)", position:"relative", transition:"background .2s",
                }}>
                  <div style={{ position:"absolute", top:3, left: homeSettings[key] ? 24 : 3, width:20, height:20, borderRadius:10, background:"#fff", transition:"left .2s", boxShadow:"0 1px 4px rgba(0,0,0,.2)" }} />
                </button>
              </div>
            ))}
          </div>

          {/* 추천 가중치 */}
          <div>
            <p style={{ fontFamily:"var(--font-display)", fontSize:16, marginBottom:4 }}>⚖️ 추천 가중치</p>
            <p style={{ fontSize:12, color:"var(--text-2)", marginBottom:8 }}>각 항목은 서로 독립적입니다. 하나를 올려도 다른 항목에 영향 없음. 0 = 이 요소 무시, 100 = 최대 반영</p>
            <div style={{ padding:"12px 14px", borderRadius:12, background:"var(--primary-light)", border:"1.5px solid var(--primary)", marginBottom:14, fontSize:12, color:"var(--text)" }}>
              <p style={{ fontWeight:700, marginBottom:6 }}>📐 실제 점수 계산 공식</p>
              <p style={{ lineHeight:1.8, fontFamily:"monospace", fontSize:11 }}>
                점수 = 28<br/>
                + 시간대점수(max 30) × 가중치/100<br/>
                + 나이대점수(max 22) × 가중치/100<br/>
                + 날씨점수(max 18) × 가중치/100<br/>
                + 트렌드점수(max 15) × 가중치/100<br/>
                + 앱선호도(max 20) × 가중치/100<br/>
                + 이름해시 지터(±3, 동점 방지)
              </p>
              <p style={{ marginTop:8 }}>→ 최소 30점, 최대 99점으로 표시 (%)</p>
            </div>
            {([
              { key:"weight_time" as const, label:"⏰ 시간대", desc:"아침=국밥/브런치, 저녁=치킨 등 시간대별 가중치", max:30 },
              { key:"weight_age" as const, label:"🎂 나이대", desc:"프로필 연령대 기반 (10대=젠지, 40대=한식 등)", max:22 },
              { key:"weight_weather" as const, label:"🌤️ 날씨", desc:"더운 날=냉면, 비=파전, 추운 날=국밥 등", max:18 },
              { key:"weight_trend" as const, label:"📈 네이버 트렌드", desc:"네이버 DataLab 주간 검색량 기반", max:15 },
              { key:"weight_app" as const, label:"❤️ 앱 선호도", desc:"월드컵 결과·투표 집계 기반", max:20 },
              { key:"weight_nearby_search" as const, label:"🔍 맛집찾기 실행", desc:"특정 메뉴로 맛집찾기를 실행한 횟수 반영", max:1 },
            ]).map(({ key, label, desc, max }) => (
              <div key={key} style={{ padding:"14px", borderRadius:12, background:"var(--surface)", border:"var(--card-border)", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div>
                    <p style={{ fontSize:14, fontWeight:600 }}>{label}</p>
                    <p style={{ fontSize:11, color:"var(--text-2)", marginTop:2 }}>{desc}</p>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0, marginLeft:12 }}>
                    <span style={{ fontSize:20, fontWeight:800, color: homeSettings[key] === 0 ? "var(--text-3)" : "var(--primary)" }}>{homeSettings[key]}</span>
                    <p style={{ fontSize:10, color:"var(--text-3)", margin:0 }}>
                      {homeSettings[key] === 0 ? "비활성" : `최대 ${Math.round(max * homeSettings[key] / 100)}pt`}
                    </p>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:11, color:"var(--text-3)" }}>끔</span>
                  <input type="range" min={0} max={100} value={homeSettings[key]}
                    onChange={e => setHomeSettings(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                    style={{ flex:1, accentColor:"var(--primary)" }} />
                  <span style={{ fontSize:11, color:"var(--text-3)" }}>최대</span>
                </div>
              </div>
            ))}
          </div>

          {/* 수동 고정 메뉴 */}
          <div>
            <p style={{ fontFamily:"var(--font-display)", fontSize:16, marginBottom:4 }}>📌 고정 메뉴</p>
            <p style={{ fontSize:12, color:"var(--text-2)", marginBottom:10 }}>최대 3개까지 설정하면 추천 랭킹 맨 앞에 고정됩니다 (비워두면 알고리즘 자동 순위)</p>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
              {homeSettings.pinned_menus.map(m => (
                <div key={m} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:99, background:"var(--primary-light)", border:"1.5px solid var(--primary)" }}>
                  <span style={{ fontSize:12, fontWeight:600, color:"var(--primary)" }}>{m}</span>
                  <button onClick={() => setHomeSettings(prev => ({ ...prev, pinned_menus: prev.pinned_menus.filter(x => x !== m) }))}
                    style={{ background:"none", border:"none", cursor:"pointer", color:"var(--primary)", fontSize:12, padding:0, lineHeight:1 }}>✕</button>
                </div>
              ))}
            </div>
            {homeSettings.pinned_menus.length < 3 && (
              <div style={{ display:"flex", gap:6 }}>
                <input value={pinnedInput} onChange={e => setPinnedInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key !== "Enter" || !pinnedInput.trim()) return;
                    const m = pinnedInput.trim();
                    if (!homeSettings.pinned_menus.includes(m)) {
                      setHomeSettings(prev => ({ ...prev, pinned_menus: [...prev.pinned_menus, m] }));
                    }
                    setPinnedInput("");
                  }}
                  placeholder="메뉴 이름 입력 후 Enter"
                  style={{ flex:1, padding:"8px 12px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--bg)", fontSize:13, outline:"none" }} />
              </div>
            )}
          </div>

          <button onClick={saveHomeSettings} style={{
            padding:"13px", borderRadius:"var(--r-pill)", border:"none",
            background: homeSaved ? "var(--green)" : "var(--primary)", color:"#fff",
            fontFamily:"var(--font-display)", fontSize:14, cursor:"pointer", transition:"background .2s",
          }}>
            {homeSaved ? "✓ 저장됨" : "저장하기"}
          </button>
        </div>
      )}

      {/* ── 메뉴 관리 탭 ── */}
      {adminTab === "menus" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <p style={{ fontFamily:"var(--font-display)", fontSize:16 }}>🍽️ 메뉴 카테고리 관리</p>
            <button onClick={saveMenuCategories} disabled={!menuDirty} style={{
              padding:"8px 18px", borderRadius:"var(--r-pill)", border:"none", fontSize:13, fontWeight:700, cursor: menuDirty ? "pointer" : "default",
              background: menuSaved ? "var(--green)" : menuDirty ? "var(--primary)" : "var(--bg-2)",
              color: menuDirty || menuSaved ? "#fff" : "var(--text-3)", transition:"background .2s",
            }}>
              {menuSaved ? "✓ 저장됨" : "저장"}
            </button>
          </div>

          {/* 검색 */}
          <input
            value={menuSearch}
            onChange={e => setMenuSearch(e.target.value)}
            placeholder="메뉴 또는 카테고리 검색…"
            style={{ padding:"10px 16px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--card)", fontSize:14, outline:"none" }}
          />

          {menuCategories
            .map((cat, ci) => ({ cat, ci }))
            .filter(({ cat }) => {
              if (!menuSearch) return true;
              const q = menuSearch.toLowerCase();
              return cat.label.toLowerCase().includes(q) || cat.menus.some(m => m.toLowerCase().includes(q));
            })
            .map(({ cat, ci }) => {
              const q = menuSearch.toLowerCase();
              const catMatches = !menuSearch || cat.label.toLowerCase().includes(q);
              const filteredMenus = menuSearch && !catMatches
                ? cat.menus.filter(m => m.toLowerCase().includes(q))
                : cat.menus;
              const isOpen = expandedCat === ci || !!menuSearch;
              return (
                <div key={ci} style={{ background:"var(--surface)", borderRadius:14, border:"var(--card-border)", overflow:"hidden" }}>
                  <button onClick={() => setExpandedCat(expandedCat === ci ? null : ci)} style={{
                    width:"100%", display:"flex", alignItems:"center", gap:10, padding:"12px 14px",
                    background:"none", border:"none", cursor:"pointer", textAlign:"left",
                  }}>
                    <span style={{ fontSize:20 }}>{cat.emoji}</span>
                    <span style={{ fontFamily:"var(--font-display)", fontSize:15, flex:1 }}>{cat.label}</span>
                    <span style={{ fontSize:12, color:"var(--text-3)" }}>{cat.menus.length}개</span>
                    <span style={{ color:"var(--text-3)" }}>{isOpen ? "▲" : "▼"}</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding:"0 14px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                        {filteredMenus.map((menu) => {
                          const actualMi = cat.menus.indexOf(menu);
                          const iconUrl = cat.menuIcons?.[menu]
                            ? getFoodIconUrl(cat.menuIcons[menu])
                            : getFoodIconUrl(menu);
                          return (
                            <div key={actualMi} style={{ display:"flex", alignItems:"center", gap:4 }}>
                              {editingMenu?.catIdx === ci && editingMenu.menuIdx === actualMi ? (
                                <>
                                  <input
                                    autoFocus
                                    value={editingMenu.val}
                                    onChange={e => setEditingMenu(p => p ? { ...p, val: e.target.value } : p)}
                                    onKeyDown={e => {
                                      if (e.key === "Enter" && editingMenu.val.trim()) {
                                        const next = menuCategories.map((c, i) => i !== ci ? c : { ...c, menus: c.menus.map((m, j) => j === actualMi ? editingMenu.val.trim() : m) });
                                        setMenuCategories(next); setMenuDirty(true); setEditingMenu(null);
                                      }
                                      if (e.key === "Escape") setEditingMenu(null);
                                    }}
                                    style={{ padding:"3px 8px", borderRadius:8, border:"1.5px solid var(--primary)", fontSize:13, width:90, outline:"none" }}
                                  />
                                  <button onClick={() => {
                                    if (editingMenu.val.trim()) {
                                      const next = menuCategories.map((c, i) => i !== ci ? c : { ...c, menus: c.menus.map((m, j) => j === actualMi ? editingMenu.val.trim() : m) });
                                      setMenuCategories(next); setMenuDirty(true);
                                    }
                                    setEditingMenu(null);
                                  }} style={{ padding:"3px 8px", borderRadius:8, border:"none", background:"var(--primary)", color:"#fff", fontSize:12, cursor:"pointer" }}>✓</button>
                                  <button onClick={() => setEditingMenu(null)} style={{ padding:"3px 8px", borderRadius:8, border:"none", background:"var(--bg-2)", color:"var(--text)", fontSize:12, cursor:"pointer" }}>✕</button>
                                </>
                              ) : (
                                <div style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:"var(--r-pill)", background:"var(--bg-2)", border:"1px solid var(--border)" }}>
                                  {iconUrl && <img src={iconUrl} alt="" style={{ width:16, height:16, objectFit:"contain" }} />}
                                  <span style={{ fontSize:13 }}>{menu}</span>
                                  <button onClick={() => setEditingMenu({ catIdx:ci, menuIdx:actualMi, val:menu })} style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, color:"var(--text-3)", padding:0 }}>✏️</button>
                                  <button onClick={() => {
                                    const next = menuCategories.map((c, i) => i !== ci ? c : { ...c, menus: c.menus.filter((_, j) => j !== actualMi) });
                                    setMenuCategories(next); setMenuDirty(true);
                                  }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, color:"var(--red)", padding:0 }}>✕</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* 메뉴 추가 */}
                      {addMenuForm?.catIdx === ci ? (
                        <div style={{ display:"flex", flexDirection:"column", gap:8, padding:"10px 12px", borderRadius:12, background:"var(--bg)", border:"1.5px dashed var(--border)" }}>
                          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                            {(() => {
                              const iconUrl = getFoodIconUrl(addMenuForm.iconQuery || addMenuForm.name);
                              return iconUrl
                                ? <img src={iconUrl} alt="" style={{ width:36, height:36, objectFit:"contain", flexShrink:0 }} />
                                : <span style={{ fontSize:28, flexShrink:0 }}>🍽️</span>;
                            })()}
                            <div style={{ flex:1, display:"flex", flexDirection:"column", gap:6 }}>
                              <input
                                autoFocus
                                placeholder="메뉴 이름"
                                value={addMenuForm.name}
                                onChange={e => setAddMenuForm(p => p ? { ...p, name: e.target.value } : p)}
                                style={{ padding:"7px 12px", borderRadius:8, border:"1.5px solid var(--border)", fontSize:13, outline:"none", background:"var(--surface)" }}
                              />
                              <input
                                placeholder="아이콘 검색어 (선택 — 비우면 메뉴명 자동 사용)"
                                value={addMenuForm.iconQuery}
                                onChange={e => setAddMenuForm(p => p ? { ...p, iconQuery: e.target.value } : p)}
                                style={{ padding:"7px 12px", borderRadius:8, border:"1.5px solid var(--border)", fontSize:12, outline:"none", background:"var(--surface)", color:"var(--text-2)" }}
                              />
                            </div>
                          </div>

                          {/* 다중 카테고리 선택 */}
                          <div>
                            <p style={{ fontSize:11, color:"var(--text-3)", marginBottom:6 }}>추가할 카테고리 (복수 선택 가능)</p>
                            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                              {menuCategories.map((c, idx) => {
                                const isCurrent = idx === ci;
                                const isSelected = isCurrent || (addMenuForm.extraCats ?? []).includes(idx);
                                return (
                                  <button key={idx} onClick={() => {
                                    if (isCurrent) return;
                                    setAddMenuForm(p => {
                                      if (!p) return p;
                                      const extras = p.extraCats ?? [];
                                      return { ...p, extraCats: extras.includes(idx) ? extras.filter(x => x !== idx) : [...extras, idx] };
                                    });
                                  }} style={{
                                    padding:"3px 9px", borderRadius:"var(--r-pill)", border:"1.5px solid",
                                    borderColor: isSelected ? "var(--primary)" : "var(--border)",
                                    background: isSelected ? "var(--primary-light)" : "transparent",
                                    color: isSelected ? "var(--primary)" : "var(--text-3)",
                                    fontSize:11, fontWeight: isSelected ? 700 : 400,
                                    cursor: isCurrent ? "default" : "pointer",
                                  }}>
                                    {c.emoji} {c.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div style={{ display:"flex", gap:8 }}>
                            <button onClick={() => {
                              if (!addMenuForm.name.trim()) return;
                              const name = addMenuForm.name.trim();
                              const iconQuery = addMenuForm.iconQuery.trim();
                              const targetCats = [ci, ...(addMenuForm.extraCats ?? [])];
                              const next = menuCategories.map((c, i) => {
                                if (!targetCats.includes(i) || c.menus.includes(name)) return c;
                                const newIcons = iconQuery ? { ...c.menuIcons, [name]: iconQuery } : c.menuIcons;
                                return { ...c, menus: [...c.menus, name], ...(newIcons ? { menuIcons: newIcons } : {}) };
                              });
                              setMenuCategories(next); setMenuDirty(true); setAddMenuForm(null);
                            }} style={{ flex:1, padding:"8px", borderRadius:8, border:"none", background:"var(--primary)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                              추가
                            </button>
                            <button onClick={() => setAddMenuForm(null)} style={{ padding:"8px 14px", borderRadius:8, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-2)", fontSize:13, cursor:"pointer" }}>
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setAddMenuForm({ catIdx:ci, name:"", iconQuery:"", extraCats:[] })} style={{
                          alignSelf:"flex-start", padding:"6px 14px", borderRadius:"var(--r-pill)", border:"1.5px dashed var(--primary)",
                          background:"transparent", color:"var(--primary)", fontSize:13, fontWeight:600, cursor:"pointer",
                        }}>
                          + 메뉴 추가
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          }
        </div>
      )}

      {adminTab === "api" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>API 사용량 대시보드</p>
            <button className="tap" onClick={() => loadApiStats()} style={{ padding:"6px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", fontSize:12, cursor:"pointer", color:"var(--text-2)" }}>
              새로고침
            </button>
          </div>
          <p style={{ fontSize:12, color:"var(--text-2)", marginTop:-8 }}>오늘 기준 일간/월간 사용량 (서비스 실행 후 누적)</p>
          {apiStatsLoading && <p style={{ textAlign:"center", color:"var(--text-2)", padding:20 }}>로딩 중…</p>}
          {!apiStatsLoading && apiStats.length === 0 && (
            <div style={{ textAlign:"center", padding:32, color:"var(--text-2)" }}>
              <p style={{ marginBottom:8 }}>데이터 없음 (새로고침 버튼 클릭)</p>
              <button className="tap" onClick={() => loadApiStats()} style={{ padding:"8px 20px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontSize:13, cursor:"pointer" }}>불러오기</button>
            </div>
          )}
          {apiStats.map(stat => {
            const dailyPct = stat.dailyLimit ? Math.min(100, (stat.dailyUsed / stat.dailyLimit) * 100) : null;
            const monthlyPct = stat.monthlyLimit ? Math.min(100, (stat.monthlyUsed / stat.monthlyLimit) * 100) : null;
            const barColor = (pct: number) => pct >= 90 ? "#E53935" : pct >= 70 ? "#F5A623" : "var(--primary)";
            return (
              <div key={stat.name} style={{ background:"var(--surface)", borderRadius:14, padding:"14px 16px", border:"var(--card-border)", boxShadow:"var(--card-shadow)" }}>
                <p style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>{stat.label}</p>
                {stat.usages?.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:10 }}>
                    {stat.usages.map((u, i) => (
                      <span key={i} style={{ fontSize:10, padding:"2px 7px", borderRadius:"var(--r-pill)", background:"var(--bg-2)", color:"var(--text-3)", fontWeight:500 }}>{u}</span>
                    ))}
                  </div>
                )}
                {stat.dailyLimit !== null && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                      <span style={{ color:"var(--text-2)" }}>일간</span>
                      <span style={{ fontWeight:600 }}>{stat.dailyUsed.toLocaleString()} / {stat.dailyLimit.toLocaleString()} ({(dailyPct ?? 0).toFixed(1)}%)</span>
                    </div>
                    <div style={{ height:6, borderRadius:3, background:"var(--bg-2)", overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${dailyPct ?? 0}%`, background: barColor(dailyPct ?? 0), borderRadius:3, transition:"width 0.4s" }} />
                    </div>
                    <p style={{ fontSize:11, color:"var(--text-3)", marginTop:3 }}>남은 횟수: {(stat.dailyLimit - stat.dailyUsed).toLocaleString()}</p>
                  </div>
                )}
                {stat.monthlyLimit !== null && (
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                      <span style={{ color:"var(--text-2)" }}>월간</span>
                      <span style={{ fontWeight:600 }}>{stat.monthlyUsed.toLocaleString()} / {stat.monthlyLimit.toLocaleString()} ({(monthlyPct ?? 0).toFixed(1)}%)</span>
                    </div>
                    <div style={{ height:6, borderRadius:3, background:"var(--bg-2)", overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${monthlyPct ?? 0}%`, background: barColor(monthlyPct ?? 0), borderRadius:3, transition:"width 0.4s" }} />
                    </div>
                    <p style={{ fontSize:11, color:"var(--text-3)", marginTop:3 }}>남은 횟수: {(stat.monthlyLimit - stat.monthlyUsed).toLocaleString()}</p>
                  </div>
                )}
                {stat.dailyLimit === null && stat.monthlyLimit === null && (
                  <p style={{ fontSize:12, color:"var(--text-2)" }}>일간 {stat.dailyUsed.toLocaleString()}회 / 월간 {stat.monthlyUsed.toLocaleString()}회 (한도 없음)</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {adminTab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>소셜 로그인 표시 설정</p>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: -8 }}>로그인 화면에 각 소셜 로그인 버튼을 표시할지 선택합니다</p>
          {[
            { key: "show_kakao_login" as const, label: "카카오 로그인", color: "#FEE500", textColor: "#191919" },
            { key: "show_naver_login" as const, label: "네이버 로그인", color: "#03C75A", textColor: "#fff" },
          ].map(({ key, label, color, textColor }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 14, background: "var(--surface)", border: "var(--card-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: textColor }}>{label[0]}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
              </div>
              <button onClick={() => setSocialSettings(prev => ({ ...prev, [key]: !prev[key] }))} style={{
                width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
                background: socialSettings[key] ? "var(--green)" : "var(--border-2)",
                position: "relative", transition: "background .2s",
              }}>
                <div style={{
                  position: "absolute", top: 3, left: socialSettings[key] ? 24 : 3,
                  width: 20, height: 20, borderRadius: 10, background: "#fff",
                  transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.2)",
                }} />
              </button>
            </div>
          ))}
          {/* 검색 제공자 */}
          <div style={{ paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 15, marginBottom: 4 }}>🔍 맛집 검색 제공자</p>
            <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 12 }}>주변 식당 찾기 검색 API 선택. 구글은 GOOGLE_PLACES_API_KEY 필요.</p>
            <div style={{ display: "flex", gap: 8 }}>
              {([
                { key: "kakao" as const, label: "카카오", color: "#FAE100", textColor: "#3A1D1D" },
                { key: "naver" as const, label: "네이버", color: "#03C75A", textColor: "#fff" },
                { key: "google" as const, label: "구글", color: "#4285F4", textColor: "#fff" },
              ]).map(({ key, label, color, textColor }) => (
                <button key={key} onClick={() => setSearchProvider(key)} style={{
                  flex: 1, padding: "10px 8px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
                  background: searchProvider === key ? color : "var(--bg-2)",
                  color: searchProvider === key ? textColor : "var(--text-3)",
                  boxShadow: searchProvider === key ? "0 2px 8px rgba(0,0,0,.15)" : "none",
                  transition: "all .15s",
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={saveSocialSettings} style={{
            padding: "13px", borderRadius: "var(--r-pill)", border: "none",
            background: settingsSaved ? "var(--green)" : "var(--primary)", color: "#fff",
            fontFamily: "var(--font-display)", fontSize: 14, cursor: "pointer", transition: "background .2s",
          }}>
            {settingsSaved ? "✓ 저장됨" : "저장하기"}
          </button>

          {/* 레이트 리밋 설정 */}
          <div style={{ paddingTop: 20, borderTop: "1px solid var(--border)" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 16, marginBottom: 4 }}>🛡️ API 레이트 리밋</p>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
              /nearby, /search, /search-kakao — IP당 제한 (0 = 무제한)
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "분당 최대 요청 수", state: rateLimitPerMinute, setState: setRateLimitPerMinute, key: "rate_limit_per_minute", hint: "기본 10" },
                { label: "일별 최대 요청 수", state: rateLimitPerDay, setState: setRateLimitPerDay, key: "rate_limit_per_day", hint: "기본 100" },
              ].map(({ label, state, setState, hint }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, background: "var(--surface)", border: "var(--card-border)" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600 }}>{label}</p>
                    <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{hint}</p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={state}
                    onChange={e => setState(parseInt(e.target.value) || 0)}
                    style={{ width: 80, padding: "7px 10px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 15, fontWeight: 700, textAlign: "right", outline: "none" }}
                  />
                </div>
              ))}
            </div>
            <button onClick={async () => {
              await fetch("/api/admin/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rate_limit_per_minute: rateLimitPerMinute, rate_limit_per_day: rateLimitPerDay }),
              });
              setRateLimitSaved(true);
              setTimeout(() => setRateLimitSaved(false), 2000);
            }} style={{
              marginTop: 12, width: "100%", padding: "11px", borderRadius: "var(--r-pill)", border: "none",
              background: rateLimitSaved ? "var(--green)" : "var(--primary)", color: "#fff",
              fontFamily: "var(--font-display)", fontSize: 14, cursor: "pointer", transition: "background .2s",
            }}>
              {rateLimitSaved ? "✓ 저장됨" : "레이트 리밋 저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
