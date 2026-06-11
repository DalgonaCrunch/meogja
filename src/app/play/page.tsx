"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getDeviceId } from "@/lib/auth";
import { MBTI_FOOD, MBTI_LIST, randomMbtiFoods } from "@/lib/foodRecommend";
import { getFoodIconUrl } from "@/lib/foodIcons";
import WorldCup from "./WorldCup";

type Battle = {
  id: string;
  menu_a: string;
  menu_b: string;
  date: string;
  votes_a: number;
  votes_b: number;
  my_vote: "a" | "b" | null;
};

type Group = { id: string; name: string; description?: string; emoji?: string; };

const EMOJIS: Record<string, string> = {
  치킨:"🍗", 피자:"🍕", 삼겹살:"🥓", 초밥:"🍣", 마라탕:"🌶️", 떡볶이:"🌮",
  라멘:"🍜", 우동:"🍜", 스테이크:"🥩", 파스타:"🍝", 갈비:"🥩", 불고기:"🥩",
  족발:"🍖", 보쌈:"🥬", 냉면:"🍜", 국수:"🍜", 부대찌개:"🍲", 김치찌개:"🍲",
  돈카츠:"🍱", 카라아게:"🍗", 비빔밥:"🍚", 덮밥:"🍚", 짜장면:"🍜", 짬뽕:"🍜",
  순대국밥:"🍲", 설렁탕:"🍲",
};

function BattleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"worldcup"|"battle"|"mbti"|"ranking">(
    searchParams.get("tab") === "battle" ? "battle"
    : searchParams.get("tab") === "mbti" ? "mbti"
    : searchParams.get("tab") === "ranking" ? "ranking"
    : "worldcup"
  );
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [myMbti, setMyMbti] = useState<string>("");
  const [mbtiSaved, setMbtiSaved] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mbtiFoods, setMbtiFoods] = useState<string[]>([]);
  const [browsingMbti, setBrowsingMbti] = useState<string>("");
  const [browsingFoods, setBrowsingFoods] = useState<string[]>([]);
  const [resultKey, setResultKey] = useState(0);
  const [showBrowse, setShowBrowse] = useState(false);
  type RankItem = { food: string; wins: number; selects: number; searches: number; clicks: number; score: number };
  const [ranking, setRanking] = useState<RankItem[]>([]);
  const [rankLoading, setRankLoading] = useState(false);
  const [menuActionMenus, setMenuActionMenus] = useState<string[]>([]);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [battleGroups, setBattleGroups] = useState<Group[]>([]);

  useEffect(() => {
    loadBattles();
    loadMbti();
    window.history.pushState({ backGuard: true }, '');
    const onPop = () => { router.replace('/'); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  async function loadMbti() {
    const { data: { user } } = await getSupabase().auth.getUser();
    if (!user) return;
    setIsLoggedIn(true);
    const { data } = await getSupabase().from("user_profiles").select("mbti").eq("id", user.id).single();
    if (data?.mbti) {
      setMyMbti(data.mbti);
      setMbtiFoods(randomMbtiFoods(data.mbti, 4));
    }
    // 내 모임 목록 로드
    const { data: memberships } = await getSupabase().from("group_memberships").select("group_id").eq("user_id", user.id);
    const memberGroupIds = memberships?.map(m => m.group_id) || [];
    const { data: ownedGroups } = await getSupabase().from("groups").select("id,name,description,emoji").eq("owner_id", user.id);
    let memberGroups: Group[] = [];
    if (memberGroupIds.length > 0) {
      const { data: mg } = await getSupabase().from("groups").select("id,name,description,emoji").in("id", memberGroupIds);
      memberGroups = mg || [];
    }
    const allGroups = [...(ownedGroups || []), ...memberGroups];
    const seen = new Set<string>();
    setBattleGroups(allGroups.filter(g => { if (seen.has(g.id)) return false; seen.add(g.id); return true; }));
  }

  function goToSearch(menus: string[]) {
    if (menus.length > 0) sessionStorage.setItem("meogja_preset_menus", JSON.stringify(menus));
    const homeLoc = sessionStorage.getItem("meogja_home_location");
    if (homeLoc) {
      try {
        const loc = JSON.parse(homeLoc);
        sessionStorage.setItem("meogja_search_location", JSON.stringify({ lat: loc.lat, lng: loc.lng }));
      } catch { /* ignore */ }
    }
    router.push("/search");
  }

  async function saveMbti(mbti: string) {
    const { data: { user } } = await getSupabase().auth.getUser();
    if (!user) { setMyMbti(mbti); setMbtiFoods(randomMbtiFoods(mbti, 4)); setResultKey(k => k + 1); return; }
    await getSupabase().from("user_profiles").upsert({ id: user.id, mbti }, { onConflict: "id" });
    setMyMbti(mbti);
    setMbtiFoods(randomMbtiFoods(mbti, 4));
    setResultKey(k => k + 1);
    setMbtiSaved(true);
    setTimeout(() => setMbtiSaved(false), 2000);
  }

  function refreshMbtiFoods() {
    if (myMbti) { setMbtiFoods(randomMbtiFoods(myMbti, 4)); setResultKey(k => k + 1); }
  }

  function browseMbti(mbti: string) {
    setBrowsingMbti(mbti);
    setBrowsingFoods(randomMbtiFoods(mbti, 4));
  }

  async function loadRanking() {
    setRankLoading(true);
    try {
      const res = await fetch("/api/food-stats");
      const data = await res.json();
      setRanking(data.ranking || []);
    } catch { /* ignore */ }
    setRankLoading(false);
  }

  async function loadBattles() {
    const deviceId = getDeviceId();
    const { data: battleData } = await getSupabase()
      .from("menu_battles")
      .select("id, menu_a, menu_b, date")
      .order("date", { ascending: false })
      .limit(30);
    if (!battleData) { setLoading(false); return; }

    const withVotes = await Promise.all(battleData.map(async (b) => {
      const { data: votes } = await getSupabase()
        .from("menu_battle_votes").select("choice, voter_device_id").eq("battle_id", b.id);
      const va = votes?.filter(v => v.choice === "a").length || 0;
      const vb = votes?.filter(v => v.choice === "b").length || 0;
      const mine = votes?.find(v => v.voter_device_id === deviceId)?.choice as "a"|"b"|null || null;
      return { ...b, votes_a: va, votes_b: vb, my_vote: mine };
    }));
    setBattles(withVotes);
    setLoading(false);
  }

  const today = new Date().toISOString().slice(0,10);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0, paddingBottom:80 }}>
      <div style={{ padding:"16px 16px 0", position:"sticky", top:52, background:"var(--bg)", zIndex:10, borderBottom:"1px solid var(--border)" }}>
        <h1 style={{ fontFamily:"var(--font-display)", fontSize:22, marginBottom:12 }}>🎮 게임</h1>
        <div style={{ display:"flex", gap:0 }}>
          {([["worldcup","🏆 월드컵"],["battle","⚔️ 배틀"],["mbti","🧬 MBTI"],["ranking","ranking"]] as const).map(([t,label]) => (
            <button key={t} onClick={() => { setTab(t); if (t === "ranking") loadRanking(); }} style={{
              flex:1, padding:"10px 0", border:"none", background:"transparent", cursor:"pointer",
              fontFamily: tab===t ? "var(--font-display)" : "inherit",
              fontSize:12, fontWeight: tab===t ? 700 : 400,
              color: tab===t ? "var(--primary)" : "var(--text-3)",
              borderBottom: tab===t ? "2.5px solid var(--primary)" : "2.5px solid transparent",
              transition:"all .15s",
              display:"flex", alignItems:"center", justifyContent:"center", gap:4,
            }}>
              {t === "ranking"
                ? <><img src="/mascot/tabs/ranking.png" alt="랭킹" style={{ width:16, height:16, objectFit:"contain", opacity: tab===t ? 1 : 0.5 }} /> 랭킹</>
                : t === "worldcup"
                ? <><img src="/mascot/tabs/ranking.png" alt="월드컵" style={{ width:16, height:16, objectFit:"contain", opacity: tab===t ? 1 : 0.5 }} /> 월드컵</>
                : label}
            </button>
          ))}
        </div>
      </div>

      {tab === "worldcup" && (
        <div style={{ padding:"16px" }}>
          <WorldCup />
        </div>
      )}

      {tab === "battle" && loading && <div style={{ textAlign:"center", padding:40, color:"var(--text-2)" }}>불러오는 중…</div>}
      {tab === "battle" && !loading && (

      <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:12 }}>
        {battles.map((b) => {
          const total = b.votes_a + b.votes_b;
          const pctA = total > 0 ? Math.round(b.votes_a / total * 100) : 50;
          const pctB = 100 - pctA;
          const isToday = b.date === today;
          const winnerIsA = pctA > pctB;
          const tied = pctA === pctB;

          return (
            <div key={b.id} style={{
              background:"var(--surface)", borderRadius:18, overflow:"hidden",
              border: isToday ? "2px solid var(--primary)" : "var(--card-border)",
              boxShadow:"var(--card-shadow)",
            }}>
              {isToday && (
                <div style={{ padding:"6px 14px", background:"var(--primary)", color:"#fff", fontSize:12, fontWeight:700 }}>
                  ⚡ 오늘의 배틀 (진행 중)
                </div>
              )}

              {/* 결과 바 */}
              <div style={{ display:"flex", height:5 }}>
                <div style={{ width:`${pctA}%`, background:"#FF7A45", transition:"width .6s" }} />
                <div style={{ flex:1, background:"#6B5CE7" }} />
              </div>

              <div style={{ display:"flex" }}>
                {(["a","b"] as const).map((side) => {
                  const menu = side === "a" ? b.menu_a : b.menu_b;
                  const pct = side === "a" ? pctA : pctB;
                  const votes = side === "a" ? b.votes_a : b.votes_b;
                  const isWinner = !tied && (side === "a" ? winnerIsA : !winnerIsA);
                  const isMine = b.my_vote === side;
                  const color = side === "a" ? "#FF7A45" : "#6B5CE7";

                  return (
                    <div key={side} style={{
                      flex:1, padding:"16px 10px", textAlign:"center",
                      background: isMine ? `${color}10` : "transparent",
                      borderRight: side === "a" ? "1px solid var(--border)" : "none",
                    }}>
                      <div style={{ fontSize:34, marginBottom:6 }}>{EMOJIS[menu] || <img src="/mascot/tabs/food.png" style={{width:34,height:34,objectFit:"contain"}}/>}</div>
                      <p style={{ fontFamily:"var(--font-display)", fontSize:16, marginBottom:4 }}>{menu}</p>
                      <p style={{ fontSize:22, fontWeight:800, color, fontFamily:"var(--font-display)" }}>{pct}%</p>
                      <p style={{ fontSize:11, color:"var(--text-3)" }}>{votes}표</p>
                      {isWinner && <p style={{ fontSize:11, color, fontWeight:700, marginTop:2 }}>우세 🏆</p>}
                      {isMine && <p style={{ fontSize:11, color:"var(--text-3)", marginTop:2 }}>내 선택 ✓</p>}
                    </div>
                  );
                })}
              </div>

              <div style={{ padding:"8px 14px", borderTop:"1px solid var(--border)", display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:12, color:"var(--text-3)" }}>{b.date}</span>
                <span style={{ fontSize:12, color:"var(--text-3)" }}>총 {total}표</span>
              </div>
            </div>
          );
        })}

        {battles.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text-2)" }}>
            <p style={{ fontSize:24, marginBottom:8 }}>⚔️</p>
            <p>아직 배틀 기록이 없습니다</p>
          </div>
        )}
      </div>
      )}

      {tab === "mbti" && (
        <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:16 }}>

          {/* 나의 MBTI 선택 */}
          <div style={{ background:"var(--surface)", borderRadius:20, padding:"20px 18px", border:"var(--card-border)", boxShadow:"var(--card-shadow)" }}>
            <p style={{ fontFamily:"var(--font-display)", fontSize:17, marginBottom:4 }}>🧬 나의 MBTI는?</p>
            <p style={{ fontSize:12, color:"var(--text-3)", marginBottom:14 }}>
              {myMbti ? `${myMbti}로 설정되어 있어요 · 탭해서 변경` : "내 MBTI를 선택하면 음식 궁합을 알려드려요"}
            </p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8 }}>
              {MBTI_LIST.map(m => (
                <button key={m} onClick={() => saveMbti(m)} style={{
                  padding:"10px 4px", borderRadius:12, fontSize:13, fontWeight:700,
                  border: myMbti === m ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                  background: myMbti === m ? "var(--primary)" : "var(--surface)",
                  color: myMbti === m ? "#fff" : "var(--text)",
                  cursor:"pointer", transition:"all .15s",
                  boxShadow: myMbti === m ? "0 4px 12px rgba(255,122,69,.3)" : "none",
                }}>{m}</button>
              ))}
            </div>
            {mbtiSaved && (
              <p style={{ fontSize:12, color:"var(--primary)", marginTop:10, fontWeight:600, textAlign:"center" }}>
                ✓ 프로필에 저장됐어요
              </p>
            )}
            {!isLoggedIn && myMbti && (
              <p style={{ fontSize:11, color:"var(--text-3)", marginTop:8, textAlign:"center" }}>
                * 로그인하면 다음에도 기억해요
              </p>
            )}
          </div>

          {/* MBTI 없을 때 안내 */}
          {!myMbti && (
            <div style={{ textAlign:"center", padding:"20px 0", color:"var(--text-3)" }}>
              <p style={{ fontSize:32, marginBottom:8 }}><img src="/mascot/tabs/food.png" style={{width:32, height:32, objectFit:"contain"}} /></p>
              <p style={{ fontSize:14 }}>위에서 내 MBTI를 선택해보세요</p>
              <p style={{ fontSize:12, marginTop:4 }}>성격 유형에 딱 맞는 음식을 알려드려요</p>
            </div>
          )}

          {/* 내 MBTI 결과 카드 */}
          {myMbti && MBTI_FOOD[myMbti] && (() => {
            const info = MBTI_FOOD[myMbti];
            const foods = mbtiFoods.length > 0 ? mbtiFoods : randomMbtiFoods(myMbti, 4);
            return (
              <div key={resultKey} className="bounce-in" style={{ background:"linear-gradient(135deg, var(--primary) 0%, #ff9a6c 100%)", borderRadius:24, padding:"24px 20px", color:"#fff", boxShadow:"0 8px 32px rgba(255,122,69,.25)" }}>
                {/* 헤더 */}
                <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:16 }}>
                  <span style={{ fontSize:48, lineHeight:1 }}>{info.emoji}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                      <span style={{ fontFamily:"var(--font-display)", fontSize:26, fontWeight:900, letterSpacing:1 }}>{myMbti}</span>
                      <span style={{ padding:"3px 10px", borderRadius:"var(--r-pill)", background:"rgba(255,255,255,0.25)", fontSize:11, fontWeight:700 }}>{info.desc}</span>
                    </div>
                    <p style={{ fontSize:13, opacity:0.9, lineHeight:1.6 }}>{info.longDesc}</p>
                  </div>
                </div>
                {/* 구분선 */}
                <div style={{ height:1, background:"rgba(255,255,255,0.2)", margin:"0 0 16px" }} />
                {/* 음식 추천 */}
                <p style={{ fontSize:12, opacity:0.75, marginBottom:12, fontWeight:600 }}>
                  🍴 이런 음식이 잘 맞아요 (총 {info.foods.length}가지 중 {foods.length}개)
                </p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
                  {foods.map((f, idx) => {
                    const iconUrl = getFoodIconUrl(f);
                    return (
                      <button key={f} onClick={() => setMenuActionMenus([f])}
                        className={`fade-up fade-up-${idx + 1}`}
                        style={{ background:"rgba(255,255,255,0.18)", borderRadius:16, padding:"14px", display:"flex", alignItems:"center", gap:10, backdropFilter:"blur(4px)", border:"1.5px solid rgba(255,255,255,0.25)", cursor:"pointer", textAlign:"left" }}>
                        {iconUrl
                          ? <img src={iconUrl} alt={f} style={{ width:38, height:38, objectFit:"contain", flexShrink:0 }} />
                          : <img src="/mascot/tabs/food.png" style={{width:30, height:30, objectFit:"contain", flexShrink:0}} />}
                        <span style={{ fontSize:15, fontWeight:700, color:"#fff" }}>{f}</span>
                      </button>
                    );
                  })}
                </div>
                {/* 액션 버튼들 */}
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => { setMenuActionMenus(foods); }} style={{
                    flex:1, padding:"12px", borderRadius:"var(--r-pill)",
                    background:"#fff", color:"var(--primary)", fontSize:13, fontWeight:800,
                    border:"none", cursor:"pointer",
                  }}>
                    오늘 이걸로 결정! 🎯
                  </button>
                  <button onClick={refreshMbtiFoods} style={{
                    padding:"12px 14px", borderRadius:"var(--r-pill)",
                    border:"1.5px solid rgba(255,255,255,0.5)", background:"transparent",
                    color:"#fff", fontSize:13, cursor:"pointer",
                  }}>
                    🔀
                  </button>
                </div>
                {/* 다른 MBTI 탐색 토글 */}
                <button onClick={() => setShowBrowse(v => !v)} style={{
                  marginTop:12, width:"100%", padding:"10px",
                  background:"rgba(255,255,255,0.12)", borderRadius:"var(--r-pill)",
                  border:"1px solid rgba(255,255,255,0.2)", color:"rgba(255,255,255,0.85)",
                  fontSize:12, cursor:"pointer", fontWeight:600,
                }}>
                  다른 MBTI 결과도 보기 {showBrowse ? "▲" : "▾"}
                </button>
              </div>
            );
          })()}

          {/* 다른 MBTI 탐색 */}
          {myMbti && showBrowse && (
            <div style={{ background:"var(--surface)", borderRadius:20, padding:"18px 16px", border:"var(--card-border)", boxShadow:"var(--card-shadow)" }}>
              <p style={{ fontSize:13, fontWeight:700, marginBottom:12, color:"var(--text-2)" }}>다른 MBTI 음식 궁합 탐색</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8, marginBottom:14 }}>
                {MBTI_LIST.filter(m => m !== myMbti).map(m => {
                  const info = MBTI_FOOD[m];
                  return (
                    <button key={m} onClick={() => browseMbti(m)} style={{
                      padding:"10px 4px", borderRadius:12, fontSize:13, fontWeight:700,
                      border: browsingMbti === m ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                      background: browsingMbti === m ? "var(--primary)" : "var(--surface)",
                      color: browsingMbti === m ? "#fff" : "var(--text)",
                      cursor:"pointer", transition:"all .15s",
                    }}>
                      <span style={{ display:"block", fontSize:16 }}>{info.emoji}</span>
                      {m}
                    </button>
                  );
                })}
              </div>
              {/* 선택된 MBTI 프리뷰 */}
              {browsingMbti && MBTI_FOOD[browsingMbti] && (() => {
                const info = MBTI_FOOD[browsingMbti];
                const foods = browsingFoods.length > 0 ? browsingFoods : randomMbtiFoods(browsingMbti, 4);
                return (
                  <div key={browsingMbti} className="fade-up" style={{ background:"linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", borderRadius:20, padding:"20px 18px", color:"#fff" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                      <span style={{ fontSize:36 }}>{info.emoji}</span>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontFamily:"var(--font-display)", fontSize:22, fontWeight:900 }}>{browsingMbti}</span>
                          <span style={{ fontSize:11, opacity:0.8 }}>{info.desc}</span>
                        </div>
                        <p style={{ fontSize:12, opacity:0.85, lineHeight:1.5, marginTop:4 }}>{info.longDesc}</p>
                      </div>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                      {foods.map(f => {
                        const iconUrl = getFoodIconUrl(f);
                        return (
                          <div key={f} style={{ background:"rgba(255,255,255,0.15)", borderRadius:12, padding:"10px 12px", display:"flex", alignItems:"center", gap:8 }}>
                            {iconUrl
                              ? <img src={iconUrl} alt={f} style={{ width:30, height:30, objectFit:"contain", flexShrink:0 }} />
                              : <img src="/mascot/tabs/food.png" style={{width:22, height:22, objectFit:"contain"}} />}
                            <span style={{ fontSize:13, fontWeight:700, color:"#fff" }}>{f}</span>
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={() => saveMbti(browsingMbti)} style={{
                      width:"100%", padding:"10px", borderRadius:"var(--r-pill)",
                      background:"rgba(255,255,255,0.2)", border:"1px solid rgba(255,255,255,0.4)",
                      color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer",
                    }}>
                      ✨ 내 MBTI를 {browsingMbti}로 바꾸기
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* MBTI 없을 때 전체 목록 */}
          {!myMbti && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <p style={{ fontSize:13, color:"var(--text-2)", fontWeight:600 }}>모든 MBTI 음식 궁합 미리보기</p>
              {MBTI_LIST.map(m => {
                const info = MBTI_FOOD[m];
                const preview = info.foods.slice(0, 3);
                return (
                  <button key={m} onClick={() => saveMbti(m)} style={{
                    display:"flex", alignItems:"center", gap:12, padding:"14px 16px",
                    background:"var(--surface)", borderRadius:16, border:"var(--card-border)",
                    boxShadow:"var(--card-shadow)", cursor:"pointer", textAlign:"left",
                  }}>
                    <span style={{ fontSize:22, flexShrink:0 }}>{info.emoji}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:800, color:"var(--text)" }}>{m}</span>
                        <span style={{ fontSize:11, color:"var(--text-3)" }}>{info.desc}</span>
                      </div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {preview.map(f => {
                          const icon = getFoodIconUrl(f);
                          return (
                            <div key={f} style={{ display:"flex", alignItems:"center", gap:4 }}>
                              {icon && <img src={icon} alt={f} style={{ width:18, height:18, objectFit:"contain" }} />}
                              <span style={{ fontSize:11, color:"var(--primary)", fontWeight:600 }}>{f}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "ranking" && (
        <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <p style={{ fontFamily:"var(--font-display)", fontSize:17 }}><img src="/mascot/tabs/ranking.png" style={{width:24, height:24, objectFit:"contain", marginRight:4}} />음식 인기 랭킹</p>
            <button onClick={loadRanking} style={{ padding:"5px 12px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-2)", fontSize:12, cursor:"pointer" }}>
              새로고침
            </button>
          </div>
          <p style={{ fontSize:12, color:"var(--text-3)", marginTop:-8 }}>월드컵 우승·선택 + 검색 + 클릭 종합 점수</p>

          {rankLoading && <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text-2)" }}>🔍 집계 중…</div>}

          {!rankLoading && ranking.length === 0 && (
            <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text-2)" }}>
              <p style={{ fontSize:24, marginBottom:8 }}><img src="/mascot/tabs/ranking.png" style={{width:24, height:24, objectFit:"contain"}} /></p>
              <p style={{ fontSize:13 }}>아직 통계 데이터가 없습니다</p>
              <p style={{ fontSize:12, color:"var(--text-3)", marginTop:4 }}>월드컵을 플레이하면 랭킹이 쌓여요!</p>
            </div>
          )}

          {!rankLoading && ranking.length > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {ranking.slice(0, 20).map((item, i) => {
                const iconUrl = getFoodIconUrl(item.food);
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                return (
                  <button key={item.food} onClick={() => setMenuActionMenus([item.food])} style={{
                    display:"flex", alignItems:"center", gap:12, padding:"12px 16px",
                    background: i < 3 ? "var(--surface)" : "var(--bg-card)",
                    borderRadius:16, border: i < 3 ? "var(--card-border)" : "1px solid var(--border)",
                    boxShadow: i < 3 ? "var(--card-shadow)" : "none",
                    cursor:"pointer", textAlign:"left", width:"100%",
                  }}>
                    <span style={{ width:28, textAlign:"center", fontSize: medal ? 20 : 14, color:"var(--text-3)", fontWeight:700, flexShrink:0 }}>
                      {medal || `${i+1}`}
                    </span>
                    {iconUrl
                      ? <img src={iconUrl} alt={item.food} style={{ width:40, height:40, objectFit:"contain", flexShrink:0 }} />
                      : <img src="/mascot/tabs/food.png" style={{width:32, height:32, objectFit:"contain", flexShrink:0}} />}
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700 }}>{item.food}</p>
                      <div style={{ display:"flex", gap:8, marginTop:3, flexWrap:"wrap" }}>
                        {item.wins > 0 && <span style={{ fontSize:11, color:"#E6A817", fontWeight:600 }}>🏆 우승 {item.wins}</span>}
                        {item.selects > 0 && <span style={{ fontSize:11, color:"var(--text-3)" }}>선택 {item.selects}</span>}
                        {item.searches > 0 && <span style={{ fontSize:11, color:"var(--text-3)" }}>검색 {item.searches}</span>}
                        {item.clicks > 0 && <span style={{ fontSize:11, color:"var(--text-3)" }}>클릭 {item.clicks}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <p style={{ fontSize:16, fontWeight:800, color:"var(--primary)", fontFamily:"var(--font-display)" }}>{item.score}</p>
                      <p style={{ fontSize:10, color:"var(--text-3)" }}>점수</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 메뉴 액션 시트 ── */}
      {menuActionMenus.length > 0 && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:75 }}
          onClick={() => setMenuActionMenus([])}>
          <div onClick={(e) => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"24px 24px 0 0", padding:"20px 20px 40px", width:"100%", maxWidth:480, animation:"sheetUp .28s both" }}>
            <div style={{ width:40, height:5, borderRadius:99, background:"var(--border)", margin:"0 auto 12px" }} />
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
              <p style={{ fontFamily:"var(--font-display)", fontSize:18 }}>어떻게 찾으시겠어요?</p>
              <button onClick={() => setMenuActionMenus([])} style={{ background:"var(--bg-2)", border:"none", borderRadius:"50%", width:30, height:30, cursor:"pointer", color:"var(--text-2)", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>✕</button>
            </div>
            <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:18 }}>{menuActionMenus.join(", ")}</p>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <button className="tap" onClick={() => {
                sessionStorage.setItem("meogja_preset_menus", JSON.stringify(menuActionMenus));
                setMenuActionMenus([]);
                setShowGroupPicker(true);
              }} style={{ padding:"14px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:15, cursor:"pointer" }}>
                👥 모임에서 찾기
              </button>
              <button className="tap" onClick={() => {
                const menus = menuActionMenus;
                setMenuActionMenus([]);
                goToSearch(menus);
              }} style={{ padding:"14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", fontSize:15, fontWeight:600, cursor:"pointer" }}>
                📍 모임 없이 바로 주변 찾기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 모임 선택 시트 ── */}
      {showGroupPicker && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:76 }}
          onClick={() => setShowGroupPicker(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"24px 24px 0 0", padding:"20px 20px 40px", width:"100%", maxWidth:480, maxHeight:"60vh", display:"flex", flexDirection:"column", animation:"sheetUp .28s both" }}>
            <div style={{ width:40, height:5, borderRadius:99, background:"var(--border)", margin:"0 auto 12px" }} />
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
              <p style={{ fontFamily:"var(--font-display)", fontSize:18 }}>어느 모임에서 찾을까요?</p>
              <button onClick={() => setShowGroupPicker(false)} style={{ background:"var(--bg-2)", border:"none", borderRadius:"50%", width:30, height:30, cursor:"pointer", color:"var(--text-2)", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>✕</button>
            </div>
            <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:16 }}>
              {(() => { try { return JSON.parse(sessionStorage.getItem("meogja_preset_menus") || "[]").join(", "); } catch { return ""; } })()}
            </p>
            <div style={{ overflowY:"auto", flex:1, display:"flex", flexDirection:"column", gap:10 }}>
              {battleGroups.length === 0 ? (
                <div style={{ textAlign:"center", padding:"20px 0" }}>
                  <p style={{ fontSize:14, color:"var(--text-2)", marginBottom:16 }}>아직 가입한 모임이 없습니다</p>
                  <button className="tap" onClick={() => { setShowGroupPicker(false); router.push("/groups"); }} style={{ padding:"10px 20px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", fontSize:14, fontWeight:600, cursor:"pointer" }}>모임 찾기</button>
                </div>
              ) : (
                battleGroups.map(g => (
                  <button key={g.id} className="tap" onClick={() => {
                    setShowGroupPicker(false);
                    router.push(`/groups/${g.id}?tab=recommend`);
                  }} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:14, border:"1.5px solid var(--border)", background:"var(--bg)", cursor:"pointer", textAlign:"left" }}>
                    <span style={{ fontSize:24 }}>{g.emoji || "🍱"}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontFamily:"var(--font-display)", fontSize:15, color:"var(--text)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{g.name}</p>
                      {g.description && <p style={{ fontSize:12, color:"var(--text-2)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{g.description}</p>}
                    </div>
                    <span style={{ color:"var(--text-3)", fontSize:18 }}>›</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BattlePage() {
  return (
    <Suspense fallback={<div style={{ padding:40, textAlign:"center", color:"var(--text-2)" }}>로딩 중…</div>}>
      <BattleContent />
    </Suspense>
  );
}
