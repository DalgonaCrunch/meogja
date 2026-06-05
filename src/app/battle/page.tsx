"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getDeviceId } from "@/lib/auth";

type Battle = {
  id: string;
  menu_a: string;
  menu_b: string;
  date: string;
  votes_a: number;
  votes_b: number;
  my_vote: "a" | "b" | null;
};

const EMOJIS: Record<string, string> = {
  치킨:"🍗", 피자:"🍕", 삼겹살:"🥓", 초밥:"🍣", 마라탕:"🌶️", 떡볶이:"🌮",
  라멘:"🍜", 우동:"🍜", 스테이크:"🥩", 파스타:"🍝", 갈비:"🥩", 불고기:"🥩",
  족발:"🍖", 보쌈:"🥬", 냉면:"🍜", 국수:"🍜", 부대찌개:"🍲", 김치찌개:"🍲",
  돈카츠:"🍱", 카라아게:"🍗", 비빔밥:"🍚", 덮밥:"🍚", 짜장면:"🍜", 짬뽕:"🍜",
  순대국밥:"🍲", 설렁탕:"🍲",
};

export default function BattlePage() {
  const router = useRouter();
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadBattles(); }, []);

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
      <div style={{ padding:"16px 16px 12px", position:"sticky", top:52, background:"var(--bg)", zIndex:10, borderBottom:"1px solid var(--border)" }}>
        <h1 style={{ fontFamily:"var(--font-display)", fontSize:22 }}>⚔️ 메뉴 배틀 히스토리</h1>
        <p style={{ fontSize:13, color:"var(--text-2)", marginTop:4 }}>매일 두 메뉴가 맞붙습니다</p>
      </div>

      {loading && <div style={{ textAlign:"center", padding:40, color:"var(--text-2)" }}>불러오는 중…</div>}

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
                      <div style={{ fontSize:34, marginBottom:6 }}>{EMOJIS[menu] || "🍽️"}</div>
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

        {!loading && battles.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text-2)" }}>
            <p style={{ fontSize:24, marginBottom:8 }}>⚔️</p>
            <p>아직 배틀 기록이 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
