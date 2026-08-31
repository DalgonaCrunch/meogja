import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { trackApiUsage } from "@/lib/apiTracker";
import { alertApiFailure } from "@/lib/adminAlert";

type Item = {
  title: string; category: string; address: string;
  mapx: string; mapy: string; link: string; distance: number | null;
  /** 네이버는 telephone 을 주지만 빈 값이 많다 — 있으면 쓴다 */
  phone: string | null;
};

/** 한 번에 받을 수 있는 검색어 개수. 모임 추천은 보통 5~7개를 함께 찾는다. */
const MAX_QUERIES = 8;

export async function GET(request: NextRequest) {
  /* 🔴 예전에는 검색어 하나가 요청 하나였다. 모임 추천은 한 번 누르면 검색어를
     7개 던지므로 분당 10회 제한에 곧바로 걸렸다("1분에 10번까지만" 안내가 뜬다).
     여러 검색어를 한 요청으로 받아 서버에서 병렬로 돌린다 — 제한은 1회로 센다. */
  const limited = await checkRateLimit(request, "search", { perMinute: 10, perDay: 100 });
  if (limited) return limited;

  const sp = request.nextUrl.searchParams;
  const single = sp.get("query");
  const multi = sp.get("queries");
  const queries = (multi ? multi.split("|") : single ? [single] : [])
    .map((q) => q.trim()).filter(Boolean).slice(0, MAX_QUERIES);
  const x = sp.get("x"); // longitude (decimal degrees)
  const y = sp.get("y"); // latitude (decimal degrees)
  const location = sp.get("location"); // 지역명 (ex: 강남역)

  if (queries.length === 0) return NextResponse.json({ error: "query required" }, { status: 400 });

  const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.json({ error: "Naver API credentials not configured" }, { status: 500 });

  const userLng = x ? parseFloat(x) : null;
  const userLat = y ? parseFloat(y) : null;

  async function runOne(query: string): Promise<{ items: Item[]; error?: string; status?: number }> {
    // 지역명이 있으면 쿼리에 포함 (ex: "강남역 한식 맛집")
    const searchQuery = location ? `${location} ${query} 맛집` : `${query} 맛집`;
    const params = new URLSearchParams({ query: searchQuery, display: "5", sort: "comment" });

    const res = await fetch(`https://openapi.naver.com/v1/search/local.json?${params}`, {
      headers: { "X-Naver-Client-Id": clientId!, "X-Naver-Client-Secret": clientSecret! },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      void alertApiFailure("naver_search", res.status, detail);
      return { items: [], error: detail, status: res.status };
    }

    const data = await res.json();
    const items: Item[] = (data.items || []).map((d: Record<string, string>) => {
      // 네이버 mapx/mapy는 * 1e7 형태
      const itemLng = parseInt(d.mapx) / 1e7;
      const itemLat = parseInt(d.mapy) / 1e7;
      let distance: number | null = null;
      if (userLng && userLat && itemLng && itemLat) {
        distance = haversine(userLat, userLng, itemLat, itemLng);
      }
      return {
        /* 네이버는 제목에 <b> 태그와 HTML 엔티티를 함께 준다.
           태그만 걷어내면 "덮밥&amp;짜글이" 처럼 남는다. */
        title: decodeEntities(d.title?.replace(/<[^>]*>/g, "") || ""),
        category: d.category,
        address: d.roadAddress || d.address,
        mapx: d.mapx,
        mapy: d.mapy,
        link: d.link,
        distance,
        phone: d.telephone || null,
      };
    });
    return { items };
  }

  const results = await Promise.all(queries.map(runOne));

  /* 검색어 전부가 실패했을 때만 오류로 돌려준다. 하나라도 결과가 있으면 화면에 보여
     주는 편이 낫다(하나가 0건인 것은 흔한 일이다). */
  const firstErr = results.find((r) => r.error);
  if (firstErr && results.every((r) => r.items.length === 0)) {
    return NextResponse.json({ error: "Naver API error", detail: firstErr.error }, { status: firstErr.status || 502 });
  }

  const seen = new Set<string>();
  const items = results.flatMap((r) => r.items).filter((it) => {
    const key = (it.title || "") + (it.address || "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 거리 정보 있으면 가까운 순 정렬
  if (userLng && userLat) {
    items.sort((a, b) => {
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
      return 0;
    });
  }

  // 실제로 부른 외부 API 횟수만큼 센다
  queries.forEach(() => trackApiUsage("naver_search"));
  return NextResponse.json({ items });
}

function decodeEntities(t: string): string {
  return t
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
