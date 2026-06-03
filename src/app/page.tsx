"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, Group } from "@/lib/supabase";
import { getCurrentUser, CurrentUser } from "@/lib/auth";

function CreateForm({ newName, setNewName, isPrivate, setIsPrivate, newPassword, setNewPassword, requireAuth, setRequireAuth, creating, onSubmit, isLoggedIn }: {
  newName: string; setNewName: (v: string) => void;
  isPrivate: boolean; setIsPrivate: (v: boolean) => void;
  newPassword: string; setNewPassword: (v: string) => void;
  requireAuth: boolean; setRequireAuth: (v: boolean) => void;
  creating: boolean; onSubmit: (e: React.FormEvent) => void;
  isLoggedIn: boolean;
}) {
  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="모임 이름 (예: 점심팀, 야식팀)" required
        style={{ padding: "12px 18px", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 15, color: "var(--text)", outline: "none" }}
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

      {isPrivate && (
        <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="비밀번호 입력" type="password" required={isPrivate}
          style={{ padding: "12px 18px", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 15, color: "var(--text)", outline: "none" }}
          onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
      )}

      {/* 인증 전용 (로그인 사용자만) */}
      {isLoggedIn && (
        <button type="button" onClick={() => setRequireAuth(!requireAuth)} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 100, width: "fit-content",
          border: `1.5px solid ${requireAuth ? "var(--green)" : "var(--border)"}`,
          background: requireAuth ? "var(--green-soft)" : "transparent",
          color: requireAuth ? "var(--green)" : "var(--text-muted)",
          fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
        }}>
          {requireAuth ? "✓" : "○"} 로그인 사용자만 참여 가능
        </button>
      )}

      <button type="submit" disabled={creating} style={{ padding: "13px", borderRadius: 100, border: "none", background: "var(--accent)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: creating ? "default" : "pointer", opacity: creating ? 0.7 : 1 }}>
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

  // 모임 생성
  const [newName, setNewName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [requireAuth, setRequireAuth] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // 비공개 모임 입장
  const [enterTarget, setEnterTarget] = useState<Group | null>(null);
  const [enterPassword, setEnterPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // 모임 삭제
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState(false);

  useEffect(() => { loadGroups(); getCurrentUser().then(setCurrentUser); }, []);

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
    const ownerId = currentUser.type === "auth" ? currentUser.user.id : null;
    const { data } = await getSupabase()
      .from("groups")
      .insert({ name: newName.trim(), is_private: isPrivate, password: isPrivate ? newPassword : null, owner_id: ownerId, require_auth: requireAuth })
      .select().single();
    setCreating(false);
    if (data) {
      // 모임 생성자를 owner로 멤버십 추가
      if (ownerId) {
        await getSupabase().from("group_memberships").insert({ group_id: data.id, user_id: ownerId, role: "owner" });
      }
      router.push(`/groups/${data.id}`);
    }
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
    // 인증 전용 모임: 비로그인/게스트 차단
    if (group.require_auth && currentUser.type !== "auth") {
      alert("이 모임은 로그인한 사용자만 참여할 수 있습니다.\n로그인 후 다시 시도해주세요.");
      router.push(`/login?next=/groups/${group.id}`);
      return;
    }
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
      <div className="fade-up" style={{ textAlign: "center", padding: "20px 0 8px" }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(40px,8vw,68px)", lineHeight: 1.1, marginBottom: 12, color: "var(--text)", letterSpacing: "-1px" }}>
            오늘 뭐 먹지? 🍴
          </h1>
          {/* Decorative food emojis */}
          <span style={{ position: "absolute", top: -10, left: -30, fontSize: 28, opacity: 0.15, animation: "float 3.5s ease-in-out infinite", pointerEvents: "none" }}>🍜</span>
          <span style={{ position: "absolute", top: 0, right: -30, fontSize: 24, opacity: 0.15, animation: "float 4s ease-in-out 0.5s infinite", pointerEvents: "none" }}>🍱</span>
          <span style={{ position: "absolute", bottom: -5, left: -20, fontSize: 20, opacity: 0.12, animation: "float 5s ease-in-out 1s infinite", pointerEvents: "none" }}>🥩</span>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 16, fontWeight: 400 }}>
          모임을 만들고 모두가 만족하는 메뉴를 찾아보세요 ✨
        </p>
      </div>

      {/* 모임 생성 — 모임 없으면 바로, 있으면 버튼 토글 */}
      {!loading && groups.length > 0 ? (
        <>
          {!showCreateForm ? (
            <button onClick={() => setShowCreateForm(true)} className="fade-up fade-up-1" style={{
              padding: "14px 28px", borderRadius: 100, border: "2px dashed var(--border)",
              background: "transparent", color: "var(--text-muted)", fontSize: 14, fontWeight: 600,
              cursor: "pointer", transition: "all 0.18s", textAlign: "center",
            }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              + 새 모임 만들기
            </button>
          ) : (
            <div className="fade-up" style={{ background: "var(--bg-card)", borderRadius: 20, padding: 28, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>새 모임 만들기</p>
                <button onClick={() => { setShowCreateForm(false); setNewName(""); setIsPrivate(false); setNewPassword(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 18 }}>✕</button>
              </div>
              <CreateForm newName={newName} setNewName={setNewName} isPrivate={isPrivate} setIsPrivate={setIsPrivate} newPassword={newPassword} setNewPassword={setNewPassword} requireAuth={requireAuth} setRequireAuth={setRequireAuth} creating={creating} onSubmit={createGroup} isLoggedIn={currentUser.type === "auth"} />
            </div>
          )}
        </>
      ) : !loading ? (
        <div className="fade-up fade-up-1" style={{ background: "var(--bg-card)", borderRadius: 20, padding: 28, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 18 }}>새 모임 만들기</p>
          <CreateForm newName={newName} setNewName={setNewName} isPrivate={isPrivate} setIsPrivate={setIsPrivate} newPassword={newPassword} setNewPassword={setNewPassword} requireAuth={requireAuth} setRequireAuth={setRequireAuth} creating={creating} onSubmit={createGroup} isLoggedIn={currentUser.type === "auth"} />
        </div>
      ) : null}

      {/* 모임 목록 */}
      {!loading && groups.length > 0 && (
        <div className="fade-up fade-up-2">
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 16 }}>
            모임 목록
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...publicGroups, ...privateGroups].map((group, i) => (
              <button key={group.id}
                onClick={() => handleEnter(group)}
                className={`fade-up fade-up-${Math.min(i + 1, 5)} group-card`}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "18px 22px", borderRadius: 16, width: "100%",
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  boxShadow: "var(--shadow)", textAlign: "left", cursor: "pointer",
                  transition: "all 0.18s cubic-bezier(0.34,1.56,0.64,1)",
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-2px) scale(1.01)"; e.currentTarget.style.boxShadow = "var(--shadow-lg)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "var(--shadow)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                onMouseDown={(e) => { e.currentTarget.style.transform = "translateY(0) scale(0.98)"; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(-2px) scale(1.01)"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: group.is_private ? "#FFF3E0" : "#E8F5E9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                    {group.is_private ? "🔒" : "🌐"}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <p style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 600, color: "var(--text)" }}>{group.name}</p>
                      {group.require_auth && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 100, background: "var(--green-soft)", color: "var(--green)", fontWeight: 700 }}>로그인 전용</span>}
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {group.is_private ? "비공개 모임" : "공개 모임"} · {new Date(group.created_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: 20, color: "var(--text-muted)", transition: "transform 0.18s" }}>→</span>
              </button>
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
