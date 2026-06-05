"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { getDeviceId } from "@/lib/auth";

const MENU_POOL = [
  "삼겹살","초밥","마라탕","치킨","파스타","떡볶이","순대국밥","김치찌개","불고기","라멘",
  "갈비찜","돈카츠","우동","비빔밥","감자탕","피자","스테이크","부대찌개","칼국수","짬뽕",
  "냉면","제육볶음","족발","양꼬치","오마카세","갈비","소불고기","낙지볶음","쭈꾸미","불닭",
  "마라샹궈","규동","텐동","카라아게","야키토리","해물찜","꽃게찜","간장게장","수육","보쌈",
  "순대","떡갈비","짜장면","짬뽕","탕수육","깐풍기","잡채","해장국","설렁탕","갈낙전골",
  "샤브샤브","훠궈","전골","유산슬","닭갈비","오겹살","항정살","갈매기살","목살","껍데기",
  "치즈닭갈비","매운찜닭","간장찜닭","불닭볶음면","엽기떡볶이","매운낙지볶음",
];

const EMOJIS: Record<string, string> = {
  삼겹살:"🥓",초밥:"🍣",마라탕:"🌶️",치킨:"🍗",파스타:"🍝",떡볶이:"🌮",순대국밥:"🍲",
  김치찌개:"🍲",불고기:"🥩",라멘:"🍜",갈비찜:"🍖",돈카츠:"🍱",우동:"🍜",비빔밥:"🍚",
  감자탕:"🍲",피자:"🍕",스테이크:"🥩",부대찌개:"🍲",칼국수:"🍜",짬뽕:"🍜",냉면:"🍜",
  제육볶음:"🥩",족발:"🍖",양꼬치:"🍢",오마카세:"🍱",갈비:"🥩",소불고기:"🥩",짜장면:"🍜",
  탕수육:"🍖",해장국:"🍲",설렁탕:"🍲",샤브샤브:"🍲",훠궈:"🍲",닭갈비:"🍗",
};

function emoji(m: string) { return EMOJIS[m] || "🍽️"; }

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
  const [bracket, setBracket] = useState<string[][]>([]); // remaining rounds
  const [currentPair, setCurrentPair] = useState<[string, string] | null>(null);
  const [roundWinners, setRoundWinners] = useState<string[]>([]);
  const [champion, setChampion] = useState<string | null>(null);
  const [roundNum, setRoundNum] = useState(1);
  const [matchNum, setMatchNum] = useState(1);
  const [totalMatches, setTotalMatches] = useState(0);
  const [matchesDone, setMatchesDone] = useState(0);
  const [animating, setAnimating] = useState(false);

  function start(n: number) {
    setSize(n);
    setChampion(null);
    setRoundWinners([]);
    const pool = shuffle(MENU_POOL).slice(0, n);
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
      <p style={{ fontSize:48, marginBottom:12 }}>🏆</p>
      <p style={{ fontFamily:"var(--font-display)", fontSize:14, color:"var(--text-2)", marginBottom:8 }}>오늘의 최종 우승 메뉴</p>
      <p style={{ fontFamily:"var(--font-display)", fontSize:36, color:"var(--primary)", marginBottom:6 }}>{emoji(champion)} {champion}</p>
      <p style={{ fontSize:13, color:"var(--text-3)", marginBottom:20 }}>이 메뉴가 먹고 싶으셨군요!</p>
      <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
        <button className="tap" onClick={() => {
          sessionStorage.setItem("meogja_preset_menus", JSON.stringify([champion]));
          window.location.href = "/search";
        }} style={{ padding:"11px 22px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:14, cursor:"pointer" }}>
          📍 주변에서 찾기
        </button>
        <button className="tap" onClick={() => {
          const text = `🏆 메뉴 월드컵 결과\n오늘의 우승: ${emoji(champion)} ${champion}\n\nmeogja에서 해보세요 → ${window.location.origin}`;
          if (navigator.share) navigator.share({ title:"메뉴 월드컵", text, url: window.location.origin });
          else navigator.clipboard?.writeText(text);
        }} style={{ padding:"11px 22px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", fontSize:14, cursor:"pointer" }}>
          공유하기
        </button>
        <button className="tap" onClick={() => { setSize(null); setChampion(null); setBracket([]); setRoundWinners([]); setMatchesDone(0); }} style={{ padding:"11px 22px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-2)", fontSize:14, cursor:"pointer" }}>
          다시하기
        </button>
      </div>
    </div>
  );

  if (!size) return (
    <div style={{ background:"var(--surface)", borderRadius:20, padding:"22px 20px", border:"var(--card-border)" }}>
      <p style={{ fontFamily:"var(--font-display)", fontSize:18, marginBottom:6 }}>🏆 메뉴 월드컵</p>
      <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:20 }}>두 메뉴를 비교해 최종 우승 메뉴를 결정하세요</p>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
        {SIZES.map((s) => (
          <button key={s.value} className="tap" onClick={() => start(s.value)} style={{
            padding:"12px 22px", borderRadius:"var(--r-pill)",
            border:"1.5px solid var(--border)", background:"var(--bg)",
            color:"var(--text)", fontSize:15, fontWeight:600, cursor:"pointer",
          }}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (!currentPair) return null;

  const progress = Math.round(matchesDone / totalMatches * 100);

  return (
    <div style={{ background:"var(--surface)", borderRadius:20, overflow:"hidden", border:"var(--card-border)", boxShadow:"var(--card-shadow)" }}>
      {/* 헤더 */}
      <div style={{ padding:"14px 18px", background:"linear-gradient(135deg,#FF7A45,#FF4E88)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <p style={{ fontFamily:"var(--font-display)", fontSize:16, color:"#fff" }}>🏆 {getRoundName(roundNum)}</p>
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
          return (
            <button key={idx} className="tap" onClick={() => pick(menu, otherMenu, isFinal)} disabled={animating} style={{
              flex:1, padding:"28px 12px", display:"flex", flexDirection:"column", alignItems:"center", gap:10,
              background:"transparent", border:"none", cursor:"pointer",
              borderRight: idx === 0 ? "1px solid var(--border)" : "none",
              transition:"background .15s",
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--primary-light)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontSize:56 }}>{emoji(menu)}</span>
              <p style={{ fontFamily:"var(--font-display)", fontSize:20, color:"var(--text)" }}>{menu}</p>
            </button>
          );
        })}
      </div>

      {/* VS */}
      <div style={{ textAlign:"center", paddingBottom:14 }}>
        <span style={{ fontSize:12, fontWeight:800, color:"var(--text-3)", letterSpacing:2 }}>VS</span>
      </div>

      <div style={{ padding:"0 16px 14px", display:"flex", justifyContent:"flex-end" }}>
        <button onClick={() => { setSize(null); setChampion(null); setBracket([]); setRoundWinners([]); setMatchesDone(0); }} style={{ fontSize:12, color:"var(--text-3)", background:"none", border:"none", cursor:"pointer" }}>그만하기</button>
      </div>
    </div>
  );
}
