"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser, setGuestUser, signInWithGoogle, signInWithKakao, CurrentUser } from "@/lib/auth";

type Props = {
  groupId: string;
  currentUser: CurrentUser;
  onJoined: (memberId: string, memberName: string) => void;
  onClose: () => void;
};

export default function JoinModal({ groupId, currentUser, onJoined, onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"choose" | "name" | "prefs">("choose");
  const [name, setName] = useState(
    currentUser.type === "auth" ? (currentUser.user.display_name || "") :
    currentUser.type === "guest" ? currentUser.user.name : ""
  );
  const [joining, setJoining] = useState(false);
  const [authLoading, setAuthLoading] = useState<string | null>(null);

  async function doJoin(joinName: string, userId: string | null, guestName: string | null) {
    setJoining(true);
    const { data, error } = await getSupabase().from("members").upsert(
      { name: joinName, group_id: groupId, user_id: userId, guest_name: guestName },
      { onConflict: "group_id,name", ignoreDuplicates: false }
    ).select().single();

    if (error || !data) {
      // 이름 중복 시도 — 기존 멤버 조회
      const { data: existing } = await getSupabase().from("members")
        .select("*").eq("group_id", groupId).eq("name", joinName).single();
      if (existing) {
        // 내 계정으로 업데이트
        await getSupabase().from("members").update({ user_id: userId, guest_name: guestName }).eq("id", existing.id);
        setJoining(false);
        onJoined(existing.id, joinName);
        return;
      }
    }

    setJoining(false);
    if (data) onJoined(data.id, joinName);
  }

  async function handleNameJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const userId = currentUser.type === "auth" ? currentUser.user.id : null;
    let guestName: string | null = null;
    if (currentUser.type === "none") {
      setGuestUser(name.trim());
      guestName = name.trim();
    } else if (currentUser.type === "guest") {
      guestName = currentUser.user.name;
    }
    await doJoin(name.trim(), userId, guestName);
  }

  async function handleKakao() {
    setAuthLoading("kakao");
    try { await signInWithKakao(); } catch { setAuthLoading(null); }
  }

  async function handleGoogle() {
    setAuthLoading("google");
    try { await signInWithGoogle(); } catch { setAuthLoading(null); }
  }

  // 로그인된 사용자 → 이름 확인 후 바로 참여
  const isLoggedIn = currentUser.type !== "none";
  const defaultStep = isLoggedIn ? "name" : "choose";
  if (step === "choose" && defaultStep === "name") {
    setStep("name");
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 60, padding: "0 0 0 0" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-card)", borderRadius: "24px 24px 0 0", padding: "28px 24px 40px", width: "100%", maxWidth: 480, boxShadow: "0 -8px 40px rgba(0,0,0,0.15)" }}>
        {/* 핸들 */}
        <div style={{ width: 40, height: 4, borderRadius: 100, background: "var(--border)", margin: "0 auto 24px" }} />

        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, marginBottom: 6 }}>모임 참여하기 🙌</h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>참여 후 선호/비선호 음식을 설정할 수 있어요</p>

        {step === "choose" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* 카카오 로그인 */}
            <button onClick={handleKakao} disabled={!!authLoading} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              padding: "14px", borderRadius: 100, border: "none",
              background: "#FAE100", color: "#3A1D1D",
              fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, cursor: "pointer",
              opacity: authLoading === "google" ? 0.5 : 1,
            }}>
              {authLoading === "kakao" ? "연결 중…" : "🟡 카카오로 로그인 후 참여"}
            </button>
            <button onClick={handleGoogle} disabled={!!authLoading} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              padding: "14px", borderRadius: 100, border: "1.5px solid var(--border)",
              background: "var(--bg-card)", color: "var(--text)",
              fontSize: 14, fontWeight: 600, cursor: "pointer",
              opacity: authLoading === "kakao" ? 0.5 : 1,
            }}>
              {authLoading === "google" ? "연결 중…" : "🔵 Google로 로그인 후 참여"}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>또는</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            <button onClick={() => setStep("name")} style={{
              padding: "14px", borderRadius: 100, border: "1.5px dashed var(--border)",
              background: "transparent", color: "var(--text-muted)", fontSize: 14, cursor: "pointer",
            }}>
              이름만 입력하고 참여하기
            </button>
          </div>
        )}

        {step === "name" && (
          <form onSubmit={handleNameJoin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>이 모임에서 사용할 닉네임</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                {currentUser.type === "auth" ? "계정과 다른 닉네임을 사용할 수 있어요" : "참여할 이름을 입력하세요"}
              </p>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="닉네임 입력 (예: 홍길동, 길동이)"
                style={{ width: "100%", padding: "13px 18px", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 16, color: "var(--text)", outline: "none", textAlign: "center", fontFamily: "var(--font-display)" }}
                onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
                onBlur={(e) => e.target.style.borderColor = "var(--border)"}
              />
              {currentUser.type === "auth" && currentUser.user.display_name && currentUser.user.display_name !== name && (
                <button type="button" onClick={() => setName(currentUser.type === "auth" ? currentUser.user.display_name || "" : "")} style={{ marginTop: 6, background: "none", border: "none", color: "var(--accent)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
                  계정 이름으로 되돌리기 ({currentUser.user.display_name})
                </button>
              )}
            </div>
            <button type="submit" disabled={joining || !name.trim()} style={{
              padding: "14px", borderRadius: 100, border: "none",
              background: (!name.trim() || joining) ? "var(--border)" : "var(--accent)",
              color: (!name.trim() || joining) ? "var(--text-muted)" : "#fff",
              fontFamily: "var(--font-display)", fontSize: 16, cursor: "pointer",
            }}>
              {joining ? "참여 중…" : "참여하기 →"}
            </button>
            {currentUser.type === "none" && (
              <button type="button" onClick={() => setStep("choose")} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>← 로그인으로 참여</button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
