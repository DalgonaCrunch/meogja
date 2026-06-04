"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, Group } from "@/lib/supabase";
import { getCurrentUser, CurrentUser } from "@/lib/auth";

const GROUP_EMOJIS = ['🍱','🍜','🍗','🍕','🍣','🥘','🌮','🍻','🥗','🍰'];

function GroupCard({ group, onClick }: { group: Group; onClick: () => void }) {
  const emoji = GROUP_EMOJIS[group.name.charCodeAt(0) % GROUP_EMOJIS.length];
  const hue = 20 + (group.name.charCodeAt(0) % 6) * 18;
  return (
    <button onClick={onClick} className="tap"
      style={{ width:"100%", textAlign:"left", display:"flex", gap:14, alignItems:"center",
        padding:16, background:"var(--card)", border:"var(--card-border)",
        borderRadius:"var(--card-radius)", boxShadow:"var(--card-shadow)", cursor:"pointer" }}>
      <div style={{ width:58, height:58, borderRadius:"var(--tile-radius)", flex:"none", position:"relative", overflow:"hidden",
        display:"grid", placeItems:"center", fontSize:30,
        background:`linear-gradient(140deg, hsl(${hue} 88% 64%), hsl(${(hue+26)%360} 90% 52%))`,
        boxShadow:"inset 0 -10px 22px rgba(0,0,0,.18), inset 0 8px 14px rgba(255,255,255,.28)" }}>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(60% 50% at 30% 22%, rgba(255,255,255,.45), transparent)" }}/>
        <span style={{ position:"relative", filter:"drop-shadow(0 3px 4px rgba(0,0,0,.25))" }}>{emoji}</span>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
          <span style={{ fontFamily:"var(--font-display)", fontSize:18.5, color:"var(--text)", flex:1, minWidth:0,
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{group.name}</span>
          {group.is_private
            ? <span style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"3px 9px", borderRadius:"var(--r-pill)", fontSize:11.5, fontWeight:700, color:"var(--muted)", background:"var(--bg-2)", flexShrink:0 }}>🔒 비공개</span>
            : <span style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"3px 9px", borderRadius:"var(--r-pill)", fontSize:11.5, fontWeight:700, color:"var(--green)", background:"var(--green-soft)", flexShrink:0 }}>🌍 공개</span>}
        </div>
        {group.description && <p style={{ fontSize:12.5, color:"var(--muted)", marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{group.description}</p>}
        <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12.5, color:"var(--muted)" }}>
          <span>{new Date(group.created_at).toLocaleDateString("ko-KR")}</span>
        </div>
        {group.require_auth && <div style={{ marginTop:6 }}>
          <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:"var(--r-pill)", fontSize:11, fontWeight:700, color:"var(--accent)", background:"var(--accent-soft)" }}>🔑 로그인 전용</span>
        </div>}
      </div>
      <span style={{ color:"var(--faint)", fontSize:22, flexShrink:0 }}>›</span>
    </button>
  );
}

function CreateForm({ newName, setNewName, description, setDescription, isPrivate, setIsPrivate, newPassword, setNewPassword, requireAuth, setRequireAuth, creating, onSubmit, isLoggedIn }: {
  newName: string; setNewName: (v: string) => void;
  description: string; setDescription: (v: string) => void;
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
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="모임 설명 (선택, 예: 마케팅팀 점심 모임)"
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

  // 모임 생성
  const [newName, setNewName] = useState("");
  const [description, setDescription] = useState("");
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
    // 비공개 모임은 로그인 필수
    if (isPrivate && currentUser.type !== "auth") return;
    // 비로그인은 생성 불가
    if (currentUser.type === "none") { router.push("/login"); return; }
    setCreating(true);
    const ownerId = currentUser.type === "auth" ? currentUser.user.id : null;
    const ownerGuestName = currentUser.type === "guest" ? currentUser.user.name : null;
    const { data } = await getSupabase()
      .from("groups")
      .insert({
        name: newName.trim(),
        description: description.trim() || null,
        is_private: isPrivate,
        password: isPrivate ? newPassword : null,
        owner_id: ownerId,
        owner_guest_name: ownerGuestName,
        require_auth: requireAuth,
      })
      .select().single();
    setCreating(false);
    if (data) {
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
      <div className="fade-up" style={{ padding: "4px 0 0" }}>
        <div style={{ position: "relative", borderRadius: 24, padding: "24px 22px 28px", overflow: "hidden",
          background: "linear-gradient(135deg, var(--accent), var(--accent-2))", color: "#fff",
          boxShadow: "0 18px 36px -16px var(--accent)" }}>
          <div style={{ position: "absolute", right: -10, top: -16, fontSize: 130, opacity: 0.15, transform: "rotate(-12deg)", pointerEvents: "none" }}>🍴</div>
          <div style={{ position: "relative" }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px,7vw,38px)", lineHeight: 1.18, marginBottom: 10 }}>
              오늘 뭐 먹지? 🍴
            </h1>
            <p style={{ fontSize: 14, opacity: 0.92, lineHeight: 1.6, maxWidth: 260 }}>
              같이 먹을 사람 고르고, 취향 맞춰<br/>주변 맛집을 추천받아요
            </p>
          </div>
        </div>
      </div>

      {/* 모임 생성 — 모임 없으면 바로, 있으면 버튼 토글 */}
      {!loading && groups.length > 0 ? (
        <>
          {!showCreateForm ? (
            <button onClick={() => {
              if (currentUser.type === "none") {
                router.push("/login");
                return;
              }
              setShowCreateForm(true);
            }} className="fade-up fade-up-1" style={{
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
              <CreateForm newName={newName} setNewName={setNewName} description={description} setDescription={setDescription} isPrivate={isPrivate} setIsPrivate={setIsPrivate} newPassword={newPassword} setNewPassword={setNewPassword} requireAuth={requireAuth} setRequireAuth={setRequireAuth} creating={creating} onSubmit={createGroup} isLoggedIn={currentUser.type === "auth"} />
            </div>
          )}
        </>
      ) : !loading ? (
        currentUser.type === "none" ? (
          <div className="fade-up fade-up-1" style={{ textAlign: "center", padding: "32px 20px" }}>
            <p style={{ fontSize: 20, marginBottom: 8 }}>🍴</p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 8 }}>모임을 시작해볼까요?</p>
            <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 20 }}>로그인하거나 이름을 입력해서 첫 모임을 만들어보세요</p>
            <button className="tap" onClick={() => router.push("/login")} style={{ padding: "12px 28px", borderRadius: "var(--r-pill)", border: "none", background: "var(--accent)", color: "#fff", fontFamily: "var(--font-display)", fontSize: 15, cursor: "pointer", boxShadow: "0 8px 18px -8px var(--accent)" }}>
              로그인 / 게스트로 시작하기 →
            </button>
          </div>
        ) : (
          <div className="fade-up fade-up-1" style={{ background: "var(--card)", borderRadius: "var(--card-radius)", padding: 28, border: "var(--card-border)", boxShadow: "var(--card-shadow)" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 18 }}>첫 모임 만들기 🎉</p>
            <CreateForm newName={newName} setNewName={setNewName} description={description} setDescription={setDescription} isPrivate={isPrivate} setIsPrivate={setIsPrivate} newPassword={newPassword} setNewPassword={setNewPassword} requireAuth={requireAuth} setRequireAuth={setRequireAuth} creating={creating} onSubmit={createGroup} isLoggedIn={currentUser.type === "auth"} />
          </div>
        )
      ) : null}

      {/* 모임 목록 */}
      {!loading && groups.length > 0 && (
        <div className="fade-up fade-up-2">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <div style={{ fontFamily:"var(--font-display)", fontSize:18, color:"var(--text)" }}>내 모임 {groups.length}</div>
            {groups.length > 0 && !showCreateForm && (
              <button className="tap" onClick={() => setShowCreateForm(true)} style={{ display:"inline-flex", alignItems:"center", gap:4, color:"var(--accent)", fontWeight:700, fontSize:13.5, background:"none", border:"none", cursor:"pointer", padding:"4px 0" }}>
                + 새 모임
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...publicGroups, ...privateGroups].map((group, i) => (
              <GroupCard key={group.id} group={group} onClick={() => handleEnter(group)} />
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
