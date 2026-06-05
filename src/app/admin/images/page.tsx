"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { ALL_AVATARS, TAB_ICONS, HANDSUP_POSES, POSE_WAVE, UI_LOCATION } from "@/lib/mascot";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

type Section = "avatars" | "tabs" | "poses" | "ui";

const TAB_ENTRIES = Object.entries(TAB_ICONS);

export default function AdminImagesPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [section, setSection] = useState<Section>("avatars");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u.type !== "auth" || u.user.email !== ADMIN_EMAIL) { router.replace("/"); return; }
      setAuthed(true);
    });
  }, []);

  if (!authed) return <div style={{ padding:40, textAlign:"center", color:"var(--text-2)" }}>확인 중…</div>;

  async function setDefaultAvatar(url: string) {
    setSaving(true);
    setSelectedAvatar(url);
    await getSupabase().from("app_settings").upsert({ key: "main_avatar", value: JSON.stringify(url), updated_at: new Date().toISOString() });
    setSaving(false);
  }

  return (
    <div style={{ padding:16, paddingBottom:80, display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => router.push("/admin")} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"var(--text)" }}>←</button>
        <h1 style={{ fontFamily:"var(--font-display)", fontSize:22 }}>🐱 먹자냥 이미지 관리</h1>
      </div>

      {/* 섹션 탭 */}
      <div style={{ display:"flex", gap:0, borderBottom:"1px solid var(--border)" }}>
        {([["avatars","아바타"],["tabs","탭 아이콘"],["poses","포즈"],["ui","UI 아이콘"]] as const).map(([s,label]) => (
          <button key={s} onClick={() => setSection(s)} style={{
            flex:1, padding:"10px 0", border:"none", background:"transparent", cursor:"pointer",
            fontSize:13, fontWeight: section===s ? 700 : 400,
            color: section===s ? "var(--primary)" : "var(--text-3)",
            borderBottom: section===s ? "2.5px solid var(--primary)" : "2.5px solid transparent",
          }}>{label}</button>
        ))}
      </div>

      {/* 아바타 */}
      {section === "avatars" && (
        <div>
          <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:12 }}>총 {ALL_AVATARS.length}개 — 탭하면 기본 아바타로 설정</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
            {ALL_AVATARS.map((url, i) => (
              <div key={url} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <button className="tap" onClick={() => setDefaultAvatar(url)} style={{
                  width:60, height:60, borderRadius:"50%", overflow:"hidden", padding:0,
                  border: selectedAvatar===url ? "3px solid var(--primary)" : "2px solid var(--border)",
                  cursor:"pointer", background:"var(--bg-2)",
                }}>
                  <img src={url} alt={`cat-${i+1}`} style={{ width:"100%", height:"100%", objectFit:"contain" }} />
                </button>
                <span style={{ fontSize:10, color:"var(--text-3)" }}>cat-{String(i+1).padStart(2,"0")}</span>
              </div>
            ))}
          </div>
          {saving && <p style={{ fontSize:12, color:"var(--primary)", marginTop:8 }}>저장 중…</p>}
        </div>
      )}

      {/* 탭 아이콘 */}
      {section === "tabs" && (
        <div>
          <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:12 }}>현재 사용 중인 탭 아이콘</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:16 }}>
            {TAB_ENTRIES.map(([name, url]) => (
              <div key={name} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                <div style={{ width:72, height:72, borderRadius:16, background:"var(--bg-2)", display:"flex", alignItems:"center", justifyContent:"center", border:"var(--card-border)" }}>
                  <img src={url} alt={name} style={{ width:60, height:60, objectFit:"contain" }} />
                </div>
                <span style={{ fontSize:11, color:"var(--text-2)", fontWeight:600 }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 포즈 */}
      {section === "poses" && (
        <div>
          <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:12 }}>손 흔들기 / 인사 포즈</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:12 }}>
            {[POSE_WAVE, ...HANDSUP_POSES].map((url, i) => (
              <div key={url} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{ width:80, height:80, borderRadius:16, background:"var(--bg-2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <img src={url} alt={`pose-${i}`} style={{ width:70, height:70, objectFit:"contain" }} />
                </div>
                <span style={{ fontSize:10, color:"var(--text-3)" }}>{i===0?"wave":url.split("/").pop()?.replace(".png","")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UI 아이콘 */}
      {section === "ui" && (
        <div>
          <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:12 }}>UI 컨텍스트 아이콘</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:16 }}>
            {[{ name:"location", url:UI_LOCATION }].map(({ name, url }) => (
              <div key={name} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                <div style={{ width:80, height:80, borderRadius:16, background:"var(--bg-2)", display:"flex", alignItems:"center", justifyContent:"center", border:"var(--card-border)" }}>
                  <img src={url} alt={name} style={{ width:64, height:64, objectFit:"contain" }} />
                </div>
                <span style={{ fontSize:11, color:"var(--text-2)" }}>{name}</span>
                <span style={{ fontSize:10, color:"var(--text-3)" }}>위치/찾기 아이콘</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
