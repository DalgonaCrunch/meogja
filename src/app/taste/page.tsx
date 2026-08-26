"use client";

/**
 * 취향 알아보기 — 3갈래 스와이프 + 적응형(중분류 → 그 안 메뉴).
 *
 * 왜 월드컵이 아닌가: 둘 중 하나를 고르게 하면 "둘 다 좋다/둘 다 싫다" 를 말할 수
 * 없다. 이긴 쪽만 남아서 정보가 오히려 줄어든다. 결정 단계에는 재미있지만
 * 취향을 모으는 데는 안 맞는다.
 *
 * 적응형: 먼저 중분류 19개만 묻고, 좋다고 한 쪽의 메뉴만 이어서 묻는다.
 * 301개를 전부 물으면 아무도 끝까지 안 한다.
 *
 * 한 장 넘길 때마다 바로 저장한다 — 중간에 나가도 거기까지는 남는다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { MENU_DATA } from "@/lib/recommend";
import { getFoodIconUrl } from "@/lib/foodIcons";
import { savePreference, type TasteVerdict } from "@/lib/tastePrefs";
import { reportMenuIngredient } from "@/lib/ingredientMap";
import { toast } from "@/lib/dialog";
import LoadingCat from "@/components/LoadingCat";

/** 중분류에 붙일 이모지 — 아이콘 파일이 없는 것들을 위한 대비 */
const CATEGORY_EMOJI: Record<string, string> = {
  한식: "🍚", 중식: "🥢", 일식: "🍱", 양식: "🍝", 동남아식: "🍜", 분식: "🌭",
  패스트푸드: "🍔", "인도/중동식": "🍛", "치킨/닭": "🍗", 고기류: "🥩",
  해산물: "🦐", 안주류: "🍺", "빵/케이크": "🍰", "아이스크림/빙수": "🍧",
  한식디저트: "🍡", "과일/건강": "🥗", 커피: "☕", 논커피: "🧋", 카페음식: "🥪",
};

/** 재료·알레르기 — 프로필 화면과 같은 목록 */
const INGREDIENTS = ["고수","땅콩","견과류","새우","조개","오징어","낙지","문어","굴",
  "생선회","마라","청양고추","양파","버섯","파","마늘","곱창","순대","선지","내장"];

type Card = { name: string; kind: "category" | "menu"; sub?: string };

const MEDIUMS: { name: string; large: string; items: string[] }[] =
  MENU_DATA.flatMap(l => l.medium.map(m => ({ name: m.name, large: l.name, items: m.items })));

/** 좋다고 한 중분류에서 물어볼 메뉴를 고른다(너무 많으면 아무도 안 끝낸다) */
function pickMenus(likedMediums: string[], limit = 16): Card[] {
  const pools = likedMediums
    .map(name => MEDIUMS.find(m => m.name === name))
    .filter((m): m is { name: string; large: string; items: string[] } => !!m)
    .map(m => ({ sub: m.name, items: [...m.items] }));
  const out: Card[] = [];
  let round = 0;
  // 중분류를 돌아가며 하나씩 뽑는다 — 한 분류만 쭉 나오면 지겹다
  while (out.length < limit && pools.some(p => p.items.length > round)) {
    for (const p of pools) {
      if (out.length >= limit) break;
      const item = p.items[round];
      if (item) out.push({ name: item, kind: "menu", sub: p.sub });
    }
    round++;
  }
  return out;
}

function TasteContent() {
  const router = useRouter();
  const params = useSearchParams();
  const isOnboarding = params.get("onboarding") === "1";

  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  /** 진행 단계: 중분류 → 메뉴 → 재료 → 끝 */
  const [phase, setPhase] = useState<"category" | "menu" | "ingredient" | "done">("category");
  const [idx, setIdx] = useState(0);
  const [menuCards, setMenuCards] = useState<Card[]>([]);
  const [likedMediums, setLikedMediums] = useState<string[]>([]);
  const [badIngredients, setBadIngredients] = useState<string[]>([]);
  const [tally, setTally] = useState({ like: 0, never: 0 });
  /** 카드가 날아가는 방향 (애니메이션) */
  const [fly, setFly] = useState<"" | "left" | "right" | "up">("");
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState({ dx: 0, dy: 0 });
  /* 끌고 있는 중인지는 **상태**로 들고 있는다. 렌더 중에 ref 를 읽으면 안 된다
     (그리기 시점에는 최신 값이 아닐 수 있다). */
  const [dragging, setDragging] = useState(false);
  /* "이 메뉴에 ○○ 들어있어요" 제보. 표에 없는 조합을 사용자가 알려 주는 창구다
     (세 명이 같은 말을 하면 추천에 반영된다). */
  const [reportFor, setReportFor] = useState<string | null>(null);

  const categoryCards: Card[] = useMemo(
    () => MEDIUMS.map(m => ({ name: m.name, kind: "category" as const })), []);

  const cards = phase === "category" ? categoryCards : menuCards;
  const card = cards[idx];

  useEffect(() => {
    getCurrentUser().then(u => {
      if (u.type === "auth") setUserId(u.user.id);
      setReady(true);
    });
  }, []);

  const answer = useCallback((verdict: TasteVerdict) => {
    const cur = cards[idx];
    if (!cur) return;
    if (verdict === "like" || verdict === "best") {
      setTally(t => ({ ...t, like: t.like + 1 }));
      if (cur.kind === "category") setLikedMediums(prev => [...prev, cur.name]);
    }
    if (verdict === "never") setTally(t => ({ ...t, never: t.never + 1 }));

    // 저장은 기다리지 않는다(넘기는 손이 멈추면 안 된다). 실패해도 화면은 흐른다.
    if (userId) void savePreference(userId, cur.name, verdict, cur.kind);

    setFly(verdict === "never" ? "left" : verdict === "meh" ? "up" : "right");
    setTimeout(() => {
      setFly("");
      setDrag({ dx: 0, dy: 0 });
      const next = idx + 1;
      if (next < cards.length) { setIdx(next); return; }
      if (phase === "category") {
        const liked = verdict === "like" || verdict === "best"
          ? [...likedMediums, cur.kind === "category" ? cur.name : ""].filter(Boolean)
          : likedMediums;
        const picked = pickMenus(liked.length ? liked : MEDIUMS.slice(0, 4).map(m => m.name));
        setMenuCards(picked);
        setIdx(0);
        setPhase(picked.length ? "menu" : "ingredient");
        return;
      }
      setPhase("ingredient");
    }, 180);
  }, [cards, idx, phase, likedMediums, userId]);

  async function finishIngredients() {
    if (userId) {
      // 재료는 한 번에 저장한다(고르는 화면이라 장마다 저장할 것이 없다)
      await Promise.all(badIngredients.map(n => savePreference(userId, n, "never", "ingredient")));
    }
    setPhase("done");
  }

  if (!ready) return <LoadingCat text="취향 준비 중…" padding="80px 0" />;

  if (!userId) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center" }}>
        <img src="/mascot/avatars/cat-16.png" alt="" style={{ width: 96, height: 96, objectFit: "contain", mixBlendMode: "multiply" }} />
        <p style={{ fontFamily: "var(--font-display)", fontSize: 18, margin: "12px 0 6px" }}>먼저 로그인해 주세요</p>
        <p style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.6, marginBottom: 20 }}>
          취향은 계정에 저장돼요. 다음에 모임에서 메뉴를 정할 때 그대로 쓰입니다.
        </p>
        <button className="tap" onClick={() => router.push("/login")} style={{
          padding: "13px 28px", borderRadius: "var(--r-pill)", border: "none",
          background: "var(--primary)", color: "#fff", fontFamily: "var(--font-display)", fontSize: 15, cursor: "pointer",
        }}>로그인하러 가기 →</button>
      </div>
    );
  }

  /* ── 끝 화면 ─────────────────────────────────────────────── */
  if (phase === "done") {
    return (
      <div style={{ padding: "40px 20px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 4, animation: "sheetUp .35s both" }}>🎉</div>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 22, margin: "0 0 6px" }}>취향 등록 완료!</p>
        <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 20 }}>
          좋아하는 것 {tally.like}개 · 못 먹는 것 {tally.never + badIngredients.length}개
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 24 }}>
          {likedMediums.slice(0, 8).map(n => (
            <span key={n} style={{ padding: "7px 14px", borderRadius: "var(--r-pill)", background: "var(--primary)", color: "#fff", fontSize: 13, fontWeight: 700 }}>
              {CATEGORY_EMOJI[n] || "🍽️"} {n}
            </span>
          ))}
        </div>
        <p style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.6, marginBottom: 24 }}>
          이제 모임에서 메뉴를 고르면 <b>모두가 먹을 수 있는 것</b>부터 보여드려요.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 320, margin: "0 auto" }}>
          <button className="tap" onClick={() => router.push("/nearby")} style={{
            padding: "14px", borderRadius: "var(--r-pill)", border: "none",
            background: "var(--primary)", color: "#fff", fontFamily: "var(--font-display)", fontSize: 15.5, cursor: "pointer",
          }}>🍜 주변 맛집 보러 가기</button>
          <button className="tap" onClick={() => router.push(isOnboarding ? "/" : "/profile")} style={{
            padding: "13px", borderRadius: "var(--r-pill)", border: "1.5px solid var(--border)",
            background: "transparent", color: "var(--text-2)", fontSize: 14.5, fontWeight: 600, cursor: "pointer",
          }}>{isOnboarding ? "홈으로" : "내 정보로"}</button>
        </div>
      </div>
    );
  }

  /* ── 재료·알레르기 ────────────────────────────────────────── */
  if (phase === "ingredient") {
    return (
      <div style={{ padding: "24px 20px 40px" }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 20, margin: "0 0 4px" }}>못 먹는 재료가 있나요?</p>
        <p style={{ fontSize: 13.5, color: "var(--text-2)", marginBottom: 18, lineHeight: 1.6 }}>
          고른 재료가 들어간 메뉴는 추천에서 <b>아예 빼드려요.</b> 없으면 그냥 넘어가도 돼요.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 28 }}>
          {INGREDIENTS.map(n => {
            const on = badIngredients.includes(n);
            return (
              <button key={n} className="tap"
                onClick={() => setBadIngredients(prev => on ? prev.filter(x => x !== n) : [...prev, n])}
                style={{
                  padding: "9px 15px", borderRadius: "var(--r-pill)", cursor: "pointer",
                  border: on ? "1.5px solid var(--red, #E5484D)" : "1.5px solid var(--border)",
                  background: on ? "var(--red-soft, #FFF0F0)" : "var(--surface)",
                  color: on ? "var(--red, #E5484D)" : "var(--text-2)",
                  fontSize: 14, fontWeight: on ? 800 : 500,
                }}>{on ? "🚫 " : ""}{n}</button>
            );
          })}
        </div>
        <button className="tap" onClick={finishIngredients} style={{
          width: "100%", padding: "15px", borderRadius: "var(--r-pill)", border: "none",
          background: "var(--primary)", color: "#fff", fontFamily: "var(--font-display)", fontSize: 16, cursor: "pointer",
        }}>다 골랐어요 →</button>
      </div>
    );
  }

  /* ── 스와이프 카드 ────────────────────────────────────────── */
  const total = cards.length;
  const iconUrl = card ? getFoodIconUrl(card.name) : null;
  const emoji = card ? (CATEGORY_EMOJI[card.name] || "🍽️") : "🍽️";
  const flyX = fly === "left" ? -420 : fly === "right" ? 420 : 0;
  const flyY = fly === "up" ? -420 : 0;

  return (
    /* 🔴 여기서 100vh 를 쓰면 안 된다. 위에 헤더, 아래에 탭바가 있어서
       카드 밑의 버튼들이 화면 밖으로 밀려난다(실제로 그랬다). */
    <div style={{ padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 19, margin: "0 0 4px" }}>
          {phase === "category" ? "어떤 걸 좋아해요?" : "이건 어때요?"}
        </p>
        <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: 0 }}>
          {phase === "category" ? "좋아하는 종류만 골라주면 그 안에서 더 물어볼게요" : "좋아한 종류에서 골라온 메뉴예요"}
          {" · "}{Math.min(idx + 1, total)}/{total}
        </p>
        {/* 진행 막대 */}
        <div style={{ height: 6, borderRadius: 99, background: "var(--bg-2)", marginTop: 10, overflow: "hidden" }}>
          <div style={{
            width: `${(idx / Math.max(1, total)) * 100}%`, height: "100%",
            background: "var(--primary)", borderRadius: 99, transition: "width .25s ease",
          }} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 0 14px" }}>
        {card && (
          <div
            onPointerDown={(e) => { dragRef.current = { x: e.clientX, y: e.clientY }; setDragging(true); }}
            onPointerMove={(e) => {
              if (!dragRef.current) return;
              setDrag({ dx: e.clientX - dragRef.current.x, dy: e.clientY - dragRef.current.y });
            }}
            onPointerUp={() => {
              const { dx, dy } = drag;
              dragRef.current = null;
              setDragging(false);
              if (dx > 90) answer("like");
              else if (dx < -90) answer("never");
              else if (dy < -90) answer("meh");
              else setDrag({ dx: 0, dy: 0 });
            }}
            onPointerCancel={() => { dragRef.current = null; setDragging(false); setDrag({ dx: 0, dy: 0 }); }}
            style={{
              width: "100%", maxWidth: 340, background: "var(--surface)", borderRadius: 28,
              border: "var(--card-border)", boxShadow: "0 12px 40px rgba(0,0,0,.14)",
              padding: "24px 22px 20px", textAlign: "center", touchAction: "none", userSelect: "none",
              transform: fly
                ? `translate(${flyX}px, ${flyY}px) rotate(${flyX / 24}deg)`
                : `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx / 24}deg)`,
              transition: fly ? "transform .18s ease-out" : dragging ? "none" : "transform .2s ease",
              opacity: fly ? 0 : 1,
            }}>
            <div style={{ width: "min(46vw, 148px)", height: "min(46vw, 148px)", margin: "0 auto 14px", borderRadius: 28, background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {iconUrl
                ? <img src={iconUrl} alt="" style={{ width: "78%", height: "78%", objectFit: "contain" }} />
                : <span style={{ fontSize: 76, lineHeight: 1 }}>{emoji}</span>}
            </div>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 23, margin: "0 0 4px" }}>{card.name}</p>
            {card.sub && <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: 0 }}>{card.sub}</p>}
            {card.kind === "menu" && (
              <button className="tap"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setReportFor(card.name); }}
                style={{ marginTop: 10, background: "none", border: "none", color: "var(--text-3)", fontSize: 11.5, cursor: "pointer", textDecoration: "underline" }}>
                이 메뉴에 못 먹는 재료가 들어있어요
              </button>
            )}
            {/* 끄는 방향에 따라 미리 알려 준다 */}
            {drag.dx > 40 && <p style={{ color: "var(--green, #30A46C)", fontWeight: 800, marginTop: 12 }}>좋아! 👍</p>}
            {drag.dx < -40 && <p style={{ color: "var(--red, #E5484D)", fontWeight: 800, marginTop: 12 }}>못 먹어 🚫</p>}
            {drag.dy < -40 && Math.abs(drag.dx) < 40 && <p style={{ color: "var(--text-3)", fontWeight: 800, marginTop: 12 }}>상관없어 🤷</p>}
          </div>
        )}
      </div>

      {/* 재료 제보 시트 */}
      {reportFor && (
        <div onClick={() => setReportFor(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 90 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: "24px 24px 0 0", padding: "20px 20px calc(28px + env(safe-area-inset-bottom, 0px))", width: "100%", maxWidth: 480 }}>
            <div style={{ width: 40, height: 5, borderRadius: 99, background: "var(--border)", margin: "0 auto 14px" }} />
            <p style={{ fontFamily: "var(--font-display)", fontSize: 17, margin: "0 0 4px" }}>{reportFor} 에 뭐가 들어있나요?</p>
            <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "0 0 14px", lineHeight: 1.5 }}>
              알려주시면 그 재료를 못 먹는 사람에게는 이 메뉴를 안 보여줘요. 여러 사람이 같은 재료를 알려주면 반영됩니다.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {INGREDIENTS.map(n => (
                <button key={n} className="tap" onClick={async () => {
                  const menu = reportFor;
                  setReportFor(null);
                  const ok = await reportMenuIngredient(menu, n);
                  toast(ok ? `고마워요! ${menu} · ${n} 제보했어요` : "제보를 저장하지 못했어요");
                }} style={{
                  padding: "8px 14px", borderRadius: "var(--r-pill)", border: "1.5px solid var(--border)",
                  background: "var(--bg)", color: "var(--text-2)", fontSize: 13.5, cursor: "pointer",
                }}>{n}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 버튼도 남긴다 — 스와이프가 익숙하지 않은 사람이 있다 */}
      <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center" }}>
        <button className="tap" onClick={() => answer("never")} aria-label="못 먹어" style={btn("#FFF0F0", "var(--red, #E5484D)")}>🚫<span style={lbl}>못 먹어</span></button>
        <button className="tap" onClick={() => answer("meh")} aria-label="상관없어" style={btn("var(--bg-2)", "var(--text-2)")}>🤷<span style={lbl}>상관없어</span></button>
        <button className="tap" onClick={() => answer("like")} aria-label="좋아" style={btn("#EAF7EF", "var(--green, #30A46C)")}>👍<span style={lbl}>좋아</span></button>
        {phase === "menu" && (
          <button className="tap" onClick={() => answer("best")} aria-label="최고" style={btn("#FFF4E0", "#C05E00")}>⭐<span style={lbl}>최고</span></button>
        )}
      </div>

      <button className="tap" onClick={() => setPhase(phase === "category" ? "ingredient" : "ingredient")}
        style={{ marginTop: 16, background: "none", border: "none", color: "var(--text-3)", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
        나중에 할게요 — 여기까지 저장하고 넘어가기
      </button>
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, marginTop: 2 };
function btn(bg: string, color: string): React.CSSProperties {
  return {
    flex: 1, maxWidth: 96, padding: "12px 6px", borderRadius: 18, border: "none",
    background: bg, color, fontSize: 24, lineHeight: 1, cursor: "pointer",
  };
}

export default function TastePage() {
  return (
    <Suspense fallback={<LoadingCat padding="80px 0" />}>
      <TasteContent />
    </Suspense>
  );
}
