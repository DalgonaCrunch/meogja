"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, signOut, CurrentUser } from "@/lib/auth";
import { getSupabase, Group } from "@/lib/supabase";

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
    </div>
  );
}
