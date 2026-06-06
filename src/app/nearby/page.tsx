"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";

type Place = {
  title: string;
  category: string;
  address: string;
  distance: number | null;
  mapx: string;
  mapy: string;
  link: string;
  phone: string;
};

function NearbyContent() {
  const router = useRouter();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [sort, setSort] = useState<"distance" | "accuracy">("distance");

  useEffect(() => {
    const saved = sessionStorage.getItem("meogja_home_location");
    if (saved) {
      try {
        const loc = JSON.parse(saved);
        if (loc.label) setLocationLabel(loc.label);
        fetchNearby(loc.lng, loc.lat, sort);
        return;
      } catch { /* ignore */ }
    }
    requestLocation();
  }, []);

  function requestLocation() {
    setLocating(true);
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        let label: string | undefined;
        try {
          const hl = sessionStorage.getItem("meogja_home_location");
          if (hl) label = JSON.parse(hl).label;
        } catch { /* ignore */ }
        if (label) setLocationLabel(label);
        fetchNearby(pos.coords.longitude, pos.coords.latitude, sort);
      },
      () => {
        setLocating(false);
        setLoading(false);
        setError("위치 권한을 허용해주세요.");
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }

  async function fetchNearby(x: number, y: number, sortBy: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/nearby?x=${x}&y=${y}&radius=1000&sort=${sortBy}`);
      if (!res.ok) throw new Error("검색 실패");
      const data = await res.json();
      setPlaces(data.items || []);
    } catch {
      setError("주변 식당을 불러올 수 없습니다.");
    }
    setLoading(false);
  }

  function handleSortChange(newSort: "distance" | "accuracy") {
    setSort(newSort);
    const saved = sessionStorage.getItem("meogja_home_location");
    if (saved) {
      try {
        const loc = JSON.parse(saved);
        fetchNearby(loc.lng, loc.lat, newSort);
      } catch { /* ignore */ }
    }
  }

  const categoryShort = (cat: string) => cat.split(" > ").pop() || cat;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", paddingBottom: 32 }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text)", flexShrink: 0 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 18, margin: 0 }}>주변 맛집</h1>
          {locationLabel && <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0 }}>📍 {locationLabel} 기준 1km</p>}
        </div>
      </div>

      {/* 정렬 탭 */}
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 0" }}>
        {(["distance", "accuracy"] as const).map((s) => (
          <button key={s} onClick={() => handleSortChange(s)} style={{
            padding: "7px 16px", borderRadius: "var(--r-pill)", fontSize: 13, fontWeight: 600, cursor: "pointer",
            border: sort === s ? "none" : "1.5px solid var(--border)",
            background: sort === s ? "var(--primary)" : "var(--surface)",
            color: sort === s ? "#fff" : "var(--text-2)",
          }}>
            {s === "distance" ? "📍 거리순" : "⭐ 정확도순"}
          </button>
        ))}
      </div>

      {/* 상태 표시 */}
      {(loading || locating) && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-2)" }}>
          <p style={{ fontSize: 14 }}>{locating ? "📍 위치 확인 중…" : "🔍 주변 식당 검색 중…"}</p>
        </div>
      )}

      {error && !loading && (
        <div style={{ margin: "16px", padding: "14px 16px", borderRadius: 12, background: "#FFF4CC", border: "1.5px solid #F5A623", color: "#7A5A00", fontSize: 14 }}>
          {error}
          <button onClick={requestLocation} style={{ display: "block", marginTop: 8, padding: "8px 16px", borderRadius: "var(--r-pill)", border: "none", background: "var(--primary)", color: "#fff", fontSize: 13, cursor: "pointer" }}>
            다시 시도
          </button>
        </div>
      )}

      {!loading && !error && places.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 16px", color: "var(--text-2)" }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🍽️</p>
          <p style={{ fontSize: 14 }}>주변 1km 이내 식당이 없습니다</p>
        </div>
      )}

      {/* 결과 리스트 */}
      {!loading && places.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px 0" }}>
          {places.map((p, i) => (
            <div key={i} style={{ padding: "14px 16px", borderRadius: 16, background: "var(--surface)", border: "var(--card-border)", boxShadow: "var(--card-shadow)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--text)", flex: 1 }}>{p.title}</p>
                {p.distance !== null && (
                  <span style={{ fontSize: 12, color: "var(--text-3)", flexShrink: 0 }}>
                    {p.distance < 1000 ? `${p.distance}m` : `${(p.distance / 1000).toFixed(1)}km`}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 6 }}>{p.address}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                {p.category && (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: "var(--r-pill)", background: "var(--bg-2)", color: "var(--text-3)" }}>
                    {categoryShort(p.category)}
                  </span>
                )}
                {p.phone && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{p.phone}</span>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <a href={`https://map.kakao.com/link/search/${encodeURIComponent(p.title)}`} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, padding: "8px", borderRadius: 10, background: "#FAE100", color: "#3A1D1D", fontSize: 12, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
                  K 지도
                </a>
                <a href={`https://map.naver.com/p/search/${encodeURIComponent(p.title)}`} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, padding: "8px", borderRadius: 10, background: "#03C75A", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
                  N 지도
                </a>
                {p.link && (
                  <a href={p.link} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, padding: "8px", borderRadius: 10, background: "var(--bg-2)", color: "var(--text-2)", fontSize: 12, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
                    상세 →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NearbyPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--text-2)" }}>로딩 중…</div>}>
      <NearbyContent />
    </Suspense>
  );
}
