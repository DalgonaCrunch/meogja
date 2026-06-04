"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, Group } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export default function AdminPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");

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
    if (!confirm(`선택한 ${selected.size}개 모임을 삭제하시겠습니까?\n(멤버, 선호도, 히스토리 모두 삭제)`)) return;
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
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28 }}>🛡️ 관리자 모드</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>모임 일괄 관리</p>
        </div>
      </div>

      {/* 툴바 */}
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
    </div>
  );
}
