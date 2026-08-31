"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { bumpFoodScore, BEHAVIOR_WEIGHT } from "@/lib/behaviorScore";
import { suggestMenus, menuForStorage, canonicalizeMenu } from "@/lib/menuMatch";
import { showConfirm, toast } from "@/lib/dialog";
import { trackPlaceClick, fetchPlaceClickStats, getClickCount } from "@/lib/placeClicks";
import LoadingCat from "@/components/LoadingCat";

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
  /* 종료된 팟 보기: 날짜순 / 식당별 */
  const [closedSort, setClosedSort] = useState<"date" | "place">("date");
  const [expandedClosedId, setExpandedClosedId] = useState<string | null>(null);
  const [showAllClosed, setShowAllClosed] = useState(false);
  const [placeClicks, setPlaceClicks] = useState<Record<string, number>>({});
  /* "또 갈래?" 에 답한 팟. 기기에만 남긴다 — 표를 만들 만큼 무거운 값이 아니고,
     한 번 더 물어봐도 점수만 한 번 더 오를 뿐이라 위험하지 않다. */
  const [rated, setRated] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("meogja_pat_rated") || "[]"); } catch { return []; }
  });

  function markRated(patId: string) {
    setRated(prev => {
      const next = [...new Set([...prev, patId])].slice(-200);
      try { localStorage.setItem("meogja_pat_rated", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  /** 또 갈래? — 한 번 누르면 끝. 별점을 받으려 하면 아무도 안 쓴다. */
  async function askWouldRepeat(patId: string, menu: string) {
    const again = await showConfirm(
      "또 먹으러 갈 만했나요? 다음 추천에 반영해드려요.",
      { title: `${menu} 어땠어요?`, icon: "🍚", confirmLabel: "또 갈래요 👍" },
    );
    markRated(patId); // 아니라고 해도 다시 묻지 않는다
    if (!again) return;
    const canon = canonicalizeMenu(menu);
    if (canon) {
      await bumpFoodScore(canon, BEHAVIOR_WEIGHT.wouldRepeat);
      toast(`${canon} 취향에 반영했어요`);
    } else {
      // 사전에 없는 이름 — 고맙다는 말은 하고, 점수는 쌓지 않는다
      toast("알려주셔서 고마워요");
    }
  }

  const generatedTitle = menuInput.trim() ? TITLE_TEMPLATES[titleIdx](menuInput.trim()) : "";
  const menuSuggestions = suggestMenus(menuInput, 6);
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
      /* 표준 이름이 있으면 그것을 저장한다. 사용자가 쓴 원문은 제목에 남아 있다
         ("삼겹" 으로 적어도 삼겹살로 모여야 집계와 취향 반영이 맞는다). */
      menu: menuForStorage(menuInput).menu,
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
    /* 먹으러 가겠다고 한 것 — 설문보다 센 신호다.
       🔴 사전에 없는 이름으로는 점수를 쌓지 않는다(오타가 취향 테이블에 남는다). */
    const canon = canonicalizeMenu(pat.menu);
    if (canon) void bumpFoodScore(canon, BEHAVIOR_WEIGHT.joinedPat);
  }

  async function leavePat(pat: MealPat) {
    if (!myMemberId) return;
    await getSupabase().from("meal_pat_joins").delete()
      .eq("pat_id", pat.id).eq("member_id", myMemberId);
  }

  /** 확정 — 이 팟으로 간다. 오늘의 결정으로 기록하고 멤버에게 알린다.
   *  🔴 만든 사람과 모임장만 부를 수 있다(호출부에서 막고, 여기서 한 번 더 본다). */
  async function confirmPat(pat: MealPat) {
    if (!(pat.creator_member_id === myMemberId || isOwner)) return;
    const target = pat.restaurant_name || pat.menu;
    const ok = await showConfirm(
      `${target}(으)로 확정하고 오늘의 메뉴로 기록할까요?`,
      { title: "먹자팟 확정", icon: "🎯", confirmLabel: "확정하기" },
    );
    if (!ok) return;

    await getSupabase().from("meal_pats").update({ status: "closed" }).eq("id", pat.id);

    // 오늘의 결정으로 남긴다 — 기록 탭이 이걸 보여준다
    await getSupabase().from("group_decisions").insert({
      group_id: groupId,
      food_name: pat.menu,
      restaurant_name: pat.restaurant_name,
      restaurant_address: pat.restaurant_address,
      restaurant_link: pat.restaurant_link,
      decided_by_name: myMemberName || pat.creator_name,
    });

    // 참여자에게 알린다
    const patJoins = joins[pat.id] || [];
    const memberIds = patJoins.map(j => j.member_id).filter(mid => mid !== myMemberId);
    if (memberIds.length > 0) {
      try {
        const { data: mem } = await getSupabase().from("members").select("user_id").in("id", memberIds);
        const userIds = (mem || []).map(m => m.user_id).filter(Boolean);
        if (userIds.length > 0) {
          fetch("/api/push/notify-group", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              groupId: null, userIds,
              title: `🎯 ${target}(으)로 확정!`,
              body: `${myMemberName || pat.creator_name}님이 먹자팟을 확정했어요`,
              url: `/groups/${groupId}?tab=pat&pat=${pat.id}`,
              excludeUserId: currentUserId || undefined,
            }),
          }).catch(() => {/* 알림 실패는 넘긴다 */});
        }
      } catch { /* 알림 실패는 넘긴다 */ }
    }
    toast(`${target}(으)로 확정했어요 🎉`);
    loadPats();
  }

  /** 취소 — 팟을 지운다. 확정된 팟이면 그때 남긴 결정 기록도 함께 지운다
   *  (안 지우면 가지도 않은 가게가 기록에 남는다). */
  async function deletePat(pat: MealPat) {
    if (!(pat.creator_member_id === myMemberId || isOwner)) return;
    const ok = await showConfirm(
      "먹자팟을 취소하고 삭제할까요? 참여자 목록도 함께 사라져요.",
      { title: "먹자팟 취소", icon: "🗑️", danger: true, confirmLabel: "삭제" },
    );
    if (!ok) return;

    if (pat.status === "closed") {
      /* 이 팟을 확정하며 남긴 기록만 지운다. 팟이 만들어지기 전에 남은 결정은
         다른 경로(투표·결정하기)로 정한 것이라 건드리면 안 된다. */
      const q = getSupabase().from("group_decisions").select("id").eq("group_id", groupId)
        .gte("decided_at", pat.created_at)
        .order("decided_at", { ascending: false }).limit(1);
      const { data: dec } = pat.restaurant_name
        ? await q.eq("restaurant_name", pat.restaurant_name)
        : await q.eq("food_name", pat.menu).is("restaurant_name", null);
      if (dec?.[0]) await getSupabase().from("group_decisions").delete().eq("id", dec[0].id);
    }

    await getSupabase().from("meal_pat_joins").delete().eq("pat_id", pat.id);
    await getSupabase().from("meal_pats").delete().eq("id", pat.id);
    setExpandedPatId(prev => prev === pat.id ? null : prev);
    toast("먹자팟을 삭제했어요");
    loadPats();
  }

  /** 내가 이 팟에 참여했나 (또 갈래? 는 같이 먹은 사람에게만 묻는다) */
  function joinedThis(patId: string): boolean {
    if (!myMemberId) return false;
    return (joins[patId] || []).some(j => j.member_id === myMemberId);
  }

  /* 알림("또 갈 만했어요?")을 눌러 들어온 경우 — 주소의 rate 를 보고 바로 묻는다.
     한 번만 뜨게 ref 로 막는다(목록이 실시간으로 갱신되므로 effect 가 여러 번 돈다). */
  const ratePromptedRef = useRef(false);
  useEffect(() => {
    if (ratePromptedRef.current || loading || pats.length === 0) return;
    const id = new URLSearchParams(window.location.search).get("rate");
    if (!id) return;
    const pat = pats.find(p => p.id === id);
    if (!pat) return;
    ratePromptedRef.current = true;
    if (!rated.includes(id) && (joins[id] || []).some(j => j.member_id === myMemberId)) {
      /* 렌더가 끝난 뒤에 띄운다 — effect 안에서 바로 부르면 상태 변경이 렌더에
         물려 연쇄가 생긴다(eslint react-hooks/set-state-in-effect). */
      const t = setTimeout(() => { void askWouldRepeat(id, pat.menu); }, 0);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pats, joins]);

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

      {loading && <LoadingCat />}

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
                      {/* 확정·취소는 만든 사람과 모임장만 */}
                      {(isCreator || isOwner) && (
                        <>
                          <button className="tap" onClick={() => confirmPat(pat)} style={{
                            padding:"9px 14px", borderRadius:"var(--r-pill)", border:"none",
                            background:"var(--green, #17A34A)", color:"#fff", fontSize:12.5, fontWeight:800, cursor:"pointer",
                          }}>
                            ✅ 확정
                          </button>
                          <button className="tap" onClick={() => deletePat(pat)} style={{
                            padding:"9px 12px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)",
                            background:"transparent", color:"var(--text-3)", fontSize:12, cursor:"pointer",
                          }}>
                            🗑️ 취소
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 종료된 팟 — 눌러서 누가 갔고 어디였는지 다 볼 수 있다 */}
      {closed.length > 0 && (() => {
        const mapUrl = (kind: "kakao" | "naver" | "google", pat: MealPat) => {
          const name = pat.restaurant_name || "";
          const addr = pat.restaurant_address ? " " + pat.restaurant_address : "";
          if (kind === "kakao") return `https://map.kakao.com/link/search/${encodeURIComponent(name)}`;
          if (kind === "naver") return `https://map.naver.com/p/search/${encodeURIComponent(name + addr)}`;
          return `https://www.google.com/maps/search/?q=${encodeURIComponent(name + addr)}&hl=ko`;
        };

        const card = (pat: MealPat) => {
          const patJoins = joins[pat.id] || [];
          const isExpanded = expandedClosedId === pat.id;
          const canManage = pat.creator_member_id === myMemberId || isOwner;
          return (
            <div key={pat.id} style={{ borderRadius:14, background:"var(--bg-2)", overflow:"hidden" }}>
              <button className="tap" onClick={() => setExpandedClosedId(isExpanded ? null : pat.id)}
                style={{ width:"100%", textAlign:"left", background:"none", border:"none", cursor:"pointer", padding:"12px 14px" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                  <p style={{ fontSize:14, color:"var(--text-2)", margin:0, flex:1, minWidth:0 }}>{pat.title}</p>
                  <span style={{ fontSize:13, color:"var(--text-3)", transform: isExpanded ? "rotate(180deg)" : "none", transition:"transform .2s" }}>▾</span>
                </div>
                <span style={{ fontSize:11, color:"var(--text-3)" }}>
                  {pat.restaurant_name ? `📍 ${pat.restaurant_name} · ` : ""}{patJoins.length}명 참여 · {new Date(pat.created_at).toLocaleDateString("ko-KR", { month:"numeric", day:"numeric" })}
                </span>
              </button>

              {isExpanded && (
                <div style={{ padding:"0 14px 14px", borderTop:"1px solid var(--border)" }}>
                  <p style={{ fontSize:11, fontWeight:700, color:"var(--text-3)", margin:"12px 0 6px" }}>같이 먹은 사람</p>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
                    {patJoins.length === 0 && <span style={{ fontSize:12, color:"var(--text-3)" }}>참여자 기록이 없어요</span>}
                    {patJoins.map(j => (
                      <span key={j.id} style={{ fontSize:12, padding:"3px 9px", borderRadius:"var(--r-pill)", background: j.member_id === pat.creator_member_id ? "#FFF4CC" : "var(--surface)", color: j.member_id === pat.creator_member_id ? "#9A7B00" : "var(--text-2)", fontWeight: j.member_id === pat.creator_member_id ? 700 : 400 }}>
                        {j.member_id === pat.creator_member_id ? "👑 " : ""}{j.member_name}
                      </span>
                    ))}
                  </div>

                  {pat.restaurant_name ? (
                    <div style={{ background:"var(--surface)", borderRadius:12, padding:"12px 14px", border:"1px solid var(--border)" }}>
                      <p style={{ fontFamily:"var(--font-display)", fontSize:15, margin:"0 0 3px" }}>{pat.restaurant_name}</p>
                      {pat.restaurant_address && <p style={{ fontSize:12, color:"var(--text-2)", margin:"0 0 10px" }}>📍 {pat.restaurant_address}</p>}
                      <div style={{ display:"flex", gap:6 }}>
                        <a href={mapUrl("kakao", pat)} target="_blank" rel="noopener noreferrer" onClick={() => trackPlaceClick(pat.restaurant_name!)}
                          style={{ flex:1, padding:"7px", borderRadius:9, background:"#FAE100", color:"#3A1D1D", fontSize:12, fontWeight:800, textDecoration:"none", textAlign:"center" }}>카카오맵</a>
                        <a href={mapUrl("naver", pat)} target="_blank" rel="noopener noreferrer" onClick={() => trackPlaceClick(pat.restaurant_name!)}
                          style={{ flex:1, padding:"7px", borderRadius:9, background:"#03C75A", color:"#fff", fontSize:12, fontWeight:800, textDecoration:"none", textAlign:"center" }}>네이버맵</a>
                        <a href={mapUrl("google", pat)} target="_blank" rel="noopener noreferrer" onClick={() => trackPlaceClick(pat.restaurant_name!)}
                          style={{ flex:1, padding:"7px", borderRadius:9, background:"#4285F4", color:"#fff", fontSize:12, fontWeight:800, textDecoration:"none", textAlign:"center" }}>구글맵</a>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize:12.5, color:"var(--text-3)" }}>메뉴만 정한 팟이에요 · {pat.menu}</p>
                  )}

                  <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
                    {joinedThis(pat.id) && !rated.includes(pat.id) && (
                      <button className="tap" onClick={() => askWouldRepeat(pat.id, pat.menu)} style={{
                        flex:1, padding:"9px 14px", borderRadius:"var(--r-pill)",
                        border:"1.5px solid var(--primary)", background:"transparent", color:"var(--primary)",
                        fontSize:12.5, fontWeight:700, cursor:"pointer",
                      }}>
                        🍚 {pat.menu} 또 갈래요?
                      </button>
                    )}
                    {canManage && (
                      <button className="tap" onClick={() => deletePat(pat)} style={{
                        padding:"9px 12px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)",
                        background:"transparent", color:"var(--text-3)", fontSize:12, cursor:"pointer",
                      }}>
                        🗑️ 삭제
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        };

        const list = showAllClosed ? closed : closed.slice(0, 8);
        /* 식당별 보기: 같은 가게에 몇 번 갔는지 한눈에 보인다.
           🔴 세는 것은 전체 기록이다 — 화면에 보이는 8개만 세면 "3번" 이 거짓말이 된다. */
        const byPlace = (() => {
          const m = new Map<string, MealPat[]>();
          closed.forEach(pat => {
            const key = pat.restaurant_name || pat.menu;
            if (!m.has(key)) m.set(key, []);
            m.get(key)!.push(pat);
          });
          return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
        })();

        return (
          <div style={{ padding:"16px 16px 0" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, gap:8 }}>
              <p style={{ fontSize:12, color:"var(--text-3)", fontWeight:700, margin:0 }}>종료된 팟 {closed.length}개</p>
              <div style={{ display:"flex", background:"var(--bg-2)", borderRadius:99, padding:2, gap:2 }}>
                {([["date","날짜순"],["place","식당별"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setClosedSort(k)} style={{
                    padding:"5px 12px", borderRadius:99, border:"none", cursor:"pointer", fontSize:11.5, fontWeight:700,
                    background: closedSort === k ? "var(--text)" : "transparent",
                    color: closedSort === k ? "#fff" : "var(--text-3)",
                  }}>{label}</button>
                ))}
              </div>
            </div>

            {closedSort === "date" ? (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {list.map(card)}
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {byPlace.map(([place, pats2]) => (
                  <div key={place}>
                    <p style={{ fontSize:12.5, fontWeight:700, marginBottom:6 }}>
                      {place} <span style={{ color:"var(--text-3)", fontWeight:500 }}>· {pats2.length}번</span>
                    </p>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {pats2.map(card)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {closed.length > 8 && !showAllClosed && (
              <button className="tap" onClick={() => setShowAllClosed(true)} style={{
                width:"100%", marginTop:10, padding:"10px", borderRadius:12, border:"1.5px solid var(--border)",
                background:"transparent", color:"var(--text-2)", fontSize:12.5, fontWeight:700, cursor:"pointer",
              }}>
                지난 팟 더 보기 ({closed.length - 8}개)
              </button>
            )}
          </div>
        );
      })()}

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
              style={{ width:"100%", padding:"11px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--bg)", fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:8 }}
            />

            {/* 후보 — 고르면 표준 이름으로 저장된다. 자유 입력도 그대로 받는다
                (막으면 답답하고, 우리 사전에 없는 메뉴도 있다). */}
            {menuSuggestions.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
                {menuSuggestions.map(m => (
                  <button key={m} className="tap" onClick={() => { setMenuInput(m); setTitleIdx(0); setUseCustom(false); }}
                    style={{ padding:"6px 12px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)",
                      background:"var(--bg-2)", color:"var(--text-2)", fontSize:13, cursor:"pointer" }}>
                    {m}
                  </button>
                ))}
              </div>
            )}
            {/* 사전에 없는 이름이면 알려 준다 — 아이콘도 취향 반영도 안 되는 이유가 있다 */}
            {menuInput.trim().length >= 2 && !canonicalizeMenu(menuInput) && (
              <p style={{ fontSize:11.5, color:"var(--text-3)", margin:"0 0 12px", lineHeight:1.5 }}>
                우리 메뉴 목록에 없는 이름이에요. 그대로 만들 수 있지만, 취향 반영과 아이콘은 목록에 있는 이름일 때 동작해요.
              </p>
            )}

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
