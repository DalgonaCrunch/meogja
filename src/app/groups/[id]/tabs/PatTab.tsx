"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { trackPlaceClick, fetchPlaceClickStats, getClickCount } from "@/lib/placeClicks";

type MealPat = {
  id: string;
  group_id: string;
  creator_member_id: string | null;
  creator_name: string;
  menu: string;
  title: string;
  restaurant_name: string | null;
  restaurant_address: string | null;
  restaurant_link: string | null;
  scheduled_at: string | null;
  max_members: number | null;
  status: "open" | "closed";
  created_at: string;
};

type PatJoin = {
  id: string;
  pat_id: string;
  member_id: string;
  member_name: string;
};

const TITLE_TEMPLATES = [
  (menu: string) => `${menu} 먹을 파티원 구함 🍽️`,
  (menu: string) => `${menu} 같이 먹을 사람? 🙋`,
  (menu: string) => `지금 ${menu} 먹으러 갈 사람 🚀`,
  (menu: string) => `${menu} 먹자팟 모집 중 🎉`,
  (menu: string) => `${menu} 오늘 먹어볼 사람 손! ✋`,
];

function fmtScheduled(iso: string) {
  const d = new Date(iso);
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h < 12 ? "오전" : "오후";
  return `${mo}/${day} ${ampm} ${h % 12 || 12}:${m}`;
}

function timeSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function PatTab({
  groupId,
  myMemberId,
  myMemberName,
  isOwner,
  initialExpandId,
  currentUserId,
}: {
  groupId: string;
  myMemberId: string | null;
  myMemberName: string;
  isOwner: boolean;
  initialExpandId?: string | null;
  currentUserId?: string | null;
}) {
  const [pats, setPats] = useState<MealPat[]>([]);
  const [joins, setJoins] = useState<Record<string, PatJoin[]>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [menuInput, setMenuInput] = useState("");
  const [titleIdx, setTitleIdx] = useState(0);
  const [customTitle, setCustomTitle] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [restaurantInput, setRestaurantInput] = useState("");
  const [scheduledInput, setScheduledInput] = useState("");
  const [maxInput, setMaxInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedPatId, setExpandedPatId] = useState<string | null>(initialExpandId ?? null);
  const [copiedPatId, setCopiedPatId] = useState<string | null>(null);
  const [placeClicks, setPlaceClicks] = useState<Record<string, number>>({});

  const generatedTitle = menuInput.trim() ? TITLE_TEMPLATES[titleIdx](menuInput.trim()) : "";
  const finalTitle = useCustom ? customTitle : generatedTitle;

  function copyInviteLink(patId: string) {
    const url = `${window.location.origin}/groups/${groupId}?tab=pat&pat=${patId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedPatId(patId);
      setTimeout(() => setCopiedPatId(null), 2000);
    }).catch(() => {
      if (navigator.share) navigator.share({ url });
    });
  }

  useEffect(() => {
    loadPats();
    const ch = getSupabase()
      .channel(`meal_pats_${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meal_pats", filter: `group_id=eq.${groupId}` }, () => loadPats())
      .on("postgres_changes", { event: "*", schema: "public", table: "meal_pat_joins" }, () => loadPats())
      .subscribe();
    return () => { getSupabase().removeChannel(ch); };
  }, [groupId]);

  async function loadPats() {
    setLoading(true);
    const { data: patData } = await getSupabase()
      .from("meal_pats")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (patData) {
      setPats(patData as MealPat[]);
      const ids = patData.map((p: MealPat) => p.id);
      if (ids.length > 0) {
        const { data: joinData } = await getSupabase()
          .from("meal_pat_joins")
          .select("*")
          .in("pat_id", ids);
        if (joinData) {
          const map: Record<string, PatJoin[]> = {};
          joinData.forEach((j: PatJoin) => {
            if (!map[j.pat_id]) map[j.pat_id] = [];
            map[j.pat_id].push(j);
          });
          setJoins(map);
        }
      }
      const names = (patData as MealPat[]).filter(p => p.restaurant_name).map(p => p.restaurant_name!);
      if (names.length) fetchPlaceClickStats(names).then(setPlaceClicks);
    }
    setLoading(false);
  }

  async function createPat() {
    if (!menuInput.trim() || !finalTitle.trim() || creating) return;
    if (!myMemberId) return;
    setCreating(true);
    const { data } = await getSupabase().from("meal_pats").insert({
      group_id: groupId,
      creator_member_id: myMemberId,
      creator_name: myMemberName,
      menu: menuInput.trim(),
      title: finalTitle.trim(),
      restaurant_name: restaurantInput.trim() || null,
      scheduled_at: scheduledInput ? new Date(scheduledInput).toISOString() : null,
      max_members: maxInput ? parseInt(maxInput) : null,
      status: "open",
    }).select().single();
    if (data) {
      await getSupabase().from("meal_pat_joins").insert({
        pat_id: data.id, member_id: myMemberId, member_name: myMemberName,
      });
      // 모임 멤버 푸시 알림
      fetch("/api/push/notify-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          title: `🍚 ${myMemberName}님이 먹자팟을 만들었어요!`,
          body: finalTitle.trim(),
          url: `/groups/${groupId}?tab=pat&pat=${data.id}`,
          excludeUserId: currentUserId || undefined,
        }),
      }).catch(() => {});
    }
    setCreating(false);
    setShowCreate(false);
    setMenuInput(""); setCustomTitle(""); setRestaurantInput(""); setScheduledInput(""); setMaxInput(""); setUseCustom(false); setTitleIdx(0);
  }

  async function joinPat(pat: MealPat) {
    if (!myMemberId) return;
    const existing = (joins[pat.id] || []).find(j => j.member_id === myMemberId);
    if (existing) return;
    await getSupabase().from("meal_pat_joins").insert({
      pat_id: pat.id, member_id: myMemberId, member_name: myMemberName,
    });
  }

  async function leavePat(pat: MealPat) {
    if (!myMemberId) return;
    await getSupabase().from("meal_pat_joins").delete()
      .eq("pat_id", pat.id).eq("member_id", myMemberId);
  }

  async function closePat(patId: string) {
    await getSupabase().from("meal_pats").update({ status: "closed" }).eq("id", patId);
  }

  const canParticipate = !!myMemberId;
  const open = pats.filter(p => p.status === "open");
  const closed = pats.filter(p => p.status === "closed");

  return (
    <div style={{ padding:"0 0 100px" }}>
      {/* 헤더 */}
      <div style={{ padding:"16px 16px 0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <p style={{ fontFamily:"var(--font-display)", fontSize:18 }}>🍚 먹자팟</p>
          <p style={{ fontSize:12, color:"var(--text-2)" }}>같이 먹을 사람을 구해보세요</p>
        </div>
        {canParticipate && (
          <button className="tap" onClick={() => setShowCreate(true)} style={{
            padding:"9px 16px", borderRadius:"var(--r-pill)", border:"none",
            background:"var(--primary)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer",
          }}>
            + 팟 만들기
          </button>
        )}
      </div>

      {!canParticipate && (
        <div style={{ margin:"16px", padding:"14px", borderRadius:14, background:"var(--bg-2)", textAlign:"center" }}>
          <p style={{ fontSize:14, color:"var(--text-2)" }}>모임 멤버만 먹자팟을 만들거나 참여할 수 있어요</p>
        </div>
      )}

      {loading && <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text-2)" }}>로딩 중…</div>}

      {!loading && open.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px 16px" }}>
          <p style={{ fontSize:32, marginBottom:8 }}><img src="/mascot/tabs/food.png" style={{width:32, height:32, objectFit:"contain"}} /></p>
          <p style={{ fontFamily:"var(--font-display)", fontSize:16, color:"var(--text)", marginBottom:6 }}>아직 먹자팟이 없어요</p>
          <p style={{ fontSize:13, color:"var(--text-3)" }}>먹고 싶은 메뉴로 팟을 만들어보세요!</p>
        </div>
      )}

      {/* 진행 중 팟 */}
      {open.length > 0 && (
        <div style={{ padding:"12px 16px 0", display:"flex", flexDirection:"column", gap:10 }}>
          {open.map(pat => {
            const patJoins = joins[pat.id] || [];
            const myJoin = patJoins.find(j => j.member_id === myMemberId);
            const isCreator = pat.creator_member_id === myMemberId;
            const full = pat.max_members != null && patJoins.length >= pat.max_members;
            const isExpanded = expandedPatId === pat.id;
            return (
              <div key={pat.id} style={{ background:"var(--surface)", borderRadius:16, border:"var(--card-border)", boxShadow:"var(--card-shadow)", overflow:"hidden" }}>
                {/* 요약 헤더 — tap to expand */}
                <button className="tap" onClick={() => setExpandedPatId(isExpanded ? null : pat.id)}
                  style={{ width:"100%", textAlign:"left", background:"none", border:"none", cursor:"pointer", padding:"14px 14px 10px" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:6 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontFamily:"var(--font-display)", fontSize:15, lineHeight:1.3, margin:0 }}>{pat.title}</p>
                      <div style={{ display:"flex", gap:6, marginTop:4, flexWrap:"wrap" }}>
                        <span style={{ fontSize:11, padding:"2px 8px", borderRadius:"var(--r-pill)", background:"var(--primary)", color:"#fff", fontWeight:700 }}>{pat.menu}</span>
                        {pat.restaurant_name && <span style={{ fontSize:11, padding:"2px 8px", borderRadius:"var(--r-pill)", background:"var(--bg-2)", color:"var(--text-2)" }}>📍 {pat.restaurant_name}</span>}
                        {pat.scheduled_at && <span style={{ fontSize:11, padding:"2px 8px", borderRadius:"var(--r-pill)", background:"var(--bg-2)", color:"var(--text-2)" }}>🕐 {fmtScheduled(pat.scheduled_at)}</span>}
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                      <span style={{ fontSize:11, color:"var(--text-3)" }}>{timeSince(pat.created_at)}</span>
                      <span style={{ fontSize:14, color:"var(--text-3)", transition:"transform .2s", transform: isExpanded ? "rotate(180deg)" : "none" }}>▾</span>
                    </div>
                  </div>
                  {/* 참여자 요약 */}
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                    <span style={{ fontSize:12, color:"var(--text-2)" }}>
                      참여 {patJoins.length}{pat.max_members ? `/${pat.max_members}` : ""}명
                    </span>
                    {patJoins.slice(0, 5).map(j => (
                      <span key={j.id} style={{ fontSize:12, padding:"2px 8px", borderRadius:"var(--r-pill)", background: j.member_id === pat.creator_member_id ? "#FFF4CC" : "var(--bg-2)", color: j.member_id === pat.creator_member_id ? "#9A7B00" : "var(--text-2)", fontWeight: j.member_id === pat.creator_member_id ? 700 : 400 }}>
                        {j.member_id === pat.creator_member_id ? "👑 " : ""}{j.member_name}
                      </span>
                    ))}
                    {patJoins.length > 5 && <span style={{ fontSize:12, color:"var(--text-3)" }}>+{patJoins.length - 5}명</span>}
                  </div>
                </button>

                {/* 펼침: 식당 상세 + 액션 */}
                {isExpanded && (
                  <div style={{ borderTop:"1px solid var(--border)", padding:"12px 14px 14px" }}>
                    {/* 식당 상세 카드 */}
                    {pat.restaurant_name && (
                      <div style={{ background:"var(--bg)", borderRadius:12, padding:"12px 14px", marginBottom:12, border:"1px solid var(--border)" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                          <p style={{ fontFamily:"var(--font-display)", fontSize:16, margin:0 }}>{pat.restaurant_name}</p>
                          {getClickCount(pat.restaurant_name, placeClicks) >= 5 && (
                            <span style={{ fontSize:11, padding:"2px 8px", borderRadius:99, background:"#FFF0E0", color:"#D65000", fontWeight:700 }}>
                              🔥 많이 찾아봤어요
                            </span>
                          )}
                        </div>
                        {pat.restaurant_address && (
                          <p style={{ fontSize:12, color:"var(--text-2)", margin:"0 0 10px" }}>📍 {pat.restaurant_address}</p>
                        )}
                        {/* SNS / 홈페이지 링크 */}
                        {pat.restaurant_link && (() => {
                          const url = pat.restaurant_link;
                          let snsLabel = "";
                          let snsBg = "";
                          let snsColor = "#fff";
                          if (url.includes("instagram.com")) { snsLabel = "Instagram"; snsBg = "#E1306C"; }
                          else if (url.includes("youtube.com") || url.includes("youtu.be")) { snsLabel = "YouTube"; snsBg = "#FF0000"; }
                          else if (url.includes("facebook.com")) { snsLabel = "Facebook"; snsBg = "#1877F2"; }
                          else if (url.includes("blog.naver.com")) { snsLabel = "N 블로그"; snsBg = "#03C75A"; }
                          else if (url.includes("twitter.com") || url.includes("x.com")) { snsLabel = "X"; snsBg = "#000"; }
                          else if (url.includes("tiktok.com")) { snsLabel = "TikTok"; snsBg = "#010101"; }
                          else if (!url.includes("map.kakao") && !url.includes("naver.me") && !url.includes("place.naver") && !url.includes("smartplace.naver") && !url.includes("store.naver.com")) {
                            snsLabel = "홈페이지"; snsBg = "var(--bg-2)"; snsColor = "var(--text-2)";
                          }
                          if (!snsLabel) return null;
                          return (
                            <a href={url} target="_blank" rel="noopener noreferrer"
                              onClick={() => trackPlaceClick(pat.restaurant_name!)}
                              style={{ display:"inline-block", marginBottom:10, padding:"5px 12px", borderRadius:"var(--r-pill)", background:snsBg, color:snsColor, fontSize:12, fontWeight:700, textDecoration:"none", border: snsBg === "var(--bg-2)" ? "1px solid var(--border)" : "none" }}>
                              🔗 {snsLabel}
                            </a>
                          );
                        })()}
                        <div style={{ display:"flex", gap:8 }}>
                          <a href={(() => {
                            const url = pat.restaurant_link || "";
                            if (url.includes("place.map.kakao") || url.includes("map.kakao.com/link")) return url;
                            return `https://map.kakao.com/link/search/${encodeURIComponent(pat.restaurant_name)}`;
                          })()}
                            target="_blank" rel="noopener noreferrer"
                            onClick={() => trackPlaceClick(pat.restaurant_name!)}
                            style={{ flex:1, padding:"8px", borderRadius:10, background:"#FAE100", color:"#3A1D1D", fontSize:12, fontWeight:800, textDecoration:"none", textAlign:"center" }}>
                            카카오맵
                          </a>
                          <a href={(() => {
                            const url = pat.restaurant_link || "";
                            if (url.includes("store.naver.com") || url.includes("naver.me") || url.includes("smartplace.naver")) return url;
                            return `https://map.naver.com/p/search/${encodeURIComponent(pat.restaurant_name)}`;
                          })()}
                            target="_blank" rel="noopener noreferrer"
                            onClick={() => trackPlaceClick(pat.restaurant_name!)}
                            style={{ flex:1, padding:"8px", borderRadius:10, background:"#03C75A", color:"#fff", fontSize:12, fontWeight:800, textDecoration:"none", textAlign:"center" }}>
                            네이버맵
                          </a>
                          <a href={`https://www.google.com/maps/search/?q=${encodeURIComponent(pat.restaurant_name + (pat.restaurant_address ? " " + pat.restaurant_address : ""))}&hl=ko`}
                            target="_blank" rel="noopener noreferrer"
                            onClick={() => trackPlaceClick(pat.restaurant_name!)}
                            style={{ flex:1, padding:"8px", borderRadius:10, background:"#4285F4", color:"#fff", fontSize:12, fontWeight:800, textDecoration:"none", textAlign:"center" }}>
                            구글맵
                          </a>
                        </div>
                      </div>
                    )}
                    {/* 액션 버튼 */}
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      {canParticipate && !myJoin && !full && (
                        <button className="tap" onClick={() => joinPat(pat)} style={{
                          flex:1, padding:"9px", borderRadius:"var(--r-pill)", border:"none",
                          background:"var(--primary)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer",
                        }}>
                          🙋 참여하기
                        </button>
                      )}
                      {canParticipate && myJoin && !isCreator && (
                        <button className="tap" onClick={() => leavePat(pat)} style={{
                          flex:1, padding:"9px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)",
                          background:"transparent", color:"var(--text-2)", fontSize:13, cursor:"pointer",
                        }}>
                          나가기
                        </button>
                      )}
                      {full && !myJoin && (
                        <span style={{ flex:1, padding:"9px", textAlign:"center", fontSize:13, color:"var(--text-3)" }}>마감됨</span>
                      )}
                      {/* 초대 링크 복사 */}
                      <button className="tap" onClick={() => copyInviteLink(pat.id)} style={{
                        padding:"9px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)",
                        background: copiedPatId === pat.id ? "var(--green-soft)" : "transparent",
                        color: copiedPatId === pat.id ? "var(--green)" : "var(--text-2)", fontSize:12, cursor:"pointer",
                        display:"flex", alignItems:"center", gap:4,
                      }}>
                        {copiedPatId === pat.id ? "✓ 복사됨" : "🔗 초대"}
                      </button>
                      {(isCreator || isOwner) && (
                        <button className="tap" onClick={() => closePat(pat.id)} style={{
                          padding:"9px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)",
                          background:"transparent", color:"var(--text-3)", fontSize:12, cursor:"pointer",
                        }}>
                          마감
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 종료된 팟 */}
      {closed.length > 0 && (
        <div style={{ padding:"16px 16px 0" }}>
          <p style={{ fontSize:12, color:"var(--text-3)", fontWeight:700, marginBottom:8 }}>종료된 팟</p>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {closed.slice(0, 5).map(pat => {
              const patJoins = joins[pat.id] || [];
              return (
                <div key={pat.id} style={{ padding:"12px 14px", borderRadius:14, background:"var(--bg-2)", opacity:0.7 }}>
                  <p style={{ fontSize:14, color:"var(--text-2)", marginBottom:4 }}>{pat.title}</p>
                  <span style={{ fontSize:11, color:"var(--text-3)" }}>{patJoins.length}명 참여 · {timeSince(pat.created_at)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 팟 만들기 모달 */}
      {showCreate && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:90 }}
          onClick={() => setShowCreate(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"24px 24px 0 0", padding:"20px 20px calc(32px + env(safe-area-inset-bottom, 0px))", width:"100%", maxWidth:480, maxHeight:"85vh", overflowY:"auto" }}>
            <div style={{ width:40, height:5, borderRadius:99, background:"var(--border)", margin:"0 auto 16px" }} />
            <p style={{ fontFamily:"var(--font-display)", fontSize:18, marginBottom:16 }}>🍚 먹자팟 만들기</p>

            {/* 메뉴 입력 */}
            <p style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>먹고 싶은 메뉴 *</p>
            <input
              value={menuInput}
              onChange={e => { setMenuInput(e.target.value); setTitleIdx(0); setUseCustom(false); }}
              placeholder="예: 삼겹살, 떡볶이, 라멘…"
              style={{ width:"100%", padding:"11px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--bg)", fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:12 }}
            />

            {/* 자동 생성 제목 */}
            {menuInput.trim() && (
              <>
                <p style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>팟 제목</p>
                {!useCustom ? (
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
                    <div style={{ flex:1, padding:"11px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--primary)", background:"var(--primary-soft, #FFF0EC)", fontSize:14, color:"var(--text)" }}>
                      {generatedTitle}
                    </div>
                    <button onClick={() => setTitleIdx(i => (i + 1) % TITLE_TEMPLATES.length)}
                      style={{ padding:"9px 12px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--bg-2)", fontSize:13, cursor:"pointer", flexShrink:0 }}>
                      <img src="/mascot/tabs/refresh.png" style={{width:20, height:20, objectFit:"contain", verticalAlign:"middle"}} />
                    </button>
                  </div>
                ) : (
                  <input
                    value={customTitle}
                    onChange={e => setCustomTitle(e.target.value)}
                    placeholder="직접 입력"
                    style={{ width:"100%", padding:"11px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--primary)", background:"var(--bg)", fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:8 }}
                  />
                )}
                <button onClick={() => setUseCustom(v => !v)} style={{ fontSize:11, color:"var(--text-3)", background:"none", border:"none", cursor:"pointer", marginBottom:12, padding:0 }}>
                  {useCustom ? "← 자동 제목 사용" : "✏️ 직접 입력"}
                </button>
              </>
            )}

            {/* 식당 (선택) */}
            <p style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>식당 이름 (선택)</p>
            <input
              value={restaurantInput}
              onChange={e => setRestaurantInput(e.target.value)}
              placeholder="예: 강남 돼지집"
              style={{ width:"100%", padding:"11px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--bg)", fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:12 }}
            />

            {/* 시간 (선택) */}
            <p style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>식사 시간 (선택)</p>
            <input
              type="datetime-local"
              value={scheduledInput}
              onChange={e => setScheduledInput(e.target.value)}
              style={{ width:"100%", padding:"11px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--bg)", fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:12, color:"var(--text)" }}
            />

            {/* 최대 인원 (선택) */}
            <p style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>최대 인원 (선택)</p>
            <input
              type="number"
              min={2}
              max={20}
              value={maxInput}
              onChange={e => setMaxInput(e.target.value)}
              placeholder="예: 4"
              style={{ width:"100%", padding:"11px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--bg)", fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:16 }}
            />

            <div style={{ display:"flex", gap:10 }}>
              <button className="tap" onClick={() => setShowCreate(false)} style={{ flex:1, padding:"12px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-2)", fontSize:14, cursor:"pointer" }}>
                취소
              </button>
              <button className="tap" onClick={createPat} disabled={!menuInput.trim() || !finalTitle.trim() || creating}
                style={{ flex:2, padding:"12px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:14, cursor:"pointer" }}>
                {creating ? "만드는 중…" : "🍚 먹자팟 만들기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
