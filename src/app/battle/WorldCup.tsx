"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { getDeviceId } from "@/lib/auth";
import { WORLDCUP_CATEGORIES, MEAL_POOL } from "@/lib/menus";
import { getFoodIconUrl } from "@/lib/foodIcons";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SIZES = [
  { label:"8강", value:8 }, { label:"16강", value:16 },
  { label:"32강", value:32 }, { label:"64강", value:64 },
];

type Props = { onChampion?: (winner: string) => void };

export default function WorldCup({ onChampion }: Props) {
  const [size, setSize] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number>(0); // index into WORLDCUP_CATEGORIES
  const [bracket, setBracket] = useState<string[][]>([]); // remaining rounds
  const [currentPair, setCurrentPair] = useState<[string, string] | null>(null);
  const [roundWinners, setRoundWinners] = useState<string[]>([]);
  const [champion, setChampion] = useState<string | null>(null);
  const [champStats, setChampStats] = useState<{ wins: number; selects: number } | null>(null);
  const [pickedMenu, setPickedMenu] = useState<string | null>(null);
  const [roundNum, setRoundNum] = useState(1);
  const [matchNum, setMatchNum] = useState(1);
  const [totalMatches, setTotalMatches] = useState(0);
  const [matchesDone, setMatchesDone] = useState(0);
  const [animating, setAnimating] = useState(false);

  function start(n: number) {
    setSize(n);
    setChampion(null);
    setRoundWinners([]);
    const catPool = WORLDCUP_CATEGORIES[selectedCategory]?.pool ?? MEAL_POOL;
    const pool = shuffle([...catPool]).slice(0, n);
    const pairs: string[][] = [];
    for (let i = 0; i < pool.length; i += 2) pairs.push([pool[i], pool[i+1]]);
    setBracket(pairs);
    setCurrentPair([pairs[0][0], pairs[0][1]]);
    setRoundNum(Math.log2(n));
    setMatchNum(1);
    setTotalMatches(n - 1);
    setMatchesDone(0);
  }

  async function pick(winner: string, loser: string, isFinal: boolean) {
    if (animating) return;
    setAnimating(true);
    setPickedMenu(winner);

    // DB 기록
    const deviceId = getDeviceId();
    const { data: { user } } = await getSupabase().auth.getUser();
    await getSupabase().from("worldcup_selections").insert({
      winner, loser, is_final: isFinal, device_id: deviceId, user_id: user?.id || null,
    });

    const newDone = matchesDone + 1;
    setMatchesDone(newDone);

    if (isFinal) {
      setChampion(winner);
      setCurrentPair(null);
      onChampion?.(winner);
      setPickedMenu(null);
      // 우승자 통계 조회
      getSupabase().from("worldcup_selections").select("id").eq("winner", winner).eq("is_final", true)
        .then(({ data: w }) =>
          getSupabase().from("worldcup_selections").select("id").eq("winner", winner)
            .then(({ data: s }) => setChampStats({ wins: w?.length ?? 0, selects: s?.length ?? 0 }))
        );
      setAnimating(false);
      return;
    }

    const newWinners = [...roundWinners, winner];

    // 현재 라운드 남은 경기
    const remaining = bracket.slice(matchNum); // matchNum은 0-indexed 내 다음 pair index

    if (remaining.length === 0) {
      // 이 라운드 끝 → 다음 라운드
      if (newWinners.length === 1) {
        setChampion(newWinners[0]);
        setCurrentPair(null);
        setAnimating(false);
        return;
      }
      const nextPairs: string[][] = [];
      for (let i = 0; i < newWinners.length; i += 2) {
        if (newWinners[i+1]) nextPairs.push([newWinners[i], newWinners[i+1]]);
        else nextPairs.push([newWinners[i]]); // bye
      }
      setBracket(nextPairs);
      setRoundWinners([]);
      setMatchNum(1);
      setRoundNum(prev => prev - 1);
      setCurrentPair([nextPairs[0][0], nextPairs[0][1]]);
    } else {
      setRoundWinners(newWinners);
      setMatchNum(prev => prev + 1);
      setCurrentPair([remaining[0][0], remaining[0][1]]);
    }
    setPickedMenu(null);
    setAnimating(false);
  }

  function getRoundName(n: number) {
    if (n === 1) return "결승";
    if (n === 2) return "준결승";
    if (n === 3) return "8강";
    if (n === 4) return "16강";
    if (n === 5) return "32강";
    return `${Math.pow(2,n)}강`;
  }

  if (champion) return (
    <div style={{ padding:"32px 20px", textAlign:"center", background:"var(--surface)", borderRadius:20, border:"var(--card-border)" }}>
      <p style={{ fontSize:48, marginBottom:12 }}><img src="/mascot/tabs/ranking.png" style={{width:48, height:48, objectFit:"contain"}} /></p>
      <p style={{ fontFamily:"var(--font-display)", fontSize:14, color:"var(--text-2)", marginBottom:8 }}>오늘의 최종 우승 메뉴</p>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:6 }}>
        {getFoodIconUrl(champion)
          ? <img src={getFoodIconUrl(champion)!} alt={champion} style={{ width:52, height:52, objectFit:"contain" }} />
          : null}
        <p style={{ fontFamily:"var(--font-display)", fontSize:36, color:"var(--primary)" }}>{champion}</p>
      </div>
      <p style={{ fontSize:13, color:"var(--text-3)", marginBottom:12 }}>이 메뉴가 먹고 싶으셨군요!</p>
      {champStats && (
        <div style={{ display:"flex", gap:12, justifyContent:"center", marginBottom:16 }}>
          <div style={{ padding:"8px 18px", borderRadius:12, background:"rgba(230,168,23,0.15)", border:"1.5px solid #E6A817" }}>
            <p style={{ fontSize:18, fontWeight:800, color:"#E6A817", fontFamily:"var(--font-display)" }}>🏆 {champStats.wins}</p>
            <p style={{ fontSize:10, color:"var(--text-3)" }}>총 우승 횟수</p>
          </div>
          <div style={{ padding:"8px 18px", borderRadius:12, background:"var(--bg-2)", border:"1px solid var(--border)" }}>
            <p style={{ fontSize:18, fontWeight:800, color:"var(--primary)", fontFamily:"var(--font-display)" }}>👆 {champStats.selects}</p>
            <p style={{ fontSize:10, color:"var(--text-3)" }}>총 선택 횟수</p>
          </div>
        </div>
      )}
      <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
        <button className="tap" onClick={() => {
          sessionStorage.setItem("meogja_preset_menus", JSON.stringify([champion]));
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                sessionStorage.setItem("meogja_search_location", JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
                window.location.href = "/search";
              },
              () => { window.location.href = "/search"; },
              { timeout: 5000 }
            );
          } else { window.location.href = "/search"; }
        }} style={{ padding:"11px 22px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:14, cursor:"pointer" }}>
          📍 주변에서 찾기
        </button>
        <button className="tap" onClick={() => {
          const url = window.location.origin;
          const text = `🏆 내 최애 메뉴는?\nmeogja 월드컵에서 확인해봐요 👀`;
          if (navigator.share) navigator.share({ title:"나의 최애 메뉴는?", text, url });
          else navigator.clipboard?.writeText(`${text}\n${url}`);
        }} style={{ padding:"11px 22px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", fontSize:14, cursor:"pointer" }}>
          공유하기
        </button>
        <button className="tap" onClick={() => { setSize(null); setChampion(null); setBracket([]); setRoundWinners([]); setMatchesDone(0); setChampStats(null); setSelectedCategory(0); }} style={{ padding:"11px 22px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-2)", fontSize:14, cursor:"pointer" }}>
          다시하기
        </button>
      </div>
    </div>
  );

  if (!size) return (
    <div style={{ background:"var(--surface)", borderRadius:20, padding:"22px 20px", border:"var(--card-border)" }}>
      <p style={{ fontFamily:"var(--font-display)", fontSize:18, marginBottom:6 }}><img src="/mascot/tabs/ranking.png" style={{width:24, height:24, objectFit:"contain", marginRight:4}} />메뉴 월드컵</p>
      <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:18 }}>두 메뉴를 비교해 최종 우승 메뉴를 결정하세요</p>

      {/* 카테고리 선택 */}
      <p style={{ fontSize:11, fontWeight:700, color:"var(--text-3)", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:10 }}>카테고리</p>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:22 }}>
        {WORLDCUP_CATEGORIES.map((cat, i) => (
          <button key={i} onClick={() => setSelectedCategory(i)} style={{
            padding:"8px 14px", borderRadius:"var(--r-pill)", fontSize:13, fontWeight:600,
            border: selectedCategory === i ? "none" : "1.5px solid var(--border)",
            background: selectedCategory === i ? "var(--primary)" : "var(--surface)",
            color: selectedCategory === i ? "#fff" : "var(--text)",
            cursor:"pointer", transition:"all .15s",
            boxShadow: selectedCategory === i ? "0 4px 12px rgba(255,122,69,.25)" : "none",
          }}>
            {cat.emoji} {cat.label}
            <span style={{ fontSize:11, opacity:0.7, marginLeft:4 }}>({cat.pool.length})</span>
          </button>
        ))}
      </div>

      {/* 강 선택 */}
      <p style={{ fontSize:11, fontWeight:700, color:"var(--text-3)", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:10 }}>강 수 선택</p>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
        {SIZES.filter(s => s.value <= WORLDCUP_CATEGORIES[selectedCategory].pool.length).map((s) => (
          <button key={s.value} className="tap" onClick={() => start(s.value)} style={{
            padding:"12px 22px", borderRadius:"var(--r-pill)",
            border:"1.5px solid var(--border)", background:"var(--bg)",
            color:"var(--text)", fontSize:15, fontWeight:600, cursor:"pointer",
          }}>
            {s.label}
          </button>
        ))}
        {SIZES.filter(s => s.value <= WORLDCUP_CATEGORIES[selectedCategory].pool.length).length === 0 && (
          <p style={{ fontSize:13, color:"var(--text-3)" }}>이 카테고리는 메뉴가 부족합니다</p>
        )}
      </div>
    </div>
  );

  if (!currentPair) return null;

  const progress = Math.round(matchesDone / totalMatches * 100);

  return (
    <div style={{ background:"var(--surface)", borderRadius:20, overflow:"hidden", border:"var(--card-border)", boxShadow:"var(--card-shadow)" }}>
      {/* 헤더 */}
      <div style={{ padding:"14px 18px", background:"var(--hero-gradient)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <p style={{ fontFamily:"var(--font-display)", fontSize:16, color:"#fff" }}><img src="/mascot/tabs/ranking.png" style={{width:20, height:20, objectFit:"contain", marginRight:4}} />{getRoundName(roundNum)}</p>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:80, height:6, borderRadius:99, background:"rgba(255,255,255,.3)", overflow:"hidden" }}>
            <div style={{ width:`${progress}%`, height:"100%", background:"#fff", borderRadius:99, transition:"width .4s" }} />
          </div>
          <span style={{ fontSize:12, color:"rgba(255,255,255,.8)" }}>{matchesDone}/{totalMatches}</span>
        </div>
      </div>

      <p style={{ textAlign:"center", fontSize:13, color:"var(--text-3)", padding:"12px 0 0" }}>더 먹고 싶은 걸 선택하세요</p>

      {/* 두 메뉴 */}
      <div style={{ display:"flex" }}>
        {([0,1] as const).map((idx) => {
          const menu = currentPair[idx];
          const otherMenu = currentPair[idx === 0 ? 1 : 0];
          const isFinal = totalMatches - matchesDone === 1;
          const isPicked = animating && pickedMenu === menu;
          const isLoser = animating && pickedMenu !== null && pickedMenu !== menu;
          return (
            <button key={menu} className="tap" onClick={() => pick(menu, otherMenu, isFinal)} disabled={animating} style={{
              flex:1, padding:"28px 12px", display:"flex", flexDirection:"column", alignItems:"center", gap:10,
              background: isPicked ? "rgba(255,122,69,0.12)" : "transparent",
              border:"none", cursor: animating ? "default" : "pointer",
              borderRight: idx === 0 ? "1px solid var(--border)" : "none",
              transition:"all .25s",
              transform: isPicked ? "scale(1.04)" : isLoser ? "scale(0.96)" : "scale(1)",
              opacity: isLoser ? 0.35 : 1,
              position:"relative",
            }}
              onMouseEnter={(e) => { if (!animating) e.currentTarget.style.background = "rgba(255,122,69,0.08)"; }}
              onMouseLeave={(e) => { if (!animating) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ position:"relative", display:"inline-block" }}>
                {getFoodIconUrl(menu)
                  ? <img src={getFoodIconUrl(menu)!} alt={menu} style={{ width:90, height:90, objectFit:"contain", transition:"transform .25s", transform: isPicked ? "scale(1.1)" : "scale(1)" }} />
                  : <img src="/mascot/tabs/food.png" style={{width:56, height:56, objectFit:"contain", display:"block", transition:"transform .25s", transform: isPicked ? "scale(1.1)" : "scale(1)"}} />}
                {isPicked && (
                  <div style={{
                    position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
                    background:"rgba(255,122,69,0.85)", borderRadius:"50%",
                    animation:"popIn .2s ease-out",
                  }}>
                    <span style={{ fontSize:40, color:"#fff" }}>✓</span>
                  </div>
                )}
              </div>
              <p style={{ fontFamily:"var(--font-display)", fontSize:20, color: isPicked ? "var(--primary)" : "var(--text)", fontWeight: isPicked ? 800 : 600, transition:"all .25s" }}>{menu}</p>
              {isPicked && <span style={{ fontSize:12, color:"var(--primary)", fontWeight:700, marginTop:-4 }}>선택!</span>}
            </button>
          );
        })}
      </div>

      {/* VS */}
      <div style={{ textAlign:"center", paddingBottom:14 }}>
        <span style={{ fontSize:12, fontWeight:800, color:"var(--text-3)", letterSpacing:2 }}>VS</span>
      </div>

      <div style={{ padding:"0 16px 14px", display:"flex", justifyContent:"flex-end" }}>
        <button onClick={() => { setSize(null); setChampion(null); setBracket([]); setRoundWinners([]); setMatchesDone(0); setChampStats(null); setSelectedCategory(0); }} style={{ fontSize:12, color:"var(--text-3)", background:"none", border:"none", cursor:"pointer" }}>그만하기</button>
      </div>
    </div>
  );
}
