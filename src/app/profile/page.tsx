"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, signOut, CurrentUser } from "@/lib/auth";
import { getSupabase, Group } from "@/lib/supabase";
import { getAllLargeCategories, getMediumCategories, getMenuItems, getCategorySubItems } from "@/lib/recommend";
import { THEMES, ThemeId, applyTheme, getSavedTheme } from "@/lib/theme";

function ProfileFieldRow({ fieldKey, label, value, editable, isLast, onSave }: {
  fieldKey: string; label: string; value: string; editable: boolean; isLast: boolean;
  onSave: (key: string, val: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(value);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!editVal.trim()) return;
    setSaving(true);
    await onSave(fieldKey, editVal.trim());
    setSaving(false);
    setEditing(false);
  }

  return (
    <div style={{ display:"flex", alignItems:"center", padding:"12px 16px", borderBottom: isLast ? "none" : "1px solid var(--border)", gap:8 }}>
      <span style={{ fontSize:12, color:"var(--text-2)", width:90, flexShrink:0, fontWeight:600 }}>{label}</span>
      {editing ? (
        <div style={{ display:"flex", gap:6, flex:1, alignItems:"center" }}>
          <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            style={{ flex:1, padding:"6px 10px", borderRadius:"var(--r-pill)", border:"1.5px solid var(--primary)", background:"var(--bg)", fontSize:13, outline:"none" }} />
          <button className="tap" onClick={handleSave} disabled={saving} style={{ padding:"5px 12px", borderRadius:"var(--r-pill)", border:"none", background:"var(--primary)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            {saving ? "…" : "저장"}
          </button>
          <button onClick={() => { setEditing(false); setEditVal(value); }} style={{ background:"none", border:"none", color:"var(--text-2)", fontSize:16, cursor:"pointer" }}>✕</button>
        </div>
      ) : (
        <>
          <span style={{ fontSize:14, color: value ? "var(--text)" : "var(--text-3)", flex:1 }}>{value || "미설정"}</span>
          {editable && (
            <button className="tap" onClick={() => { setEditVal(value); setEditing(true); }} style={{ background:"none", border:"none", color:"var(--text-3)", fontSize:14, cursor:"pointer", padding:"2px 6px" }}>✏️</button>
          )}
        </>
      )}
    </div>
  );
}

const FEEDBACK_CATS = [
  { id: "bug", label: "🐛 버그 신고" },
  { id: "feature", label: "✨ 기능 제안" },
  { id: "general", label: "💬 일반 문의" },
  { id: "other", label: "📝 기타" },
];

export default function ProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser>({ type: "none" });
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [joinedGroups, setJoinedGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const user = await getCurrentUser();
    setCurrentUser(user);
    if (user.type === "none") { router.replace("/login"); return; }

    if (user.type === "auth") {
      // 내가 만든 모임
      const { data: owned } = await getSupabase().from("groups").select("*").eq("owner_id", user.user.id).order("created_at", { ascending: false });
      if (owned) setMyGroups(owned);

      // 내가 참여한 모임 (멤버십)
      const { data: memberships } = await getSupabase()
        .from("group_memberships").select("group_id").eq("user_id", user.user.id);
      if (memberships && memberships.length > 0) {
        const groupIds = memberships.map((m) => m.group_id);
        const { data: joined } = await getSupabase().from("groups").select("*").in("id", groupIds).order("created_at", { ascending: false });
        if (joined) setJoinedGroups(joined.filter((g) => g.owner_id !== user.user.id));
      }
    }
    setLoading(false);
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  async function leaveGroup(groupId: string) {
    if (currentUser.type !== "auth") return;
    await getSupabase().from("group_memberships").delete().eq("group_id", groupId).eq("user_id", currentUser.user.id);
    setJoinedGroups((prev) => prev.filter((g) => g.id !== groupId));
  }

  const displayName = currentUser.type === "auth" ? currentUser.user.display_name : currentUser.type === "guest" ? currentUser.user.name : "";
  const [myProfile, setMyProfile] = useState<Record<string,string>>({});
  const [myPrefs, setMyPrefs] = useState<{id:string;food_name:string;preference_type:string}[]>([]);
  const [prefInput, setPrefInput] = useState("");
  const [prefType, setPrefType] = useState<"like"|"dislike">("like");
  const [prefLarge, setPrefLarge] = useState("");
  const [prefMedium, setPrefMedium] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeId>("cozy");

  useEffect(() => { setCurrentTheme(getSavedTheme()); }, []);

  useEffect(() => {
    if (currentUser.type === "auth") {
      // 프로필 정보 로드
      getSupabase().from("user_profiles").select("*").eq("id", currentUser.user.id).single().then(({ data }) => {
        if (data) setMyProfile(data);
      });
      getSupabase().from("user_food_preferences").select("*").eq("user_id", currentUser.user.id).order("preference_type").then(({ data }) => {
        if (data) setMyPrefs(data);
      });
    }
  }, [currentUser]);

  async function addMyPref(foodName?: string) {
    const name = (foodName || prefInput).trim();
    if (!name || currentUser.type !== "auth") return;
    const existing = myPrefs.find((p) => p.food_name === name && p.preference_type === prefType);
    if (existing) {
      await removeMyPref(existing.id);
      return;
    }
    // 반대 타입 있으면 먼저 제거
    const opposite = myPrefs.find((p) => p.food_name === name && p.preference_type !== prefType);
    if (opposite) await removeMyPref(opposite.id);
    // 카테고리면 하위 항목 반대타입 제거
    const subItems = getCategorySubItems(name);
    if (subItems.length > 0) {
      const oppType = prefType === "like" ? "dislike" : "like";
      const toRemove = myPrefs.filter((p) => (p.food_name === name || subItems.includes(p.food_name)) && p.preference_type === oppType);
      for (const r of toRemove) await removeMyPref(r.id);
    }
    const { data } = await getSupabase().from("user_food_preferences").insert({ user_id: currentUser.user.id, food_name: name, preference_type: prefType }).select().single();
    if (data) setMyPrefs((prev) => prev.filter((p) => !(p.food_name === name && p.preference_type !== prefType) && !(subItems.includes(p.food_name) && p.preference_type !== prefType)).concat(data));
    if (!foodName) setPrefInput("");
  }

  async function removeMyPref(id: string) {
    await getSupabase().from("user_food_preferences").delete().eq("id", id);
    setMyPrefs((prev) => prev.filter((p) => p.id !== id));
  }

  const [fbCat, setFbCat] = useState("general");
  const [fbContent, setFbContent] = useState("");
  const [fbEmail, setFbEmail] = useState("");
  const [fbSent, setFbSent] = useState(false);
  const [fbSending, setFbSending] = useState(false);

  async function submitFeedback(e: FormEvent) {
    e.preventDefault();
    if (!fbContent.trim()) return;
    setFbSending(true);
    await getSupabase().from("feedbacks").insert({
      user_id: currentUser.type === "auth" ? currentUser.user.id : null,
      guest_name: currentUser.type === "guest" ? currentUser.user.name : null,
      email: fbEmail.trim() || (currentUser.type === "auth" ? currentUser.user.email : null),
      category: fbCat,
      content: fbContent.trim(),
    });
    setFbSent(true);
    setFbSending(false);
    setFbContent("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* 프로필 헤더 */}
      <div className="fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 600, marginBottom: 4 }}>
            {displayName || "사용자"}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {currentUser.type === "auth" ? `${currentUser.user.email} · 로그인 계정` : "게스트 이용 중"}
          </p>
        </div>
        <button onClick={handleSignOut} style={{ padding: "8px 18px", borderRadius: 100, border: "1.5px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          {currentUser.type === "auth" ? "로그아웃" : "나가기"}
        </button>
      </div>

      {/* 👤 내 정보 — 수정 가능 */}
      {currentUser.type === "auth" && (() => {
        const FIELDS: {key:string;label:string;editable:boolean}[] = [
          { key: "nickname", label: "닉네임 (앱 표시명)", editable: true },
          { key: "name", label: "이름", editable: true },
          { key: "email", label: "이메일", editable: true },
          { key: "gender", label: "성별", editable: false },
          { key: "birthday", label: "생일", editable: false },
          { key: "birthyear", label: "출생연도", editable: false },
          { key: "age", label: "연령대", editable: false },
          { key: "mobile", label: "휴대전화", editable: false },
        ];

        async function saveProfileField(key: string, value: string) {
          if (currentUser.type !== "auth") return;

          // 닉네임 중복 체크
          if (key === "nickname") {
            const trimmed = value.trim();
            if (!trimmed) return;
            // 다른 계정이 이미 같은 닉네임을 사용 중인지 확인
            const { data: dupe } = await getSupabase()
              .from("user_profiles")
              .select("id")
              .eq("nickname", trimmed)
              .neq("id", currentUser.user.id)
              .single();
            if (dupe) {
              alert(`"${trimmed}" 닉네임은 이미 사용 중입니다. 다른 닉네임을 입력해주세요.`);
              return;
            }
          }

          const update: Record<string,string> = { [key]: value };
          if (key === "nickname") update.display_name = value;
          const { error } = await getSupabase().from("user_profiles").update(update).eq("id", currentUser.user.id);
          if (error) { alert("저장 실패: " + error.message); return; }
          setMyProfile((prev) => ({ ...prev, ...update }));
          window.dispatchEvent(new CustomEvent("meogja-auth-change"));
        }

        return (
          <div className="fade-up">
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
              {myProfile.profile_image && (
                <img src={myProfile.profile_image} alt="프로필" style={{ width:48, height:48, borderRadius:"50%", objectFit:"cover", border:"2px solid var(--border)" }} />
              )}
              <p style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>👤 내 정보</p>
            </div>
            <div style={{ background:"var(--surface)", borderRadius:16, border:"var(--card-border)", boxShadow:"var(--card-shadow)", overflow:"hidden" }}>
              {FIELDS.filter((f) => myProfile[f.key] || f.editable).map((f, i, arr) => (
                <ProfileFieldRow key={f.key} fieldKey={f.key} label={f.label} value={myProfile[f.key] || ""} editable={f.editable} isLast={i === arr.length-1} onSave={saveProfileField} />
              ))}
            </div>
          </div>
        );
      })()}

      {/* 🎨 색상 테마 */}
      <div className="fade-up">
        <p style={{ fontFamily: "var(--font-display)", fontSize: 17, marginBottom: 12 }}>🎨 색상 테마</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(Object.entries(THEMES) as [ThemeId, typeof THEMES[ThemeId]][]).map(([id, t]) => (
            <button key={id} className="tap" onClick={() => { applyTheme(id); setCurrentTheme(id); }} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: "var(--r-pill)",
              border: currentTheme === id ? `2px solid ${t.preview}` : "1.5px solid var(--border)",
              background: currentTheme === id ? t.vars["--bg-2"] : "var(--surface)",
              color: "var(--text)", fontSize: 13, fontWeight: currentTheme === id ? 700 : 400, cursor: "pointer",
              transition: "all .15s",
            }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: t.preview, flexShrink: 0 }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!loading && currentUser.type === "auth" && (
        <>
          {/* 내가 만든 모임 */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>내가 만든 모임</p>
            {myGroups.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>아직 만든 모임이 없습니다</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {myGroups.map((g) => (
                  <button key={g.id} onClick={() => router.push(`/groups/${g.id}`)} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 18px", borderRadius: 14, background: "var(--bg-card)",
                    border: "1px solid var(--border)", boxShadow: "var(--shadow)",
                    cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{g.is_private ? "🔒" : "🌐"}</span>
                      <div>
                        <p style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{g.name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{g.require_auth ? "인증 전용" : "누구나 참여"}</p>
                      </div>
                    </div>
                    <span style={{ color: "var(--text-muted)", fontSize: 16 }}>→</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 참여 중인 모임 */}
          {joinedGroups.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>참여 중인 모임</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {joinedGroups.map((g) => (
                  <div key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
                    <button onClick={() => router.push(`/groups/${g.id}`)} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ fontSize: 18 }}>{g.is_private ? "🔒" : "🌐"}</span>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{g.name}</p>
                    </button>
                    <button onClick={() => leaveGroup(g.id)} style={{ padding: "5px 12px", borderRadius: 100, border: "1.5px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}>
                      나가기
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 내 기본 선호도 — 로그인 사용자만 */}
      {currentUser.type === "auth" && (() => {
        const largeCats = getAllLargeCategories();
        const medCats = prefLarge ? getMediumCategories(prefLarge) : [];
        const menuItems = prefLarge && prefMedium ? getMenuItems(prefLarge, prefMedium) : [];
        return (
          <div className="fade-up">
            <p style={{ fontFamily: "var(--font-display)", fontSize: 17, marginBottom: 14 }}>🍴 내 기본 선호도</p>
            <div style={{ background: "var(--surface)", borderRadius: 16, padding: "18px 16px", border: "var(--card-border)", boxShadow: "var(--card-shadow)", display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: 13, color: "var(--text-2)" }}>모임 참여 시 불러올 수 있는 내 기본 선호도입니다.</p>
              {/* 좋아함/못먹음 토글 */}
              <div style={{ display: "flex", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r-pill)", padding: 3, gap: 3, width: "fit-content" }}>
                {(["like","dislike"] as const).map((t) => (
                  <button key={t} className="tap" onClick={() => setPrefType(t)} style={{ padding: "6px 18px", borderRadius: "var(--r-pill)", border: "none", fontSize: 13, fontWeight: 600, background: prefType === t ? (t === "like" ? "var(--green)" : "var(--red)") : "transparent", color: prefType === t ? "#fff" : "var(--text-2)", cursor: "pointer", transition: "all .15s" }}>{t === "like" ? "👍 좋아함" : "🚫 못먹음"}</button>
                ))}
              </div>
              {/* 대분류 */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>대분류</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {largeCats.map((c) => (
                    <button key={c} className="tap" onClick={() => { setPrefLarge(c === prefLarge ? "" : c); setPrefMedium(""); }} style={{ padding: "5px 13px", borderRadius: "var(--r-pill)", fontSize: 12, fontWeight: 500, border: prefLarge === c ? "2px solid var(--primary)" : "1.5px solid var(--border)", background: prefLarge === c ? "var(--primary-light)" : "transparent", color: prefLarge === c ? "var(--primary)" : "var(--text)", cursor: "pointer" }}>{c}</button>
                  ))}
                </div>
              </div>
              {/* 중분류 */}
              {prefLarge && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>중분류</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {medCats.map((c) => (
                      <button key={c} className="tap" onClick={() => setPrefMedium(c === prefMedium ? "" : c)} style={{ padding: "5px 13px", borderRadius: "var(--r-pill)", fontSize: 12, fontWeight: 500, border: prefMedium === c ? "2px solid var(--primary)" : "1.5px solid var(--border)", background: prefMedium === c ? "var(--primary-light)" : "transparent", color: prefMedium === c ? "var(--primary)" : "var(--text)", cursor: "pointer" }}>{c}</button>
                    ))}
                    <button className="tap" onClick={() => addMyPref(prefLarge)} style={{ padding: "5px 13px", borderRadius: "var(--r-pill)", fontSize: 12, border: "1.5px dashed var(--border)", background: "transparent", color: "var(--text-2)", cursor: "pointer" }}>+ {prefLarge} 전체</button>
                  </div>
                </div>
              )}
              {/* 소분류 */}
              {prefMedium && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>메뉴</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 130, overflowY: "auto" }}>
                    {menuItems.map((item) => {
                      const liked = myPrefs.find((p) => p.food_name === item && p.preference_type === "like");
                      const disliked = myPrefs.find((p) => p.food_name === item && p.preference_type === "dislike");
                      return (
                        <button key={item} className="tap" onClick={() => addMyPref(item)} style={{ padding: "4px 11px", borderRadius: "var(--r-pill)", fontSize: 12, fontWeight: 500, border: liked ? "1.5px solid var(--green)" : disliked ? "1.5px solid var(--red)" : "1.5px solid var(--border)", background: liked ? "var(--green-soft)" : disliked ? "var(--red-soft)" : "transparent", color: liked ? "var(--green)" : disliked ? "var(--red)" : "var(--text)", cursor: "pointer" }}>{item}</button>
                      );
                    })}
                    <button className="tap" onClick={() => addMyPref(prefMedium)} style={{ padding: "4px 11px", borderRadius: "var(--r-pill)", fontSize: 12, border: "1.5px dashed var(--border)", background: "transparent", color: "var(--text-2)", cursor: "pointer" }}>+ {prefMedium} 전체</button>
                  </div>
                </div>
              )}
              {/* 직접 입력 */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>직접 입력</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={prefInput} onChange={(e) => setPrefInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMyPref(); } }} placeholder="음식명 입력" style={{ flex: 1, padding: "9px 14px", borderRadius: "var(--r-pill)", border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 13, outline: "none" }} onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
                  <button className="tap" onClick={() => addMyPref()} style={{ padding: "9px 16px", borderRadius: "var(--r-pill)", border: "none", background: "var(--primary)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>등록</button>
                </div>
              </div>
              {/* 등록된 선호도 */}
              {myPrefs.filter((p) => p.preference_type === "dislike").length > 0 && (
                <div><p style={{ fontSize: 12, fontWeight: 700, color: "var(--red)", marginBottom: 6 }}>🚫 못먹는 음식</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {myPrefs.filter((p) => p.preference_type === "dislike").map((p) => (
                      <button key={p.id} onClick={() => removeMyPref(p.id)} style={{ padding: "3px 10px", borderRadius: "var(--r-pill)", fontSize: 12, fontWeight: 600, background: "var(--red-soft)", border: "1px solid var(--red)", color: "var(--red)", cursor: "pointer" }}>{p.food_name} ✕</button>
                    ))}
                  </div>
                </div>
              )}
              {myPrefs.filter((p) => p.preference_type === "like").length > 0 && (
                <div><p style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", marginBottom: 6 }}>❤️ 좋아하는 음식</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {myPrefs.filter((p) => p.preference_type === "like").map((p) => (
                      <button key={p.id} onClick={() => removeMyPref(p.id)} style={{ padding: "3px 10px", borderRadius: "var(--r-pill)", fontSize: 12, fontWeight: 600, background: "var(--green-soft)", border: "1px solid var(--green)", color: "var(--green)", cursor: "pointer" }}>{p.food_name} ✕</button>
                    ))}
                  </div>
                </div>
              )}
              {myPrefs.length === 0 && <p style={{ fontSize: 13, color: "var(--text-2)" }}>아직 저장된 선호도가 없습니다</p>}

              {/* 설정 완료 버튼 */}
              {myPrefs.length > 0 && (
                <button className="tap tap-primary" onClick={() => { setPrefSaved(true); setTimeout(() => setPrefSaved(false), 2500); }} style={{
                  width: "100%", padding: "13px", borderRadius: "var(--r-pill)", border: "none",
                  background: prefSaved ? "var(--green)" : "var(--primary)", color: "#fff",
                  fontFamily: "var(--font-display)", fontSize: 15, cursor: "pointer",
                  transition: "background .3s", boxShadow: prefSaved ? "0 6px 16px rgba(46,158,107,.3)" : "0 6px 16px rgba(255,122,69,.3)",
                }}>
                  {prefSaved ? "✓ 저장됐습니다!" : "설정 완료"}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* 문의/피드백 — 접기/열기 */}
      <div className="fade-up" style={{ marginTop: 8 }}>
        <button className="tap" onClick={() => setShowFeedback((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: showFeedback ? 14 : 0 }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>💬 문의 / 피드백</p>
          <span style={{ fontSize: 20, color: "var(--text-2)", transition: "transform .2s", transform: showFeedback ? "rotate(180deg)" : "" }}>⌄</span>
        </button>
        {showFeedback && <div>{fbSent ? (
          <div className="bounce-in" style={{ padding: "20px", borderRadius: 16, background: "var(--green-soft)", border: "1.5px solid var(--green)", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--green)", marginBottom: 6 }}>✓ 전달됐습니다!</p>
            <p style={{ fontSize: 13, color: "var(--text-2)" }}>소중한 의견 감사합니다 🙏</p>
            <button onClick={() => setFbSent(false)} style={{ marginTop: 12, padding: "8px 20px", borderRadius: "var(--r-pill)", border: "none", background: "var(--green)", color: "#fff", fontSize: 13, cursor: "pointer" }}>다시 작성</button>
          </div>
        ) : (
          <form onSubmit={submitFeedback} style={{ display: "flex", flexDirection: "column", gap: 12, background: "var(--surface)", borderRadius: 16, padding: "18px 16px", border: "var(--card-border)", boxShadow: "var(--card-shadow)" }}>
            {/* 카테고리 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {FEEDBACK_CATS.map((c) => (
                <button key={c.id} type="button" className="tap" onClick={() => setFbCat(c.id)} style={{
                  padding: "6px 14px", borderRadius: "var(--r-pill)", fontSize: 12, fontWeight: 600,
                  border: fbCat === c.id ? "none" : "1.5px solid var(--border)",
                  background: fbCat === c.id ? "var(--primary)" : "transparent",
                  color: fbCat === c.id ? "#fff" : "var(--text-2)", cursor: "pointer",
                }}>{c.label}</button>
              ))}
            </div>
            {/* 내용 */}
            <textarea value={fbContent} onChange={(e) => setFbContent(e.target.value)} required placeholder="내용을 입력해주세요 (버그, 불편한 점, 개선 아이디어 등)" rows={4}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 14, resize: "none", outline: "none", fontFamily: "var(--font-body)" }}
              onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
            {/* 이메일 (선택) */}
            {currentUser.type !== "auth" && (
              <input value={fbEmail} onChange={(e) => setFbEmail(e.target.value)} placeholder="답변 받을 이메일 (선택)"
                style={{ padding: "10px 14px", borderRadius: "var(--r-pill)", border: "1.5px solid var(--border)", background: "var(--bg)", fontSize: 13, outline: "none" }}
                onFocus={(e) => e.target.style.borderColor = "var(--primary)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
            )}
            <button type="submit" disabled={fbSending || !fbContent.trim()} className="tap" style={{
              padding: "13px", borderRadius: "var(--r-pill)", border: "none",
              background: (!fbContent.trim() || fbSending) ? "var(--border)" : "var(--primary)",
              color: (!fbContent.trim() || fbSending) ? "var(--text-2)" : "#fff",
              fontFamily: "var(--font-display)", fontSize: 15, cursor: "pointer",
            }}>
              {fbSending ? "전송 중…" : "보내기 →"}
            </button>
          </form>
        )}</div>}
      </div>
    </div>
  );
}
