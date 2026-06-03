"use client";

import { useEffect, useState } from "react";
import { getSupabase, Member, FoodPreference } from "@/lib/supabase";
import {
  getAllLargeCategories,
  getMediumCategories,
  getMenuItems,
} from "@/lib/recommend";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [newName, setNewName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<FoodPreference[]>([]);
  const [prefType, setPrefType] = useState<"like" | "dislike">("like");

  // 3단계 카테고리 선택
  const [selectedLarge, setSelectedLarge] = useState<string>("");
  const [selectedMedium, setSelectedMedium] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [customInput, setCustomInput] = useState<string>("");

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
      .from("food_preferences")
      .select("*")
      .eq("member_id", memberId)
      .order("preference_type");
    if (data) setPreferences(data);
  }

  async function addPreference(foodName: string) {
    if (!expandedId || !foodName.trim()) return;
    const existing = preferences.find(
      (p) => p.food_name === foodName && p.preference_type === prefType
    );
    if (existing) return;
    await getSupabase().from("food_preferences").insert({
      member_id: expandedId,
      food_name: foodName.trim(),
      preference_type: prefType,
    });
    await loadPreferences(expandedId);
    setSelectedItem("");
    setCustomInput("");
  }

  async function removePreference(id: string) {
    await getSupabase().from("food_preferences").delete().eq("id", id);
    setPreferences((prev) => prev.filter((p) => p.id !== id));
  }

  const likes = preferences.filter((p) => p.preference_type === "like");
  const dislikes = preferences.filter((p) => p.preference_type === "dislike");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">멤버 관리</h1>
        <p className="text-muted-foreground">멤버를 추가하고 음식 선호도를 설정하세요</p>
      </div>

      <Card>
        <CardHeader><CardTitle>새 멤버 추가</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); addMember(); }} className="flex gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="이름 입력" />
            <Button type="submit">추가</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {members.map((m) => (
          <Card key={m.id}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-medium">{m.name}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggleExpand(m.id)}>
                    {expandedId === m.id ? "접기" : "선호도 설정"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteMember(m.id)}>삭제</Button>
                </div>
              </div>

              {expandedId === m.id && (
                <div className="mt-4 space-y-5">

                  {/* 좋아함/못먹음 토글 */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPrefType("like")}
                      className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
                        prefType === "like"
                          ? "bg-green-500 text-white border-green-500"
                          : "bg-white text-gray-600 border-gray-300 hover:border-green-400"
                      }`}
                    >
                      👍 좋아함
                    </button>
                    <button
                      onClick={() => setPrefType("dislike")}
                      className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
                        prefType === "dislike"
                          ? "bg-red-500 text-white border-red-500"
                          : "bg-white text-gray-600 border-gray-300 hover:border-red-400"
                      }`}
                    >
                      🚫 못먹음
                    </button>
                  </div>

                  {/* 대분류 */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">대분류</Label>
                    <div className="flex flex-wrap gap-2">
                      {largeCategories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => {
                            setSelectedLarge(cat === selectedLarge ? "" : cat);
                            setSelectedMedium("");
                            setSelectedItem("");
                          }}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                            selectedLarge === cat
                              ? "bg-blue-500 text-white border-blue-500"
                              : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 중분류 */}
                  {selectedLarge && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">중분류</Label>
                      <div className="flex flex-wrap gap-2">
                        {mediumCategories.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => {
                              setSelectedMedium(cat === selectedMedium ? "" : cat);
                              setSelectedItem("");
                            }}
                            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                              selectedMedium === cat
                                ? "bg-blue-500 text-white border-blue-500"
                                : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                        {/* 중분류 자체를 바로 등록 */}
                        {selectedLarge && !selectedMedium && (
                          <button
                            onClick={() => addPreference(selectedLarge)}
                            className="px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-400 text-gray-500 hover:border-blue-400 hover:text-blue-500"
                          >
                            ＋ {selectedLarge} 전체 등록
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 소분류(메뉴) */}
                  {selectedMedium && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">메뉴 선택</Label>
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                        {menuItems.map((item) => {
                          const alreadyLiked = preferences.find(p => p.food_name === item && p.preference_type === "like");
                          const alreadyDisliked = preferences.find(p => p.food_name === item && p.preference_type === "dislike");
                          return (
                            <button
                              key={item}
                              onClick={() => addPreference(item)}
                              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                                alreadyLiked
                                  ? "bg-green-100 border-green-400 text-green-700"
                                  : alreadyDisliked
                                  ? "bg-red-100 border-red-400 text-red-700"
                                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                              }`}
                            >
                              {item}
                            </button>
                          );
                        })}
                        {/* 중분류 전체 등록 */}
                        <button
                          onClick={() => addPreference(selectedMedium)}
                          className="px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-400 text-gray-500 hover:border-blue-400 hover:text-blue-500"
                        >
                          ＋ {selectedMedium} 전체 등록
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 직접 입력 */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">직접 입력</Label>
                    <div className="flex gap-2">
                      <Input
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        placeholder="음식명 직접 입력"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); addPreference(customInput); }
                        }}
                      />
                      <Button onClick={() => addPreference(customInput)}>등록</Button>
                    </div>
                  </div>

                  {/* 등록된 선호도 */}
                  {dislikes.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-1">🚫 못먹는 음식</p>
                      <div className="flex flex-wrap gap-1">
                        {dislikes.map((p) => (
                          <Badge key={p.id} variant="destructive" className="cursor-pointer" onClick={() => removePreference(p.id)}>
                            {p.food_name} ✕
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {likes.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-1">❤️ 좋아하는 음식</p>
                      <div className="flex flex-wrap gap-1">
                        {likes.map((p) => (
                          <Badge key={p.id} className="cursor-pointer bg-green-500 hover:bg-green-600" onClick={() => removePreference(p.id)}>
                            {p.food_name} ✕
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {likes.length === 0 && dislikes.length === 0 && (
                    <p className="text-sm text-muted-foreground">아직 등록된 선호도가 없습니다</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
