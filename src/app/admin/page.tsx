"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, Group } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { showConfirm } from "@/lib/dialog";

type Feedback = { id: string; category: string; content: string; email: string | null; guest_name: string | null; status: string; created_at: string; };
type GuestAccount = { id: string; name: string; password: string | null; created_at: string; };
type Report = { id: string; target_type: string; target_id: string; target_name: string | null; reason: string; status: string; created_at: string; };

export default function AdminPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [adminTab, setAdminTab] = useState<"groups" | "feedbacks" | "guests" | "reports">("groups");
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [guestAccounts, setGuestAccounts] = useState<GuestAccount[]>([]);
  const [guestSearch, setGuestSearch] = useState("");
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const user = await getCurrentUser();
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (user.type !== "auth" || user.user.email !== adminEmail) {
      router.replace("/");
      return;
    }
    loadGroups();
    loadFeedbacks();
    loadGuestAccounts();
    loadReports();
  }

  async function loadReports() {
    const res = await fetch("/api/admin/reports");
    const data = await res.json();
    if (data.reports) setReports(data.reports);
  }

  async function updateReportStatus(id: string, status: string) {
    await fetch("/api/admin/reports", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
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
        <button className="tap" onClick={() => router.push("/admin/menus")} style={{ padding:"7px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--bg-2)", color:"var(--text)", fontSize:13, cursor:"pointer", flexShrink:0 }}>
          🍽️ 메뉴
        </button>
        <button className="tap" onClick={() => router.push("/admin/images")} style={{ padding:"7px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--bg-2)", color:"var(--text)", fontSize:13, cursor:"pointer", flexShrink:0 }}>
          🐱 이미지
        </button>
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", borderBottom: "1.5px solid var(--border)" }}>
        {([["groups","📋 모임"],["feedbacks","💬 문의"],["guests","👤 게스트"],["reports","🚨 신고"]] as const).map(([t, label]) => (
          <button key={t} className="tap" onClick={() => setAdminTab(t)} style={{
            flex: 1, padding: "11px", border: "none", fontSize: 14, fontWeight: 700, background: "transparent", cursor: "pointer",
            color: adminTab === t ? "var(--primary)" : "var(--text-2)",
            borderBottom: adminTab === t ? "2.5px solid var(--primary)" : "2.5px solid transparent", marginBottom: -1.5,
          }}>{label}</button>
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

      {/* 게스트 계정 목록 */}
      {adminTab === "guests" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <input value={guestSearch} onChange={(e) => setGuestSearch(e.target.value)} placeholder="닉네임 검색"
            style={{ padding:"10px 16px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--card)", fontSize:14, outline:"none" }} />
          <p style={{ fontSize:13, color:"var(--muted)" }}>총 {guestAccounts.length}개</p>
          {guestAccounts
            .filter((g) => !guestSearch || g.name.toLowerCase().includes(guestSearch.toLowerCase()))
            .map((g) => (
              <div key={g.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderRadius:14, background:"var(--card)", border:"var(--card-border)", boxShadow:"var(--card-shadow)" }}>
                <div>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:15 }}>{g.name}</span>
                  <span style={{ marginLeft:8, fontSize:12, color:"var(--muted)" }}>{g.password ? "🔐 비밀번호 있음" : "비밀번호 없음"}</span>
                  <p style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>{new Date(g.created_at).toLocaleString("ko-KR")}</p>
                </div>
                <button className="tap" onClick={() => deleteGuestAccount(g.id)} style={{ padding:"5px 12px", borderRadius:10, border:"none", background:"var(--red-soft)", color:"var(--red)", fontSize:12, fontWeight:700, cursor:"pointer" }}>삭제</button>
              </div>
            ))}
          {guestAccounts.length === 0 && <p style={{ color:"var(--muted)", textAlign:"center", padding:30 }}>게스트 계정 없음</p>}
        </div>
      )}

      {/* 신고 목록 */}
      {adminTab === "reports" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <p style={{ fontSize:13, color:"var(--text-2)" }}>총 {reports.length}건 · 미처리 {reports.filter(r=>r.status==="pending").length}건</p>
          {reports.length === 0 && <p style={{ color:"var(--text-3)", textAlign:"center", padding:40 }}>신고 없음</p>}
          {reports.map((r) => (
            <div key={r.id} style={{ padding:"14px 16px", borderRadius:14, background:"var(--card)", border: r.status==="pending" ? "1.5px solid #E53935" : "var(--card-border)", boxShadow:"var(--card-shadow)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ fontSize:13, fontWeight:700 }}>{r.target_type==="user"?"👤":"👥"} {r.target_name || r.target_id}</span>
                <span style={{ fontSize:11, padding:"2px 8px", borderRadius:99, background: r.status==="resolved"?"#D4EDDA":r.status==="reviewed"?"#FFF3CD":"#FFE0DE", color: r.status==="resolved"?"#155724":r.status==="reviewed"?"#856404":"#721c24" }}>
                  {r.status==="resolved"?"처리완료":r.status==="reviewed"?"검토중":"미처리"}
                </span>
              </div>
              <p style={{ fontSize:13, color:"var(--text)", marginBottom:6 }}>{r.reason}</p>
              <p style={{ fontSize:11, color:"var(--text-3)", marginBottom:8 }}>{new Date(r.created_at).toLocaleString("ko-KR")}</p>
              <div style={{ display:"flex", gap:8 }}>
                {r.status !== "reviewed" && <button className="tap" onClick={() => updateReportStatus(r.id, "reviewed")} style={{ padding:"4px 12px", borderRadius:99, border:"1.5px solid var(--border)", background:"transparent", fontSize:12, cursor:"pointer" }}>검토중으로</button>}
                {r.status !== "resolved" && <button className="tap" onClick={() => updateReportStatus(r.id, "resolved")} style={{ padding:"4px 12px", borderRadius:99, border:"none", background:"#28A745", color:"#fff", fontSize:12, cursor:"pointer" }}>처리완료</button>}
              </div>
            </div>
          ))}
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
    </div>
  );
}
