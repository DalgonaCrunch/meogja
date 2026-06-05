"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser, setGuestUser, signInWithGoogle, signInWithKakao, CurrentUser } from "@/lib/auth";

type Props = {
  groupId: string;
  requiresApproval?: boolean;
  onJoined: (memberId: string, memberName: string) => void;
  onClose: () => void;
};

export default function JoinModal({ groupId, requiresApproval, onJoined, onClose }: Props) {
  const [step, setStep] = useState<"loading" | "choose" | "name" | "pending">("loading");
  const [user, setUser] = useState<CurrentUser>({ type: "none" });
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [authLoading, setAuthLoading] = useState<string | null>(null);
  const [nameError, setNameError] = useState("");
  const [isWebView, setIsWebView] = useState(false);
  const [guestPassword, setGuestPassword] = useState("");
  const [newGuestPassword, setNewGuestPassword] = useState("");
  const [requiresPassword, setRequiresPassword] = useState(false); // 기존 계정에 비밀번호 있음
  const [showSetPassword, setShowSetPassword] = useState(false); // 새 게스트 비밀번호 설정

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsWebView(/KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|MicroMessenger|WebView|wv\b/.test(ua));
    // 모달 마운트 시 현재 유저 fresh 로드
    getCurrentUser().then((u) => {
      setUser(u);
      if (u.type === "auth") {
        setName(u.user.display_name || "");
        setStep("name");
      } else if (u.type === "guest") {
        setName(u.user.name);
        setStep("name");
      } else {
        setStep("choose");
      }
    });
  }, []);

  async function doJoin(joinName: string, userId: string | null, guestName: string | null) {
    setJoining(true);

    // 1. 같은 이름 멤버가 이미 있는지 먼저 확인
    const { data: existing } = await getSupabase().from("members")
      .select("*").eq("group_id", groupId).eq("name", joinName).single();

    if (existing) {
      // 내 계정이 이미 이 멤버 → 그냥 입장
      if (userId && existing.user_id === userId) {
        setJoining(false);
        onJoined(existing.id, joinName);
        return;
      }
      // 계정 멤버 자리를 게스트가 탈취 시도 → 차단
      if (!userId && existing.user_id !== null) {
        setJoining(false);
        setNameError("이미 로그인 계정이 사용 중인 닉네임입니다. 다른 이름을 사용해주세요.");
        return;
      }
      // 다른 게스트가 이미 사용 중 → 차단
      if (!userId && existing.guest_name && existing.guest_name !== guestName) {
        setJoining(false);
        setNameError("이미 다른 참여자가 사용 중인 닉네임입니다. 다른 이름을 사용해주세요.");
        return;
      }
      // 내 게스트 이름이 이미 있음 → 입장
      if (!userId && existing.guest_name === guestName) {
        setJoining(false);
        onJoined(existing.id, joinName);
        return;
      }
    }

    // 2. 새 멤버 생성
    const status = requiresApproval ? "pending" : "approved";
    const { data, error } = await getSupabase().from("members")
      .insert({ name: joinName, group_id: groupId, user_id: userId, guest_name: guestName, status })
      .select().single();

    // 3. group_memberships에도 기록 (프로필 페이지에서 참여 모임 표시용)
    if (userId && data && !requiresApproval) {
      await getSupabase().from("group_memberships").upsert(
        { group_id: groupId, user_id: userId, role: "member" },
        { onConflict: "group_id,user_id", ignoreDuplicates: true }
      );
    }

    setJoining(false);
    if (error) {
      setNameError("참여 중 오류가 발생했습니다. 다시 시도해주세요.");
      return;
    }
    if (data) {
      if (requiresApproval) {
        setStep("pending");
      } else {
        onJoined(data.id, joinName);
      }
    }
  }

  async function handleNameJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const userId = user.type === "auth" ? user.user.id : null;

    if (user.type === "none") {
      // 게스트: guest_accounts 확인
      const { data: acct } = await getSupabase().from("guest_accounts").select("password").eq("name", name.trim()).single();
      if (acct) {
        if (acct.password) {
          // 비밀번호 있는 기존 계정
          if (!requiresPassword) { setRequiresPassword(true); return; }
          if (guestPassword !== acct.password) { setNameError("비밀번호가 틀렸습니다."); return; }
        }
      } else {
        // 새 계정 생성
        const pw = newGuestPassword.trim() || null;
        await getSupabase().from("guest_accounts").insert({ name: name.trim(), password: pw });
      }
      setGuestUser(name.trim());
      await doJoin(name.trim(), null, name.trim());
      return;
    }

    const guestName = user.type === "guest" ? user.user.name : null;
    await doJoin(name.trim(), userId, guestName);
  }

  async function handleKakao() {
    setAuthLoading("kakao");
    // 로그인 후 이 모임으로 복귀 + 자동 참여 모달 열기
    const returnUrl = `/groups/${groupId}`;
    sessionStorage.setItem("meogja_pending_join", groupId);
    try { await signInWithKakao(returnUrl); } catch { setAuthLoading(null); }
  }

  async function handleGoogle() {
    setAuthLoading("google");
    const returnUrl = `/groups/${groupId}`;
    sessionStorage.setItem("meogja_pending_join", groupId);
    try { await signInWithGoogle(returnUrl); } catch { setAuthLoading(null); }
  }

  const accountName = user.type === "auth" ? user.user.display_name : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 60 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--card)", borderRadius: "28px 28px 0 0", padding: "10px 22px 40px", width: "100%", maxWidth: 480, boxShadow: "0 -20px 50px -20px rgba(0,0,0,.4)", animation: "sheetUp .32s cubic-bezier(.2,.8,.2,1) both" }}>
        <div style={{ width: 42, height: 5, borderRadius: 99, background: "var(--border-2)", margin: "4px auto 20px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontSize: 21 }}>모임 참여하기 🙌</h3>
          <button className="tap" onClick={onClose} style={{ color: "var(--muted)", width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--bg-2)", border: "none", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        {step === "loading" && (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--muted)" }}>로딩 중…</div>
        )}

        {step === "pending" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "20px 0" }}>
            <div style={{ fontSize: 48 }}>⏳</div>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 20, textAlign: "center" }}>가입 신청 완료!</p>
            <p style={{ fontSize: 14, color: "var(--muted)", textAlign: "center", lineHeight: 1.6 }}>
              모임장의 승인 후 입장할 수 있습니다.<br/>
              승인되면 다시 모임에 들어오세요.
            </p>
            <button className="tap" onClick={onClose} style={{ padding: "13px 32px", borderRadius: "var(--r-pill)", border: "none", background: "var(--accent)", color: "#fff", fontFamily: "var(--font-display)", fontSize: 15, cursor: "pointer" }}>
              확인
            </button>
          </div>
        )}

        {step === "choose" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* WebView 경고 */}
            {isWebView && (
              <div style={{ padding: "12px 14px", borderRadius: 12, background: "#FFF8E1", border: "1.5px solid #F5A623" }}>
                <p style={{ fontSize: 12, color: "#795548", marginBottom: 8, lineHeight: 1.6 }}>
                  ⚠️ 인앱 브라우저에서는 Google 로그인이 차단됩니다.<br/>
                  다른 브라우저에서 열거나, 이름으로 참여하세요.
                </p>
                <button onClick={() => {
                  const url = window.location.href;
                  if (/Android/.test(navigator.userAgent)) {
                    const u = url.replace(/^https?:\/\//, "");
                    window.location.href = `intent://${u}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
                  } else if (navigator.share) {
                    navigator.share({ url, title: "meogja" }).catch(() => navigator.clipboard?.writeText(url));
                  } else {
                    navigator.clipboard?.writeText(url);
                    alert("링크를 복사했습니다!");
                  }
                }} style={{ width: "100%", padding: "9px", borderRadius: "var(--r-pill)", border: "none", background: "#FF7A45", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  다른 브라우저로 열기 →
                </button>
              </div>
            )}
            <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 4 }}>로그인하거나 이름만 입력해서 참여하세요</p>
            {/* 카카오 로그인 — 비즈앱 심사 후 활성화 */}
            {/* <button onClick={handleKakao}>카카오로 로그인 후 참여</button> */}
            <button className="tap" onClick={() => {
              sessionStorage.setItem("meogja_pending_join", groupId);
              window.location.href = `/api/auth/naver?next=/groups/${groupId}`;
            }} disabled={!!authLoading} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "14px", borderRadius: "var(--r-pill)", border: "none",
              background: "#03C75A", color: "#fff", fontFamily: "var(--font-display)", fontSize: 15, cursor: "pointer",
              boxShadow: "0 6px 18px -8px rgba(3,199,90,.5)",
            }}>
              <span style={{ fontSize: 16, fontWeight: 900 }}>N</span>
              네이버로 로그인 후 참여
            </button>
            <button className="tap" onClick={handleGoogle} disabled={!!authLoading} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "14px", borderRadius: "var(--r-pill)", border: "1.5px solid var(--border-2)",
              background: "var(--card)", color: "var(--text)", fontSize: 14, fontWeight: 600, cursor: "pointer",
              opacity: authLoading === "kakao" ? 0.5 : 1,
            }}>
              {authLoading === "google" ? "연결 중…" : "🔵 Google로 로그인 후 참여"}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 12, color: "var(--muted)" }}>또는</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            <button className="tap" onClick={() => setStep("name")} style={{
              padding: "14px", borderRadius: "var(--r-pill)",
              border: "1.5px dashed var(--border-2)", background: "transparent",
              color: "var(--muted)", fontSize: 14, cursor: "pointer",
            }}>
              이름만 입력하고 참여하기
            </button>
          </div>
        )}

        {step === "name" && (
          <form onSubmit={handleNameJoin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>이 모임에서 사용할 닉네임</p>
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                {user.type === "auth" ? "계정과 다른 닉네임을 사용할 수 있어요" : "참여할 이름을 입력하세요"}
              </p>
              {nameError && <p style={{ fontSize:12, color:"var(--red)", marginBottom:8, padding:"8px 12px", borderRadius:10, background:"var(--red-soft)" }}>{nameError}</p>}
              <input
                autoFocus
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(""); }}
                placeholder="닉네임 입력"
                style={{ width: "100%", padding: "14px 18px", borderRadius: "var(--r-pill)", border: "2px solid var(--border-2)", background: "var(--card)", fontSize: 16, color: "var(--text)", outline: "none", textAlign: "center", fontFamily: "var(--font-display)" }}
                onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
                onBlur={(e) => e.target.style.borderColor = "var(--border-2)"}
              />
              {accountName && accountName !== name && (
                <button type="button" onClick={() => setName(accountName)} style={{ marginTop: 7, background: "none", border: "none", color: "var(--accent)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
                  계정 이름으로 되돌리기 ({accountName})
                </button>
              )}
            </div>

            {/* 게스트 비밀번호 입력 (기존 계정) */}
            {user.type === "none" && requiresPassword && (
              <div>
                <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 6 }}>🔐 이 닉네임은 비밀번호가 설정돼 있어요</p>
                <input type="password" value={guestPassword} onChange={(e) => { setGuestPassword(e.target.value.slice(0,16)); setNameError(""); }} placeholder="비밀번호 입력"
                  style={{ width:"100%", padding:"12px 16px", borderRadius:"var(--r-pill)", border:"2px solid var(--border-2)", background:"var(--card)", fontSize:15, outline:"none", textAlign:"center" }}
                  onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border-2)"} />
              </div>
            )}

            {/* 게스트 비밀번호 설정 (새 계정) */}
            {user.type === "none" && !requiresPassword && (
              <div>
                {!showSetPassword ? (
                  <button type="button" onClick={() => setShowSetPassword(true)} style={{ background:"none", border:"none", color:"var(--accent)", fontSize:12, cursor:"pointer", textDecoration:"underline" }}>
                    🔐 이 닉네임에 비밀번호 설정하기 (선택)
                  </button>
                ) : (
                  <div>
                    <p style={{ fontSize:12, color:"var(--text-2)", marginBottom:6 }}>비밀번호 설정 (최대 16자, 선택)</p>
                    <input type="password" value={newGuestPassword} onChange={(e) => setNewGuestPassword(e.target.value.slice(0,16))} placeholder="비밀번호 입력 (없으면 빈칸)"
                      style={{ width:"100%", padding:"12px 16px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--card)", fontSize:14, outline:"none", textAlign:"center" }} />
                    <p style={{ fontSize:11, color:"var(--text-3)", marginTop:4 }}>{newGuestPassword.length}/16자</p>
                  </div>
                )}
              </div>
            )}

            <button type="submit" disabled={joining || !name.trim()} style={{
              padding: "15px", borderRadius: "var(--r-pill)", border: "none",
              background: (!name.trim() || joining) ? "var(--border)" : "var(--accent)",
              color: (!name.trim() || joining) ? "var(--muted)" : "var(--accent-ink)",
              fontFamily: "var(--font-display)", fontSize: 16, cursor: "pointer",
              boxShadow: name.trim() && !joining ? "0 8px 18px -8px var(--accent)" : "none",
            }}>
              {joining ? "신청 중…" : requiresApproval ? "가입 신청하기 →" : "참여하기 →"}
            </button>
            {user.type === "none" && (
              <button type="button" onClick={() => setStep("choose")} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}>
                ← 로그인으로 참여
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
