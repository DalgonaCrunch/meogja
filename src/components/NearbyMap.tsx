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
type KPoint = { x: number; y: number };
type KProjection = {
  containerPointFromCoords(ll: KLatLng): KPoint;
  coordsFromContainerPoint(pt: KPoint): KLatLng;
};
type KMap = {
  setBounds(b: KBounds, ...padding: number[]): void;
  setCenter(ll: KLatLng): void;
  getCenter(): KLatLng;
  setLevel(level: number): void;
  getLevel(): number;
  getProjection(): KProjection;
  relayout(): void;
};
type KOverlay = {
  setMap(map: KMap | null): void;
  setZIndex(z: number): void;
};
type KEventTarget = KMap;
type KakaoMaps = {
  load(cb: () => void): void;
  /** 화면 좌표 객체. 평범한 {x,y} 를 넘기면 SDK 안에서 터진다(실측) */
  Point: new (x: number, y: number) => KPoint;
  event: {
    addListener(target: KEventTarget, type: string, handler: () => void): void;
    removeListener(target: KEventTarget, type: string, handler: () => void): void;
  };
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

/* 겹친 마커를 하나로 묶어 보여주는 동그라미.
   묶었어도 **가게 이름은 보여준다** — 이름이 없으면 뭐가 묶였는지 몰라서 누르기 전에는
   쓸모가 없다. 좁은 폭에 다 못 넣으니 두 곳까지 적고 나머지는 개수로 알린다. */
function makeClusterEl(count: number, emoji: string, names: string[]): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;";

  const bubble = document.createElement("div");
  bubble.style.cssText = [
    "width:44px", "height:44px", "border-radius:50%",
    "display:flex", "flex-direction:column", "align-items:center", "justify-content:center",
    "background:#fff", "border:2.5px solid var(--primary)",
    "box-shadow:0 3px 10px rgba(0,0,0,.24)", "line-height:1",
  ].join(";");

  const top = document.createElement("div");
  top.textContent = emoji;
  top.style.cssText = "font-size:13px;";
  const num = document.createElement("div");
  num.textContent = String(count);
  num.style.cssText = "font-size:12.5px;font-weight:800;color:var(--primary);margin-top:1px;";
  bubble.appendChild(top);
  bubble.appendChild(num);

  const tip = document.createElement("div");
  tip.style.cssText = [
    "width:0", "height:0", "margin-top:-2px",
    "border-left:5px solid transparent", "border-right:5px solid transparent",
    "border-top:7px solid #fff",
    "filter:drop-shadow(0 2px 1px rgba(0,0,0,.18))",
  ].join(";");

  const label = document.createElement("div");
  const shown = names.slice(0, 2);
  const rest = count - shown.length;
  label.textContent = shown.join(" · ") + (rest > 0 ? ` +${rest}곳` : "");
  label.style.cssText = [
    "margin-top:3px", "max-width:150px",
    "overflow:hidden", "text-overflow:ellipsis", "white-space:nowrap",
    "font-size:11px", "font-weight:700",
    "padding:2px 8px", "border-radius:99px",
    "background:rgba(255,255,255,.96)", "color:var(--text, #333)",
    "box-shadow:0 1px 4px rgba(0,0,0,.18)",
  ].join(";");

  wrap.appendChild(bubble);
  wrap.appendChild(tip);
  wrap.appendChild(label);
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
  /** 지도를 띄울 수 없을 때(키 없음·SDK 실패) 알린다. 지도가 기본 화면이므로
   *  부르는 쪽이 목록으로 되돌려 결과가 안 보이는 상황을 막는다. */
  onUnavailable?: () => void;
  /** 사용자가 지도를 밀거나 줌을 바꿔 멈췄을 때의 화면 중심 (x=경도, y=위도) */
  onMoved?: (c: { x: number; y: number }) => void;
};

export default function NearbyMap({
  places, center, getEmoji, selectedIndex, onSelect, height = 420, onUnavailable, onMoved,
}: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KMap | null>(null);
  const overlaysRef = useRef<KOverlay[]>([]);
  const meRef = useRef<KOverlay | null>(null);
  /* 화면을 맞춘 대상이 무엇이었는지 기억한다. 마커를 고를 때마다 다시 맞추면
     사용자가 확대·이동해 둔 화면이 매번 원위치로 튕긴다. */
  const fittedRef = useRef<string>("");
  const [loaded, setLoaded] = useState<"loading" | "ready" | "error">("loading");
  /* 줌·이동이 끝나면 다시 뭉쳐야 한다(겹침은 화면 픽셀 기준이라 줌에 따라 달라진다).
     화면이 실제로 바뀐 횟수를 세어 마커 그리기 effect 를 다시 돌린다. */
  const [epoch, setEpoch] = useState(0);
  /* 더 확대할 수 없을 만큼 붙어 있는 자리를 눌렀을 때, 그 안의 가게들을 동그랗게
     펼쳐 보여준다. 어느 화면 상태에서 펼친 것인지(epoch) 같이 들고 있어서
     지도를 움직이면 저절로 접힌다. */
  const [spread, setSpread] = useState<{ members: number[]; epoch: number } | null>(null);

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

    /* ── 겹치는 마커 뭉치기 ────────────────────────────────────────
       이름표가 92px 이나 되므로 가까운 마커끼리는 이름이 서로를 덮는다.
       겹침은 지구 위 거리가 아니라 **화면 픽셀** 문제다 — 줌마다 달라진다.
       그래서 화면 좌표로 바꿔 놓고 가까운 것끼리 묶는다. 고른 가게는 절대
       묶지 않는다(눌러서 보고 있는 것이 사라지면 안 된다). */
    /* 얼마나 가까울 때 묶을지. 넉넉하게 잡으면(예전 62px) 조금만 가까워도 묶여서
       지도가 동그라미 몇 개로 뭉뚱그려진다 — 실물에서 "너무 합쳐져 안 보인다".
       마커 동그라미가 38px 이니, 실제로 겹치는 정도만 묶는다. 이름표는 서로
       조금 겹칠 수 있지만, 묶여서 안 보이는 것보다 낫다. */
    const CLUSTER_PX = 36;
    const proj = map.getProjection();
    type Spot = { i: number; pos: KLatLng; pt: KPoint };
    const spots: Spot[] = [];
    places.forEach((p, i) => {
      const lat = parseFloat(p.mapy);
      const lng = parseFloat(p.mapx);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return; // 좌표 없는 항목은 지도에서 뺀다
      const pos = new maps.LatLng(lat, lng);
      bounds.extend(pos);
      spots.push({ i, pos, pt: proj.containerPointFromCoords(pos) });
    });

    const groups: Spot[][] = [];
    for (const sp of spots) {
      if (sp.i === selectedIndex) { groups.push([sp]); continue; }  // 고른 것은 홀로
      const near = groups.find(g =>
        g[0].i !== selectedIndex &&
        Math.hypot(g[0].pt.x - sp.pt.x, g[0].pt.y - sp.pt.y) < CLUSTER_PX);
      if (near) near.push(sp); else groups.push([sp]);
    }

    groups.forEach((g) => {
      if (g.length === 1) {
        const { i, pos } = g[0];
        const p = places[i];
        const active = selectedIndex === i;
        const el = makeMarkerEl(getEmoji(p), p.title, active);
        el.addEventListener("click", () => onSelect(active ? null : i));
        const ov = new maps.CustomOverlay({
          position: pos, content: el, yAnchor: 1, zIndex: active ? 10 : 2,
        });
        ov.setMap(map);
        overlaysRef.current.push(ov);
        return;
      }
      const head = g[0];

      /* 이 자리를 펼쳐 보라고 한 상태면 가게들을 동그랗게 벌려 놓는다.
         (같은 건물에 여러 곳이 있으면 더 확대해도 안 갈라진다 — 그때 쓸 수 있는
         유일한 출구다. 화면 좌표로 벌린 뒤 좌표로 되돌린다.) */
      const spreading = spread && spread.epoch === epoch && spread.members.includes(head.i);
      if (spreading) {
        const R = 58;
        g.forEach((sp, k) => {
          const a = (2 * Math.PI * k) / g.length - Math.PI / 2;
          const pos = proj.coordsFromContainerPoint(new maps.Point(
            head.pt.x + Math.cos(a) * R,
            head.pt.y + Math.sin(a) * R,
          ));
          const p = places[sp.i];
          const active = selectedIndex === sp.i;
          const el = makeMarkerEl(getEmoji(p), p.title, active);
          el.addEventListener("click", () => onSelect(active ? null : sp.i));
          const ov = new maps.CustomOverlay({ position: pos, content: el, yAnchor: 1, zIndex: active ? 10 : 4 });
          ov.setMap(map);
          overlaysRef.current.push(ov);
        });
        return;
      }

      // 여러 곳이 겹친 자리 — 개수를 보여준다. 누르면 확대하고, 더 못 하면 펼친다
      const el = makeClusterEl(g.length, getEmoji(places[head.i]), g.map(sp => places[sp.i].title));
      el.addEventListener("click", () => {
        const lv = map.getLevel();
        /* 이미 많이 확대된 상태(레벨 1~2)면 더 확대해도 안 갈라진다 — 바로 펼친다.
           예전에는 레벨 1 에서만 펼쳐서, 2 에서 몇 번을 눌러도 아무 일이 없었다. */
        if (lv > 2) {
          const gb = new maps.LatLngBounds();
          g.forEach(sp => gb.extend(sp.pos));
          if (!gb.isEmpty()) map.setBounds(gb, 80, 60, 60, 60);
          if (map.getLevel() >= lv) map.setLevel(Math.max(1, lv - 1)); // 한 점이면 bounds 로는 안 변한다
          setEpoch(e => e + 1);
          return;
        }
        // 최대 확대인데도 붙어 있다 → 동그랗게 펼친다
        setSpread({ members: g.map(sp => sp.i), epoch });
      });
      const ov = new maps.CustomOverlay({
        position: head.pos, content: el, yAnchor: 1, zIndex: 3,
      });
      ov.setMap(map);
      overlaysRef.current.push(ov);
    });

    // 목록이나 기준 위치가 실제로 바뀌었을 때만 화면을 다시 맞춘다(선택은 제외)
    const fitKey = `${center ? `${center.x},${center.y}` : "-"}|${places.map(p => `${p.mapx},${p.mapy}`).join(";")}`;
    if (!bounds.isEmpty() && fittedRef.current !== fitKey) {
      // 좌우 여백을 넉넉히. 마커 옆에 가게 이름표가 붙어 있어서 여백이 좁으면
      // 가장자리 마커의 이름이 지도 밖으로 잘린다(폭 92px 짜리가 중앙 기준 양옆).
      map.setBounds(bounds, 64, 56, 40, 56);
      fittedRef.current = fitKey;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, places, center, selectedIndex, epoch, spread]);

  /* 콜백이 바뀌어도 리스너를 다시 달지 않게 최신 것을 담아 둔다
     (렌더 중에 ref 를 건드리면 안 된다 — effect 에서 갈아 끼운다) */
  const onMovedRef = useRef(onMoved);
  useEffect(() => { onMovedRef.current = onMoved; }, [onMoved]);

  // ── 지도를 밀거나 줌을 바꾸면 그 중심을 알린다 ("이 지역에서 다시 찾기")
  useEffect(() => {
    if (status !== "ready" || !mapRef.current || !window.kakao) return;
    const maps = window.kakao.maps;
    const map = mapRef.current;
    /* 밀어서 옮긴 것은 부모에 알린다("이 지역에서 다시 찾기"). 줌은 알리지 않는다 —
       클러스터를 눌러 확대하는 것까지 "옮겼다" 로 세면 다시 찾기가 계속 뜬다. */
    const onDrag = () => {
      const c = map.getCenter();
      onMovedRef.current?.({ x: c.getLng(), y: c.getLat() });
      setEpoch((e) => e + 1);
    };
    const onZoom = () => setEpoch((e) => e + 1);
    maps.event.addListener(map, "dragend", onDrag);
    maps.event.addListener(map, "zoom_changed", onZoom);
    return () => {
      maps.event.removeListener(map, "dragend", onDrag);
      maps.event.removeListener(map, "zoom_changed", onZoom);
    };
  }, [status]);

  // ── 지도를 못 띄우면 부르는 쪽에 알린다 (지도가 기본 화면이라 목록으로 되돌려야 한다)
  useEffect(() => {
    if (status === "nokey" || status === "error") onUnavailable?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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
