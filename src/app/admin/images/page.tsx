"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { ALL_AVATARS, TAB_ICONS, HANDSUP_POSES, POSE_WAVE, UI_LOCATION } from "@/lib/mascot";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

type Section = "avatars" | "tabs" | "poses" | "ui";
type Purpose = "avatar" | "emotion" | "hidden";
type AvatarCfg = { purpose: Purpose; object_position: string; label: string };

const PURPOSE_LABELS: Record<Purpose, string> = {
  avatar: "아바타",
  emotion: "감정표현",
  hidden: "제외",
};
const PURPOSE_COLORS: Record<Purpose, string> = {
  avatar: "var(--primary)",
  emotion: "#E67700",
  hidden: "var(--text-3)",
};

const POSITIONS = ["center","top","bottom","center 20%","center 30%","center 70%","center 80%"];

export default function AdminImagesPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [section, setSection] = useState<Section>("avatars");
  const [configs, setConfigs] = useState<Record<string, AvatarCfg>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u.type !== "auth" || u.user.email !== ADMIN_EMAIL) { router.replace("/"); return; }
      setAuthed(true);
      loadConfigs();
    });
  }, []);

  async function loadConfigs() {
    const { data } = await getSupabase().from("avatar_config").select("*");
    if (data) {
      const map: Record<string, AvatarCfg> = {};
      data.forEach((r: {id:string;purpose:Purpose;object_position:string;label:string}) => {
        map[r.id] = { purpose: r.purpose, object_position: r.object_position, label: r.label || "" };
      });
      setConfigs(map);
    }
  }

  function getCfg(id: string): AvatarCfg {
    return configs[id] || { purpose: "avatar", object_position: "center", label: "" };
  }

  async function saveCfg(id: string, cfg: Partial<AvatarCfg>) {
    setSaving(true);
    const current = getCfg(id);
    const updated = { ...current, ...cfg };
    setConfigs(prev => ({ ...prev, [id]: updated }));
    await getSupabase().from("avatar_config").upsert({
      id, purpose: updated.purpose, object_position: updated.object_position,
      label: updated.label, updated_at: new Date().toISOString(),
    });
    setSaving(false);
  }

  if (!authed) return <div style={{ padding:40, textAlign:"center", color:"var(--text-2)" }}>확인 중…</div>;

  return (
    <div style={{ paddingBottom:80 }}>
      <div style={{ padding:"16px 16px 0", position:"sticky", top:52, background:"var(--bg)", zIndex:10, borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
          <button onClick={() => router.push("/admin")} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"var(--text)" }}>←</button>
          <h1 style={{ fontFamily:"var(--font-display)", fontSize:20 }}>🐱 먹자냥 이미지 관리</h1>
          {saving && <span style={{ fontSize:12, color:"var(--primary)" }}>저장 중…</span>}
        </div>
        <div style={{ display:"flex", gap:0 }}>
          {([["avatars","아바타"],["tabs","탭"],["poses","포즈"],["ui","UI"]] as const).map(([s,label]) => (
            <button key={s} onClick={() => setSection(s)} style={{
              flex:1, padding:"10px 0", border:"none", background:"transparent", cursor:"pointer",
              fontSize:13, fontWeight: section===s ? 700 : 400,
              color: section===s ? "var(--primary)" : "var(--text-3)",
              borderBottom: section===s ? "2.5px solid var(--primary)" : "2.5px solid transparent",
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* 아바타 관리 */}
      {section === "avatars" && (
        <div style={{ padding:"16px" }}>
          <p style={{ fontSize:12, color:"var(--text-2)", marginBottom:12 }}>
            탭 → 용도 변경 / 길게 탭 → 위치 조정<br/>
            <span style={{ color:"var(--primary)" }}>■ 아바타</span>{"  "}
            <span style={{ color:"#E67700" }}>■ 감정표현</span>{"  "}
            <span style={{ color:"var(--text-3)" }}>■ 제외</span>
          </p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
            {ALL_AVATARS.map((url, i) => {
              const id = `cat-${String(i+1).padStart(2,"0")}`;
              const cfg = getCfg(id);
              const isEditing = editing === id;
              return (
                <div key={id} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, width:70 }}>
                  <div style={{ position:"relative" }}>
                    <button className="tap" onClick={() => {
                      // 순환: avatar → emotion → hidden → avatar
                      const next: Purpose = cfg.purpose === "avatar" ? "emotion" : cfg.purpose === "emotion" ? "hidden" : "avatar";
                      saveCfg(id, { purpose: next });
                    }} style={{
                      width:60, height:60, borderRadius:"50%", overflow:"hidden", padding:0,
                      border: `3px solid ${PURPOSE_COLORS[cfg.purpose]}`,
                      cursor:"pointer", background:"var(--bg-2)", opacity: cfg.purpose === "hidden" ? 0.35 : 1,
                    }}>
                      <img src={url} alt={id} style={{ width:"100%", height:"100%", objectFit:"contain", objectPosition: cfg.object_position }} />
                    </button>
                    <div style={{ position:"absolute", bottom:-2, right:-2, width:18, height:18, borderRadius:"50%", background:PURPOSE_COLORS[cfg.purpose], display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#fff", fontWeight:700, cursor:"pointer" }}
                      onClick={() => setEditing(isEditing ? null : id)}>
                      ✏️
                    </div>
                  </div>
                  <span style={{ fontSize:9, color:PURPOSE_COLORS[cfg.purpose], fontWeight:700 }}>{PURPOSE_LABELS[cfg.purpose]}</span>
                  {cfg.label && <span style={{ fontSize:9, color:"var(--text-3)", textAlign:"center", lineHeight:1.2 }}>{cfg.label}</span>}

                  {/* 편집 패널 */}
                  {isEditing && (
                    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:90 }}
                      onClick={() => setEditing(null)}>
                      <div onClick={(e) => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"24px 24px 0 0", padding:"20px", width:"100%", maxWidth:480 }}>
                        <div style={{ width:40, height:5, borderRadius:99, background:"var(--border)", margin:"0 auto 16px" }} />
                        <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:16 }}>
                          <img src={url} alt={id} style={{ width:56, height:56, borderRadius:"50%", objectFit:"contain", objectPosition:cfg.object_position, background:"var(--bg-2)", border:"2px solid var(--border)" }} />
                          <div>
                            <p style={{ fontFamily:"var(--font-display)", fontSize:16 }}>{id}</p>
                            <p style={{ fontSize:12, color:"var(--text-2)" }}>{PURPOSE_LABELS[cfg.purpose]}</p>
                          </div>
                        </div>

                        <p style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>용도</p>
                        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                          {(["avatar","emotion","hidden"] as Purpose[]).map(p => (
                            <button key={p} className="tap" onClick={() => saveCfg(id, { purpose: p })} style={{
                              flex:1, padding:"8px", borderRadius:"var(--r-pill)", border:"none",
                              background: cfg.purpose===p ? PURPOSE_COLORS[p] : "var(--bg-2)",
                              color: cfg.purpose===p ? "#fff" : "var(--text-2)", fontSize:12, fontWeight:600, cursor:"pointer",
                            }}>{PURPOSE_LABELS[p]}</button>
                          ))}
                        </div>

                        <p style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>이미지 위치 (object-position)</p>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
                          {POSITIONS.map(pos => (
                            <button key={pos} className="tap" onClick={() => saveCfg(id, { object_position: pos })} style={{
                              padding:"6px 10px", borderRadius:"var(--r-pill)",
                              border: cfg.object_position===pos ? "none" : "1.5px solid var(--border)",
                              background: cfg.object_position===pos ? "var(--primary)" : "transparent",
                              color: cfg.object_position===pos ? "#fff" : "var(--text-2)", fontSize:11, cursor:"pointer",
                            }}>{pos}</button>
                          ))}
                        </div>

                        {cfg.purpose === "emotion" && (
                          <>
                            <p style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>감정 레이블</p>
                            <input defaultValue={cfg.label} onBlur={(e) => saveCfg(id, { label: e.target.value })}
                              placeholder="예: 기쁨, 슬픔, 화남"
                              style={{ width:"100%", padding:"10px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--bg)", fontSize:14, outline:"none", marginBottom:12 }} />
                          </>
                        )}

                        <button className="tap" onClick={() => setEditing(null)} style={{ width:"100%", padding:"12px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:14, cursor:"pointer" }}>완료</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 탭 아이콘 */}
      {section === "tabs" && (
        <div style={{ padding:"16px" }}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:16 }}>
            {Object.entries(TAB_ICONS).map(([name, url]) => (
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

      {section === "poses" && (
        <div style={{ padding:"16px" }}>
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

      {section === "ui" && (
        <div style={{ padding:"16px" }}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:16 }}>
            {[{ name:"location (위치/찾기)", url:UI_LOCATION }].map(({ name, url }) => (
              <div key={name} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                <div style={{ width:80, height:80, borderRadius:16, background:"var(--bg-2)", display:"flex", alignItems:"center", justifyContent:"center", border:"var(--card-border)" }}>
                  <img src={url} alt={name} style={{ width:64, height:64, objectFit:"contain" }} />
                </div>
                <span style={{ fontSize:11, color:"var(--text-2)", textAlign:"center" }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
