"use client";

import { useEffect, useState } from "react";
import { getSupabase, Member, FoodPreference } from "@/lib/supabase";
import { getAllLargeCategories, getMediumCategories, getMenuItems } from "@/lib/recommend";

const MEMBER_COLORS = [
  "#F4631E","#3D7A5A","#6B5CE7","#E7975C","#2E86AB","#C94040","#7B8C42","#A35CB0"
];

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [newName, setNewName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<FoodPreference[]>([]);
  const [prefType, setPrefType] = useState<"like" | "dislike">("like");
  const [selectedLarge, setSelectedLarge] = useState("");
  const [selectedMedium, setSelectedMedium] = useState("");
  const [customInput, setCustomInput] = useState("");

  const largeCategories = getAllLargeCategories();
  const mediumCategories = selectedLarge ? getMediumCategories(selectedLarge) : [];
  const menuItems = selectedLarge && selectedMedium ? getMenuItems(selectedLarge, selectedMedium) : [];

  useEffect(() => { loadMembers(); }, []);

  async function loadMembers() {
    const { data } = await getSupabase().from("members").select("*").order("name");
    if (data) setMembers(data);
  }

  async function addMember() {
    const name = newName.trim();
    if (!name) return;
    await getSupabase().from("members").insert({ name });
    setNewName("");
    loadMembers();
  }

  async function deleteMember(id: string) {
    await getSupabase().from("members").delete().eq("id", id);
    if (expandedId === id) setExpandedId(null);
    loadMembers();
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    await loadPreferences(id);
  }

  async function loadPreferences(memberId: string) {
    const { data } = await getSupabase()
      .from("food_preferences").select("*")
      .eq("member_id", memberId).order("preference_type");
    if (data) setPreferences(data);
  }

  async function addPreference(foodName: string) {
    if (!expandedId || !foodName.trim()) return;
    if (preferences.find((p) => p.food_name === foodName && p.preference_type === prefType)) return;
    await getSupabase().from("food_preferences").insert({
      member_id: expandedId, food_name: foodName.trim(), preference_type: prefType,
    });
    await loadPreferences(expandedId);
    setCustomInput("");
  }

  async function removePreference(id: string) {
    await getSupabase().from("food_preferences").delete().eq("id", id);
    setPreferences((prev) => prev.filter((p) => p.id !== id));
  }

  const likes = preferences.filter((p) => p.preference_type === "like");
  const dislikes = preferences.filter((p) => p.preference_type === "dislike");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      <div className="fade-up">
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(28px,5vw,42px)", fontWeight: 600, lineHeight: 1.1, marginBottom: 8 }}>
          멤버 관리
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>멤버를 추가하고 선호도를 설정하세요</p>
      </div>

      {/* 멤버 추가 */}
      <div className="fade-up fade-up-1" style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>새 멤버</p>
        <form onSubmit={(e) => { e.preventDefault(); addMember(); }} style={{ display: "flex", gap: 10 }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="이름 입력"
            style={{
              flex: 1, padding: "10px 16px", borderRadius: 100,
              border: "1.5px solid var(--border)", background: "var(--bg)",
              fontSize: 14, color: "var(--text)", outline: "none",
            }}
            onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
            onBlur={(e) => e.target.style.borderColor = "var(--border)"}
          />
          <button type="submit" style={{
            padding: "10px 24px", borderRadius: 100, border: "none",
            background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>추가</button>
        </form>
      </div>

      {/* 멤버 목록 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {members.map((m, idx) => {
          const color = MEMBER_COLORS[idx % MEMBER_COLORS.length];
          const isExpanded = expandedId === m.id;
          return (
            <div key={m.id} className="fade-up" style={{
              background: "var(--bg-card)", borderRadius: 16,
              border: "1px solid var(--border)", boxShadow: "var(--shadow)",
              overflow: "hidden", borderLeft: `4px solid ${color}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: color, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700,
                  }}>{m.name[0]}</div>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{m.name}</span>
                  {(likes.length > 0 || dislikes.length > 0) && isExpanded && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      ❤️ {likes.length} · 🚫 {dislikes.length}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => toggleExpand(m.id)} style={{
                    padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 500,
                    border: "1.5px solid var(--border)", background: isExpanded ? "var(--text)" : "transparent",
                    color: isExpanded ? "#fff" : "var(--text-muted)", cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}>
                    {isExpanded ? "접기" : "선호도 설정"}
                  </button>
                  <button onClick={() => deleteMember(m.id)} style={{
                    padding: "6px 12px", borderRadius: 100, fontSize: 12, fontWeight: 500,
                    border: "1.5px solid var(--border)", background: "transparent",
                    color: "var(--red)", cursor: "pointer",
                  }}>삭제</button>
                </div>
              </div>

              {isExpanded && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "20px" }}>

                  {/* 좋아함/못먹음 토글 */}
                  <div style={{ display: "flex", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 100, padding: 4, gap: 4, marginBottom: 20, width: "fit-content" }}>
                    <button
                      onClick={() => setPrefType("like")}
                      style={{
                        padding: "7px 20px", borderRadius: 100, border: "none", fontSize: 13, fontWeight: 600,
                        background: prefType === "like" ? "var(--green)" : "transparent",
                        color: prefType === "like" ? "#fff" : "var(--text-muted)",
                        cursor: "pointer", transition: "all 0.15s ease",
                      }}
                    >👍 좋아함</button>
                    <button
                      onClick={() => setPrefType("dislike")}
                      style={{
                        padding: "7px 20px", borderRadius: 100, border: "none", fontSize: 13, fontWeight: 600,
                        background: prefType === "dislike" ? "var(--red)" : "transparent",
                        color: prefType === "dislike" ? "#fff" : "var(--text-muted)",
                        cursor: "pointer", transition: "all 0.15s ease",
                      }}
                    >🚫 못먹음</button>
                  </div>

                  {/* 대분류 */}
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>대분류</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {largeCategories.map((cat) => (
                        <button key={cat}
                          onClick={() => { setSelectedLarge(cat === selectedLarge ? "" : cat); setSelectedMedium(""); }}
                          style={{
                            padding: "6px 16px", borderRadius: 100, fontSize: 13, fontWeight: 500,
                            border: selectedLarge === cat ? "2px solid var(--accent)" : "1.5px solid var(--border)",
                            background: selectedLarge === cat ? "var(--accent-soft)" : "transparent",
                            color: selectedLarge === cat ? "var(--accent)" : "var(--text)",
                            cursor: "pointer", transition: "all 0.15s ease",
                          }}
                        >{cat}</button>
                      ))}
                    </div>
                  </div>

                  {/* 중분류 */}
                  {selectedLarge && (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>중분류</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {mediumCategories.map((cat) => (
                          <button key={cat}
                            onClick={() => setSelectedMedium(cat === selectedMedium ? "" : cat)}
                            style={{
                              padding: "6px 16px", borderRadius: 100, fontSize: 13, fontWeight: 500,
                              border: selectedMedium === cat ? "2px solid var(--accent)" : "1.5px solid var(--border)",
                              background: selectedMedium === cat ? "var(--accent-soft)" : "transparent",
                              color: selectedMedium === cat ? "var(--accent)" : "var(--text)",
                              cursor: "pointer", transition: "all 0.15s ease",
                            }}
                          >{cat}</button>
                        ))}
                        <button
                          onClick={() => addPreference(selectedLarge)}
                          style={{
                            padding: "6px 16px", borderRadius: 100, fontSize: 13,
                            border: "1.5px dashed var(--border)", background: "transparent",
                            color: "var(--text-muted)", cursor: "pointer",
                          }}
                        >+ {selectedLarge} 전체</button>
                      </div>
                    </div>
                  )}

                  {/* 소분류 메뉴 */}
                  {selectedMedium && (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>메뉴 선택</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 160, overflowY: "auto", paddingRight: 4 }}>
                        {menuItems.map((item) => {
                          const liked = preferences.find((p) => p.food_name === item && p.preference_type === "like");
                          const disliked = preferences.find((p) => p.food_name === item && p.preference_type === "dislike");
                          return (
                            <button key={item}
                              onClick={() => addPreference(item)}
                              style={{
                                padding: "5px 13px", borderRadius: 100, fontSize: 12, fontWeight: 500,
                                border: liked ? "1.5px solid var(--green)" : disliked ? "1.5px solid var(--red)" : "1.5px solid var(--border)",
                                background: liked ? "var(--green-soft)" : disliked ? "var(--red-soft)" : "transparent",
                                color: liked ? "var(--green)" : disliked ? "var(--red)" : "var(--text)",
                                cursor: "pointer", transition: "all 0.1s ease",
                              }}
                            >{item}</button>
                          );
                        })}
                        <button
                          onClick={() => addPreference(selectedMedium)}
                          style={{
                            padding: "5px 13px", borderRadius: 100, fontSize: 12,
                            border: "1.5px dashed var(--border)", background: "transparent",
                            color: "var(--text-muted)", cursor: "pointer",
                          }}
                        >+ {selectedMedium} 전체</button>
                      </div>
                    </div>
                  )}

                  {/* 직접 입력 */}
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>직접 입력</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        placeholder="음식명 입력"
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPreference(customInput); } }}
                        style={{
                          flex: 1, padding: "8px 14px", borderRadius: 100,
                          border: "1.5px solid var(--border)", background: "var(--bg)",
                          fontSize: 13, color: "var(--text)", outline: "none",
                        }}
                        onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
                        onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                      />
                      <button onClick={() => addPreference(customInput)} style={{
                        padding: "8px 18px", borderRadius: 100, border: "none",
                        background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                      }}>등록</button>
                    </div>
                  </div>

                  {/* 등록된 선호도 */}
                  {dislikes.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--red)", marginBottom: 8 }}>🚫 못먹는 음식</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {dislikes.map((p) => (
                          <button key={p.id} onClick={() => removePreference(p.id)}
                            style={{
                              padding: "4px 12px", borderRadius: 100, fontSize: 12, fontWeight: 500,
                              background: "var(--red-soft)", border: "1px solid var(--red)",
                              color: "var(--red)", cursor: "pointer",
                            }}>
                            {p.food_name} ✕
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {likes.length > 0 && (
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--green)", marginBottom: 8 }}>❤️ 좋아하는 음식</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {likes.map((p) => (
                          <button key={p.id} onClick={() => removePreference(p.id)}
                            style={{
                              padding: "4px 12px", borderRadius: 100, fontSize: 12, fontWeight: 500,
                              background: "var(--green-soft)", border: "1px solid var(--green)",
                              color: "var(--green)", cursor: "pointer",
                            }}>
                            {p.food_name} ✕
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {likes.length === 0 && dislikes.length === 0 && (
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>아직 등록된 선호도가 없습니다</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
