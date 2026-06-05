"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";

type Restaurant = {
  title: string;
  address: string;
  category: string;
  distance?: number;
  mapx?: string;
  mapy?: string;
  roadAddress?: string;
  telephone?: string;
};

function SearchContent() {
  const router = useRouter();
  const [menus, setMenus] = useState<string[]>([]);
  const [results, setResults] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{lat:number;lng:number}|null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("meogja_preset_menus");
    if (raw) {
      try { setMenus(JSON.parse(raw)); } catch {}
      sessionStorage.removeItem("meogja_preset_menus");
    }
    requestLocation();
  }, []);

  useEffect(() => {
    if (menus.length > 0 && location) search();
  }, [menus, location]);

  function requestLocation() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
      () => { setError("위치 정보를 가져올 수 없습니다. 위치 권한을 허용해주세요."); setLocating(false); }
    );
  }

  async function search() {
    if (!location || menus.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const query = menus[0];
      const res = await fetch(`/api/search?query=${encodeURIComponent(query)}&lat=${location.lat}&lng=${location.lng}&radius=1000`);
      if (!res.ok) throw new Error("검색 실패");
      const data = await res.json();
      setResults(data.items || []);
    } catch (e) {
      setError("검색 중 오류가 발생했습니다.");
    }
    setLoading(false);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, padding:"16px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => router.back()} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"var(--text)" }}>←</button>
        <h1 style={{ fontFamily:"var(--font-display)", fontSize:20 }}>주변 식당 찾기</h1>
      </div>

      {menus.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {menus.map(m => (
            <span key={m} style={{ padding:"6px 12px", borderRadius:"var(--r-pill)", background:"var(--primary)", color:"#fff", fontSize:13, fontWeight:600 }}>{m}</span>
          ))}
        </div>
      )}

      {locating && (
        <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text-2)" }}>📍 위치 확인 중…</div>
      )}

      {error && (
        <div style={{ padding:"14px 16px", borderRadius:12, background:"#FFF4CC", border:"1.5px solid #F5A623", color:"#7A5A00", fontSize:14 }}>
          {error}
          <button onClick={requestLocation} style={{ display:"block", marginTop:8, padding:"8px 16px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontSize:13, cursor:"pointer" }}>다시 시도</button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text-2)" }}>🔍 검색 중…</div>
      )}

      {!loading && results.length === 0 && location && !error && (
        <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text-2)" }}>
          <p style={{ fontSize:14, marginBottom:16 }}>검색 결과가 없습니다</p>
          <button onClick={search} style={{ padding:"10px 24px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontSize:14, cursor:"pointer" }}>다시 검색</button>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {results.map((r, i) => (
          <div key={i} style={{ padding:"14px 16px", borderRadius:16, background:"var(--surface)", border:"var(--card-border)", boxShadow:"var(--card-shadow)" }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10, marginBottom:6 }}>
              <p style={{ fontFamily:"var(--font-display)", fontSize:16, color:"var(--text)", flex:1 }} dangerouslySetInnerHTML={{ __html: r.title }} />
              {r.distance && <span style={{ fontSize:12, color:"var(--text-3)", flexShrink:0 }}>{r.distance < 1000 ? `${r.distance}m` : `${(r.distance/1000).toFixed(1)}km`}</span>}
            </div>
            <p style={{ fontSize:12, color:"var(--text-2)", marginBottom:8 }}>{r.roadAddress || r.address}</p>
            {r.category && <span style={{ fontSize:11, padding:"2px 8px", borderRadius:"var(--r-pill)", background:"var(--bg-2)", color:"var(--text-3)" }}>{r.category}</span>}
            <div style={{ display:"flex", gap:8, marginTop:10 }}>
              <a href={`https://map.naver.com/p/search/${encodeURIComponent((r.title||"").replace(/<[^>]*>/g,"") + " " + (r.address||""))}`} target="_blank" rel="noopener noreferrer" style={{ flex:1, padding:"8px", borderRadius:10, background:"#03C75A", color:"#fff", fontSize:12, fontWeight:700, textDecoration:"none", textAlign:"center" }}>N 지도</a>
              <a href={`https://map.kakao.com/link/search/${encodeURIComponent((r.title||"").replace(/<[^>]*>/g,""))}`} target="_blank" rel="noopener noreferrer" style={{ flex:1, padding:"8px", borderRadius:10, background:"#FAE100", color:"#3A1D1D", fontSize:12, fontWeight:700, textDecoration:"none", textAlign:"center" }}>K 지도</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ padding:40, textAlign:"center", color:"var(--text-2)" }}>로딩 중…</div>}>
      <SearchContent />
    </Suspense>
  );
}
