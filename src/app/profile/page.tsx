"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, signOut, CurrentUser } from "@/lib/auth";
import { getSupabase, Group } from "@/lib/supabase";

const FEEDBACK_CATS = [
  { id: "bug", label: "🐛 버그 신고" },
  { id: "feature", label: "✨ 기능 제안" },
  { id: "general", label: "💬 일반 문의" },
  { id: "other", label: "📝 기타" },
];

export default function ProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser>({ type: "none" });
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [joinedGroups, setJoinedGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const user = await getCurrentUser();
    setCurrentUser(user);
    if (user.type === "none") { router.replace("/login"); return; }

    if (user.type === "auth") {
      // 내가 만든 모임
      const { data: owned } = await getSupabase().from("groups").select("*").eq("owner_id", user.user.id).order("created_at", { ascending: false });
      if (owned) setMyGroups(owned);

      // 내가 참여한 모임 (멤버십)
      const { data: memberships } = await getSupabase()
        .from("group_memberships").select("group_id").eq("user_id", user.user.id);
      if (memberships && memberships.length > 0) {
        const groupIds = memberships.map((m) => m.group_id);
        const { data: joined } = await getSupabase().from("groups").select("*").in("id", groupIds).order("created_at", { ascending: false });
        if (joined) setJoinedGroups(joined.filter((g) => g.owner_id !== user.user.id));
      }
    }
    setLoading(false);
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  async function leaveGroup(groupId: string) {
    if (currentUser.type !== "auth") return;
    await getSupabase().from("group_memberships").delete().eq("group_id", groupId).eq("user_id", currentUser.user.id);
    setJoinedGroups((prev) => prev.filter((g) => g.id !== groupId));
  }

  const displayName = currentUser.type === "auth" ? currentUser.user.display_name : currentUser.type === "guest" ? currentUser.user.name : "";
  const [fbCat, setFbCat] = useState("general");
  const [fbContent, setFbContent] = useState("");
  const [fbEmail, setFbEmail] = useState("");
  const [fbSent, setFbSent] = useState(false);
  const [fbSending, setFbSending] = useState(false);

  async function submitFeedback(e: FormEvent) {
    e.preventDefault();
    if (!fbContent.trim()) return;
    setFbSending(true);
    await getSupabase().from("feedbacks").insert({
      user_id: currentUser.type === "auth" ? currentUser.user.id : null,
      guest_name: currentUser.type === "guest" ? currentUser.user.name : null,
      email: fbEmail.trim() || (currentUser.type === "auth" ? currentUser.user.email : null),
      category: fbCat,
      content: fbContent.trim(),
    });
    setFbSent(true);
    setFbSending(false);
    setFbContent("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* 프로필 헤더 */}
      <div className="fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 600, marginBottom: 4 }}>
            {displayName || "사용자"}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {currentUser.type === "auth" ? `${currentUser.user.email} · 로그인 계정` : "게스트 이용 중"}
          </p>
        </div>
        <button onClick={handleSignOut} style={{ padding: "8px 18px", borderRadius: 100, border: "1.5px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          {currentUser.type === "auth" ? "로그아웃" : "나가기"}
        </button>
      </div>

      {!loading && currentUser.type === "auth" && (
        <>
          {/* 내가 만든 모임 */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>내가 만든 모임</p>
            {myGroups.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>아직 만든 모임이 없습니다</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {myGroups.map((g) => (
                  <button key={g.id} onClick={() => router.push(`/groups/${g.id}`)} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 18px", borderRadius: 14, background: "var(--bg-card)",
                    border: "1px solid var(--border)", boxShadow: "var(--shadow)",
                    cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{g.is_private ? "🔒" : "🌐"}</span>
                      <div>
                        <p style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{g.name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{g.require_auth ? "인증 전용" : "누구나 참여"}</p>
                      </div>
                    </div>
                    <span style={{ color: "var(--text-muted)", fontSize: 16 }}>→</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 참여 중인 모임 */}
          {joinedGroups.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>참여 중인 모임</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {joinedGroups.map((g) => (
                  <div key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
                    <button onClick={() => router.push(`/groups/${g.id}`)} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ fontSize: 18 }}>{g.is_private ? "🔒" : "🌐"}</span>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{g.name}</p>
                    </button>
                    <button onClick={() => leaveGroup(g.id)} style={{ padding: "5px 12px", borderRadius: 100, border: "1.5px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}>
                      나가기
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 문의/피드백 */}
      <div className="fade-up" style={{ marginTop: 8 }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 17, marginBottom: 14 }}>💬 문의 / 피드백</p>
        {fbSent ? (
          <div className="bounce-in" style={{ padding: "20px", borderRadius: 16, background: "var(--green-soft)", border: "1.5px solid var(--green)", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--green)", marginBottom: 6 }}>✓ 전달됐습니다!</p>
            <p style={{ fontSize: 13, color: "var(--text-2)" }}>소중한 의견 감사합니다 🙏</p>
            <button onClick={() => setFbSent(false)} style={{ marginTop: 12, padding: "8px 20px", borderRadius: "var(--r-pill)", border: "none", background: "var(--green)", color: "#fff", fontSize: 13, cursor: "pointer" }}>다시 작성</button>
          </div>
        ) : (
          <form onSubmit={submitFeedback} style={{ display: "flex", flexDirection: "column", gap: 12, background: "var(--surface)", borderRadius: 16, padding: "18px 16px", border: "var(--card-border)", boxShadow: "var(--card-shadow)" }}>
            {/* 카테고리 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {FEEDBACK_CATS.map((c) => (
                <button key={c.id} type="button" className="tap" onClick={() => setFbCat(c.id)} style={{
                  padding: "6px 14px", borderRadius: "var(--r-pill)", fontSize: 12, fontWeight: 600,
                  border: fbCat === c.id ? "none" : "1.5px solid var(--border)",
                  background: fbCat === c.id ? "var(--primary)" : "transparent",
                  color: fbCat === c.id ? "#fff" : "var(--text-2)", cursor: "pointer",
                }}>{c.label}</button>
              ))}
            </div>
            {/* 내용 */}
            <textarea value={fbContent} onChange={(e) => setFbContent(e.target.value)} required placeholder="내용을 입력해주세요 (버그, 불편한 점, 개선 아이디어 등)" rows={4}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 14, resize: "none", outline: "none", fontFamily: "var(--font-body)" }}
              onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
            {/* 이메일 (선택) */}
            {currentUser.type !== "auth" && (
              <input value={fbEmail} onChange={(e) => setFbEmail(e.target.value)} placeholder="답변 받을 이메일 (선택)"
                style={{ padding: "10px 14px", borderRadius: "var(--r-pill)", border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 13, outline: "none" }}
                onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
            )}
            <button type="submit" disabled={fbSending || !fbContent.trim()} className="tap" style={{
              padding: "13px", borderRadius: "var(--r-pill)", border: "none",
              background: (!fbContent.trim() || fbSending) ? "var(--border)" : "var(--primary)",
              color: (!fbContent.trim() || fbSending) ? "var(--text-2)" : "#fff",
              fontFamily: "var(--font-display)", fontSize: 15, cursor: "pointer",
            }}>
              {fbSending ? "전송 중…" : "보내기 →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
