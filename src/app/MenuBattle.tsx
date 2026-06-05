"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getDeviceId } from "@/lib/auth";

// 매일 갱신되는 배틀 쌍 (날짜 시드로 결정)
const BATTLE_PAIRS = [
  ["치킨", "피자"], ["삼겹살", "초밥"], ["마라탕", "떡볶이"],
  ["라멘", "우동"], ["스테이크", "파스타"], ["치킨", "삼겹살"],
  ["초밥", "파스타"], ["갈비", "불고기"], ["족발", "보쌈"],
  ["냉면", "국수"], ["부대찌개", "김치찌개"], ["돈카츠", "카라아게"],
  ["비빔밥", "덮밥"], ["짜장면", "짬뽕"], ["순대국밥", "설렁탕"],
];

const EMOJIS: Record<string, string> = {
  치킨:"🍗", 피자:"🍕", 삼겹살:"🥓", 초밥:"🍣", 마라탕:"🌶️", 떡볶이:"🌮",
  라멘:"🍜", 우동:"🍜", 스테이크:"🥩", 파스타:"🍝", 갈비:"🥩", 불고기:"🥩",
  족발:"🍖", 보쌈:"🥬", 냉면:"🍜", 국수:"🍜", 부대찌개:"🍲", 김치찌개:"🍲",
  돈카츠:"🍱", 카라아게:"🍗", 비빔밥:"🍚", 덮밥:"🍚", 짜장면:"🍜", 짬뽕:"🍜",
  순대국밥:"🍲", 설렁탕:"🍲",
};

function getTodayPair(): [string, string] {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return BATTLE_PAIRS[dayOfYear % BATTLE_PAIRS.length] as [string, string];
}

export default function MenuBattle({ onVoted }: { onVoted?: () => void }) {
  const router = useRouter();
  const [battle, setBattle] = useState<{id:string;menu_a:string;menu_b:string} | null>(null);
  const [votes, setVotes] = useState<{a:number;b:number}>({a:0, b:0});
  const [myVote, setMyVote] = useState<"a"|"b"|null>(null);
  const [voting, setVoting] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadBattle(); }, []);

  async function loadBattle() {
    const today = new Date().toISOString().slice(0,10);
    let { data: existing } = await getSupabase()
      .from("menu_battles").select("*").eq("date", today).single();

    if (!existing) {
      const [a, b] = getTodayPair();
      const { data } = await getSupabase()
        .from("menu_battles").insert({ menu_a: a, menu_b: b, date: today })
        .select().single();
      existing = data;
    }
    if (!existing) return;
    setBattle(existing);

    // 투표수 집계
    const { data: voteData } = await getSupabase()
      .from("menu_battle_votes").select("choice").eq("battle_id", existing.id);
    if (voteData) {
      setVotes({
        a: voteData.filter(v => v.choice === "a").length,
        b: voteData.filter(v => v.choice === "b").length,
      });
    }

    // 내 투표 확인 (device_id 기반)
    const deviceId = getDeviceId();
    const { data: myVoteData } = await getSupabase()
      .from("menu_battle_votes").select("choice")
      .eq("battle_id", existing.id).eq("voter_device_id", deviceId).single();
    if (myVoteData) { setMyVote(myVoteData.choice as "a"|"b"); onVoted?.(); }
  }

  async function vote(choice: "a"|"b") {
    if (myVote || voting || !battle) return;
    setVoting(true);
    const deviceId = getDeviceId();
    const { data } = await getSupabase().auth.getUser();
    await getSupabase().from("menu_battle_votes").insert({
      battle_id: battle.id,
      choice,
      voter_device_id: deviceId,
      user_id: data.user?.id || null,
    });
    setMyVote(choice);
    setVotes(prev => ({ ...prev, [choice]: prev[choice] + 1 }));
    setVoting(false);
    setShowShare(true);
    onVoted?.();
  }

  if (!battle) return null;

  const total = votes.a + votes.b;
  const pctA = total > 0 ? Math.round(votes.a / total * 100) : 50;
  const pctB = 100 - pctA;
  const winnerIsA = pctA >= pctB;

  return (
    <div ref={cardRef} style={{ padding: "0 16px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <p style={{ fontFamily:"var(--font-display)", fontSize:16 }}>⚔️ 오늘의 배틀</p>
        <button onClick={() => router.push("/battle?tab=battle")} style={{ fontSize:12, color:"var(--primary)", fontWeight:700, background:"none", border:"none", cursor:"pointer" }}>히스토리 ›</button>
      </div>

      <div style={{
        background:"var(--surface)", borderRadius:20, overflow:"hidden",
        border:"var(--card-border)", boxShadow:"var(--card-shadow)",
      }}>
        {/* 투표 바 */}
        {myVote && (
          <div style={{ display:"flex", height:6 }}>
            <div style={{ width:`${pctA}%`, background:"#FF7A45", transition:"width .6s ease" }} />
            <div style={{ flex:1, background:"#6B5CE7" }} />
          </div>
        )}

        <div style={{ display:"flex", gap:0 }}>
          {(["a","b"] as const).map((side) => {
            const menu = side === "a" ? battle.menu_a : battle.menu_b;
            const pct = side === "a" ? pctA : pctB;
            const isWinner = myVote && (side === "a" ? winnerIsA : !winnerIsA);
            const isMine = myVote === side;
            const color = side === "a" ? "#FF7A45" : "#6B5CE7";

            return (
              <button key={side} className="tap" onClick={() => vote(side)}
                disabled={!!myVote || voting}
                style={{
                  flex:1, padding:"22px 12px",
                  background: isMine ? `${color}18` : "transparent",
                  border:"none", cursor: myVote ? "default" : "pointer",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:8,
                  borderRight: side === "a" ? "1px solid var(--border)" : "none",
                  transition:"background .2s",
                }}>
                <span style={{ fontSize:42 }}>{EMOJIS[menu] || "🍽️"}</span>
                <p style={{ fontFamily:"var(--font-display)", fontSize:18, color: isMine ? color : "var(--text)" }}>{menu}</p>
                {myVote ? (
                  <div style={{ textAlign:"center" }}>
                    <p style={{ fontSize:24, fontWeight:800, color, fontFamily:"var(--font-display)" }}>{pct}%</p>
                    {isMine && <p style={{ fontSize:11, color:"var(--text-3)" }}>내 선택</p>}
                    {isWinner && !isMine && <p style={{ fontSize:11, color:color, fontWeight:700 }}>우세</p>}
                  </div>
                ) : (
                  <div style={{ padding:"6px 18px", borderRadius:"var(--r-pill)", border:`1.5px solid ${color}`, color, fontSize:13, fontWeight:700 }}>
                    투표
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* vs 뱃지 */}
        <div style={{ position:"relative", height:0 }}>
          <div style={{ position:"absolute", top:-60, left:"50%", transform:"translateX(-50%)", width:36, height:36, borderRadius:"50%", background:"var(--surface)", border:"2px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"var(--text-3)" }}>
            VS
          </div>
        </div>
      </div>

      {/* 공유 버튼 */}
      {showShare && myVote && (
        <button className="tap" onClick={() => {
          const winner = myVote === "a" ? battle.menu_a : battle.menu_b;
          const loser = myVote === "a" ? battle.menu_b : battle.menu_a;
          const pctMine = myVote === "a" ? pctA : pctB;
          const text = `오늘의 배틀 결과 🍽️\n⚔️ ${battle.menu_a} vs ${battle.menu_b}\n나는 ${winner} 선택! (현재 ${pctMine}%)\n\n같이 투표해봐 → ${window.location.origin}`;
          if (navigator.share) navigator.share({ title: "오늘의 메뉴 배틀", text, url: window.location.origin });
          else { navigator.clipboard?.writeText(text); }
        }} style={{
          marginTop:10, width:"100%", padding:"11px", borderRadius:"var(--r-pill)",
          border:"1.5px solid var(--primary)", background:"var(--primary-light)",
          color:"var(--primary)", fontFamily:"var(--font-display)", fontSize:14, cursor:"pointer",
        }}>
          결과 공유하기 →
        </button>
      )}
    </div>
  );
}
