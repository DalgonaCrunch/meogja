"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { trackPlaceClick } from "@/lib/placeClicks";
import { getFoodIconUrl } from "@/lib/foodIcons";
import { toast } from "@/lib/dialog";

interface VoteOption { name: string; emoji?: string; address?: string; category?: string; }
interface MenuVote {
  id: string;
  group_id: string;
  created_by: string | null;
  title: string;
  options: VoteOption[];
  is_anonymous: boolean;
  ends_at: string | null;
  is_closed: boolean;
  created_at: string;
}
interface VoteResponse {
  id: string;
  vote_id: string;
  voter_id: string | null;
  voter_name: string;
  chosen_option: string;
  created_at: string;
}

type DecideCallback = (foodName: string, restaurantName: string | null, address: string | null, link: string | null, voteId: string) => void;

export default function VoteTab({ groupId, isOwnerOrAdmin, onDecide }: { groupId: string; isOwnerOrAdmin: boolean; onDecide?: DecideCallback }) {
  const [votes, setVotes] = useState<MenuVote[]>([]);
  const [responses, setResponses] = useState<Record<string, VoteResponse[]>>({});
  const [myVotes, setMyVotes] = useState<Record<string, string>>({}); // voteId → chosen
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("게스트");
  const [isMember, setIsMember] = useState(false);
  const [decidedVotes, setDecidedVotes] = useState<Set<string>>(new Set());
  const [collapsedVotes, setCollapsedVotes] = useState<Set<string>>(new Set());
  const [restaurantImages, setRestaurantImages] = useState<Record<string, string>>({});

  useEffect(() => {
    // DB에서 이미 결정된 vote_id 목록 로드
    getSupabase()
      .from("group_decisions")
      .select("vote_id")
      .eq("group_id", groupId)
      .not("vote_id", "is", null)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setDecidedVotes(new Set(data.map((d: { vote_id: string }) => d.vote_id)));
        }
      });
  }, [groupId]);

  useEffect(() => {
    getCurrentUser().then(async u => {
      let uid: string | null = null;
      if (u.type === "auth") {
        uid = u.user.id;
        setCurrentUserId(uid);
        const { data: profile } = await getSupabase().from("user_profiles").select("display_name").eq("id", uid).single();
        const name = profile?.display_name || u.user.email?.split("@")[0] || "사용자";
        setCurrentUserName(name);
        // 멤버십 확인
        const { data: owner } = await getSupabase().from("groups").select("owner_id").eq("id", groupId).single();
        if (owner?.owner_id === uid) { setIsMember(true); }
        else {
          const { data: membership } = await getSupabase().from("group_memberships").select("id").eq("group_id", groupId).eq("user_id", uid).single();
          if (membership) setIsMember(true);
        }
      }
      loadVotes(uid);
    });
  }, [groupId]);

  async function loadVotes(userId: string | null = null) {
    setLoading(true);
    const { data: voteData } = await getSupabase()
      .from("menu_votes").select("*").eq("group_id", groupId).order("created_at", { ascending: false });
    if (!voteData) { setLoading(false); return; }
    setVotes(voteData);
    // 마감된 투표 기본 접기
    const closedIds = voteData
      .filter(v => v.is_closed || (v.ends_at && new Date(v.ends_at) < new Date()))
      .map(v => v.id);
    setCollapsedVotes(new Set(closedIds));

    // 식당 이미지 — sessionStorage 캐시 우선, 없으면 API fetch
    const SS_IMG_KEY = `voteImages_${groupId}`;
    let cached: Record<string, string> = {};
    try { cached = JSON.parse(sessionStorage.getItem(SS_IMG_KEY) || "{}"); } catch { /* ignore */ }
    if (Object.keys(cached).length > 0) setRestaurantImages(cached);

    const optionNames: string[] = [];
    voteData.forEach(v => v.options?.forEach((o: VoteOption) => { if (o.address && !cached[o.name]) optionNames.push(o.name); }));
    optionNames.slice(0, 15).forEach(async (name) => {
      try {
        const r = await fetch(`/api/food-image?query=${encodeURIComponent(name)}`);
        const d = await r.json();
        if (d.url) {
          cached = { ...cached, [name]: d.url };
          setRestaurantImages(prev => ({ ...prev, [name]: d.url }));
          try { sessionStorage.setItem(SS_IMG_KEY, JSON.stringify(cached)); } catch { /* ignore */ }
        }
      } catch { /* fallback */ }
    });

    const ids = voteData.map(v => v.id);
    if (ids.length > 0) {
      const { data: respData } = await getSupabase().from("menu_vote_responses").select("*").in("vote_id", ids);
      const respMap: Record<string, VoteResponse[]> = {};
      respData?.forEach(r => {
        if (!respMap[r.vote_id]) respMap[r.vote_id] = [];
        respMap[r.vote_id].push(r);
      });
      setResponses(respMap);

      const uid = userId ?? currentUserId;
      const myMap: Record<string, string> = {};
      respData?.forEach(r => {
        if (uid && r.voter_id === uid) myMap[r.vote_id] = r.chosen_option;
      });
      setMyVotes(myMap);
    }
    setLoading(false);
  }

  async function submitVote(voteId: string, option: string) {
    if (!currentUserId) { toast("로그인 후 투표할 수 있어요"); return; }
    if (!isMember && !isOwnerOrAdmin) { toast("모임 멤버만 투표할 수 있어요"); return; }

    const prevChoice = myVotes[voteId];

    // 같은 옵션 다시 클릭 → 취소
    if (prevChoice === option) {
      const { error: delErr } = await getSupabase().from("menu_vote_responses")
        .delete().eq("vote_id", voteId).eq("voter_id", currentUserId);
      if (delErr) { toast("취소에 실패했어요"); return; }
      setMyVotes(prev => { const n = { ...prev }; delete n[voteId]; return n; });
      setResponses(prev => ({
        ...prev,
        [voteId]: (prev[voteId] || []).filter(r => r.voter_id !== currentUserId),
      }));
      toast("투표를 취소했어요");
      return;
    }

    // 다른 옵션 클릭 → 변경 또는 신규
    const { error } = await getSupabase().from("menu_vote_responses").upsert({
      vote_id: voteId,
      voter_id: currentUserId,
      voter_name: currentUserName,
      chosen_option: option,
    }, { onConflict: "vote_id,voter_id" });
    if (!error) {
      setMyVotes(prev => ({ ...prev, [voteId]: option }));
      setResponses(prev => {
        const existing = (prev[voteId] || []).filter(r => r.voter_id !== currentUserId);
        return { ...prev, [voteId]: [...existing, { id: "temp", vote_id: voteId, voter_id: currentUserId, voter_name: currentUserName, chosen_option: option, created_at: new Date().toISOString() }] };
      });
      toast(prevChoice ? "✅ 투표를 변경했어요!" : "✅ 투표 완료!");
    }
  }

  async function closeVote(voteId: string) {
    await getSupabase().from("menu_votes").update({ is_closed: true }).eq("id", voteId);
    setVotes(prev => prev.map(v => v.id === voteId ? { ...v, is_closed: true } : v));
    setCollapsedVotes(prev => new Set([...prev, voteId]));
  }

  async function deleteVote(voteId: string) {
    await getSupabase().from("menu_vote_responses").delete().eq("vote_id", voteId);
    await getSupabase().from("menu_votes").delete().eq("id", voteId);
    setVotes(prev => prev.filter(v => v.id !== voteId));
  }

  function toggleCollapse(voteId: string) {
    setCollapsedVotes(prev => {
      const next = new Set(prev);
      if (next.has(voteId)) next.delete(voteId); else next.add(voteId);
      return next;
    });
  }

  if (loading) return <div style={{ padding:32, textAlign:"center", color:"var(--text-2)" }}>불러오는 중…</div>;

  return (
    <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:16 }}>
      {/* 투표 없을 때 */}
      {votes.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px 16px" }}>
          <p style={{ fontSize:32, marginBottom:8 }}>🗳️</p>
          <p style={{ fontSize:14, color:"var(--text-2)" }}>아직 진행 중인 투표가 없어요</p>
          {isOwnerOrAdmin
            ? <p style={{ fontSize:12, color:"var(--text-3)", marginTop:6 }}>추천 탭에서 식당을 검색한 후 투표 버튼을 눌러 투표를 만들 수 있어요</p>
            : <p style={{ fontSize:12, color:"var(--text-3)", marginTop:6 }}>모임장이 식당 검색 후 투표를 만들 수 있어요</p>}
        </div>
      )}

      {/* 투표 카드 목록 */}
      {votes.map(vote => {
        const resps = responses[vote.id] || [];
        const totalVotes = resps.length;
        const myChoice = myVotes[vote.id];
        const isExpired = vote.ends_at && new Date(vote.ends_at) < new Date();
        const isClosed = vote.is_closed || !!isExpired;
        const showResults = !!myChoice || isClosed;
        const canVote = !!currentUserId && (isMember || isOwnerOrAdmin);

        const counts: Record<string, number> = {};
        vote.options.forEach(o => { counts[o.name] = 0; });
        resps.forEach(r => { counts[r.chosen_option] = (counts[r.chosen_option] || 0) + 1; });
        const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];

        const isCollapsed = collapsedVotes.has(vote.id);
        const canDelete = isOwnerOrAdmin || (currentUserId && vote.created_by === currentUserId);
        return (
          <div key={vote.id} style={{ borderRadius:16, background:"var(--surface)", border: isClosed ? "var(--card-border)" : "2px solid var(--primary)", boxShadow:"var(--card-shadow)", overflow:"hidden" }}>
            {/* 헤더 — 항상 표시 */}
            <div onClick={() => toggleCollapse(vote.id)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", cursor:"pointer", gap:8 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontFamily:"var(--font-display)", fontSize:15, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{vote.title}</p>
                <div style={{ display:"flex", gap:6, marginTop:4, flexWrap:"wrap" }}>
                  {vote.is_anonymous && <span style={{ fontSize:10, padding:"2px 7px", borderRadius:99, background:"var(--bg-2)", color:"var(--text-2)" }}>🔒 익명</span>}
                  {isClosed
                    ? <span style={{ fontSize:10, padding:"2px 7px", borderRadius:99, background:"var(--bg-2)", color:"var(--text-3)" }}>마감됨</span>
                    : <span style={{ fontSize:10, padding:"2px 7px", borderRadius:99, background:"var(--primary-light)", color:"var(--primary)" }}>진행 중</span>}
                  {vote.ends_at && !isClosed && <span style={{ fontSize:10, color:"var(--text-3)" }}>~{new Date(vote.ends_at).toLocaleDateString("ko-KR", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" })}</span>}
                  <span style={{ fontSize:10, color:"var(--text-3)" }}>{totalVotes}명 참여</span>
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }} onClick={e => e.stopPropagation()}>
                {isOwnerOrAdmin && !isClosed && (
                  <button onClick={() => closeVote(vote.id)} style={{ padding:"4px 10px", borderRadius:99, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-3)", fontSize:11, cursor:"pointer" }}>마감</button>
                )}
                {canDelete && (
                  <button onClick={async () => {
                    if (!confirm("투표를 삭제할까요?")) return;
                    await deleteVote(vote.id);
                  }} style={{ padding:"4px 8px", borderRadius:99, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-3)", fontSize:11, cursor:"pointer" }}>🗑️</button>
                )}
                <span style={{ fontSize:16, color:"var(--text-3)", transition:"transform .2s", transform: isCollapsed ? "" : "rotate(180deg)", display:"inline-block" }}>⌄</span>
              </div>
            </div>

            {/* 선택지 — 접힌 경우 숨김 */}
            {!isCollapsed && <><div style={{ padding:"0 16px 16px", display:"flex", flexDirection:"column", gap:8 }}>
              {vote.options.map(opt => {
                const cnt = counts[opt.name] || 0;
                const pct = totalVotes > 0 ? Math.round((cnt / totalVotes) * 100) : 0;
                const isMyChoice = myChoice === opt.name;
                const isWinner = isClosed && opt.name === winner;
                const restImg = restaurantImages[opt.name];
                const iconUrl = restImg || getFoodIconUrl(opt.name);
                const catLabel = opt.category ? opt.category.split(">").pop()?.trim() : null;

                const searchQuery = encodeURIComponent(opt.name + (opt.address ? ` ${opt.address.split(" ").slice(0,2).join(" ")}` : ""));
                return (
                  <div key={opt.name} style={{
                    borderRadius:12, border: isMyChoice ? "2px solid var(--primary)" : isWinner ? "2px solid var(--gold)" : "1.5px solid var(--border)",
                    background: isMyChoice ? "var(--primary-light)" : isWinner ? "#FFF8E6" : "var(--bg)",
                    overflow:"hidden",
                  }}>
                    <button className={canVote && !isClosed ? "tap" : ""}
                      onClick={() => { if (canVote && !isClosed) submitVote(vote.id, opt.name); }}
                      style={{
                        width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
                        background:"transparent", border:"none",
                        cursor: canVote && !isClosed ? "pointer" : "default", textAlign:"left",
                      }}>
                      {iconUrl
                        ? <img src={iconUrl} alt={opt.name} referrerPolicy="no-referrer" style={{ width:36, height:36, objectFit: restImg ? "cover" : "contain", borderRadius: restImg ? 8 : 0, flexShrink:0 }} />
                        : <img src="/mascot/tabs/food.png" style={{width:24, height:24, objectFit:"contain", flexShrink:0}} />}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom: showResults ? 4 : 0 }}>
                          <span style={{ fontSize:13, fontWeight: isMyChoice || isWinner ? 700 : 400, color:"var(--text)" }}>
                            {isWinner && "🏆 "}{opt.name}{isMyChoice && " ✓"}
                          </span>
                          {showResults && <span style={{ fontSize:12, fontWeight:700, color: isMyChoice ? "var(--primary)" : "var(--text-2)" }}>{pct}%</span>}
                        </div>
                        {(catLabel || opt.address) && (
                          <p style={{ fontSize:11, color:"var(--text-3)", marginBottom: showResults ? 4 : 0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                            {[catLabel, opt.address].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {showResults && (
                          <div style={{ height:4, borderRadius:99, background:"var(--bg-2)", overflow:"hidden" }}>
                            <div style={{ height:"100%", borderRadius:99, width:`${pct}%`, background: isMyChoice ? "var(--primary)" : isWinner ? "var(--gold)" : "var(--border-2)", transition:"width .5s" }} />
                          </div>
                        )}
                        {showResults && !vote.is_anonymous && resps.filter(r => r.chosen_option === opt.name).length > 0 && (
                          <p style={{ fontSize:10, color:"var(--text-3)", marginTop:3 }}>
                            {resps.filter(r => r.chosen_option === opt.name).map(r => r.voter_name).join(", ")}
                          </p>
                        )}
                      </div>
                      {showResults && <span style={{ fontSize:12, color:"var(--text-2)", flexShrink:0 }}>{cnt}표</span>}
                    </button>
                    {/* 지도 링크 */}
                    <div style={{ display:"flex", gap:6, padding:"0 12px 8px" }}>
                      <a href={`https://map.kakao.com/link/search/${searchQuery}`} target="_blank" rel="noopener noreferrer"
                        onClick={() => trackPlaceClick(opt.name)}
                        style={{ flex:1, padding:"5px 0", borderRadius:8, background:"#FAE100", color:"#3A1D1D", fontSize:11, fontWeight:700, textDecoration:"none", textAlign:"center" }}>
                        카카오맵
                      </a>
                      <a href={`https://map.naver.com/p/search/${searchQuery}`} target="_blank" rel="noopener noreferrer"
                        onClick={() => trackPlaceClick(opt.name)}
                        style={{ flex:1, padding:"5px 0", borderRadius:8, background:"#03C75A", color:"#fff", fontSize:11, fontWeight:700, textDecoration:"none", textAlign:"center" }}>
                        네이버맵
                      </a>
                      <a href={`https://www.google.com/maps/search/?q=${searchQuery}&hl=ko`} target="_blank" rel="noopener noreferrer"
                        onClick={() => trackPlaceClick(opt.name)}
                        style={{ flex:1, padding:"5px 0", borderRadius:8, background:"#4285F4", color:"#fff", fontSize:11, fontWeight:700, textDecoration:"none", textAlign:"center" }}>
                        구글맵
                      </a>
                    </div>
                    {/* 최종 결정 버튼 (모임장/관리자 or 투표 생성자, 투표 마감 후) */}
                    {(isOwnerOrAdmin || (currentUserId && vote.created_by === currentUserId)) && isClosed && onDecide && (
                      <div style={{ padding:"0 12px 10px" }}>
                        <button className="tap" disabled={decidedVotes.has(vote.id)} onClick={() => {
                          setDecidedVotes(prev => new Set([...prev, vote.id]));
                          onDecide(
                            opt.category?.split(">")?.[0]?.trim() || opt.name,
                            opt.name,
                            opt.address || null,
                            `https://map.kakao.com/link/search/${searchQuery}`,
                            vote.id
                          );
                          setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
                        }} style={{ width:"100%", padding:"8px", borderRadius:10, background: decidedVotes.has(vote.id) ? "var(--border)" : "var(--primary)", color: decidedVotes.has(vote.id) ? "var(--text-3)" : "#fff", fontSize:12, fontWeight:800, border:"none", cursor: decidedVotes.has(vote.id) ? "default" : "pointer", transition:"all .2s" }}>
                          {decidedVotes.has(vote.id) ? "✅ 결정됨" : "🎯 오늘은 이걸로 결정!"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

              {!isClosed && (
                <p style={{ fontSize:11, color:"var(--text-3)", marginTop:8, textAlign:"center" }}>
                  {!currentUserId ? "로그인 후 투표할 수 있어요"
                    : !isMember && !isOwnerOrAdmin ? "모임 멤버만 투표할 수 있어요"
                    : myChoice ? "선택한 메뉴를 다시 누르면 취소할 수 있어요"
                    : "메뉴를 선택하면 결과를 볼 수 있어요"}
                </p>
              )}
            </>}
          </div>
        );
      })}
    </div>
  );
}
