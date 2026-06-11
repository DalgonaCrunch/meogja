"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser, CurrentUser } from "@/lib/auth";

interface DMMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface UserProfile {
  id: string;
  display_name: string;
  profile_image: string | null;
}

interface Thread {
  userId: string;
  displayName: string;
  profileImage: string | null;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

export default function MessagesPage() {
  return <Suspense fallback={null}><MessagesInner /></Suspense>;
}

function MessagesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(params.get("with"));
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profilesCache, setProfilesCache] = useState<Record<string, UserProfile>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCurrentUser().then(u => {
      if (u.type !== "auth") { router.replace("/login"); return; }
      setCurrentUser(u);
      setCurrentUserId(u.user.id);
      loadThreads(u.user.id);
    });
  }, []);

  useEffect(() => {
    if (!activeThread || currentUser?.type !== "auth") return;
    const myId = currentUser.user.id;
    loadConversation(myId, activeThread);
    loadProfile(activeThread);

    // 실시간 구독: 상대방 새 메시지
    const channel = getSupabase()
      .channel(`dm_${myId}_${activeThread}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "direct_messages",
        filter: `sender_id=eq.${activeThread}`,
      }, (payload) => {
        const msg = payload.new as DMMessage;
        if (msg.receiver_id !== myId) return;
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        // 읽음 처리
        getSupabase().from("direct_messages").update({ is_read: true }).eq("id", msg.id);
      })
      .subscribe();

    return () => { getSupabase().removeChannel(channel); };
  }, [activeThread, currentUser]);

  async function loadProfile(userId: string) {
    if (profilesCache[userId]) { setPartnerProfile(profilesCache[userId]); return; }
    const { data } = await getSupabase().from("user_profiles").select("id, display_name, profile_image").eq("id", userId).single();
    if (data) {
      setProfilesCache(prev => ({ ...prev, [userId]: data }));
      setPartnerProfile(data);
    }
  }

  async function loadThreads(myId: string) {
    setLoading(true);
    const { data } = await getSupabase()
      .from("direct_messages")
      .select("*")
      .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    // 상대방별 그룹핑
    const threadMap: Record<string, { msgs: DMMessage[] }> = {};
    for (const msg of data) {
      const otherId = msg.sender_id === myId ? msg.receiver_id : msg.sender_id;
      if (!threadMap[otherId]) threadMap[otherId] = { msgs: [] };
      threadMap[otherId].msgs.push(msg);
    }

    // 프로필 로딩
    const otherIds = Object.keys(threadMap);
    const { data: profiles } = await getSupabase().from("user_profiles").select("id, display_name, profile_image").in("id", otherIds);
    const pMap: Record<string, UserProfile> = {};
    profiles?.forEach(p => { pMap[p.id] = p; });
    setProfilesCache(prev => ({ ...prev, ...pMap }));

    const tList: Thread[] = otherIds.map(uid => {
      const msgs = threadMap[uid].msgs;
      const unread = msgs.filter(m => m.receiver_id === myId && !m.is_read).length;
      const last = msgs[0];
      return {
        userId: uid,
        displayName: pMap[uid]?.display_name || "알 수 없는 사용자",
        profileImage: pMap[uid]?.profile_image || null,
        lastMessage: last.content,
        lastAt: last.created_at,
        unread,
      };
    }).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());

    setThreads(tList);
    setLoading(false);
  }

  async function loadConversation(myId: string, otherId: string) {
    const [q1, q2] = await Promise.all([
      getSupabase().from("direct_messages").select("*")
        .eq("sender_id", myId).eq("receiver_id", otherId)
        .order("created_at", { ascending: true }),
      getSupabase().from("direct_messages").select("*")
        .eq("sender_id", otherId).eq("receiver_id", myId)
        .order("created_at", { ascending: true }),
    ]);
    const allMsgs = [...(q1.data || []), ...(q2.data || [])]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    setMessages(allMsgs);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "instant" }), 50);

    // 읽음 처리 + 스레드 목록 뱃지 초기화
    await getSupabase().from("direct_messages")
      .update({ is_read: true })
      .eq("sender_id", otherId).eq("receiver_id", myId).eq("is_read", false);
    setThreads(prev => prev.map(t => t.userId === otherId ? { ...t, unread: 0 } : t));
  }

  async function sendMessage() {
    if (!activeThread || !input.trim() || sending || currentUser?.type !== "auth") return;
    setSending(true);
    const text = input.trim();
    setInput("");
    const { data } = await getSupabase().from("direct_messages").insert({
      sender_id: currentUser.user.id,
      receiver_id: activeThread,
      content: text,
    }).select().single();
    if (data) setMessages(prev => [...prev, data]);
    setSending(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    // 수신자 푸시 알림
    const senderName = currentUser.user.display_name || currentUser.user.email?.split("@")[0] || "쪽지";
    fetch("/api/push/notify-group", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: null, userIds: [activeThread], title: `✉️ ${senderName}`, body: text.length > 50 ? text.slice(0, 50) + "…" : text, url: `/messages?with=${currentUser.user.id}`, excludeUserId: currentUser.user.id }),
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
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return fmtTime(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  if (!currentUser) return null;

  // 헤더 공통 컨텐츠
  const headerContent = activeThread ? (
    <>
      <button onClick={() => setActiveThread(null)} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"var(--text)", padding:0 }}>←</button>
      <div style={{ width:36, height:36, borderRadius:"50%", overflow:"hidden", background:"var(--bg-2)", display:"grid", placeItems:"center", flexShrink:0 }}>
        {partnerProfile?.profile_image
          ? <img src={partnerProfile.profile_image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          : <span style={{ fontSize:16 }}>👤</span>}
      </div>
      <span style={{ fontFamily:"var(--font-display)", fontSize:16 }}>{partnerProfile?.display_name || "쪽지"}</span>
    </>
  ) : (
    <>
      <button onClick={() => router.back()} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"var(--text)", padding:0 }}>←</button>
      <span style={{ fontFamily:"var(--font-display)", fontSize:18 }}>💌 쪽지함</span>
    </>
  );

  return (
    <div style={{
      position:"fixed", top:0, left:0, right:0, bottom:0,
      display:"flex", flexDirection:"column",
      background:"var(--bg)", zIndex:100,
    }}>
      {/* 헤더 */}
      <div style={{ flexShrink:0, padding:"16px 16px 12px", display:"flex", alignItems:"center", gap:12, borderBottom:"1px solid var(--border)", background:"var(--surface)" }}>
        {headerContent}
      </div>

      {/* 대화 목록 */}
      {!activeThread && (
        <div style={{ flex:1, overflowY:"auto" }}>
          {loading && <p style={{ padding:32, textAlign:"center", color:"var(--text-2)" }}>불러오는 중…</p>}
          {!loading && threads.length === 0 && (
            <div style={{ padding:"48px 24px", textAlign:"center" }}>
              <p style={{ fontSize:40, marginBottom:12 }}>💌</p>
              <p style={{ fontSize:14, color:"var(--text-2)" }}>아직 주고받은 쪽지가 없어요</p>
            </div>
          )}
          {threads.map(t => (
            <button key={t.userId} onClick={() => setActiveThread(t.userId)} style={{
              width:"100%", display:"flex", gap:12, alignItems:"center", padding:"14px 16px",
              background:"var(--surface)", border:"none", borderBottom:"1px solid var(--border)", cursor:"pointer", textAlign:"left",
            }}>
              <div style={{ width:44, height:44, borderRadius:"50%", overflow:"hidden", background:"var(--bg-2)", display:"grid", placeItems:"center", flexShrink:0 }}>
                {t.profileImage ? <img src={t.profileImage} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ fontSize:20 }}>👤</span>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                  <span style={{ fontWeight:700, fontSize:14, color:"var(--text)" }}>{t.displayName}</span>
                  <span style={{ fontSize:11, color:"var(--text-3)" }}>{fmtDate(t.lastAt)}</span>
                </div>
                <p style={{ fontSize:13, color:"var(--text-2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.lastMessage}</p>
              </div>
              {t.unread > 0 && (
                <div style={{ width:20, height:20, borderRadius:"50%", background:"var(--primary)", color:"#fff", fontSize:11, fontWeight:700, display:"grid", placeItems:"center", flexShrink:0 }}>{t.unread}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 대화 내용 */}
      {activeThread && (
        <>
          <div style={{ flex:1, overflowY:"auto", padding:"12px 16px", display:"flex", flexDirection:"column", gap:10, minHeight:0 }}>
            {messages.map(msg => {
              const isMine = msg.sender_id === currentUserId;
              return (
                <div key={msg.id} style={{ display:"flex", flexDirection: isMine ? "row-reverse" : "row", gap:8, alignItems:"flex-end" }}>
                  <div style={{ maxWidth:"72%", display:"flex", flexDirection:"column", alignItems: isMine ? "flex-end" : "flex-start", gap:3 }}>
                    <div style={{
                      padding:"9px 13px", borderRadius: isMine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: isMine ? "var(--primary)" : "var(--surface)",
                      color: isMine ? "#fff" : "var(--text)",
                      border: isMine ? "none" : "var(--card-border)",
                      fontSize:14, lineHeight:1.5, wordBreak:"break-word",
                    }}>
                      {msg.content}
                    </div>
                    <span style={{ fontSize:10, color:"var(--text-3)" }}>{fmtTime(msg.created_at)}</span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          <div style={{ flexShrink:0, padding:"10px 16px calc(16px + env(safe-area-inset-bottom, 0px))", borderTop:"1px solid var(--border)", display:"flex", gap:8, background:"var(--bg)" }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="쪽지 입력…"
              style={{ flex:1, padding:"10px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--surface)", fontSize:14, outline:"none", color:"var(--text)" }} />
            <button className="tap" onClick={sendMessage} disabled={!input.trim() || sending} style={{
              padding:"10px 18px", borderRadius:"var(--r-pill)", border:"none",
              background: input.trim() ? "var(--primary)" : "var(--bg-2)",
              color: input.trim() ? "#fff" : "var(--text-3)",
              fontFamily:"var(--font-display)", fontSize:13, cursor: input.trim() ? "pointer" : "default",
            }}>전송</button>
          </div>
        </>
      )}
    </div>
  );
}
