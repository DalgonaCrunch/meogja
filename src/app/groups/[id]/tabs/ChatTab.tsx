"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabase, Member } from "@/lib/supabase";
import { groupMemberName } from "@/lib/memberName";
import { getCurrentUser } from "@/lib/auth";
import { HANDSUP_POSES, POSE_WAVE } from "@/lib/mascot";
import LoadingCat from "@/components/LoadingCat";
import ReportModal from "@/components/ReportModal";
import { fetchMyBlocks, blockUser } from "@/lib/blocks";
import { showConfirm, toast } from "@/lib/dialog";

interface ChatMessage {
  id: string;
  user_id: string | null;
  display_name: string;
  profile_image: string | null;
  content: string;
  created_at: string;
}

export default function ChatTab({ groupId, groupName, groupImageUrl, groupEmoji, onClose, members = [], myMemberName }: {
  groupId: string;
  members?: Member[];
  /** 이 모임에서 내가 쓰는 이름 — 계정 이름이 아니라 이것으로 말한다 */
  myMemberName?: string;
  groupName?: string;
  groupImageUrl?: string;
  groupEmoji?: string;
  onClose?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("게스트");
  const [currentUserImage, setCurrentUserImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStickers, setShowStickers] = useState(false);
  const [avatarCfgs, setAvatarCfgs] = useState<{id:string; purpose:string; cropped_url?:string}[]>([]);
  const [stickersLoading, setStickersLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* ── 신고·차단 (구글 플레이 UGC 정책) ────────────────────────────────
     사용자끼리 글이 오가면 신고와 차단이 앱 안에 있어야 한다.
     차단한 사람의 글은 화면에서 아예 지운다 — 접어 두면 차단이 아니다. */
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [actionMsg, setActionMsg] = useState<ChatMessage | null>(null);
  const [reportMsg, setReportMsg] = useState<ChatMessage | null>(null);

  const POSE_STICKERS = [...HANDSUP_POSES, POSE_WAVE];

  const avatarStickers = avatarCfgs
    .filter(c => c.purpose === "avatar")
    .map(c => ({ src: c.cropped_url || `/mascot/avatars/${c.id}.png`, id: c.id }));

  const emotionStickers = avatarCfgs
    .filter(c => c.purpose === "emotion")
    .map(c => ({ src: c.cropped_url || `/mascot/avatars/${c.id}.png`, id: c.id }));

  const STICKERS: string[] = [
    ...POSE_STICKERS,
    ...avatarStickers.map(s => s.src),
    ...emotionStickers.map(s => s.src),
  ];

  /** 차단한 사람의 글은 보이지 않는다. 게스트 메시지(user_id 없음)는 차단 대상이 아니다. */
  const visibleMessages = messages.filter((m) => !m.user_id || !blocked.has(m.user_id));

  async function handleBlock(target: ChatMessage) {
    if (!currentUserId || !target.user_id) return;
    const name = groupMemberName(members, target.user_id, target.display_name);
    const ok = await showConfirm(
      `${name} 님을 차단할까요?\n이 사람이 쓴 글이 더 이상 보이지 않습니다.`,
      { icon: "🚫", title: "사용자 차단", confirmLabel: "차단", danger: true },
    );
    if (!ok) return;
    const err = await blockUser(currentUserId, target.user_id);
    if (err) { toast(err, "⚠️"); return; }
    setBlocked((prev) => new Set(prev).add(target.user_id!));
    toast(`${name} 님을 차단했어요`, "🚫");
  }

  useEffect(() => {
    if (!currentUserId) { setBlocked(new Set()); return; }
    fetchMyBlocks(currentUserId).then(setBlocked);
  }, [currentUserId]);

  useEffect(() => {
    getSupabase().from("avatar_config").select("id,purpose,cropped_url").then(({ data }) => {
      if (data) setAvatarCfgs(data);
      setStickersLoading(false);
    });
  }, []);

  useEffect(() => {
    getCurrentUser().then(async u => {
      if (u.type === "auth") {
        setCurrentUserId(u.user.id);
        /* 모임 안에서는 모임 이름으로 말한다. 모임 이름이 없을 때만 계정 이름으로 떨어진다. */
        setCurrentUserName(myMemberName || u.user.display_name || u.user.email?.split("@")[0] || "사용자");
        const { data } = await getSupabase().from("user_profiles").select("profile_image, display_name").eq("id", u.user.id).single();
        if (data?.profile_image) setCurrentUserImage(data.profile_image);
        if (!myMemberName && data?.display_name) setCurrentUserName(data.display_name);
      } else if (u.type === "guest") {
        setCurrentUserName(myMemberName || u.user.name || "게스트");
      }
    });
  }, [myMemberName]);

  useEffect(() => {
    loadMessages();

    // 실시간 구독 (다른 사람 메시지)
    const channel = getSupabase()
      .channel(`group_chat_${groupId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "group_messages",
        filter: `group_id=eq.${groupId}`,
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        // 이미 낙관적 업데이트로 추가된 메시지 중복 방지
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .subscribe();

    return () => { getSupabase().removeChannel(channel); };
  }, [groupId]);

  async function loadMessages() {
    setLoading(true);
    const { data } = await getSupabase()
      .from("group_messages")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setMessages(data.reverse());
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "instant" }), 50);
  }

  async function sendSticker(path: string) {
    if (sending) return;
    setShowStickers(false);
    setSending(true);
    const content = `[sticker:${path}]`;
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId, user_id: currentUserId, display_name: currentUserName,
      profile_image: currentUserImage, content, created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    const { data: newMsg, error } = await getSupabase().from("group_messages").insert({
      group_id: groupId, user_id: currentUserId, display_name: currentUserName,
      profile_image: currentUserImage, content,
    }).select().single();
    if (error || !newMsg) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } else {
      setMessages(prev => {
        const withoutReal = prev.filter(m => m.id !== newMsg.id);
        return withoutReal.map(m => m.id === tempId ? newMsg : m);
      });
    }
    setSending(false);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");

    // 낙관적 업데이트: 바로 UI에 표시
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      user_id: currentUserId,
      display_name: currentUserName,
      profile_image: currentUserImage,
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    const { data: newMsg, error } = await getSupabase().from("group_messages").insert({
      group_id: groupId,
      user_id: currentUserId,
      display_name: currentUserName,
      profile_image: currentUserImage,
      content: text,
    }).select().single();

    if (error || !newMsg) {
      // 실패 시 낙관적 메시지 제거
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setSending(false);
      return;
    }
    // temp를 실제 메시지로 교체 (realtime이 먼저 추가했을 경우 중복 제거 포함)
    setMessages(prev => {
      const withoutReal = prev.filter(m => m.id !== newMsg.id);
      return withoutReal.map(m => m.id === tempId ? newMsg : m);
    });
    setSending(false);
    // 모임 멤버들에게 푸시 알림
    fetch("/api/push/notify-group", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, title: `💬 ${currentUserName}`, body: text.length > 50 ? text.slice(0, 50) + "…" : text, url: `/groups/${groupId}?tab=chat`, excludeUserId: currentUserId }),
    });
  }

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${m}`;
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", { year:"numeric", month:"long", day:"numeric", weekday:"short" });
  };

  const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);

  const isSticker = (content: string) => content.startsWith("[sticker:");
  const stickerSrc = (content: string) => content.slice(9, -1);

  if (loading) return <LoadingCat />;

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, display:"flex", flexDirection:"column", background:"var(--bg)", zIndex:100 }}>
      {/* 모임 정보 헤더 */}
      <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:10, padding:"14px 16px 12px", borderBottom:"1px solid var(--border)", background:"var(--surface)" }}>
        {onClose && (
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"var(--text)", padding:0, flexShrink:0 }}>←</button>
        )}
        <div style={{ width:32, height:32, borderRadius:10, overflow:"hidden", background:"var(--bg-2)", display:"grid", placeItems:"center", flexShrink:0 }}>
          {groupImageUrl
            ? <img src={groupImageUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            : <span style={{ fontSize:18 }}>{groupEmoji || "🍽️"}</span>}
        </div>
        <span style={{ fontFamily:"var(--font-display)", fontSize:15, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{groupName || "채팅"}</span>
      </div>
      {/* 메시지 목록 */}
      <div style={{ flex:1, overflowY:"auto", padding:"12px 16px", display:"flex", flexDirection:"column", gap:10, minHeight:0 }}>
        {visibleMessages.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 16px", color:"var(--text-2)" }}>
            <p style={{ fontSize:32, marginBottom:8 }}>💬</p>
            <p style={{ fontSize:14 }}>첫 메시지를 보내보세요!</p>
          </div>
        )}
        {visibleMessages.map((msg, idx) => {
          const isMine = msg.user_id === currentUserId || (!currentUserId && msg.display_name === currentUserName);
          const prevMsg = visibleMessages[idx - 1];
          const showDateSep = !prevMsg || dayKey(prevMsg.created_at) !== dayKey(msg.created_at);
          const sticker = isSticker(msg.content);
          return (
            <div key={msg.id}>
              {showDateSep && (
                <div style={{ display:"flex", alignItems:"center", gap:10, margin:"8px 0" }}>
                  <div style={{ flex:1, height:1, background:"var(--border)" }} />
                  <span style={{ fontSize:11, color:"var(--text-3)", fontWeight:600, whiteSpace:"nowrap" }}>{fmtDate(msg.created_at)}</span>
                  <div style={{ flex:1, height:1, background:"var(--border)" }} />
                </div>
              )}
              <div style={{ display:"flex", flexDirection: isMine ? "row-reverse" : "row", gap:8, alignItems:"flex-end" }}>
                {!isMine && (
                  <div style={{ width:30, height:30, borderRadius:"50%", overflow:"hidden", flexShrink:0, background:"var(--bg-2)", display:"grid", placeItems:"center" }}>
                    {msg.profile_image
                      ? <img src={msg.profile_image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      : <span style={{ fontSize:14 }}>👤</span>}
                  </div>
                )}
                <div
                  style={{ maxWidth:"72%", display:"flex", flexDirection:"column", alignItems: isMine ? "flex-end" : "flex-start", gap:3 }}
                  onContextMenu={(e) => { if (!isMine) { e.preventDefault(); setActionMsg(msg); } }}
                >
                  {!isMine && (
                    <span style={{ fontSize:11, color:"var(--text-2)", fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
                      {groupMemberName(members, msg.user_id, msg.display_name)}
                      <button
                        className="tap"
                        onClick={() => setActionMsg(msg)}
                        aria-label="신고 또는 차단"
                        style={{ border:"none", background:"transparent", color:"var(--text-3)", fontSize:12, lineHeight:1, padding:"0 2px", cursor:"pointer" }}
                      >⋯</button>
                    </span>
                  )}
                  {sticker ? (
                    <img src={stickerSrc(msg.content)} alt="스티커" style={{ width:80, height:80, objectFit:"contain" }} />
                  ) : (
                    <div style={{
                      padding:"9px 13px", borderRadius: isMine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: isMine ? "var(--primary)" : "var(--surface)",
                      color: isMine ? "#fff" : "var(--text)",
                      border: isMine ? "none" : "var(--card-border)",
                      fontSize:14, lineHeight:1.5, wordBreak:"break-word",
                    }}>
                      {msg.content}
                    </div>
                  )}
                  <span style={{ fontSize:10, color:"var(--text-3)" }}>{fmtTime(msg.created_at)}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 스티커 피커 */}
      {showStickers && (
        <div style={{ flexShrink:0, borderTop:"1px solid var(--border)", background:"var(--surface)", padding:"12px 16px" }}>
          {stickersLoading ? (
            <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:60, color:"var(--text-3)", fontSize:13 }}>
              스티커 로딩 중…
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:8 }}>
              {STICKERS.map((src, i) => (
                <button key={i} onClick={() => sendSticker(src)} style={{ background:"none", border:"none", padding:4, cursor:"pointer", borderRadius:8, display:"grid", placeItems:"center" }}>
                  <img src={src} alt="" style={{ width:48, height:48, objectFit:"contain" }} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {/* 입력창 */}
      <div style={{ flexShrink:0, padding:"10px 16px calc(16px + env(safe-area-inset-bottom, 0px))", borderTop:"1px solid var(--border)", display:"flex", gap:8, alignItems:"center", background:"var(--bg)" }}>
        <button onClick={() => setShowStickers(v => !v)} style={{
          background: showStickers ? "var(--primary-light, #fce4ec)" : "none", border:"none",
          cursor:"pointer", flexShrink:0, padding:2, borderRadius:8,
          opacity: showStickers ? 1 : 0.7,
        }}>
          <img src="/mascot/avatars/cat-00.png" alt="스티커" style={{ width:32, height:32, objectFit:"contain", display:"block" }} />
        </button>
        <input
          value={input}
          onChange={e => { setInput(e.target.value); if (showStickers) setShowStickers(false); }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="메시지 입력…"
          style={{ flex:1, padding:"10px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--surface)", fontSize:14, outline:"none", color:"var(--text)" }}
        />
        <button className="tap" onClick={sendMessage} disabled={!input.trim() || sending} style={{
          padding:"10px 18px", borderRadius:"var(--r-pill)", border:"none",
          background: input.trim() ? "var(--primary)" : "var(--bg-2)",
          color: input.trim() ? "#fff" : "var(--text-3)",
          fontFamily:"var(--font-display)", fontSize:13, cursor: input.trim() ? "pointer" : "default",
          flexShrink:0,
        }}>전송</button>
      </div>

      {/* 신고·차단 액션 시트 — 이름 옆 ⋯ 또는 길게 눌러서 연다 */}
      {actionMsg && (
        <div
          onClick={() => setActionMsg(null)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:120, display:"flex", alignItems:"flex-end" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width:"100%", background:"var(--surface)", borderRadius:"20px 20px 0 0", padding:"8px 0 calc(12px + env(safe-area-inset-bottom, 0px))" }}
          >
            <div style={{ width:38, height:4, borderRadius:2, background:"var(--border-2)", margin:"6px auto 12px" }} />
            <p style={{ padding:"0 20px 10px", fontSize:12.5, color:"var(--text-3)" }}>
              {groupMemberName(members, actionMsg.user_id, actionMsg.display_name)} 님의 메시지
            </p>
            <button
              className="tap"
              onClick={() => { const m = actionMsg; setActionMsg(null); setReportMsg(m); }}
              style={{ width:"100%", padding:"15px 20px", border:"none", background:"transparent", textAlign:"left", fontSize:15, color:"#E53935", cursor:"pointer" }}
            >🚨 신고하기</button>
            {currentUserId && actionMsg.user_id && actionMsg.user_id !== currentUserId && (
              <button
                className="tap"
                onClick={() => { const m = actionMsg; setActionMsg(null); if (m) handleBlock(m); }}
                style={{ width:"100%", padding:"15px 20px", border:"none", background:"transparent", textAlign:"left", fontSize:15, color:"var(--text)", cursor:"pointer" }}
              >🚫 이 사용자 차단하기</button>
            )}
            <button
              className="tap"
              onClick={() => setActionMsg(null)}
              style={{ width:"100%", padding:"15px 20px", border:"none", borderTop:"1px solid var(--border)", background:"transparent", fontSize:15, color:"var(--text-2)", cursor:"pointer" }}
            >취소</button>
          </div>
        </div>
      )}

      {reportMsg && (
        <ReportModal
          targetType="message"
          targetId={reportMsg.id}
          targetName={groupMemberName(members, reportMsg.user_id, reportMsg.display_name)}
          targetContent={isSticker(reportMsg.content) ? "(스티커)" : reportMsg.content}
          groupId={groupId}
          reporterUserId={currentUserId}
          onClose={() => setReportMsg(null)}
        />
      )}
    </div>
  );
}
