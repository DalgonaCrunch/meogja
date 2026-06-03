"use client";

import { useEffect, useState } from "react";
import { getSupabase, Member, FoodPreference } from "@/lib/supabase";
import { getAllMenuItems, getAllCategories } from "@/lib/recommend";
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
  const [foodInput, setFoodInput] = useState("");
  const [prefType, setPrefType] = useState<"like" | "dislike">("dislike");

  const menuSuggestions = [...getAllCategories(), ...getAllMenuItems()];

  useEffect(() => {
    loadMembers();
  }, []);

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
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    const { data } = await getSupabase()
      .from("food_preferences")
      .select("*")
      .eq("member_id", id)
      .order("preference_type");
    if (data) setPreferences(data);
  }

  async function addPreference() {
    if (!expandedId || !foodInput.trim()) return;
    await getSupabase().from("food_preferences").insert({
      member_id: expandedId,
      food_name: foodInput.trim(),
      preference_type: prefType,
    });
    setFoodInput("");
    const { data } = await getSupabase()
      .from("food_preferences")
      .select("*")
      .eq("member_id", expandedId)
      .order("preference_type");
    if (data) setPreferences(data);
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
        <p className="text-muted-foreground">
          멤버를 추가하고 음식 선호도를 설정하세요
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>새 멤버 추가</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addMember();
            }}
            className="flex gap-2"
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="이름 입력"
            />
            <Button type="submit">추가</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {members.map((m) => (
          <Card key={m.id}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleExpand(m.id)}
                  className="text-lg font-medium hover:underline text-left"
                >
                  {m.name}
                </button>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleExpand(m.id)}
                  >
                    {expandedId === m.id ? "접기" : "선호도 설정"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteMember(m.id)}
                  >
                    삭제
                  </Button>
                </div>
              </div>

              {expandedId === m.id && (
                <div className="mt-4 space-y-4">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label>음식 추가</Label>
                      <Input
                        value={foodInput}
                        onChange={(e) => setFoodInput(e.target.value)}
                        placeholder="음식명 또는 카테고리 (예: 회, 일식)"
                        list="food-suggestions"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addPreference();
                          }
                        }}
                      />
                      <datalist id="food-suggestions">
                        {menuSuggestions.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant={prefType === "like" ? "default" : "outline"}
                        onClick={() => setPrefType("like")}
                      >
                        👍 좋아함
                      </Button>
                      <Button
                        size="sm"
                        variant={prefType === "dislike" ? "default" : "outline"}
                        onClick={() => setPrefType("dislike")}
                      >
                        👎 못먹음
                      </Button>
                    </div>
                    <Button onClick={addPreference}>등록</Button>
                  </div>

                  {dislikes.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-1">
                        🚫 못먹는 음식
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {dislikes.map((p) => (
                          <Badge
                            key={p.id}
                            variant="destructive"
                            className="cursor-pointer"
                            onClick={() => removePreference(p.id)}
                          >
                            {p.food_name} ✕
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {likes.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-1">
                        ❤️ 좋아하는 음식
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {likes.map((p) => (
                          <Badge
                            key={p.id}
                            variant="default"
                            className="cursor-pointer"
                            onClick={() => removePreference(p.id)}
                          >
                            {p.food_name} ✕
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {likes.length === 0 && dislikes.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      아직 등록된 선호도가 없습니다
                    </p>
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
