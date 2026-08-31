import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { trackApiUsage } from "@/lib/apiTracker";

type Item = {
  title: string; category: string; address: string;
  mapx: string; mapy: string; link: string; distance: number | null;
  /** 카카오는 전화번호를 준다 — 화면에서 눌러 바로 걸 수 있게 넘긴다 */
  phone: string | null;
};

/** 한 번에 받을 수 있는 검색어 개수 */
const MAX_QUERIES = 8;

export async function GET(request: NextRequest) {
  /* 🔴 검색어 하나당 요청 하나였다 — 모임 추천 한 번이 7요청이라 분당 10회 제한에
     바로 걸렸다. 여러 검색어를 한 요청으로 받아 제한을 1회로 센다. */
  const limited = await checkRateLimit(request, "search-kakao", { perMinute: 10, perDay: 100 });
  if (limited) return limited;

  const sp = request.nextUrl.searchParams;
  const single = sp.get("query");
  const multi = sp.get("queries");
  const queries = (multi ? multi.split("|") : single ? [single] : [])
    .map((q) => q.trim()).filter(Boolean).slice(0, MAX_QUERIES);
  const x = sp.get("x");
  const y = sp.get("y");
  const radius = sp.get("radius") || "1000";
  const location = sp.get("location"); // 지역명 (네이버 방식 fallback)
  // 카카오 size 허용 범위 1~15. 미지정 시 5 (모임 추천 화면 기존 동작 유지)
  const size = Math.min(15, Math.max(1, parseInt(sp.get("size") || "5") || 5));
  /* 카카오는 한 검색어에 최대 45곳까지 내준다(size 15 × 3페이지). 페이지를 안 넘기면
     가장 가까운 15곳에서 끝나서, 반경을 1km 로 늘려도 2km 로 늘려도 같은 목록이
     나온다 — 반경이 아니라 페이지가 한계였다. */
  const pages = Math.min(3, Math.max(1, parseInt(sp.get("pages") || "1") || 1));

  if (queries.length === 0) return NextResponse.json({ error: "query required" }, { status: 400 });

  const restKey = process.env.KAKAO_REST_KEY;
  if (!restKey) return NextResponse.json({ error: "Kakao API credentials not configured" }, { status: 500 });

  /* 외부 API 를 실제로 몇 번 불렀나 — 사용량 집계에 쓴다 */
  let calls = queries.length;

  async function runPage(query: string, page: number): Promise<{ items: Item[]; isEnd: boolean; error?: string; status?: number }> {
    // 좌표 있으면 근거리 검색, 없으면 지역명 쿼리 포함
    const searchQuery = (!x || !y) && location ? `${location} ${query} 맛집` : `${query} 맛집`;
    const params = new URLSearchParams({
      query: searchQuery,
      size: String(size),
      page: String(page),
      sort: x && y ? "distance" : "accuracy",
    });
    if (x && y) {
      params.set("x", x);
      params.set("y", y);
      params.set("radius", radius);
    }

    const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${params}`, {
      headers: { Authorization: `KakaoAK ${restKey}` },
    });
    if (!res.ok) return { items: [], isEnd: true, error: await res.text(), status: res.status };

    const data = await res.json();
    const items: Item[] = (data.documents || []).map((d: Record<string, string>) => ({
      title: d.place_name,
      category: d.category_name,
      address: d.road_address_name || d.address_name,
      mapx: d.x,
      mapy: d.y,
      link: d.place_url,
      distance: d.distance ? parseInt(d.distance) : null,
      phone: d.phone || null,
    }));
    return { items, isEnd: !!data.meta?.is_end || items.length < size };
  }

  async function runOne(query: string): Promise<{ items: Item[]; error?: string; status?: number }> {
    const first = await runPage(query, 1);
    if (first.error) return { items: [], error: first.error, status: first.status };
    const out = [...first.items];
    let isEnd = first.isEnd;
    for (let page = 2; page <= pages && !isEnd; page++) {
      const next = await runPage(query, page);
      if (next.error) break; // 뒤 페이지 실패는 앞 페이지 결과를 버릴 이유가 아니다
      out.push(...next.items);
      isEnd = next.isEnd;
      calls++;
    }
    return { items: out };
  }


  const results = await Promise.all(queries.map(runOne));

  const firstErr = results.find((r) => r.error);
  if (firstErr && results.every((r) => r.items.length === 0)) {
    return NextResponse.json({ error: "Kakao API error", detail: firstErr.error }, { status: firstErr.status || 502 });
  }

  const seen = new Set<string>();
  const items = results.flatMap((r) => r.items).filter((it) => {
    const key = (it.title || "") + (it.address || "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (let i = 0; i < calls; i++) trackApiUsage("kakao");
  return NextResponse.json({ items });
}
