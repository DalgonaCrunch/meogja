"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { ALL_AVATARS, TAB_ICONS, HANDSUP_POSES, POSE_WAVE, UI_LOCATION } from "@/lib/mascot";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
type Purpose = "avatar" | "emotion" | "hidden";
type Cfg = { purpose: Purpose; object_position: string; label: string };
type TabSection = "아바타" | "감정표현" | "제외" | "탭" | "포즈";

const PURPOSE_COLOR: Record<Purpose, string> = { avatar:"var(--primary)", emotion:"#E67700", hidden:"var(--text-3)" };

export default function AdminImagesPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<TabSection>("아바타");
  const [configs, setConfigs] = useState<Record<string, Cfg>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
      const map: Record<string, Cfg> = {};
      data.forEach((r: any) => { map[r.id] = { purpose: r.purpose, object_position: r.object_position || "center", label: r.label || "" }; });
      setConfigs(map);
    }
  }

  function getCfg(id: string): Cfg {
    return configs[id] || { purpose: "avatar", object_position: "center", label: "" };
  }

  function updateCfg(id: string, patch: Partial<Cfg>) {
    setConfigs(prev => ({ ...prev, [id]: { ...getCfg(id), ...patch } }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    const items = Object.entries(configs).map(([id, cfg]) => ({ id, ...cfg }));
    await fetch("/api/admin/avatar-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    setSaving(false);
    setDirty(false);
  }

  if (!authed) return <div style={{ padding:40, textAlign:"center" }}>확인 중…</div>;

  const TABS: TabSection[] = ["아바타", "감정표현", "제외", "탭", "포즈"];

  function avatarsForTab(t: TabSection) {
    return ALL_AVATARS.filter((_, i) => {
      const id = `cat-${String(i+1).padStart(2,"0")}`;
      const p = getCfg(id).purpose;
      if (t === "아바타") return p === "avatar";
      if (t === "감정표현") return p === "emotion";
      if (t === "제외") return p === "hidden";
      return false;
    });
  }

  const editingIdx = editingId ? parseInt(editingId.replace("cat-","")) - 1 : -1;
  const editingUrl = editingIdx >= 0 ? ALL_AVATARS[editingIdx] : null;
  const editingCfg = editingId ? getCfg(editingId) : null;

  return (
    <div style={{ paddingBottom:100 }}>
      {/* Header */}
      <div style={{ padding:"16px 16px 0", position:"sticky", top:52, background:"var(--bg)", zIndex:10, borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
          <button onClick={() => router.push("/admin")} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer" }}>←</button>
          <h1 style={{ fontFamily:"var(--font-display)", fontSize:20, flex:1 }}>🐱 먹자냥 이미지 관리</h1>
          {dirty && (
            <button className="tap" onClick={save} disabled={saving} style={{ padding:"8px 18px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              {saving ? "저장 중…" : "저장"}
            </button>
          )}
        </div>
        {/* Tabs */}
        <div style={{ display:"flex", overflowX:"auto", gap:0 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flexShrink:0, padding:"9px 16px", border:"none", background:"transparent", cursor:"pointer",
              fontSize:13, fontWeight: tab===t ? 700 : 400,
              color: tab===t ? "var(--primary)" : "var(--text-3)",
              borderBottom: tab===t ? "2.5px solid var(--primary)" : "2.5px solid transparent",
            }}>
              {t}
              {["아바타","감정표현","제외"].includes(t) && (
                <span style={{ marginLeft:4, fontSize:10, background:"var(--bg-2)", borderRadius:99, padding:"1px 5px" }}>
                  {avatarsForTab(t as TabSection).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 아바타/감정표현/제외 탭 */}
      {["아바타","감정표현","제외"].includes(tab) && (
        <div style={{ padding:16 }}>
          <p style={{ fontSize:12, color:"var(--text-2)", marginBottom:12 }}>
            탭 → 용도 순환 (아바타→감정표현→제외→아바타) · ✏️ → 위치 편집
          </p>
          {avatarsForTab(tab as TabSection).length === 0 && (
            <p style={{ fontSize:14, color:"var(--text-3)", textAlign:"center", padding:"24px 0" }}>이 카테고리에 아바타 없음</p>
          )}
          <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
            {ALL_AVATARS.map((url, i) => {
              const id = `cat-${String(i+1).padStart(2,"0")}`;
              const cfg = getCfg(id);
              if (tab === "아바타" && cfg.purpose !== "avatar") return null;
              if (tab === "감정표현" && cfg.purpose !== "emotion") return null;
              if (tab === "제외" && cfg.purpose !== "hidden") return null;
              return (
                <div key={id} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, width:68 }}>
                  <div style={{ position:"relative" }}>
                    <button className="tap" onClick={() => {
                      const next: Purpose = cfg.purpose === "avatar" ? "emotion" : cfg.purpose === "emotion" ? "hidden" : "avatar";
                      updateCfg(id, { purpose: next });
                    }} style={{
                      width:58, height:58, borderRadius:"50%", overflow:"hidden", padding:0,
                      border:`2.5px solid ${PURPOSE_COLOR[cfg.purpose]}`,
                      cursor:"pointer", background:"var(--bg-2)", opacity: cfg.purpose==="hidden" ? 0.3 : 1,
                    }}>
                      <img src={url} alt={id} style={{ width:"100%", height:"100%", objectFit:"contain", objectPosition:cfg.object_position }} />
                    </button>
                    <button style={{ position:"absolute", bottom:-2, right:-2, width:18, height:18, borderRadius:"50%", background:"var(--text-3)", border:"none", cursor:"pointer", fontSize:9, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}
                      onClick={() => setEditingId(editingId === id ? null : id)}>
                      ✏️
                    </button>
                  </div>
                  <span style={{ fontSize:9, color:PURPOSE_COLOR[cfg.purpose], fontWeight:700 }}>{id}</span>
                  {cfg.label && <span style={{ fontSize:9, color:"var(--text-3)", textAlign:"center" }}>{cfg.label}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 탭 아이콘 */}
      {tab === "탭" && (
        <div style={{ padding:16 }}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:16 }}>
            {Object.entries(TAB_ICONS).map(([name, url]) => (
              <div key={name} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                <div style={{ width:72, height:72, borderRadius:16, background:"var(--bg-2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <img src={url} alt={name} style={{ width:60, height:60, objectFit:"contain" }} />
                </div>
                <span style={{ fontSize:11, color:"var(--text-2)", fontWeight:600 }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 포즈 */}
      {tab === "포즈" && (
        <div style={{ padding:16 }}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:12 }}>
            {[POSE_WAVE, ...HANDSUP_POSES, UI_LOCATION].map((url, i) => (
              <div key={url} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{ width:80, height:80, borderRadius:16, background:"var(--bg-2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <img src={url} alt="" style={{ width:70, height:70, objectFit:"contain" }} />
                </div>
                <span style={{ fontSize:10, color:"var(--text-3)" }}>{url.split("/").pop()?.replace(".png","")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 편집 패널 */}
      {editingId && editingUrl && editingCfg && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:80 }}
          onClick={() => setEditingId(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"24px 24px 0 0", padding:"20px 20px 40px", width:"100%", maxWidth:480 }}>
            <div style={{ width:40, height:5, borderRadius:99, background:"var(--border)", margin:"0 auto 16px" }} />
            <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:16 }}>
              <img src={editingUrl} alt={editingId} style={{ width:56, height:56, borderRadius:"50%", objectFit:"contain", background:"var(--bg-2)", border:"2px solid var(--border)" }} />
              <p style={{ fontFamily:"var(--font-display)", fontSize:17 }}>{editingId}</p>
            </div>

            <p style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>용도</p>
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              {(["avatar","emotion","hidden"] as Purpose[]).map(p => (
                <button key={p} className="tap" onClick={() => updateCfg(editingId, { purpose: p })} style={{
                  flex:1, padding:"9px", borderRadius:"var(--r-pill)", border:"none",
                  background: editingCfg.purpose===p ? PURPOSE_COLOR[p] : "var(--bg-2)",
                  color: editingCfg.purpose===p ? "#fff" : "var(--text-2)", fontSize:12, fontWeight:700, cursor:"pointer",
                }}>{p==="avatar"?"아바타":p==="emotion"?"감정표현":"제외"}</button>
              ))}
            </div>

            <p style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>이미지 미리보기 위치</p>
            <p style={{ fontSize:11, color:"var(--text-3)", marginBottom:8 }}>슬라이더로 좌우/상하 조정</p>
            <div style={{ display:"flex", gap:12, marginBottom:8 }}>
              <div style={{ width:80, height:80, borderRadius:"50%", overflow:"hidden", background:"var(--bg-2)", border:"2px solid var(--border)", flexShrink:0 }}>
                <img src={editingUrl} alt={editingId} style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:editingCfg.object_position }} />
              </div>
              <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
                <div>
                  <label style={{ fontSize:11, color:"var(--text-2)" }}>수평 (좌←→우)</label>
                  <input type="range" min={0} max={100} step={5}
                    value={parseInt(editingCfg.object_position?.split(" ")[0]?.replace("%","") || "50")}
                    onChange={(e) => {
                      const x = e.target.value;
                      const y = editingCfg.object_position?.split(" ")[1]?.replace("%","") || "50";
                      updateCfg(editingId, { object_position: `${x}% ${y}%` });
                    }}
                    style={{ width:"100%", accentColor:"var(--primary)" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize:11, color:"var(--text-2)" }}>수직 (위↑↓아래)</label>
                  <input type="range" min={0} max={100} step={5}
                    value={parseInt(editingCfg.object_position?.split(" ")[1]?.replace("%","") || "50")}
                    onChange={(e) => {
                      const x = editingCfg.object_position?.split(" ")[0]?.replace("%","") || "50";
                      const y = e.target.value;
                      updateCfg(editingId, { object_position: `${x}% ${y}%` });
                    }}
                    style={{ width:"100%", accentColor:"var(--primary)" }}
                  />
                </div>
              </div>
            </div>

            {editingCfg.purpose === "emotion" && (
              <>
                <p style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>감정 레이블</p>
                <input defaultValue={editingCfg.label} onBlur={(e) => updateCfg(editingId, { label: e.target.value })}
                  placeholder="예: 기쁨, 슬픔, 화남, 맛있다"
                  style={{ width:"100%", padding:"10px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--bg)", fontSize:14, outline:"none", marginBottom:12, boxSizing:"border-box" }} />
              </>
            )}

            <button className="tap" onClick={() => setEditingId(null)} style={{ width:"100%", padding:"12px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:14, cursor:"pointer" }}>완료</button>
          </div>
        </div>
      )}

      {/* 저장 플로팅 버튼 */}
      {dirty && (
        <div style={{ position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)", zIndex:50 }}>
          <button className="tap" onClick={save} disabled={saving} style={{ padding:"13px 32px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontFamily:"var(--font-display)", fontSize:15, cursor:"pointer", boxShadow:"0 8px 24px rgba(255,122,69,.4)", whiteSpace:"nowrap" }}>
            {saving ? "저장 중…" : "💾 변경사항 저장"}
          </button>
        </div>
      )}
    </div>
  );
}
