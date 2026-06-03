"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, Group } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // 모임 생성
  const [newName, setNewName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  // 비공개 모임 입장
  const [enterTarget, setEnterTarget] = useState<Group | null>(null);
  const [enterPassword, setEnterPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // 모임 삭제
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState(false);

  useEffect(() => { loadGroups(); }, []);

  async function loadGroups() {
    setLoading(true);
    const { data } = await getSupabase()
      .from("groups").select("*").order("created_at", { ascending: false });
    if (data) setGroups(data);
    setLoading(false);
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const { data } = await getSupabase()
      .from("groups")
      .insert({ name: newName.trim(), is_private: isPrivate, password: isPrivate ? newPassword : null })
      .select().single();
    setCreating(false);
    if (data) router.push(`/groups/${data.id}`);
  }

  async function deleteGroup(group: Group) {
    if (group.is_private && deletePassword !== group.password) {
      setDeletePasswordError(true);
      return;
    }
    await getSupabase().from("groups").delete().eq("id", group.id);
    setDeleteTarget(null);
    setDeletePassword("");
    setDeletePasswordError(false);
    loadGroups();
  }

  function handleEnter(group: Group) {
    if (!group.is_private) {
      router.push(`/groups/${group.id}`);
    } else {
      setEnterTarget(group);
      setEnterPassword("");
      setPasswordError(false);
    }
  }

  function verifyPassword() {
    if (!enterTarget) return;
    if (enterPassword === enterTarget.password) {
      router.push(`/groups/${enterTarget.id}`);
    } else {
      setPasswordError(true);
    }
  }

  const publicGroups = groups.filter((g) => !g.is_private);
  const privateGroups = groups.filter((g) => g.is_private);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>

      {/* Hero */}
      <div className="fade-up">
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(36px,6vw,56px)", fontWeight: 600, lineHeight: 1.1, marginBottom: 8 }}>
          뭐먹지
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
          모임을 만들고 함께 먹을 메뉴를 추천받으세요
        </p>
      </div>

      {/* 모임 생성 */}
      <div className="fade-up fade-up-1" style={{ background: "var(--bg-card)", borderRadius: 20, padding: 28, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 18 }}>
          새 모임 만들기
        </p>
        <form onSubmit={createGroup} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="모임 이름 (예: 점심팀, 야식팀)"
            required
            style={{ padding: "12px 18px", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 15, color: "var(--text)", outline: "none" }}
            onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
            onBlur={(e) => e.target.style.borderColor = "var(--border)"}
          />

          {/* 공개/비공개 토글 */}
          <div style={{ display: "flex", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 100, padding: 4, gap: 4, width: "fit-content" }}>
            {[false, true].map((priv) => (
              <button key={String(priv)} type="button" onClick={() => setIsPrivate(priv)}
                style={{
                  padding: "7px 20px", borderRadius: 100, border: "none", fontSize: 13, fontWeight: 600,
                  background: isPrivate === priv ? "var(--text)" : "transparent",
                  color: isPrivate === priv ? "#fff" : "var(--text-muted)",
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                {priv ? "🔒 비공개" : "🌐 공개"}
              </button>
            ))}
          </div>

          {isPrivate && (
            <input
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="비밀번호 입력"
              type="password"
              required={isPrivate}
              style={{ padding: "12px 18px", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 15, color: "var(--text)", outline: "none" }}
              onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
              onBlur={(e) => e.target.style.borderColor = "var(--border)"}
            />
          )}

          <button type="submit" disabled={creating} style={{
            padding: "13px", borderRadius: 100, border: "none",
            background: "var(--accent)", color: "#fff", fontSize: 15, fontWeight: 700,
            cursor: creating ? "default" : "pointer",
            opacity: creating ? 0.7 : 1, transition: "all 0.15s",
          }}>
            {creating ? "생성 중…" : "모임 만들기 →"}
          </button>
        </form>
      </div>

      {/* 모임 목록 */}
      {!loading && groups.length > 0 && (
        <div className="fade-up fade-up-2">
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 16 }}>
            모임 목록
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...publicGroups, ...privateGroups].map((group, i) => (
              <div key={group.id}
                className={`fade-up fade-up-${Math.min(i + 1, 5)}`}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "18px 22px", borderRadius: 16,
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  boxShadow: "var(--shadow)", textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                <button onClick={() => handleEnter(group)} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontSize: 22 }}>{group.is_private ? "🔒" : "🌐"}</span>
                  <div>
                    <p style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 600, color: "var(--text)" }}>{group.name}</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {group.is_private ? "비공개 모임" : "공개 모임"} · {new Date(group.created_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18, color: "var(--text-muted)" }}>→</span>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(group); }} style={{ width: 32, height: 32, borderRadius: "50%", border: "1.5px solid var(--border)", background: "transparent", color: "var(--red)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="모임 삭제">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0", fontSize: 14 }}>
          불러오는 중…
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
            <p style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 6 }}>
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
            <p style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>모임 삭제</p>
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
