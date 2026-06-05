"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { MENU_CATEGORIES, MenuCategory } from "@/lib/menus";
import { getFoodIconUrl } from "@/lib/foodIcons";

export default function AdminMenusPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<string>(MENU_CATEGORIES[0].label);
  const [additions, setAdditions] = useState<Record<string, string[]>>({});
  const [removals, setRemovals] = useState<Record<string, string[]>>({});
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const user = await getCurrentUser();
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (user.type !== "auth" || user.user.email !== adminEmail) {
      router.replace("/"); return;
    }
    // 기존 설정 로드
    const { data } = await getSupabase().from("app_settings").select("value").eq("key", "menu_additions").single();
    if (data?.value) setAdditions(data.value);
    const { data: r } = await getSupabase().from("app_settings").select("value").eq("key", "menu_removals").single();
    if (r?.value) setRemovals(r.value);
    setLoading(false);
  }

  async function saveAdditions(next: Record<string, string[]>) {
    setSaving(true);
    setAdditions(next);
    const { data } = await getSupabase().from("app_settings").select("id").eq("key", "menu_additions").single();
    if (data) await getSupabase().from("app_settings").update({ value: next }).eq("key", "menu_additions");
    else await getSupabase().from("app_settings").insert({ key: "menu_additions", value: next });
    setSaving(false);
  }

  async function saveRemovals(next: Record<string, string[]>) {
    setSaving(true);
    setRemovals(next);
    const { data } = await getSupabase().from("app_settings").select("id").eq("key", "menu_removals").single();
    if (data) await getSupabase().from("app_settings").update({ value: next }).eq("key", "menu_removals");
    else await getSupabase().from("app_settings").insert({ key: "menu_removals", value: next });
    setSaving(false);
  }

  function addItem() {
    const item = newItem.trim();
    if (!item) return;
    const catItems = additions[selectedCat] || [];
    if (catItems.includes(item)) { setNewItem(""); return; }
    const next = { ...additions, [selectedCat]: [...catItems, item] };
    saveAdditions(next);
    setNewItem("");
  }

  function removeAddedItem(cat: string, item: string) {
    const next = { ...additions, [cat]: (additions[cat] || []).filter((i) => i !== item) };
    saveAdditions(next);
  }

  function toggleBaseItem(cat: string, item: string) {
    const catRemovals = removals[cat] || [];
    const isRemoved = catRemovals.includes(item);
    const next = { ...removals, [cat]: isRemoved ? catRemovals.filter((i) => i !== item) : [...catRemovals, item] };
    saveRemovals(next);
  }

  if (loading) return <div style={{ textAlign:"center", padding:60 }}>로딩 중…</div>;

  const cat = MENU_CATEGORIES.find((c) => c.label === selectedCat)!;
  const catAdditions = additions[selectedCat] || [];
  const catRemovals = removals[selectedCat] || [];
  const allItems = [...cat.menus, ...catAdditions];

  return (
    <div style={{ maxWidth:700, margin:"0 auto", padding:"20px 16px 80px", display:"flex", flexDirection:"column", gap:20 }}>
      {/* 헤더 */}
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => router.push("/admin")} style={{ width:36, height:36, borderRadius:10, border:"1px solid var(--border)", background:"var(--surface)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>←</button>
        <div style={{ flex:1 }}>
          <h1 style={{ fontFamily:"var(--font-display)", fontSize:22 }}>🍽️ 메뉴 관리</h1>
          <p style={{ fontSize:12, color:"var(--text-3)" }}>카테고리별 메뉴 추가/숨김 {saving ? "· 저장중…" : "· 자동저장"}</p>
        </div>
      </div>

      {/* 카테고리 선택 */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {MENU_CATEGORIES.map((c) => {
          const iconUrl = getFoodIconUrl(c.label);
          const isActive = selectedCat === c.label;
          const addCnt = (additions[c.label] || []).length;
          const remCnt = (removals[c.label] || []).length;
          return (
            <button key={c.label} onClick={() => setSelectedCat(c.label)} style={{
              display:"flex", alignItems:"center", gap:5, padding:"7px 14px 7px 10px",
              borderRadius:"var(--r-pill)", border: isActive ? "none" : "1.5px solid var(--border)",
              background: isActive ? "var(--primary)" : "var(--surface)",
              color: isActive ? "#fff" : "var(--text-2)", fontSize:13, fontWeight:600, cursor:"pointer",
            }}>
              {iconUrl ? <img src={iconUrl} alt="" style={{ width:20, height:20, objectFit:"contain" }} /> : <span>{c.emoji}</span>}
              {c.label}
              {(addCnt > 0 || remCnt > 0) && (
                <span style={{ fontSize:10, background: isActive ? "rgba(255,255,255,.3)" : "var(--primary)", color: isActive ? "#fff" : "#fff", borderRadius:99, padding:"1px 5px", marginLeft:2 }}>
                  {addCnt > 0 ? `+${addCnt}` : ""}{remCnt > 0 ? ` -${remCnt}` : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 선택된 카테고리 메뉴 */}
      <div style={{ background:"var(--surface)", borderRadius:16, border:"var(--card-border)", overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:8 }}>
          {getFoodIconUrl(cat.label)
            ? <img src={getFoodIconUrl(cat.label)!} alt="" style={{ width:28, height:28, objectFit:"contain" }} />
            : <span style={{ fontSize:20 }}>{cat.emoji}</span>}
          <span style={{ fontFamily:"var(--font-display)", fontSize:16 }}>{cat.label}</span>
          <span style={{ fontSize:12, color:"var(--text-3)" }}>· {allItems.length}개 (숨김 {catRemovals.length}개)</span>
        </div>

        {/* 새 메뉴 추가 */}
        <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", display:"flex", gap:8 }}>
          <input
            value={newItem} onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
            placeholder="새 메뉴 추가 (예: 뚝배기갈비)"
            style={{ flex:1, padding:"9px 14px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)", background:"var(--bg)", fontSize:14, outline:"none", color:"var(--text)" }}
          />
          <button onClick={addItem} disabled={!newItem.trim()} style={{
            padding:"9px 18px", borderRadius:"var(--r-pill)", border:"none",
            background: newItem.trim() ? "var(--primary)" : "var(--bg-2)",
            color: newItem.trim() ? "#fff" : "var(--text-3)", fontSize:14, fontWeight:700, cursor: newItem.trim() ? "pointer" : "default",
          }}>추가</button>
        </div>

        {/* 메뉴 목록 */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, padding:"14px 16px" }}>
          {allItems.map((item) => {
            const isAdded = catAdditions.includes(item);
            const isHidden = catRemovals.includes(item);
            const iconUrl = getFoodIconUrl(item);
            return (
              <div key={item} style={{
                display:"flex", alignItems:"center", gap:6, padding:"6px 12px 6px 8px",
                borderRadius:"var(--r-pill)", border:"1.5px solid var(--border)",
                background: isHidden ? "var(--bg-2)" : isAdded ? "var(--primary-light)" : "var(--surface)",
                opacity: isHidden ? 0.4 : 1,
              }}>
                {iconUrl && <img src={iconUrl} alt="" style={{ width:20, height:20, objectFit:"contain" }} />}
                <span style={{ fontSize:13, color: isAdded ? "var(--primary)" : "var(--text)" }}>{item}</span>
                <button onClick={() => isAdded ? removeAddedItem(selectedCat, item) : toggleBaseItem(selectedCat, item)}
                  style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, color: isHidden ? "var(--text-3)" : isAdded ? "var(--primary)" : "var(--text-3)", padding:0, lineHeight:1 }}>
                  {isAdded ? "✕" : isHidden ? "↩" : "✕"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <p style={{ fontSize:12, color:"var(--text-3)", textAlign:"center" }}>
        기본 메뉴는 ✕로 숨기기, 추가 메뉴는 ✕로 삭제.<br/>
        변경사항은 앱 재시작 후 반영됩니다.
      </p>
    </div>
  );
}
