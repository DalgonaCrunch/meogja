"use client";

import { useEffect, useState } from "react";
import { getSupabase, Member, FoodPreference } from "@/lib/supabase";
import { getRecommendations } from "@/lib/recommend";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Restaurant = {
  title: string;
  category: string;
  address: string;
  mapx: string;
  mapy: string;
  link: string;
};

type Recommendation = {
  menu: string;
  category: string;
  score: number;
};

export default function Home() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<FoodPreference[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [restaurants, setRestaurants] = useState<Record<string, Restaurant[]>>({});
  const [loading, setLoading] = useState(false);
  const [mapProvider, setMapProvider] = useState<"naver" | "kakao">("naver");
  const [searchingMenu, setSearchingMenu] = useState<string | null>(null);

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    const { data } = await getSupabase().from("members").select("*").order("name");
    if (data) setMembers(data);
  }

  function toggleMember(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleRecommend() {
    if (selected.length === 0) return;
    setLoading(true);
    setRecommendations([]);
    setRestaurants({});

    const { data: prefs } = await getSupabase()
      .from("food_preferences")
      .select("*")
      .in("member_id", selected);

    if (prefs) {
      setPreferences(prefs);
      const recs = getRecommendations(prefs, selected, 5);
      setRecommendations(recs);
    }

    setLoading(false);
  }

  async function searchRestaurants(menu: string) {
    setSearchingMenu(menu);
    const endpoint =
      mapProvider === "naver" ? "/api/search" : "/api/search-kakao";

    const res = await fetch(`${endpoint}?query=${encodeURIComponent(menu)}`);
    const data = await res.json();

    setRestaurants((prev) => ({ ...prev, [menu]: data.items || [] }));
    setSearchingMenu(null);
  }

  const selectedDislikes = preferences
    .filter(
      (p) =>
        selected.includes(p.member_id) && p.preference_type === "dislike"
    )
    .map((p) => p.food_name);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">오늘 뭐 먹지?</h1>
        <p className="text-muted-foreground">
          참가자를 선택하고 메뉴 추천을 받으세요
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>참가자 선택</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-muted-foreground">
              등록된 멤버가 없습니다.{" "}
              <a href="/members" className="underline">
                멤버를 추가
              </a>
              해주세요.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <Checkbox
                    id={m.id}
                    checked={selected.includes(m.id)}
                    onCheckedChange={() => toggleMember(m.id)}
                  />
                  <Label htmlFor={m.id} className="cursor-pointer">
                    {m.name}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected.length > 0 && (
        <div className="flex items-center gap-3">
          <Button onClick={handleRecommend} disabled={loading}>
            {loading ? "추천 중..." : `${selected.length}명으로 추천받기`}
          </Button>
          <div className="flex gap-1">
            <Button
              variant={mapProvider === "naver" ? "default" : "outline"}
              size="sm"
              onClick={() => setMapProvider("naver")}
            >
              네이버
            </Button>
            <Button
              variant={mapProvider === "kakao" ? "default" : "outline"}
              size="sm"
              onClick={() => setMapProvider("kakao")}
            >
              카카오
            </Button>
          </div>
        </div>
      )}

      {selectedDislikes.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-sm text-muted-foreground mr-1">제외 음식:</span>
          {[...new Set(selectedDislikes)].map((food) => (
            <Badge key={food} variant="destructive">
              {food}
            </Badge>
          ))}
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">추천 메뉴</h2>
          {recommendations.map((rec, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-medium">{rec.menu}</span>
                    <Badge variant="secondary">{rec.category}</Badge>
                    {rec.score > 0 && (
                      <Badge>👍 {rec.score}명 좋아함</Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => searchRestaurants(rec.menu)}
                    disabled={searchingMenu === rec.menu}
                  >
                    {searchingMenu === rec.menu
                      ? "검색 중..."
                      : `${mapProvider === "naver" ? "네이버" : "카카오"} 맛집 검색`}
                  </Button>
                </div>

                {restaurants[rec.menu] && (
                  <div className="mt-3 space-y-2">
                    {restaurants[rec.menu].length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        검색 결과가 없습니다
                      </p>
                    ) : (
                      restaurants[rec.menu].map((r, j) => (
                        <div
                          key={j}
                          className="flex items-center justify-between p-2 rounded border"
                        >
                          <div>
                            <a
                              href={r.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium hover:underline"
                            >
                              {r.title}
                            </a>
                            <p className="text-sm text-muted-foreground">
                              {r.address}
                            </p>
                          </div>
                          <a
                            href={
                              mapProvider === "naver"
                                ? `https://map.naver.com/v5/search/${encodeURIComponent(r.title + " " + r.address)}`
                                : `https://map.kakao.com/link/search/${encodeURIComponent(r.title)}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="ghost">
                              🗺️ 지도
                            </Button>
                          </a>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
