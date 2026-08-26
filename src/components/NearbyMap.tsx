"use client";

import { useEffect, useRef, useState } from "react";

export type MapPlace = {
  title: string;
  category: string;
  address: string;
  distance: number | null;
  mapx: string;
  mapy: string;
  link: string;
  phone: string;
};

/* ── 카카오 지도 SDK 중 실제로 쓰는 것만 좁게 선언한다 ─────────────
   전역 any 를 두면 오타가 런타임까지 살아남는다. 쓰는 만큼만 적는다. */
type KLatLng = { getLat(): number; getLng(): number };
type KBounds = { extend(ll: KLatLng): void; isEmpty(): boolean };
type KMap = {
  setBounds(b: KBounds, ...padding: number[]): void;
  setCenter(ll: KLatLng): void;
  setLevel(level: number): void;
  relayout(): void;
};
type KOverlay = {
  setMap(map: KMap | null): void;
  setZIndex(z: number): void;
};
type KakaoMaps = {
  load(cb: () => void): void;
  LatLng: new (lat: number, lng: number) => KLatLng;
  LatLngBounds: new () => KBounds;
  Map: new (container: HTMLElement, opts: { center: KLatLng; level: number }) => KMap;
  CustomOverlay: new (opts: {
    position: KLatLng;
    content: HTMLElement;
    yAnchor?: number;
    zIndex?: number;
  }) => KOverlay;
};

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

/* SDK 는 앱 전체에서 한 번만 받는다. 화면을 오갈 때마다 <script> 를 다시
   붙이면 kakao.maps.load 콜백이 중복 실행된다. */
let sdkPromise: Promise<void> | null = null;

function loadKakaoSdk(appkey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no-window"));
  if (window.kakao?.maps?.LatLng) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    // autoload=false → 아래 kakao.maps.load() 로 우리가 시점을 잡는다
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appkey}&autoload=false`;
    script.async = true;
    script.onload = () => {
      const maps = window.kakao?.maps;
      if (!maps) { sdkPromise = null; reject(new Error("sdk-broken")); return; }
      maps.load(() => resolve());
    };
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("sdk-network"));
    };
    document.head.appendChild(script);
  });

  return sdkPromise;
}

function makeMarkerEl(emoji: string, label: string, active: boolean): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = [
    "display:flex", "flex-direction:column", "align-items:center",
    "cursor:pointer", "transform:translateY(0)",
    "transition:transform .15s ease",
  ].join(";");

  const bubble = document.createElement("div");
  bubble.textContent = emoji;
  bubble.style.cssText = [
    "width:38px", "height:38px", "border-radius:50%",
    "display:flex", "align-items:center", "justify-content:center",
    "font-size:20px", "line-height:1",
    `background:${active ? "var(--primary)" : "#fff"}`,
    `border:2.5px solid ${active ? "#fff" : "var(--primary)"}`,
    `box-shadow:0 3px 10px rgba(0,0,0,${active ? ".38" : ".22"})`,
    active ? "transform:scale(1.18)" : "transform:scale(1)",
    "transition:transform .15s ease",
  ].join(";");

  const tip = document.createElement("div");
  tip.style.cssText = [
    "width:0", "height:0", "margin-top:-2px",
    "border-left:5px solid transparent",
    "border-right:5px solid transparent",
    `border-top:7px solid ${active ? "var(--primary)" : "#fff"}`,
    `filter:drop-shadow(0 2px 1px rgba(0,0,0,.18))`,
  ].join(";");

  const name = document.createElement("div");
  name.textContent = label;
  name.style.cssText = [
    "margin-top:3px", "max-width:92px",
    "overflow:hidden", "text-overflow:ellipsis", "white-space:nowrap",
    "font-size:11px", "font-weight:700",
    "padding:2px 7px", "border-radius:99px",
    `background:${active ? "var(--primary)" : "rgba(255,255,255,.94)"}`,
    `color:${active ? "#fff" : "var(--text, #333)"}`,
    "box-shadow:0 1px 4px rgba(0,0,0,.18)",
  ].join(";");

  wrap.appendChild(bubble);
  wrap.appendChild(tip);
  wrap.appendChild(name);
  return wrap;
}

function makeMeEl(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative;width:22px;height:22px;";

  const pulse = document.createElement("div");
  pulse.style.cssText = [
    "position:absolute", "inset:-9px", "border-radius:50%",
    "background:rgba(59,130,246,.22)",
    "animation:meogja-map-pulse 1.8s ease-out infinite",
  ].join(";");

  const dot = document.createElement("div");
  dot.style.cssText = [
    "position:absolute", "inset:0", "border-radius:50%",
    "background:#3B82F6", "border:3px solid #fff",
    "box-shadow:0 2px 6px rgba(0,0,0,.3)",
  ].join(";");

  wrap.appendChild(pulse);
  wrap.appendChild(dot);
  return wrap;
}

type Props = {
  places: MapPlace[];
  /** 검색 기준 위치 (x=경도, y=위도) */
  center: { x: number; y: number } | null;
  /** 카테고리 → 이모지. 목록 카드와 같은 규칙을 그대로 넘겨받는다 */
  getEmoji: (place: MapPlace) => string;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  height?: number | string;
};

export default function NearbyMap({
  places, center, getEmoji, selectedIndex, onSelect, height = 420,
}: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KMap | null>(null);
  const overlaysRef = useRef<KOverlay[]>([]);
  const meRef = useRef<KOverlay | null>(null);
  const [loaded, setLoaded] = useState<"loading" | "ready" | "error">("loading");

  const appkey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  // 키가 없는 것은 상태 변화가 아니라 처음부터 정해진 사실이다 — 계산해서 쓴다
  const status = appkey ? loaded : "nokey";

  // ── SDK 로드 + 지도 1회 생성
  useEffect(() => {
    if (!appkey) return;
    let alive = true;

    loadKakaoSdk(appkey)
      .then(() => {
        if (!alive || !boxRef.current || mapRef.current) return;
        const maps = window.kakao!.maps;
        const start = center
          ? new maps.LatLng(center.y, center.x)
          : new maps.LatLng(37.5665, 126.978); // 좌표를 아직 모를 때만 쓰는 임시 중심
        mapRef.current = new maps.Map(boxRef.current, { center: start, level: 4 });
        setLoaded("ready");
      })
      .catch(() => { if (alive) setLoaded("error"); });

    return () => { alive = false; };
    // center 는 최초 중심에만 쓴다. 갱신은 아래 마커 effect 의 setBounds 가 맡는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appkey]);

  // ── 마커 갱신 (목록·선택이 바뀔 때마다 통째로 다시 그린다. 15개라 충분히 싸다)
  useEffect(() => {
    if (status !== "ready" || !mapRef.current || !window.kakao) return;
    const maps = window.kakao.maps;
    const map = mapRef.current;

    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];
    meRef.current?.setMap(null);
    meRef.current = null;

    const bounds = new maps.LatLngBounds();

    if (center) {
      const pos = new maps.LatLng(center.y, center.x);
      const me = new maps.CustomOverlay({ position: pos, content: makeMeEl(), zIndex: 1 });
      me.setMap(map);
      meRef.current = me;
      bounds.extend(pos);
    }

    places.forEach((p, i) => {
      const lat = parseFloat(p.mapy);
      const lng = parseFloat(p.mapx);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return; // 좌표 없는 항목은 지도에서 뺀다
      const pos = new maps.LatLng(lat, lng);
      const active = selectedIndex === i;
      const el = makeMarkerEl(getEmoji(p), p.title, active);
      el.addEventListener("click", () => onSelect(active ? null : i));
      const ov = new maps.CustomOverlay({
        position: pos, content: el, yAnchor: 1, zIndex: active ? 10 : 2,
      });
      ov.setMap(map);
      overlaysRef.current.push(ov);
      bounds.extend(pos);
    });

    if (!bounds.isEmpty()) map.setBounds(bounds, 60, 30, 30, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, places, center, selectedIndex]);

  // ── 탭 전환 등으로 컨테이너 크기가 0 이었다가 살아나면 다시 재보게 한다
  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    const t = setTimeout(() => mapRef.current?.relayout(), 60);
    return () => clearTimeout(t);
  }, [status]);

  const boxStyle: React.CSSProperties = {
    width: "100%", height, borderRadius: 16, overflow: "hidden",
    border: "1.5px solid var(--border)", background: "var(--bg-2)",
  };

  if (status === "nokey" || status === "error") {
    return (
      <div style={{ ...boxStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 20, textAlign: "center" }}>
        <img src="/mascot/avatars/cat-31.png" alt="" style={{ width: 64, height: 64, objectFit: "contain", mixBlendMode: "multiply" }} />
        <p style={{ fontFamily: "var(--font-display)", fontSize: 15, margin: 0 }}>지도를 불러오지 못했어요</p>
        <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: 0, lineHeight: 1.5 }}>
          {status === "nokey"
            ? "지도 키가 아직 설정되지 않았어요. 목록으로 봐주세요."
            : "잠시 후 다시 시도하거나 목록으로 봐주세요."}
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <style>{`@keyframes meogja-map-pulse{0%{transform:scale(.6);opacity:.85}100%{transform:scale(1.5);opacity:0}}`}</style>
      <div ref={boxRef} style={boxStyle} />
      {status === "loading" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-2)", borderRadius: 16 }}>
          <p style={{ fontSize: 13, color: "var(--text-3)" }}>🗺️ 지도 여는 중…</p>
        </div>
      )}
      {/* 안내는 지도가 실제로 떴을 때만. 실패 화면 아래에 붙어 있으면 거짓말이 된다 */}
      {status === "ready" && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 2px 0" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#3B82F6", flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>파란 점이 내 위치예요. 마커를 누르면 가게가 보여요</span>
        </div>
      )}
    </div>
  );
}
