"use client";

import { useEffect, useState } from "react";
import { LOADING_CATS, randomLoadingCat } from "@/lib/mascot";

interface Props {
  text?: string;
  size?: number;
  padding?: string;
}

/**
 * 먹자냥이 통통 튀는 로딩 표시.
 * 랜덤 선택은 마운트 후에 — 초기값으로 뽑으면 프리렌더 HTML과 하이드레이션이 어긋난다.
 */
export default function LoadingCat({ text = "불러오는 중…", size = 72, padding = "40px 0" }: Props) {
  const [src, setSrc] = useState(LOADING_CATS[0]);

  useEffect(() => { setSrc(randomLoadingCat()); }, []);

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding, gap:4 }}>
      <img
        src={src}
        alt=""
        style={{
          width: size, height: size, objectFit:"contain", mixBlendMode:"multiply",
          animation:"catBob .9s ease-in-out infinite",
        }}
      />
      <div style={{
        width: size * 0.5, height: 5, borderRadius:"50%", background:"var(--text)",
        animation:"catShadow .9s ease-in-out infinite", marginBottom: 8,
      }} />
      <div style={{ display:"flex", gap:5, marginBottom:2 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width:6, height:6, borderRadius:"50%", background:"var(--primary)",
            animation:`dotBlink 1.2s ease-in-out ${i * 0.16}s infinite`,
          }} />
        ))}
      </div>
      {text && <p style={{ fontSize:13.5, color:"var(--text-2)", margin:0 }}>{text}</p>}
    </div>
  );
}
