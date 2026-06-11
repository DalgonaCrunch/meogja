import { NextResponse } from "next/server";
import { trackApiUsage } from "@/lib/apiTracker";
import { createClient } from "@supabase/supabase-js";

// 25개 음식 키워드 5배치 (DataLab: 최대 5그룹/요청)
const BATCHES = [
  [
    { groupName: "삼겹살", keywords: ["삼겹살"] },
    { groupName: "치킨", keywords: ["치킨", "후라이드치킨"] },
    { groupName: "마라탕", keywords: ["마라탕", "마라샹궈"] },
    { groupName: "떡볶이", keywords: ["떡볶이"] },
    { groupName: "비빔밥", keywords: ["비빔밥"] },
  ],
  [
    { groupName: "라멘", keywords: ["라멘", "라면맛집"] },
    { groupName: "파스타", keywords: ["파스타", "스파게티"] },
    { groupName: "초밥", keywords: ["초밥", "스시"] },
    { groupName: "김치찌개", keywords: ["김치찌개"] },
    { groupName: "피자", keywords: ["피자"] },
  ],
  [
    { groupName: "훠궈", keywords: ["훠궈"] },
    { groupName: "쌀국수", keywords: ["쌀국수", "베트남쌀국수"] },
    { groupName: "삼계탕", keywords: ["삼계탕"] },
    { groupName: "갈비", keywords: ["갈비", "갈비탕"] },
    { groupName: "냉면", keywords: ["냉면"] },
  ],
  [
    { groupName: "국밥", keywords: ["국밥", "순대국밥"] },
    { groupName: "족발", keywords: ["족발", "보쌈"] },
    { groupName: "우동", keywords: ["우동"] },
    { groupName: "짜장면", keywords: ["짜장면", "짜장"] },
    { groupName: "버거", keywords: ["버거", "햄버거"] },
  ],
  [
    { groupName: "브런치", keywords: ["브런치"] },
    { groupName: "오마카세", keywords: ["오마카세"] },
    { groupName: "찜닭", keywords: ["찜닭"] },
    { groupName: "곱창", keywords: ["곱창", "막창"] },
    { groupName: "탕후루", keywords: ["탕후루"] },
  ],
];

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6시간

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function fetchDataLab(): Promise<{ name: string; score: number }[]> {
  const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const scores: { name: string; score: number }[] = [];

  for (const batch of BATCHES) {
    try {
      const res = await fetch("https://openapi.naver.com/v1/datalab/search", {
        method: "POST",
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          timeUnit: "date",
          keywordGroups: batch,
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const result of data.results ?? []) {
        const pts = result.data as { ratio: number }[];
        const avg = pts.reduce((s, d) => s + d.ratio, 0) / (pts.length || 1);
        scores.push({ name: result.title, score: Math.round(avg * 10) / 10 });
      }
    } catch {
      // DataLab 권한 없거나 네트워크 오류 → 무시
    }
  }

  return scores.sort((a, b) => b.score - a.score);
}

export async function GET() {
  const supabase = getSupabaseAdmin();

  // 캐시 확인 (Supabase app_settings)
  const { data: cached } = await supabase
    .from("app_settings")
    .select("value, updated_at")
    .eq("key", "naver_trends_cache")
    .single();

  if (cached?.value && cached?.updated_at) {
    const age = Date.now() - new Date(cached.updated_at).getTime();
    if (age < CACHE_TTL_MS) {
      try {
        return NextResponse.json({ trends: JSON.parse(cached.value), cached: true });
      } catch {
        // 파싱 오류면 재조회
      }
    }
  }

  const trends = await fetchDataLab();

  if (trends.length > 0) {
    await supabase.from("app_settings").upsert(
      { key: "naver_trends_cache", value: JSON.stringify(trends) },
      { onConflict: "key" }
    );
  }

  trackApiUsage("naver_trends");
  return NextResponse.json({ trends, cached: false });
}
