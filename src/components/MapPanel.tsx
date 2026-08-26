"use client";

/**
 * 지도 + 고른 가게 카드. /nearby 와 /search 가 같이 쓴다.
 *
 * 예전에는 이 덩어리가 /nearby 안에만 인라인으로 있어서, 홈에서 들어가는
 * /search 화면에는 지도가 아예 없었다. 카드를 세 번째로 복사하지 않으려고
 * 컴포넌트로 뽑았다.
 */

import { useState } from "react";
import NearbyMap, { type MapPlace } from "@/components/NearbyMap";
import { trackPlaceClick, getClickCount } from "@/lib/placeClicks";
import { sharePlace } from "@/lib/shareResult";
import { toast } from "@/lib/dialog";
import {
  FOOD_EMOJIS, categoryKey, localFoodIcon, catShort, fmtDist,
  kakaoUrl, naverUrl, googleUrl, distanceMeters,
} from "@/lib/foodCategory";

/* 이만큼 밀었으면 "이 지역에서 다시 찾기" 를 보여준다. 조금 흔들린 것으로
   버튼이 깜빡이면 성가시다. */
const MOVED_THRESHOLD_M = 400;

type Props = {
  places: MapPlace[];
  /** 지도 기준점 — x=경도, y=위도 */
  center: { x: number; y: number } | null;
  /** 가게 이름 → 사진 URL (없으면 카테고리 아이콘으로 떨어진다) */
  images?: Record<string, string>;
  selectedIndex: number | null;
  onSelect: (i: number | null) => void;
  onFindGroup: (p: MapPlace) => void;
  height?: string;
  /** 지도를 못 띄웠을 때 (부르는 쪽이 목록으로 되돌린다) */
  onUnavailable?: () => void;
  /** "이 지역에서 다시 찾기" — 지도를 밀어 옮긴 위치로 다시 검색한다 */
  onSearchHere?: (c: { x: number; y: number }) => void;
  /** 다시 찾는 중이면 버튼을 잠근다 */
  searching?: boolean;
  /** 우리 앱에서 쌓인 신호 — 리뷰가 없는 우리가 신뢰를 만드는 방법이다.
   *  clicks: 이 가게를 눌러본 횟수 / pats: 이 가게로 만들어진 먹자팟 수 */
  stats?: { clicks?: Record<string, number>; pats?: Record<string, number> };
};

export default function MapPanel({
  places, center, images = {}, selectedIndex, onSelect, onFindGroup,
  height = "min(58vh, 460px)", onUnavailable, onSearchHere, searching = false, stats,
}: Props) {
  const picked = selectedIndex !== null ? places[selectedIndex] : undefined;
  /* 사용자가 지도를 밀어 옮긴 중심. 기준점에서 멀어지면 다시 찾기를 권한다.
     어느 기준점에서 밀었는지(baseKey)를 함께 들고 있어서, 새로 검색해 기준점이
     바뀌면 옛 권유가 저절로 무효가 된다(effect 로 지우지 않아도 된다). */
  const baseKey = center ? `${center.x},${center.y}` : "-";
  const [moved, setMoved] = useState<{ at: { x: number; y: number }; base: string } | null>(null);
  const movedTo = moved && moved.base === baseKey ? moved.at : null;
  const far = !!(onSearchHere && movedTo && center && distanceMeters(center, movedTo) > MOVED_THRESHOLD_M);

  return (
    <div style={{ padding: "12px 16px 0", position: "relative" }}>
      <NearbyMap
        places={places}
        center={center}
        getEmoji={(p) => FOOD_EMOJIS[categoryKey(p.category)] || "🍽️"}
        selectedIndex={selectedIndex}
        onSelect={onSelect}
        height={height}
        onUnavailable={onUnavailable}
        onMoved={onSearchHere ? (c) => setMoved({ at: c, base: baseKey }) : undefined}
      />

      {/* 지도를 옮겼으면 그 자리에서 다시 찾도록 권한다 */}
      {far && (
        <button className="tap" disabled={searching}
          onClick={() => { if (movedTo) { onSearchHere!(movedTo); setMoved(null); } }}
          style={{
            position: "absolute", left: "50%", transform: "translateX(-50%)",
            bottom: 58, zIndex: 30,
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 16px", borderRadius: "var(--r-pill)", border: "none",
            background: "var(--primary)", color: "#fff",
            fontFamily: "var(--font-display)", fontSize: 13.5,
            boxShadow: "0 4px 14px rgba(0,0,0,.28)",
            cursor: searching ? "default" : "pointer", opacity: searching ? .6 : 1,
          }}>
          <span style={{ display: "inline-block", animation: searching ? "spin .8s linear infinite" : "none" }}>↻</span>
          {searching ? "찾는 중…" : "이 지역에서 다시 찾기"}
        </button>
      )}

      {picked && (() => {
        const p = picked;
        const ck = categoryKey(p.category);
        const imgUrl = images[p.title] || localFoodIcon(p.category);
        const hasRealImg = !!images[p.title];
        return (
          <div
            /* 지도가 화면을 거의 다 쓰므로 카드는 접힌 아래에 생긴다.
               마커를 눌렀는데 아무 일도 없어 보이면 안 되니 직접 끌어와 보여준다. */
            ref={(el) => { el?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }}
            style={{ marginTop: 10, background: "var(--surface)", borderRadius: 16, border: "var(--card-border)", boxShadow: "var(--card-shadow)", overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 12, padding: "12px 14px" }}>
              <div style={{ width: 64, height: 64, borderRadius: 14, overflow: "hidden", flexShrink: 0, background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {imgUrl
                  ? <img src={imgUrl} alt={ck} referrerPolicy="no-referrer"
                      style={{ width: "100%", height: "100%", objectFit: hasRealImg ? "cover" : "contain", padding: hasRealImg ? 0 : 5 }} />
                  : <img src="/mascot/tabs/food.png" alt="" style={{ width: 40, height: 40, objectFit: "contain" }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 16, lineHeight: 1.3 }}>{p.title}</span>
                  <button onClick={() => onSelect(null)} aria-label="닫기"
                    style={{ background: "none", border: "none", fontSize: 16, color: "var(--text-3)", cursor: "pointer", flexShrink: 0, lineHeight: 1 }}>✕</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                  {p.category && (
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: "var(--r-pill)", background: "var(--bg-2)", color: "var(--text-3)" }}>{catShort(p.category)}</span>
                  )}
                  {p.distance !== null && <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>📍 {fmtDist(p.distance)}</span>}
                </div>
                {p.address && <p style={{ fontSize: 11.5, color: "var(--text-3)", margin: "0 0 8px" }}>{p.address}</p>}
                {/* 우리 앱에 쌓인 신호. 남의 리뷰를 빌려오지 않고 우리 것만 보여준다 */}
                {(() => {
                  const patCount = stats?.pats?.[p.title] ?? 0;
                  const clicks = stats?.clicks ? getClickCount(p.title, stats.clicks) : 0;
                  if (!patCount && clicks < 3) return null;
                  return (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "0 0 8px" }}>
                      {patCount > 0 && (
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: "var(--r-pill)", background: "#FFF4E0", color: "#C05E00", fontWeight: 700 }}>
                          🍚 먹자팟 {patCount}개
                        </span>
                      )}
                      {clicks >= 3 && (
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: "var(--r-pill)", background: "#FFF0E0", color: "#D65000", fontWeight: 700 }}>
                          🔥 {clicks}명이 봤어요
                        </span>
                      )}
                    </div>
                  );
                })()}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <a href={kakaoUrl(p)} target="_blank" rel="noopener noreferrer" onClick={() => trackPlaceClick(p.title)}
                    style={{ padding: "5px 12px", borderRadius: 8, background: "#FAE100", color: "#3A1D1D", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>카카오맵</a>
                  <a href={naverUrl(p)} target="_blank" rel="noopener noreferrer" onClick={() => trackPlaceClick(p.title)}
                    style={{ padding: "5px 12px", borderRadius: 8, background: "#03C75A", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>네이버맵</a>
                  <a href={googleUrl(p)} target="_blank" rel="noopener noreferrer" onClick={() => trackPlaceClick(p.title)}
                    style={{ padding: "5px 12px", borderRadius: 8, background: "#4285F4", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>구글맵</a>
                  {/* 정하고 나서 끊기지 않게 — 예약 인프라를 만들 이유는 없고, 전화와
                      예약 페이지로 넘겨주는 것만으로 흐름이 이어진다 */}
                  {p.phone && (
                    <a href={`tel:${p.phone.replace(/[^0-9+]/g, "")}`} onClick={() => trackPlaceClick(p.title)}
                      style={{ padding: "5px 12px", borderRadius: 8, background: "var(--green, #30A46C)", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>📞 전화</a>
                  )}
                  <a href={`https://booking.naver.com/booking/search?query=${encodeURIComponent(p.title)}`}
                    target="_blank" rel="noopener noreferrer" onClick={() => trackPlaceClick(p.title)}
                    style={{ padding: "5px 12px", borderRadius: 8, background: "var(--bg-2)", color: "var(--text-2)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>예약 찾기</a>
                  {/* 가게도 공유된다 — 메뉴를 정한 다음에는 "어디서" 가 남는다 */}
                  <button className="tap" onClick={async () => {
                    const r = await sharePlace({ name: p.title, category: p.category, address: p.address });
                    if (r === "copied") toast("링크를 복사했어요");
                  }} style={{ padding: "5px 12px", borderRadius: 8, background: "var(--primary)", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🔗 공유</button>
                </div>
                <button className="tap" onClick={() => onFindGroup(p)} style={{
                  marginTop: 6, width: "100%", padding: "8px", borderRadius: 10, border: "none",
                  background: "var(--primary)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>🍽️ 같이 먹을 사람 구하기</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/** 목록/지도 전환 토글. 두 화면이 같은 모양을 쓰도록 여기 둔다. */
export function ViewToggle({ view, onChange }: { view: "list" | "map"; onChange: (v: "list" | "map") => void }) {
  return (
    <div style={{ display: "flex", background: "var(--bg-2)", borderRadius: "var(--r-pill)", padding: 3, gap: 2, flexShrink: 0 }}>
      {([["list", "목록", "☰"], ["map", "지도", "🗺️"]] as const).map(([v, label, icon]) => (
        <button key={v} className="tap" onClick={() => onChange(v)} aria-pressed={view === v} style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "5px 11px", borderRadius: "var(--r-pill)", border: "none", cursor: "pointer",
          fontSize: 12.5, fontWeight: 700,
          background: view === v ? "var(--surface)" : "transparent",
          color: view === v ? "var(--primary)" : "var(--text-3)",
          boxShadow: view === v ? "0 1px 3px rgba(0,0,0,.12)" : "none",
        }}>
          <span style={{ fontSize: 13 }}>{icon}</span>{label}
        </button>
      ))}
    </div>
  );
}
