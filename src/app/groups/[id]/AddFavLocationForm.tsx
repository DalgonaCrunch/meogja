"use client";

import { useState } from "react";

type Props = {
  groupId: string;
  onAdd: (name: string, address: string, lat: number | null, lng: number | null) => void;
  onCancel: () => void;
};

export default function AddFavLocationForm({ onAdd, onCancel }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{name:string;address:string;lat:number;lng:number}[]>([]);
  const [searching, setSearching] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    const res = await fetch(`/api/geocode?query=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data.places || []);
    setSearching(false);
  }

  return (
    <div style={{ marginBottom: 14, padding: "14px", borderRadius: "var(--r-md)", background: "var(--bg-2)", border: "1px solid var(--border)" }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>즐겨찾는 지역 추가</p>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }}
          placeholder="지역명 입력 (예: 강남역, 판교)"
          style={{ flex: 1, padding: "8px 13px", borderRadius: "var(--r-pill)", border: "1.5px solid var(--border)", background: "var(--card)", fontSize: 13, color: "var(--text)", outline: "none" }}
          onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
        <button className="tap" onClick={search} disabled={searching} style={{ padding: "8px 14px", borderRadius: "var(--r-pill)", border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {searching ? "…" : "검색"}
        </button>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 16, cursor: "pointer" }}>✕</button>
      </div>
      {results.length > 0 && (
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
          {results.map((r, i) => (
            <button key={i} className="tap" onClick={() => onAdd(r.name, r.address, r.lat, r.lng)} style={{
              display: "block", width: "100%", padding: "10px 13px", textAlign: "left",
              background: "var(--card)", border: "none", borderBottom: i < results.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer",
            }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{r.name}</p>
              <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{r.address}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
